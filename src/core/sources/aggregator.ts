import { SOURCES } from '@/core/sources/registry'
import type { Article, ArticleQuery, NewsSource, SourceCapabilities } from '@/core/sources/types'
import { normalizeSearchText } from '@/utils/normalizeSearchText'

export interface SourceFailure {
  sourceId: string
  reason: string
}

export interface AggregateResult {
  articles: Article[]
  /** One entry per source that threw, so the UI can name what is missing. */
  failures: SourceFailure[]
}

const time = (article: Article) => Date.parse(article.publishedAt) || 0

const reasonOf = (error: unknown) => (error instanceof Error ? error.message : String(error))

/** A date-only bound means the whole day, not its first millisecond. */
function upperBound(value: string): number {
  const parsed = Date.parse(value)
  return /^\d{4}-\d{2}-\d{2}$/.test(value) ? parsed + 86_399_999 : parsed
}

/**
 * Strip the parts of a URL that differ between providers syndicating the same story:
 * host prefix, trailing slash, fragment, campaign params.
 */
function urlKey(url: string): string {
  try {
    const parsed = new URL(url)
    for (const key of [...parsed.searchParams.keys()]) {
      if (/^(utm_|cmp$|ito$|ns_|at_)/i.test(key)) parsed.searchParams.delete(key)
    }
    parsed.searchParams.sort()
    const host = parsed.host.replace(/^www\./, '')
    return `${host}${parsed.pathname.replace(/\/+$/, '')}${parsed.search}`.toLowerCase()
  } catch {
    // Not a parseable URL — fall back to text folding so it still dedupes against itself.
    return normalizeSearchText(url)
  }
}

/** URL first, then title: the same wire story lands under different URLs per provider. */
function dedupe(articles: Article[]): Article[] {
  const seen = new Set<string>()
  return articles.filter((article) => {
    const keys = [`u:${urlKey(article.url)}`]
    const title = normalizeSearchText(article.title)
    if (title) keys.push(`t:${title}`)
    if (keys.some((key) => seen.has(key))) return false
    for (const key of keys) seen.add(key)
    return true
  })
}

/**
 * Apply every filter the source declared it cannot do itself. This is what keeps a
 * capability-poor source (BBC's RSS: no query, no dates, no paging) honest without
 * anyone special-casing it.
 */
function degrade(
  articles: Article[],
  query: ArticleQuery,
  capabilities: SourceCapabilities,
): Article[] {
  let out = articles

  const needle = capabilities.query ? '' : normalizeSearchText(query.q)
  if (needle) {
    out = out.filter((a) =>
      normalizeSearchText(`${a.title} ${a.description} ${a.author ?? ''}`).includes(needle),
    )
  }

  if (!capabilities.dateRange && (query.from || query.to)) {
    const from = query.from ? Date.parse(query.from) : undefined
    const to = query.to ? upperBound(query.to) : undefined
    out = out.filter((a) => {
      const at = time(a)
      return (from === undefined || at >= from) && (to === undefined || at <= to)
    })
  }

  if (!capabilities.category && query.categories?.length) {
    const wanted = new Set(query.categories.map(normalizeSearchText))
    out = out.filter((a) => wanted.has(normalizeSearchText(a.category)))
  }

  if (!capabilities.author && query.authors?.length) {
    const wanted = new Set(query.authors.map(normalizeSearchText))
    out = out.filter((a) => wanted.has(normalizeSearchText(a.author)))
  }

  if (!capabilities.pagination) {
    const start = (query.page - 1) * query.pageSize
    // Sort before slicing: page boundaries are only meaningful on the ordering the
    // feed is presented in. A capable source already paged its own sorted results.
    out = [...out].sort((a, b) => time(b) - time(a)).slice(start, start + query.pageSize)
  }

  return out
}

/**
 * Fan out to the selected available sources, normalize, degrade, dedupe, merge-sort.
 * `allSettled`, never `all`: one dead provider must not blank the feed.
 */
export async function aggregate(
  query: ArticleQuery,
  sources: NewsSource[] = SOURCES,
  signal?: AbortSignal,
): Promise<AggregateResult> {
  const wanted = query.sources?.length ? new Set(query.sources) : null
  const selected = sources.filter((s) => s.available && (!wanted || wanted.has(s.id)))

  const settled = await Promise.allSettled(selected.map((s) => s.fetch(query, signal)))

  // A cancelled request is not four dead providers. Without this, aborting mid-flight — which
  // the debounced search box does on every keystroke — resolves as a success carrying an empty
  // feed and a failure for every source, i.e. "nothing matched" under a banner naming them all.
  // Rethrowing hands the caller a cancellation it can discard, which is what it asked for.
  if (signal?.aborted) throw signal.reason ?? new DOMException('Aborted', 'AbortError')

  const failures: SourceFailure[] = []
  const articles: Article[] = []

  settled.forEach((result, index) => {
    // allSettled preserves order and length, so this index always hits.
    const source = selected[index] as NewsSource
    if (result.status === 'rejected') {
      failures.push({ sourceId: source.id, reason: reasonOf(result.reason) })
      return
    }
    try {
      const normalized = result.value.map((raw) => source.normalize(raw))
      articles.push(...degrade(normalized, query, source.capabilities))
    } catch (error) {
      // A malformed payload must not blank the feed either.
      failures.push({ sourceId: source.id, reason: reasonOf(error) })
    }
  })

  articles.sort((a, b) => time(b) - time(a))

  // Per-source paging only bounds each source's own contribution, so N sources return
  // up to N × pageSize. Trim the merged feed to one page. No offset here: every
  // contribution is already the source's page `query.page`, so re-applying the offset
  // would skip a page's worth of stories.
  return { articles: dedupe(articles).slice(0, query.pageSize), failures }
}

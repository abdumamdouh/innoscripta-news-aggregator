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

  // Applied to every source, capable or not — the one filter that does not trust the provider.
  // The Guardian and NYT search the full article body, so "trump" legitimately returns a
  // headline like "Chinese EV sales surge in Europe" whose match is three paragraphs down and
  // invisible on a card. The provider's own query still runs and still does the useful work of
  // narrowing candidates; this only guarantees that what reaches the grid shows why it is there.
  const needle = normalizeSearchText(query.q)
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
    // Containment, not equality: a byline is often several people — the NYT writes
    // "Tripp Mickle and Cade Metz", the Guardian "Andrew Roth in Washington" — so matching
    // the whole string found nothing for either of them individually.
    const wanted = query.authors.map(normalizeSearchText).filter(Boolean)
    out = out.filter((a) => {
      const byline = normalizeSearchText(a.author)
      return byline ? wanted.some((name) => byline.includes(name)) : false
    })
  }

  // Bound a source that cannot bound itself. BBC returns its whole feed every time, so
  // without this one provider decides how much of the window everyone else gets. Newest
  // first, because a window is the most recent N — not an arbitrary N.
  if (!capabilities.pagination && out.length > query.limit) {
    out = [...out].sort((a, b) => time(b) - time(a)).slice(0, query.limit)
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

  // Every source we tried is down — that is an error, not an empty result set. Resolving it as
  // a success makes "nothing matched your filters" and "you have no network" the same screen,
  // and it overwrites a good cached feed with the empty one on the offline reload that the
  // cache exists to survive. A partial failure still resolves; only a total one throws.
  if (selected.length > 0 && failures.length === selected.length) {
    throw new Error(failures.map((f) => f.reason).join('; '))
  }

  articles.sort((a, b) => time(b) - time(a))

  // The whole merged window, not a page of it. Paging happens over this set, where every
  // article is reachable; slicing here is what made 45 of 54 fetched stories unreachable
  // from any page.
  return { articles: dedupe(articles), failures }
}

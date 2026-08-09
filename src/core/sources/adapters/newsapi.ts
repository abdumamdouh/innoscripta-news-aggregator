import type { Article, ArticleQuery, NewsSource } from '@/core/sources/types'
import {
  description,
  getJson,
  isoDate,
  queryString,
  text,
  url,
} from '@/core/sources/adapters/shared'

const ID = 'newsapi'
const LABEL = 'NewsAPI'

/** NewsAPI rejects `/everything` without a query, so an unfiltered feed needs a term. */
const DEFAULT_QUERY = 'news'
/** Hard ceiling on the free tier; asking for more is a 400, not a bigger page. */
const MAX_PAGE_SIZE = 100

interface NewsApiRaw {
  source?: { id?: string | null; name?: string | null }
  author?: string | null
  title?: string | null
  description?: string | null
  url?: string | null
  urlToImage?: string | null
  publishedAt?: string | null
}

interface NewsApiPayload {
  articles?: NewsApiRaw[]
}

/**
 * Everything NewsAPI can filter on is one text expression, so `q`, categories and
 * authors are composed into it rather than degraded client-side.
 */
function expression(query: ArticleQuery): string {
  const terms = [query.q, ...(query.categories ?? []), ...(query.authors ?? [])]
    .map((term) => text(term))
    .filter((term): term is string => Boolean(term))
    .map((term) => (term.includes(' ') ? `"${term}"` : term))
  return terms.length ? terms.join(' AND ') : DEFAULT_QUERY
}

/**
 * Drop what cannot become a whole `Article`, plus NewsAPI's `[Removed]` tombstones —
 * those carry a title, a description and a url, all of them the literal placeholder.
 */
export function selectItems(payload: NewsApiPayload): NewsApiRaw[] {
  return (payload.articles ?? []).filter(
    (raw) => text(raw.title) && url(raw.url) && isoDate(raw.publishedAt),
  )
}

function normalize(raw: NewsApiRaw): Article {
  return {
    // The url is NewsAPI's only stable per-article identifier — it has no id field.
    id: `${ID}:${raw.url}`,
    title: text(raw.title) ?? '',
    description: description(raw.description),
    url: url(raw.url) ?? '',
    imageUrl: url(raw.urlToImage),
    publishedAt: isoDate(raw.publishedAt) ?? '',
    sourceId: ID,
    sourceLabel: LABEL,
    author: text(raw.author),
    // `/everything` has no section concept — category is folded into `q` instead.
    category: undefined,
    // NewsAPI truncates even its `content` field at ~200 chars — a summary, not a body.
    content: undefined,
  }
}

export const newsapiSource: NewsSource<NewsApiRaw> = {
  id: ID,
  label: LABEL,
  capabilities: { query: true, dateRange: true, category: true, author: true, pagination: true },
  available: true,
  async fetch(query, signal) {
    const search = queryString({
      q: expression(query),
      from: query.from,
      to: query.to,
      page: query.page,
      pageSize: Math.min(query.pageSize, MAX_PAGE_SIZE),
      sortBy: 'publishedAt',
    })
    return selectItems(await getJson<NewsApiPayload>(`/api/newsapi/everything?${search}`, signal))
  },
  normalize,
}

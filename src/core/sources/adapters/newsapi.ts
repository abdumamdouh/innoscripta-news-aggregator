import type { Article, ArticleQuery, NewsSource } from '@/core/sources/types'
import { NEWSAPI_TERMS, isArticleCategory } from '@/core/sources/categories'
import {
  description,
  getJson,
  isoDate,
  queryString,
  text,
  url,
  longerThan,
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
  content?: string | null
  url?: string | null
  urlToImage?: string | null
  publishedAt?: string | null
}

interface NewsApiPayload {
  articles?: NewsApiRaw[]
}

/**
 * The wire item plus the category the search asked for. `/everything` returns no section, so
 * without this the aggregator's category check — which now runs, because the source stops
 * claiming to filter — would discard every NewsAPI article the moment a category is chosen.
 * The same shape the BBC adapter uses, and honest for the same reason: these came back from
 * a search for that subject.
 */
export interface NewsApiItem {
  article: NewsApiRaw
  category?: string
}

/**
 * `/everything` has no taxonomy and no author field — only free text. A category is
 * therefore a search term, which is a far weaker promise than a section filter, so the
 * source declares `category: false` and `author: false` and lets the aggregator check what
 * comes back. Terms are OR-ed, not AND-ed: two preferred categories AND-ed together asked
 * for articles containing both words and returned almost nothing.
 */
/** A date-only bound means the end of that day, not its first instant. */
const endOfDay = (value: string | undefined) =>
  value && /^\d{4}-\d{2}-\d{2}$/.test(value) ? `${value}T23:59:59` : value

function expression(query: ArticleQuery): string {
  const categories = (query.categories ?? [])
    .filter(isArticleCategory)
    .map((category) => NEWSAPI_TERMS[category])
    .filter((term): term is string => Boolean(term))

  const topic = [...categories, ...(query.authors ?? [])]
    .map((term) => text(term))
    .filter((term): term is string => Boolean(term))
    .map((term) => (term.includes(' ') ? `"${term}"` : term))

  const keyword = text(query.q)
  // Parenthesise only when the OR actually needs binding — a lone term reads as itself, and
  // wrapping it would put punctuation into a query that is otherwise the reader's own words.
  const subject = topic.length > 1 ? `(${topic.join(' OR ')})` : (topic[0] ?? '')

  // Keyword AND subject: both narrow, where OR-ing them would widen past what was asked.
  const parts = [keyword, subject].filter(Boolean)
  return parts.length ? parts.join(' AND ') : DEFAULT_QUERY
}

/**
 * Drop what cannot become a whole `Article`, plus NewsAPI's `[Removed]` tombstones —
 * those carry a title, a description and a url, all of them the literal placeholder.
 */
export function selectItems(payload: NewsApiPayload, category?: string): NewsApiItem[] {
  return (payload.articles ?? [])
    .filter((raw) => text(raw.title) && url(raw.url) && isoDate(raw.publishedAt))
    .map((article) => ({ article, category }))
}

function normalize({ article: raw, category }: NewsApiItem): Article {
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
    // What the search asked for: `/everything` returns no section of its own.
    category,
    // NewsAPI truncates `content` at ~200 chars and marks the cut with "[+1234 chars]".
    // Still three times the description, so it is worth showing once the marker is gone.
    content: longerThan(
      text(raw.content)?.replace(/\s*\[\+\d+\s*chars\]\s*$/, ''),
      raw.description,
    ),
  }
}

export const newsapiSource: NewsSource<NewsApiItem> = {
  id: ID,
  label: LABEL,
  capabilities: {
    query: true,
    dateRange: true,
    // Neither is a real filter here — see `expression`. Declaring them false is what makes
    // the aggregator check the results instead of trusting a search term.
    category: false,
    author: false,
    pagination: true,
  },
  available: true,
  async fetch(query, signal) {
    const search = queryString({
      q: expression(query),
      from: query.from,
      // NewsAPI reads a date-only `to` as T00:00:00, which drops the final day the reader
      // asked for. The other providers treat it as the whole day.
      to: endOfDay(query.to),
      page: query.page,
      pageSize: Math.min(query.pageSize, MAX_PAGE_SIZE),
      sortBy: 'publishedAt',
    })
    const payload = await getJson<NewsApiPayload>(`/api/newsapi/everything?${search}`, signal)
    // One category per query in this UI; the first is the one the results answer to.
    return selectItems(payload, query.categories?.[0])
  },
  normalize,
}

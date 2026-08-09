import type { Article } from '@/core/sources/types'
import type { ArticleSort } from '@/features/Articles/types/articles.types'
import { normalizeSearchText } from '@/utils/normalizeSearchText'

const time = (article: Article) => Date.parse(article.publishedAt) || 0

const occurrences = (haystack: string, needle: string) =>
  needle ? haystack.split(needle).length - 1 : 0

/**
 * How well an article answers the term. A hit in the headline is worth more than one in
 * the summary, and both are folded through `normalizeSearchText` so "Météo" scores for
 * "meteo". No term means no ranking signal — relevance then falls back to recency.
 */
export function relevanceScore(article: Article, term: string): number {
  const needle = normalizeSearchText(term)
  if (!needle) return 0
  return (
    occurrences(normalizeSearchText(article.title), needle) * 3 +
    occurrences(normalizeSearchText(article.description), needle)
  )
}

/**
 * Orders the page the providers returned, not the whole result set — none of
 * the four reports a total or accepts "oldest first", so an earlier page cannot be known
 * without walking every page of every provider. Upgrade path: read each provider's
 * `totalResults` in its adapter and fan out properly.
 */
export function sortArticles(articles: Article[], sort: ArticleSort, term = ''): Article[] {
  const sorted = [...articles]
  if (sort === 'oldest') return sorted.sort((a, b) => time(a) - time(b))
  if (sort === 'relevance') {
    return sorted.sort(
      (a, b) => relevanceScore(b, term) - relevanceScore(a, term) || time(b) - time(a),
    )
  }
  return sorted.sort((a, b) => time(b) - time(a))
}

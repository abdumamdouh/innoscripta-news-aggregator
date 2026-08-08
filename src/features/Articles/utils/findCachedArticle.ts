import type { AggregateResult } from '@/core/sources/aggregator'
import type { Article } from '@/core/sources/types'

/**
 * The details page reads the list the reader just came from, not the network. No source
 * adapter can fetch one article by id — ids are composite (`sourceId:providerId`) and
 * `NewsSource.fetch` only speaks page-and-filter — so "already loaded" means "sitting in
 * some cached `['articles', …]` page", and that is what this searches.
 *
 * Takes the entries rather than the QueryClient so it stays a pure lookup.
 */
export function findCachedArticle(
  entries: readonly (readonly [unknown, AggregateResult | undefined])[],
  id: string,
): Article | undefined {
  for (const [, result] of entries) {
    const found = result?.articles.find((article) => article.id === id)
    if (found) return found
  }
  return undefined
}

import { useEffect } from 'react'
import type { AggregateResult } from '@/core/sources/aggregator'
import type { Article } from '@/core/sources/types'
import type { ArticleListCache } from '@/features/Articles/utils/articleListCache'

/** The slice of a `useQuery` result the fallback actually reasons about. */
export interface CacheableQueryState {
  isError: boolean
  /** React Query's "this is the previous key's data" flag — false on any query without it. */
  isPlaceholderData?: boolean
  data?: AggregateResult
}

interface ArticleListCacheSlot {
  read: (key: string) => ArticleListCache | null
  write: (value: ArticleListCache) => void
}

/**
 * "The load failed" is two different shapes: `aggregate` is `allSettled`, so the ordinary
 * offline case resolves with no stories and one failure per source instead of rejecting,
 * and `isError` stays false. Both leave the reader staring at an empty list, so both reach
 * for the cache; a load that returned stories never does, and neither does an honest
 * zero-result filter.
 *
 * Placeholder data is the previous key's list, so it says nothing about this key's load —
 * neither that it failed nor that it succeeded.
 */
export function isFailedLoad(query: CacheableQueryState): boolean {
  if (query.isPlaceholderData) return false
  const emptyAfterFailures = Boolean(
    query.data && !query.data.articles.length && query.data.failures.length,
  )
  return query.isError || emptyAfterFailures
}

/**
 * One list screen's offline fallback: stamp the cache with every list that actually
 * loaded, and hand back the stored one when a load leaves the reader with nothing.
 *
 * `articles` is what the screen renders rather than what the query returned — the
 * directory sorts before it paints, and the cached page should come back in the order the
 * reader last saw it.
 */
export function useArticleListCache(
  cache: ArticleListCacheSlot,
  cacheKey: string,
  query: CacheableQueryState,
  articles: Article[] | undefined,
): ArticleListCache | null {
  const isPlaceholder = Boolean(query.isPlaceholderData)
  useEffect(() => {
    // Only a list with something on it is worth falling back to — and only this key's own
    // list: a placeholder is the *previous* filter's page, already re-keyed to the new one.
    if (articles?.length && !isPlaceholder)
      cache.write({ key: cacheKey, savedAt: new Date().toISOString(), articles })
  }, [cache, articles, cacheKey, isPlaceholder])

  return isFailedLoad(query) ? cache.read(cacheKey) : null
}

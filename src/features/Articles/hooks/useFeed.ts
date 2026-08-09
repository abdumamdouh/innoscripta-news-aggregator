import { hashKey, useQuery } from '@tanstack/react-query'
import { fetchFeed, hasPreferences } from '@/features/Articles/services/feed.service'
import { useArticleActions } from '@/features/Articles/hooks/useArticleActions'
import { useArticleListCache } from '@/features/Articles/hooks/useArticleListCache'
import { feedCache } from '@/features/Articles/utils/articleListCache'
import type { Preferences } from '@/features/Preferences'

/**
 * The feed's fetch, kept out of the page like the directory's and the details'. There is
 * no state layer and no derive layer to compose here: the preferences *are* the query, and
 * the aggregator already filtered, sorted and trimmed. Retry is the same action surface the
 * other two use, so a failed feed recovers in place.
 */
export function useFeed(preferences: Preferences) {
  const ready = hasPreferences(preferences)

  // The preferences object is the whole query — a save re-fetches, nothing else does. The
  // same key stamps the cache, so the fallback is only ever the current selection's own feed.
  const queryKey = ['feed', preferences]
  const cacheKey = hashKey(queryKey)

  const query = useQuery({
    queryKey,
    queryFn: ({ signal }) => fetchFeed(preferences, signal),
    enabled: ready,
  })

  const actions = useArticleActions(query.refetch)

  const articles = query.data?.articles
  const cached = useArticleListCache(feedCache, cacheKey, query, articles)

  return {
    ready,
    articles: articles?.length ? articles : (cached?.articles ?? []),
    // The cached notice already says why the live stories are missing — one message, not two.
    failures: cached ? [] : (query.data?.failures ?? []),
    /** ISO timestamp when the list on screen came from storage rather than the network. */
    cachedAt: cached?.savedAt,
    actions,
    isLoading: query.isLoading,
    isFetching: query.isFetching,
    // Cached stories under a notice beat an error card with nothing behind it.
    isError: query.isError && !cached,
  }
}

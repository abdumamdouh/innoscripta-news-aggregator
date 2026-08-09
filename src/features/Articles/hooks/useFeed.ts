import { useQuery } from '@tanstack/react-query'
import { fetchFeed, hasPreferences } from '@/features/Articles/services/feed.service'
import { QUERY_KEYS } from '@/features/Articles/queryKeys'
import { useArticleActions } from '@/features/Articles/hooks/useArticleActions'
import { useServedFromCache } from '@/features/Articles/hooks/useServedFromCache'
import type { Preferences } from '@/features/Preferences'

/**
 * The feed's fetch, kept out of the page like the directory's and the details'. There is
 * no state layer and no derive layer to compose here: the preferences *are* the query, and
 * the aggregator already filtered, sorted and trimmed. Retry is the same action surface the
 * other two use, so a failed feed recovers in place.
 */
export function useFeed(preferences: Preferences) {
  const ready = hasPreferences(preferences)

  // The preferences object is the whole query — a save re-fetches, nothing else does.
  const query = useQuery({
    queryKey: QUERY_KEYS.feed.forPreferences(preferences),
    queryFn: ({ signal }) => fetchFeed(preferences, signal),
    enabled: ready,
  })

  const actions = useArticleActions(query.refetch)

  const articles = query.data?.articles ?? []
  const servedFromCache = useServedFromCache(query.data, query.dataUpdatedAt)

  return {
    ready,
    articles,
    failures: query.data?.failures ?? [],
    /** ISO timestamp when the list on screen predates this session. */
    cachedAt: servedFromCache ? new Date(query.dataUpdatedAt).toISOString() : undefined,
    actions,
    isLoading: query.isLoading,
    isFetching: query.isFetching,
    // Cached stories under a notice beat an error card with nothing behind it.
    isError: query.isError && !query.data,
  }
}

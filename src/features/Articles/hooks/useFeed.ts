import { useQuery } from '@tanstack/react-query'
import { fetchFeed, hasPreferences } from '@/features/Articles/services/feed.service'
import { useArticleActions } from '@/features/Articles/hooks/useArticleActions'
import type { Preferences } from '@/features/Preferences'

/**
 * The feed's fetch, kept out of the page like the directory's and the details'. There is
 * no state layer and no derive layer to compose here: the preferences *are* the query, and
 * the aggregator already filtered, sorted and trimmed. Retry is the same action surface the
 * other two use, so a failed feed recovers in place.
 */
export function useFeed(preferences: Preferences) {
  const ready = hasPreferences(preferences)

  const query = useQuery({
    // The preferences object is the whole query — a save re-fetches, nothing else does.
    queryKey: ['feed', preferences],
    queryFn: ({ signal }) => fetchFeed(preferences, signal),
    enabled: ready,
  })

  const actions = useArticleActions(query.refetch)

  return {
    ready,
    articles: query.data?.articles ?? [],
    failures: query.data?.failures ?? [],
    actions,
    isLoading: query.isLoading,
    isFetching: query.isFetching,
    isError: query.isError,
  }
}

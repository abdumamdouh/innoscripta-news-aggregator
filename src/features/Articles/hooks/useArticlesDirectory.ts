import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { fetchArticles, toArticleQuery } from '@/features/Articles/services/articles.service'
import { QUERY_KEYS } from '@/features/Articles/queryKeys'
import { useArticleActions } from '@/features/Articles/hooks/useArticleActions'
import { useArticleList } from '@/features/Articles/hooks/useArticleList'
import { useArticlesState } from '@/features/Articles/hooks/useArticlesState'
import { useServedFromCache } from '@/features/Articles/hooks/useServedFromCache'

/**
 * The composition layer, and nothing else: query state, fetch, derive, act. Each of the four
 * does one job — merging them is what makes a list screen unmaintainable.
 *
 * There is no cache layer here any more. The offline fallback used to be a second store this
 * hook consulted and reconciled against the query, with its own key derivation and staleness
 * rules. The client is persisted instead, so a cold start with no network replays the last
 * result through this same `useQuery`.
 */
export function useArticlesDirectory() {
  const { state, term, setTerm, update, reset } = useArticlesState()

  const query = useQuery({
    queryKey: QUERY_KEYS.articles.list(toArticleQuery(state)),
    queryFn: ({ signal }) => fetchArticles(state, signal),
    // Keep the previous page on screen while the next one loads — the grid must not collapse
    // to a skeleton every time someone types a letter.
    placeholderData: keepPreviousData,
  })

  const list = useArticleList(query.data, state)
  const actions = useArticleActions(query.refetch)

  const servedFromCache = useServedFromCache(query.data, query.dataUpdatedAt)

  return {
    state,
    term,
    setTerm,
    update,
    reset,
    list,
    /** ISO timestamp when the grid on screen predates this session. */
    cachedAt: servedFromCache ? new Date(query.dataUpdatedAt).toISOString() : undefined,
    actions,
    isLoading: query.isLoading,
    isFetching: query.isFetching,
    // Cached stories under a notice beat an error card with nothing behind it.
    isError: query.isError && !query.data,
  }
}

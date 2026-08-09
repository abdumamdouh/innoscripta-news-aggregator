import { hashKey, keepPreviousData, useQuery } from '@tanstack/react-query'
import { fetchArticles, toArticleQuery } from '@/features/Articles/services/articles.service'
import { useArticleActions } from '@/features/Articles/hooks/useArticleActions'
import { useArticleList } from '@/features/Articles/hooks/useArticleList'
import { useArticleListCache } from '@/features/Articles/hooks/useArticleListCache'
import { useArticlesState } from '@/features/Articles/hooks/useArticlesState'
import { directoryCache } from '@/features/Articles/utils/articleListCache'

/**
 * The composition layer, and nothing else: query state, fetch, derive, act. Each of the
 * four does one job — merging them is what makes a list screen unmaintainable.
 *
 * The fifth thing it does is the same offline fallback the feed has (`useArticleListCache`):
 * the last list that loaded under this exact query is kept, so a cold start with no network
 * shows those stories under a dated notice rather than a bare error card.
 */
export function useArticlesDirectory() {
  const { state, term, setTerm, update, reset } = useArticlesState()

  const queryKey = ['articles', toArticleQuery(state)]
  // The same key stamps the cache, so the fallback is only ever this filter set's own page.
  const cacheKey = hashKey(queryKey)

  const query = useQuery({
    queryKey,
    queryFn: ({ signal }) => fetchArticles(state, signal),
    // Keep the previous page on screen while the next one loads — the grid must not
    // collapse to a skeleton every time someone types a letter.
    placeholderData: keepPreviousData,
  })

  const list = useArticleList(query.data, state)
  const actions = useArticleActions(query.refetch)

  // The directory's half of the shared fallback — see `useArticleListCache` for the rules.
  const cached = useArticleListCache(directoryCache, cacheKey, query, list.articles)

  return {
    state,
    term,
    setTerm,
    update,
    reset,
    list: cached
      ? {
          articles: cached.articles,
          // The cached notice already says why the live stories are missing — one message.
          failures: [],
          total: cached.articles.length,
          // Nothing was proved about the next page by a load that never landed.
          hasNextPage: false,
          knownPages: state.page,
        }
      : list,
    /** ISO timestamp when the grid on screen came from storage rather than the network. */
    cachedAt: cached?.savedAt,
    actions,
    isLoading: query.isLoading,
    isFetching: query.isFetching,
    // Cached stories under a notice beat an error card with nothing behind it.
    isError: query.isError && !cached,
  }
}

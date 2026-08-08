import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { fetchArticles, toArticleQuery } from '@/features/Articles/services/articles.service'
import { useArticleActions } from '@/features/Articles/hooks/useArticleActions'
import { useArticleList } from '@/features/Articles/hooks/useArticleList'
import { useArticlesState } from '@/features/Articles/hooks/useArticlesState'

/**
 * The composition layer, and nothing else: query state, fetch, derive, act. Each of the
 * four does one job — merging them is what makes a list screen unmaintainable.
 */
export function useArticlesDirectory() {
  const { state, term, setTerm, update, reset } = useArticlesState()

  const query = useQuery({
    queryKey: ['articles', toArticleQuery(state)],
    queryFn: ({ signal }) => fetchArticles(state, signal),
    // Keep the previous page on screen while the next one loads — the grid must not
    // collapse to a skeleton every time someone types a letter.
    placeholderData: keepPreviousData,
  })

  const list = useArticleList(query.data, state)
  const actions = useArticleActions(query.refetch)

  return {
    state,
    term,
    setTerm,
    update,
    reset,
    list,
    actions,
    isLoading: query.isLoading,
    isFetching: query.isFetching,
    isError: query.isError,
  }
}

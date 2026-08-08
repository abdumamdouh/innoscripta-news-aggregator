import { useMemo } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import type { AggregateResult } from '@/core/sources/aggregator'
import { fetchArticles, toArticleQuery } from '@/features/Articles/services/articles.service'
import { useArticleActions } from '@/features/Articles/hooks/useArticleActions'
import { parseArticlesState } from '@/features/Articles/utils/articlesState'
import { findCachedArticle } from '@/features/Articles/utils/findCachedArticle'

/**
 * Cache first, network only on a cold load. Arriving from the list means the story is
 * already in a cached `['articles', …]` page, so there is nothing to fetch and no skeleton
 * to flash. A pasted or reloaded URL carries the list's own query string, so the same list
 * query — the same key, so the list is warm on the way back — reconstructs the page.
 */
export function useArticleDetails(articleId: string) {
  const [searchParams] = useSearchParams()
  const client = useQueryClient()

  const state = useMemo(() => parseArticlesState(searchParams), [searchParams])
  // Read once per article: the cache cannot gain this id while we sit on its page.
  const cached = useMemo(
    () =>
      findCachedArticle(
        client.getQueriesData<AggregateResult>({ queryKey: ['articles'] }),
        articleId,
      ),
    [client, articleId],
  )

  const query = useQuery({
    queryKey: ['articles', toArticleQuery(state)],
    queryFn: ({ signal }) => fetchArticles(state, signal),
    enabled: !cached,
  })

  const article = cached ?? query.data?.articles.find((entry) => entry.id === articleId)
  // Same retry surface as the list, so a failed cold load is recoverable in place.
  const actions = useArticleActions(query.refetch)

  return { article, actions, isLoading: !cached && query.isLoading, isError: query.isError }
}

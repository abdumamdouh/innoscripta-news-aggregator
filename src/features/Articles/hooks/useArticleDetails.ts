import { useMemo } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import type { AggregateResult } from '@/core/sources/aggregator'
import { fetchArticles, toArticleQuery } from '@/features/Articles/services/articles.service'
import { useArticleActions } from '@/features/Articles/hooks/useArticleActions'
import { parseArticlesState } from '@/features/Articles/utils/articlesState'
import { findBookmarkedArticle, readBookmarks } from '@/features/Articles/utils/bookmarks'
import { findCachedArticle } from '@/features/Articles/utils/findCachedArticle'

/**
 * Cache first, then a saved copy, network only on a cold load. Arriving from the list means
 * the story is already in a cached `['articles', …]` page, so there is nothing to fetch and
 * no skeleton to flash. A pasted or reloaded URL carries the list's own query string, so the
 * same list query — the same key, so the list is warm on the way back — reconstructs the page.
 *
 * A bare permalink carries no query string, so it can only ever resolve against the default
 * first page, and a story drifts off that as the feed moves. For a bookmarked article the
 * snapshot taken at save time closes that gap; for any other one this still gives up, which
 * is the missing-article card.
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
  // Cached wins: it is the fresher copy of the same story. Read once per article and not
  // subscribed (see `useBookmarks`) on purpose: unsaving the story being read must not pull
  // it off the screen, and on a bare permalink the snapshot is all there is to render from.
  const known = useMemo(
    () => cached ?? findBookmarkedArticle(readBookmarks(), articleId),
    [cached, articleId],
  )

  const query = useQuery({
    queryKey: ['articles', toArticleQuery(state)],
    queryFn: ({ signal }) => fetchArticles(state, signal),
    enabled: !known,
  })

  const article = known ?? query.data?.articles.find((entry) => entry.id === articleId)
  // Same retry surface as the list, so a failed cold load is recoverable in place.
  const actions = useArticleActions(query.refetch)

  return { article, actions, isLoading: !known && query.isLoading, isError: query.isError }
}

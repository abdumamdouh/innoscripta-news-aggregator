import { useMemo, useRef } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import type { AggregateResult } from '@/core/sources/aggregator'
import { fetchArticles, toArticleQuery } from '@/features/Articles/services/articles.service'
import { QUERY_KEYS } from '@/features/Articles/queryKeys'
import { useArticleActions } from '@/features/Articles/hooks/useArticleActions'
import { useBookmarks } from '@/features/Articles/hooks/useBookmarks'
import { parseArticlesState } from '@/features/Articles/utils/articlesState'
import { findBookmarkedArticle } from '@/features/Articles/utils/bookmarks'
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
        client.getQueriesData<AggregateResult>({ queryKey: QUERY_KEYS.articles.root }),
        articleId,
      ),
    [client, articleId],
  )
  // The same saved list the save button writes to, so a save made on this page is readable
  // here in the same breath instead of behind a second, staler parse of storage.
  const saved = useBookmarks()
  // Cached wins: it is the fresher copy of the same story.
  const resolved = useMemo(
    () => cached ?? findBookmarkedArticle(saved, articleId),
    [cached, saved, articleId],
  )
  // Unsaving is not "the story is gone": once a copy has been resolved it stays on screen for
  // as long as this id does, so removing a bookmark on a cold permalink cannot swap the story
  // the reader is looking at for the missing-article card.
  const lastResolved = useRef(resolved)
  if (resolved) lastResolved.current = resolved
  const known =
    resolved ?? (lastResolved.current?.id === articleId ? lastResolved.current : undefined)

  const query = useQuery({
    queryKey: QUERY_KEYS.articles.list(toArticleQuery(state)),
    queryFn: ({ signal }) => fetchArticles(state, signal),
    enabled: !known,
  })

  const article = known ?? query.data?.articles.find((entry) => entry.id === articleId)
  // Same retry surface as the list, so a failed cold load is recoverable in place.
  const actions = useArticleActions(query.refetch)

  return { article, actions, isLoading: !known && query.isLoading, isError: query.isError }
}

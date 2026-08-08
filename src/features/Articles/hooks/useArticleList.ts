import { useMemo } from 'react'
import { appTheme } from '@/config/theme'
import type { AggregateResult } from '@/core/sources/aggregator'
import type { ArticleListView, ArticlesState } from '@/features/Articles/types/articles.types'
import { sortArticles } from '@/features/Articles/utils/sortArticles'

/**
 * Pure derive over the fetched page: order it, and say what is known about paging.
 * It deliberately does not filter — `fetchArticles` already did, capability-aware.
 */
export function useArticleList(
  result: AggregateResult | undefined,
  state: ArticlesState,
): ArticleListView {
  return useMemo(() => {
    const fetched = result?.articles ?? []
    const hasNextPage = fetched.length === appTheme.pageSize
    return {
      articles: sortArticles(fetched, state.sort, state.q),
      failures: result?.failures ?? [],
      hasNextPage,
      knownPages: state.page + (hasNextPage ? 1 : 0),
    }
  }, [result, state.sort, state.q, state.page])
}

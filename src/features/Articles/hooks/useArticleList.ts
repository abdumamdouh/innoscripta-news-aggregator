import { useMemo } from 'react'
import { appTheme } from '@/config/theme'
import type { AggregateResult } from '@/core/sources/aggregator'
import type { ArticleListView, ArticlesState } from '@/features/Articles/types/articles.types'
import { sortArticles } from '@/features/Articles/utils/sortArticles'

/**
 * Order the merged window and cut the requested page out of it.
 *
 * Paging belongs here because here is the only place the whole result set exists. Asking each
 * provider for "page N" and merging the answers never worked: they disagree on page size, so
 * four page-1s came back holding far more than one page, everything past the first nine was
 * dropped, and page 2 asked each source for *its* page 2 — so those stories were unreachable
 * from any page at all. `hasNextPage` was "did we get a full page?", which was always true, so
 * the pager offered one more page forever.
 *
 * Sorting before slicing matters: a page boundary only means anything on the order the reader
 * is actually looking at.
 */
export function useArticleList(
  result: AggregateResult | undefined,
  state: ArticlesState,
): ArticleListView {
  return useMemo(() => {
    const all = sortArticles(result?.articles ?? [], state.sort, state.q)

    const totalPages = Math.max(1, Math.ceil(all.length / appTheme.pageSize))
    // A filter change can leave the reader past the end; clamp rather than show nothing.
    const page = Math.min(Math.max(state.page, 1), totalPages)
    const start = (page - 1) * appTheme.pageSize

    return {
      articles: all.slice(start, start + appTheme.pageSize),
      failures: result?.failures ?? [],
      total: all.length,
      hasNextPage: page < totalPages,
      knownPages: totalPages,
    }
  }, [result, state.sort, state.q, state.page])
}

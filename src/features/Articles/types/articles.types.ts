import type { SourceFailure } from '@/core/sources/aggregator'
import type { Article } from '@/core/sources/types'

export const ARTICLE_SORTS = ['newest', 'oldest', 'relevance'] as const
export type ArticleSort = (typeof ARTICLE_SORTS)[number]

/**
 * Everything the list screen remembers. One flat object because it is also the URL:
 * a field here is a query parameter there, and nothing else is.
 */
export interface ArticlesState {
  q: string
  /** `YYYY-MM-DD`, inclusive. */
  from: string
  /** `YYYY-MM-DD`, inclusive. */
  to: string
  /** Empty means every category. */
  category: string
  /** Empty means every author. */
  author: string
  /** Empty means every available source. */
  sources: string[]
  sort: ArticleSort
  page: number
}

/** What `useArticleList` derives from a fetched page. */
export interface ArticleListView {
  articles: Article[]
  failures: SourceFailure[]
  /** A full page back means there is at least one more. Providers report no usable total. */
  hasNextPage: boolean
  /** Pages we can prove exist: the ones already walked, plus the next if there is one. */
  knownPages: number
}

import { SOURCES } from '@/core/sources/registry'
import type { ArticlesState } from '@/features/Articles/types/articles.types'

/** Sources a reader can actually pick. Unavailable ones have nothing to contribute. */
export const SELECTABLE_SOURCES = SOURCES.filter((source) => source.available)

export const DEFAULT_ARTICLES_STATE: ArticlesState = {
  q: '',
  from: '',
  to: '',
  category: '',
  author: '',
  sources: [],
  sort: 'newest',
  page: 1,
}

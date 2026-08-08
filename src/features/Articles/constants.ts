import { BBC_CATEGORIES } from '@/core/sources/adapters/bbc-rss'
import { SOURCES } from '@/core/sources/registry'
import type { ArticlesState } from '@/features/Articles/types/articles.types'

/**
 * The one taxonomy the four providers can agree on. BBC serves a category as a whole
 * feed URL, so its slugs are the only ones that have to match exactly — Guardian
 * `section` and NYT `section_name` accept the same words. Re-exported rather than
 * retyped so the two lists cannot drift.
 */
export const ARTICLE_CATEGORIES: readonly string[] = BBC_CATEGORIES

/** Sources a reader can actually pick. Unavailable ones have nothing to contribute. */
export const SELECTABLE_SOURCES = SOURCES.filter((source) => source.available)

export const SOURCE_LABELS: Record<string, string> = Object.fromEntries(
  SOURCES.map((source) => [source.id, source.label]),
)

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

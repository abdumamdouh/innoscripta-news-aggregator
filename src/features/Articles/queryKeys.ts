import type { ArticleQuery } from '@/core/sources/types'
import type { Preferences } from '@/features/Preferences'

/**
 * Every cache key the app uses, in one place.
 *
 * A key written inline is a string literal that TanStack matches structurally: the fetch
 * writes `['articles', …]`, an invalidation somewhere else types `['article', …]`, and the
 * cache quietly never updates. Nothing fails, nothing warns. Naming them here makes the typo
 * a compile error and makes "what invalidates this?" answerable by reading one file.
 *
 * The roots are exported separately so a partial match — invalidate every article query
 * whatever its filters — is spelled the same way as an exact one.
 */
export const QUERY_KEYS = {
  articles: {
    root: ['articles'] as const,
    list: (query: ArticleQuery) => ['articles', query] as const,
  },
  feed: {
    root: ['feed'] as const,
    forPreferences: (preferences: Preferences) => ['feed', preferences] as const,
  },
} as const

export type ArticlesListKey = ReturnType<typeof QUERY_KEYS.articles.list>
export type FeedKey = ReturnType<typeof QUERY_KEYS.feed.forPreferences>

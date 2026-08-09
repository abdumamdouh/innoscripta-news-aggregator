import { appTheme } from '@/config/theme'
import { aggregate } from '@/core/sources/aggregator'
import type { AggregateResult } from '@/core/sources/aggregator'
import { SOURCES } from '@/core/sources/registry'
import type { ArticleQuery, NewsSource } from '@/core/sources/types'
import type { Preferences } from '@/features/Preferences'

/**
 * Preferences → the one query shape the sources understand. Deliberately not
 * `toArticleQuery`: that one maps the directory's single-value category/author, while a
 * reader may prefer several of each. Every dimension the reader left empty stays absent —
 * "no preference there" widens the feed, it never blanks it (see `preferences.types.ts`).
 *
 * Page 1 only. The feed is a "what is new for me" glance, not a second
 * directory — add paging the day someone asks to scroll past nine stories.
 */
export function toFeedQuery(preferences: Preferences): ArticleQuery {
  return {
    categories: preferences.categories.length ? preferences.categories : undefined,
    authors: preferences.authors.length ? preferences.authors : undefined,
    sources: preferences.sources.length ? preferences.sources : undefined,
    page: 1,
    pageSize: appTheme.pageSize,
  }
}

/**
 * Nothing chosen in any dimension. An unfiltered query would be the article list again,
 * so the feed asks for preferences instead of pretending it has some.
 */
export const hasPreferences = (preferences: Preferences): boolean =>
  Boolean(preferences.sources.length || preferences.categories.length || preferences.authors.length)

/** Same contract as `fetchArticles`: the aggregator filters, capability by capability. */
export function fetchFeed(
  preferences: Preferences,
  signal?: AbortSignal,
  sources: NewsSource[] = SOURCES,
): Promise<AggregateResult> {
  return aggregate(toFeedQuery(preferences), sources, signal)
}

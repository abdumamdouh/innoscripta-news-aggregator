import { BBC_CATEGORIES, bbcNewsSource } from '@/core/sources/adapters/bbc-rss'
import { guardianSource } from '@/core/sources/adapters/guardian'
import { newsCredSource } from '@/core/sources/adapters/newscred.unavailable'
import { newsapiSource } from '@/core/sources/adapters/newsapi'
import { nytSource } from '@/core/sources/adapters/nyt'
import { openNewsSource } from '@/core/sources/adapters/opennews.unavailable'
import type { NewsSource } from '@/core/sources/types'

/**
 * The only file that changes when a source is added: one import, one entry.
 * Unavailable sources stay listed — the UI shows them disabled with their reason.
 */
export const SOURCES: NewsSource[] = [
  newsapiSource,
  guardianSource,
  nytSource,
  bbcNewsSource,
  openNewsSource,
  newsCredSource,
]

/**
 * The one taxonomy the four reachable providers can agree on. BBC serves a category as a
 * whole feed URL, so its slugs are the only ones that have to match exactly — Guardian
 * `section` and NYT `section_name` accept the same words. Re-exported rather than retyped
 * so the two lists cannot drift.
 *
 * Lives beside the registry, not in a feature: filters and preferences both pick from it.
 */
export const ARTICLE_CATEGORIES: readonly string[] = BBC_CATEGORIES

/** Source id → display label, for the places that hold an id and need a name. */
export const SOURCE_LABELS: Record<string, string> = Object.fromEntries(
  SOURCES.map((source) => [source.id, source.label]),
)

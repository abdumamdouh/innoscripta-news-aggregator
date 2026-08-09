import { appTheme } from '@/config/theme'
import type { Article } from '@/core/sources/types'
import { createLocalStorageStore } from '@/utils/localStorageStore'

/**
 * The last feed that actually loaded, kept so a cold start with no network shows the
 * reader yesterday's stories under a clear notice instead of an empty page.
 *
 * ponytail: one slot, not keyed by preferences — the feed is a single "what is new for me"
 * list, so there is only ever one to fall back to. Key it the day the feed grows tabs.
 */
export interface FeedCache {
  /** ISO timestamp of the fetch, which is what the notice puts in front of the reader. */
  savedAt: string
  articles: Article[]
}

/** Every field the grid renders without guarding — an entry missing one is not renderable. */
const requiredArticleFields = [
  'id',
  'title',
  'description',
  'url',
  'publishedAt',
  'sourceId',
  'sourceLabel',
] as const satisfies readonly (keyof Article)[]

const isArticle = (value: unknown): value is Article =>
  Boolean(value) &&
  typeof value === 'object' &&
  requiredArticleFields.every(
    (field) => typeof (value as Record<string, unknown>)[field] === 'string',
  )

/**
 * Total by contract (see `createLocalStorageStore`): anything unreadable, stale-shaped or
 * empty reads as "no cache", because a half-parsed feed on screen is worse than none.
 */
export function parseFeedCache(raw: string | null): FeedCache | null {
  try {
    const parsed: unknown = JSON.parse(raw ?? 'null')
    if (!parsed || typeof parsed !== 'object') return null
    const { savedAt, articles } = parsed as { savedAt?: unknown; articles?: unknown }
    if (typeof savedAt !== 'string' || Number.isNaN(Date.parse(savedAt))) return null
    // An empty cache is nothing to fall back to — it would read as "your feed is empty".
    if (!Array.isArray(articles) || !articles.length || !articles.every(isArticle)) return null
    return { savedAt, articles }
  } catch {
    return null
  }
}

const store = createLocalStorageStore(appTheme.storageKeys.feedCache, parseFeedCache)

export const readFeedCache = store.read
export const writeFeedCache = store.write

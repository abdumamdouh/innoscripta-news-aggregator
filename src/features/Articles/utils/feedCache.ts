import { appTheme } from '@/config/theme'
import type { Article } from '@/core/sources/types'
import { createLocalStorageStore } from '@/utils/localStorageStore'

/**
 * The last feed that actually loaded, kept so a cold start with no network shows the
 * reader yesterday's stories under a clear notice instead of an empty page.
 *
 * ponytail: still one slot, but stamped with the query key it was fetched under — a reader
 * who changes preferences and then loses the network gets no notice rather than the old
 * set's stories under one. Keep N slots the day the feed grows tabs worth switching between.
 */
export interface FeedCache {
  /**
   * Identity of the fetch that produced it — the caller's query key, hashed. Anything but
   * an exact match is another reader's feed as far as the notice is concerned.
   */
  key: string
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
    const { key, savedAt, articles } = parsed as {
      key?: unknown
      savedAt?: unknown
      articles?: unknown
    }
    // Unstamped means written before the feed was keyed — it belongs to no known selection.
    if (typeof key !== 'string' || !key) return null
    if (typeof savedAt !== 'string' || Number.isNaN(Date.parse(savedAt))) return null
    // An empty cache is nothing to fall back to — it would read as "your feed is empty".
    if (!Array.isArray(articles) || !articles.length || !articles.every(isArticle)) return null
    return { key, savedAt, articles }
  } catch {
    return null
  }
}

const store = createLocalStorageStore(appTheme.storageKeys.feedCache, parseFeedCache)

/** The cache only for the key that wrote it — a stamp from another selection reads as none. */
export const readFeedCache = (key: string): FeedCache | null => {
  const cache = store.read()
  return cache?.key === key ? cache : null
}

export const writeFeedCache = store.write

import { appTheme } from '@/config/theme'
import type { Article } from '@/core/sources/types'
import { createLocalStorageStore } from '@/utils/localStorageStore'

/**
 * The last article list that actually loaded, kept so a cold start with no network shows
 * the reader yesterday's stories under a clear notice instead of an empty page.
 *
 * ponytail: one slot per screen, each stamped with the query key it was fetched under — a
 * reader who changes preferences or filters and then loses the network gets no notice
 * rather than the old set's stories under one. Keep N slots per screen the day a list
 * grows tabs worth switching between.
 */
export interface ArticleListCache {
  /**
   * Identity of the fetch that produced it — the caller's query key, hashed. Anything but
   * an exact match is another selection's list as far as the notice is concerned.
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
 * empty reads as "no cache", because a half-parsed list on screen is worse than none.
 */
export function parseArticleListCache(raw: string | null): ArticleListCache | null {
  try {
    const parsed: unknown = JSON.parse(raw ?? 'null')
    if (!parsed || typeof parsed !== 'object') return null
    const { key, savedAt, articles } = parsed as {
      key?: unknown
      savedAt?: unknown
      articles?: unknown
    }
    // Unstamped means written before the list was keyed — it belongs to no known selection.
    if (typeof key !== 'string' || !key) return null
    if (typeof savedAt !== 'string' || Number.isNaN(Date.parse(savedAt))) return null
    // An empty cache is nothing to fall back to — it would read as "there is nothing here".
    if (!Array.isArray(articles) || !articles.length || !articles.every(isArticle)) return null
    return { key, savedAt, articles }
  } catch {
    return null
  }
}

/**
 * One cache per list screen. They share the parse and the exact-key rule but never the
 * slot: the feed and the directory would otherwise evict each other on every visit, and
 * whichever screen was offline would find the other one's stories waiting for it.
 */
function createArticleListCache(storageKey: string) {
  const store = createLocalStorageStore(storageKey, parseArticleListCache)
  return {
    /** The cache only for the key that wrote it — a stamp from another selection reads as none. */
    read: (key: string): ArticleListCache | null => {
      const cache = store.read()
      return cache?.key === key ? cache : null
    },
    write: store.write,
  }
}

export const feedCache = createArticleListCache(appTheme.storageKeys.feedCache)
export const directoryCache = createArticleListCache(appTheme.storageKeys.directoryCache)

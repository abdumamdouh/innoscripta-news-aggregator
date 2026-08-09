import { appTheme } from '@/config/theme'
import type { Article } from '@/core/sources/types'
import { createLocalStorageStore } from '@/utils/localStorageStore'

/**
 * A saved article keeps a copy of the story, not just its id. No adapter can fetch one
 * article by id (see `findCachedArticle`), so an id alone stops resolving the moment the
 * story falls off the page the reader saved it from — the snapshot is what makes a
 * bookmark's permalink survive that.
 */
export interface Bookmark {
  id: string
  /** Absent for entries saved by the earlier id-only shape — those stay id-only. */
  article?: Article
}

/** Every field the details page renders without guarding — a snapshot missing one is unusable. */
const requiredArticleFields = [
  'id',
  'title',
  'description',
  'url',
  'publishedAt',
  'sourceId',
  'sourceLabel',
] as const satisfies readonly (keyof Article)[]

const asArticle = (value: unknown, id: string): Article | undefined => {
  if (!value || typeof value !== 'object') return undefined
  const candidate = value as Record<string, unknown>
  if (candidate.id !== id) return undefined
  if (requiredArticleFields.some((field) => typeof candidate[field] !== 'string')) return undefined
  // Shape check only; a bad date string still renders as-is, tighten if that shows up.
  return value as Article
}

const asBookmark = (entry: unknown): Bookmark | undefined => {
  if (typeof entry === 'string') return { id: entry }
  if (entry && typeof entry === 'object') {
    const { id, article } = entry as { id?: unknown; article?: unknown }
    if (typeof id === 'string') {
      const snapshot = asArticle(article, id)
      return snapshot ? { id, article: snapshot } : { id }
    }
  }
  return undefined
}

export function parseBookmarks(raw: string | null): Bookmark[] {
  try {
    const parsed: unknown = JSON.parse(raw ?? '[]')
    if (!Array.isArray(parsed)) return []
    return parsed.map(asBookmark).filter((bookmark): bookmark is Bookmark => bookmark !== undefined)
  } catch {
    // A corrupt entry is not worth a broken page — it reads as "nothing saved yet".
    return []
  }
}

export const isBookmarked = (bookmarks: readonly Bookmark[], id: string) =>
  bookmarks.some((bookmark) => bookmark.id === id)

export const removeBookmark = (bookmarks: readonly Bookmark[], id: string): Bookmark[] =>
  bookmarks.filter((bookmark) => bookmark.id !== id)

/** Add or drop, order preserved so the newest save lands last. */
export function toggleBookmark(bookmarks: readonly Bookmark[], article: Article): Bookmark[] {
  return isBookmarked(bookmarks, article.id)
    ? removeBookmark(bookmarks, article.id)
    : [...bookmarks, { id: article.id, article }]
}

/** Flat by shape — an Article is strings and nothing else, so field equality is the whole story. */
const sameArticle = (a: Article, b: Article) =>
  ([...new Set([...Object.keys(a), ...Object.keys(b)])] as (keyof Article)[]).every(
    (field) => a[field] === b[field],
  )

/**
 * Bring a saved entry up to date with the copy on screen: fills in the snapshot an entry
 * saved under the earlier id-only shape lacks, and replaces one the source has since
 * corrected, so a permalink stops serving a story its newsroom has moved on from. Returns
 * the same array when the entry is unsaved or already matches — the save button stays a
 * plain save/unsave, so this never rides along on a click.
 *
 * A snapshot only refreshes while a fresher copy is on screen, which means a cache hit
 * (see `useArticleDetails`) — no adapter can fetch one article by id to check on it, so a
 * bookmark nobody opens from a warm list keeps the copy it has. That is the permalink
 * surviving, which is the point of the snapshot.
 */
export function refreshBookmark(bookmarks: Bookmark[], article: Article): Bookmark[] {
  const existing = bookmarks.find((bookmark) => bookmark.id === article.id)
  if (!existing || (existing.article && sameArticle(existing.article, article))) return bookmarks
  return bookmarks.map((bookmark) =>
    bookmark.id === article.id ? { id: article.id, article } : bookmark,
  )
}

/** The whole point of the snapshot: a permalink resolves from what was saved. */
export const findBookmarkedArticle = (
  bookmarks: readonly Bookmark[],
  id: string,
): Article | undefined => bookmarks.find((bookmark) => bookmark.id === id)?.article

/** One read model over localStorage, shared so two readers in the same page see one list. */
const store = createLocalStorageStore(appTheme.storageKeys.bookmarks, parseBookmarks)

export const readBookmarks = store.read
export const subscribeBookmarks = store.subscribe
export const writeBookmarks = store.write

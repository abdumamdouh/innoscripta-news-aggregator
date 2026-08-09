import { appTheme } from '@/config/theme'
import type { Article } from '@/core/sources/types'

/**
 * A saved article keeps a copy of the story, not just its id. No adapter can fetch one
 * article by id (see `findCachedArticle`), so an id alone stops resolving the moment the
 * story falls off the page the reader saved it from — the snapshot is what makes a
 * bookmark's permalink survive that.
 *
 * A deliberately small precursor to the bookmarks feature (backlog item 9), under the
 * storage key that was already reserved for it. Item 9 extends this shape rather than
 * migrating away from it.
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
  // ponytail: shape check only; a bad date string still renders as-is, tighten if that shows up.
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

/** Add or drop, order preserved so the newest save lands last. */
export function toggleBookmark(bookmarks: readonly Bookmark[], article: Article): Bookmark[] {
  return isBookmarked(bookmarks, article.id)
    ? bookmarks.filter((bookmark) => bookmark.id !== article.id)
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
 * surviving, which is the point of the snapshot; item 9 (reading lists) is where a real
 * store can afford to re-resolve saved stories in bulk.
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

/**
 * localStorage is the one source of truth; this is the read model over it, so two readers
 * in the same page see one list. It exists for identity, not speed: `useSyncExternalStore`
 * (see `useBookmarks`) tears the render down if a snapshot is a fresh array every call, and
 * a reader that re-parses on its own drifts the moment another one writes.
 *
 * Keyed on the raw string rather than invalidated by hand, so a change this module did not
 * make — a cleared store, another tab — still reparses on the next read.
 */
let parsed: { raw: string | null; bookmarks: Bookmark[] } | undefined
/** Shared so the unreadable-storage path is a stable snapshot too, not a new array. */
const noBookmarks: Bookmark[] = []
const listeners = new Set<() => void>()

export function readBookmarks(): Bookmark[] {
  try {
    const raw = localStorage.getItem(appTheme.storageKeys.bookmarks)
    if (!parsed || parsed.raw !== raw) parsed = { raw, bookmarks: parseBookmarks(raw) }
    return parsed.bookmarks
  } catch {
    return noBookmarks
  }
}

/** Returns the unsubscribe, which is the shape `useSyncExternalStore` asks for. */
export function subscribeBookmarks(listener: () => void) {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

export function writeBookmarks(bookmarks: readonly Bookmark[]) {
  try {
    localStorage.setItem(appTheme.storageKeys.bookmarks, JSON.stringify(bookmarks))
  } catch {
    // Private mode / quota: saving is a convenience, never a blocker.
  }
  // After the write, so every reader that wakes up re-reads what was actually stored —
  // and unchanged storage (quota, private mode) is then honestly reported as unchanged.
  readBookmarks()
  listeners.forEach((listener) => listener())
}

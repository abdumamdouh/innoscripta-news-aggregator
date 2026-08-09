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

/**
 * Give an entry saved under the earlier id-only shape the snapshot it lacks, so a
 * pre-existing bookmark's permalink starts resolving without the reader unsaving and
 * re-saving it. Returns the same array when there is nothing to fill in — the save button
 * stays a plain save/unsave, so this never rides along on a click.
 */
export function backfillBookmark(bookmarks: Bookmark[], article: Article): Bookmark[] {
  const existing = bookmarks.find((bookmark) => bookmark.id === article.id)
  if (!existing || existing.article) return bookmarks
  return bookmarks.map((bookmark) =>
    bookmark.id === article.id ? { id: article.id, article } : bookmark,
  )
}

/** The whole point of the snapshot: a permalink resolves from what was saved. */
export const findBookmarkedArticle = (
  bookmarks: readonly Bookmark[],
  id: string,
): Article | undefined => bookmarks.find((bookmark) => bookmark.id === id)?.article

export function readBookmarks(): Bookmark[] {
  try {
    return parseBookmarks(localStorage.getItem(appTheme.storageKeys.bookmarks))
  } catch {
    return []
  }
}

export function writeBookmarks(bookmarks: readonly Bookmark[]) {
  try {
    localStorage.setItem(appTheme.storageKeys.bookmarks, JSON.stringify(bookmarks))
  } catch {
    // Private mode / quota: saving is a convenience, never a blocker.
  }
}

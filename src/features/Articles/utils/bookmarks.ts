import { appTheme } from '@/config/theme'

/**
 * A deliberately small precursor to the bookmarks feature (backlog item 9): a list of
 * article ids under the storage key that was already reserved for it. Item 9 extends this
 * shape rather than migrating away from it.
 */
export function parseBookmarks(raw: string | null): string[] {
  try {
    const parsed = JSON.parse(raw ?? '[]')
    return Array.isArray(parsed) ? parsed.filter((id): id is string => typeof id === 'string') : []
  } catch {
    // A corrupt entry is not worth a broken page — it reads as "nothing saved yet".
    return []
  }
}

/** Add or drop, order preserved so the newest save lands last. */
export function toggleBookmark(ids: readonly string[], id: string): string[] {
  return ids.includes(id) ? ids.filter((entry) => entry !== id) : [...ids, id]
}

export function readBookmarks(): string[] {
  try {
    return parseBookmarks(localStorage.getItem(appTheme.storageKeys.bookmarks))
  } catch {
    return []
  }
}

export function writeBookmarks(ids: readonly string[]) {
  try {
    localStorage.setItem(appTheme.storageKeys.bookmarks, JSON.stringify(ids))
  } catch {
    // Private mode / quota: saving is a convenience, never a blocker.
  }
}

import { appTheme } from '@/config/theme'
import type { ArticlesState } from '@/features/Articles/types/articles.types'
import { sanitizeArticlesState } from '@/features/Articles/utils/articlesState'
import { createLocalStorageStore } from '@/utils/localStorageStore'

/**
 * A preset is a name over the whole filter set — the same object the URL carries, so
 * applying one is `update(preset.state)` and nothing else. Stored whole rather than as a
 * query string because the state is already the shared shape between URL and screen.
 */
export interface SavedSearch {
  id: string
  name: string
  state: ArticlesState
}

const asSearch = (entry: unknown): SavedSearch | undefined => {
  if (!entry || typeof entry !== 'object') return undefined
  const { id, name, state } = entry as Record<string, unknown>
  // A nameless preset has no way to be picked, so it is not a preset.
  if (typeof id !== 'string' || typeof name !== 'string' || !name.trim()) return undefined
  // Storage is a trust boundary too: a hand-edited entry goes through the same gate the URL does.
  return {
    id,
    name,
    state: sanitizeArticlesState(
      state && typeof state === 'object'
        ? (state as Partial<Record<keyof ArticlesState, unknown>>)
        : {},
    ),
  }
}

export function parseSavedSearches(raw: string | null): SavedSearch[] {
  try {
    const parsed: unknown = JSON.parse(raw ?? '[]')
    if (!Array.isArray(parsed)) return []
    return parsed.map(asSearch).filter((search): search is SavedSearch => search !== undefined)
  } catch {
    // A corrupt entry reads as "no presets yet" — never a broken page.
    return []
  }
}

// ponytail: same local id scheme as reading lists — presets never leave this device.
const newId = () => `search-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`

/** Appended, so saving a preset does not reshuffle the ones already in the bar. */
export const createSearch = (
  searches: readonly SavedSearch[],
  name: string,
  state: ArticlesState,
): SavedSearch[] => [...searches, { id: newId(), name: name.trim(), state: { ...state } }]

export const renameSearch = (
  searches: readonly SavedSearch[],
  id: string,
  name: string,
): SavedSearch[] =>
  searches.map((search) => (search.id === id ? { ...search, name: name.trim() } : search))

export const deleteSearch = (searches: readonly SavedSearch[], id: string): SavedSearch[] =>
  searches.filter((search) => search.id !== id)

/** Same read model as `readingLists.ts`: one parse, so every reader on the page agrees. */
const store = createLocalStorageStore(appTheme.storageKeys.savedSearches, parseSavedSearches)

export const readSavedSearches = store.read
export const subscribeSavedSearches = store.subscribe
export const writeSavedSearches = store.write

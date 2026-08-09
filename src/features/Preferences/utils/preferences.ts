import { appTheme } from '@/config/theme'
import type { Preferences } from '@/features/Preferences/types/preferences.types'
import { createLocalStorageStore } from '@/utils/localStorageStore'

/** Shared instance: every "nothing saved" read must be the same snapshot, not a new object. */
export const EMPTY_PREFERENCES: Preferences = { sources: [], categories: [], authors: [] }

const asStrings = (value: unknown): string[] =>
  Array.isArray(value) ? value.filter((entry): entry is string => typeof entry === 'string') : []

export function parsePreferences(raw: string | null): Preferences {
  try {
    const parsed: unknown = JSON.parse(raw ?? 'null')
    if (!parsed || typeof parsed !== 'object') return EMPTY_PREFERENCES
    const { sources, categories, authors } = parsed as Record<string, unknown>

    return {
      sources: asStrings(sources),
      categories: asStrings(categories),
      authors: asStrings(authors),
    }
  } catch {
    // A corrupt entry reads as "nothing chosen yet" — never a broken page.
    return EMPTY_PREFERENCES
  }
}

/** Tick/untick, order preserved so the list does not reshuffle under the reader's cursor. */
export const toggleValue = (values: readonly string[], value: string): string[] =>
  values.includes(value) ? values.filter((entry) => entry !== value) : [...values, value]

/**
 * Authors are typed, not picked: no provider exposes an authors endpoint (see
 * `mergeAuthors`), so the vocabulary is whatever the reader writes. One comma-separated
 * field rather than a tag widget — trimmed, blanks dropped, duplicates collapsed.
 */
export const parseAuthors = (raw: string): string[] => [
  ...new Set(
    raw
      .split(',')
      .map((entry) => entry.trim())
      .filter(Boolean),
  ),
]

export const formatAuthors = (authors: readonly string[]): string => authors.join(', ')

/** Same read model as `bookmarks.ts`, so a save is on screen wherever preferences are read. */
const store = createLocalStorageStore(appTheme.storageKeys.preferences, parsePreferences)

export const readPreferences = store.read
export const subscribePreferences = store.subscribe
export const writePreferences = store.write

import { useSyncExternalStore } from 'react'
import type { SavedSearch } from '@/features/Articles/utils/savedSearches'
import { readSavedSearches, subscribeSavedSearches } from '@/features/Articles/utils/savedSearches'

/** The reader's presets, read through one subscription — same shape as `useReadingLists`. */
export const useSavedSearches = (): SavedSearch[] =>
  useSyncExternalStore(subscribeSavedSearches, readSavedSearches)

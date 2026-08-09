import { useSyncExternalStore } from 'react'
import type { Preferences } from '@/features/Preferences/types/preferences.types'
import { readPreferences, subscribePreferences } from '@/features/Preferences/utils/preferences'

/**
 * The stored preferences, read by everyone through one subscription — so a save in the
 * modal is on screen wherever else they are read within the same page lifecycle.
 */
export const usePreferences = (): Preferences =>
  useSyncExternalStore(subscribePreferences, readPreferences)

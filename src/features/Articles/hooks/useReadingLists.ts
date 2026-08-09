import { useSyncExternalStore } from 'react'
import type { ReadingList } from '@/features/Articles/utils/readingLists'
import { readReadingLists, subscribeReadingLists } from '@/features/Articles/utils/readingLists'

/**
 * The reader's lists, read through one subscription — the same shape `useBookmarks` has, so
 * a list mutation made in a dialog is on screen behind it without a reload.
 */
export const useReadingLists = (): ReadingList[] =>
  useSyncExternalStore(subscribeReadingLists, readReadingLists)

import { useSyncExternalStore } from 'react'
import type { Bookmark } from '@/features/Articles/utils/bookmarks'
import { readBookmarks, subscribeBookmarks } from '@/features/Articles/utils/bookmarks'

/**
 * The saved list, read by everyone through one subscription — so a save made in one place
 * is on screen in another within the same page lifecycle, with no second parse to go stale.
 *
 * `useSyncExternalStore` over a module store, no context and no provider to thread
 * through the tree. Reading lists did not grow into this store — `utils/readingLists.ts` is a
 * sibling store on the same pattern, under its own key, holding list membership by bookmark id
 * (see `useReadingLists`). Keeping them apart means renaming a list never touches a snapshot.
 */
export const useBookmarks = (): Bookmark[] =>
  useSyncExternalStore(subscribeBookmarks, readBookmarks)

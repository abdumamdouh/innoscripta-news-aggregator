import { useCallback, useEffect, useState } from 'react'
import type { Article } from '@/core/sources/types'
import {
  isBookmarked,
  refreshBookmark,
  readBookmarks,
  subscribeBookmarks,
  toggleBookmark,
  writeBookmarks,
} from '@/features/Articles/utils/bookmarks'

/**
 * The saved list as every reader in this page sees it: storage is the copy, and a write
 * anywhere re-reads here. No context, no store — a subscription is the whole of it, and
 * item 9 (reading lists) can add readers without them drifting apart.
 */
export function useBookmarks() {
  const [bookmarks, setBookmarks] = useState(readBookmarks)
  useEffect(() => subscribeBookmarks(() => setBookmarks(readBookmarks())), [])
  return bookmarks
}

/**
 * One article's saved flag. Every write goes through `writeBookmarks`, so it is read back
 * rather than mirrored in state.
 *
 * Takes the whole article, not its id: saving stores a snapshot so the permalink still
 * resolves once the story has fallen off the page it was saved from.
 */
export function useBookmark(article: Article) {
  const bookmarks = useBookmarks()

  // A saved entry catches up with the article on screen: one saved before snapshots existed
  // gains one, and one the source has since corrected takes the newer copy. The button below
  // stays an honest save/unsave either way.
  useEffect(() => {
    const current = readBookmarks()
    const next = refreshBookmark(current, article)
    if (next !== current) writeBookmarks(next)
  }, [article])

  const toggle = useCallback(() => {
    writeBookmarks(toggleBookmark(readBookmarks(), article))
  }, [article])

  return { isBookmarked: isBookmarked(bookmarks, article.id), toggle }
}

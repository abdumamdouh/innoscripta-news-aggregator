import { useCallback, useEffect } from 'react'
import type { Article } from '@/core/sources/types'
import { useBookmarks } from '@/features/Articles/hooks/useBookmarks'
import {
  isBookmarked,
  refreshBookmark,
  readBookmarks,
  toggleBookmark,
  writeBookmarks,
} from '@/features/Articles/utils/bookmarks'

/**
 * ponytail: one article's saved flag, read through the shared `useBookmarks` snapshot rather
 * than a private copy of the list — this hook writes, and every other reader on the page sees
 * it. Item 9 (reading lists) is where a fuller store earns its keep.
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
    // Read at write time, not from the render that scheduled this: another reader may have
    // written since, and the store is the one thing that knows.
    const current = readBookmarks()
    const next = refreshBookmark(current, article)
    if (next !== current) writeBookmarks(next)
  }, [article])

  const toggle = useCallback(() => {
    writeBookmarks(toggleBookmark(readBookmarks(), article))
  }, [article])

  return { isBookmarked: isBookmarked(bookmarks, article.id), toggle }
}

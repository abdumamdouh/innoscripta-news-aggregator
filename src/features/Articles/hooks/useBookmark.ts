import { useCallback, useEffect, useState } from 'react'
import type { Article } from '@/core/sources/types'
import {
  backfillBookmark,
  isBookmarked,
  readBookmarks,
  toggleBookmark,
  writeBookmarks,
} from '@/features/Articles/utils/bookmarks'

/**
 * ponytail: one article's saved flag, backed by localStorage. No context, no store — the
 * details page is the only place that toggles one today. Item 9 (reading lists) is where
 * a shared store earns its keep.
 *
 * Takes the whole article, not its id: saving stores a snapshot so the permalink still
 * resolves once the story has fallen off the page it was saved from.
 */
export function useBookmark(article: Article) {
  const [bookmarks, setBookmarks] = useState(readBookmarks)

  // An entry saved before snapshots existed gains one as soon as the article is on screen,
  // so the button below stays an honest save/unsave.
  useEffect(() => {
    setBookmarks((previous) => {
      const next = backfillBookmark(previous, article)
      if (next !== previous) writeBookmarks(next)
      return next
    })
  }, [article])

  const toggle = useCallback(() => {
    setBookmarks((previous) => {
      const next = toggleBookmark(previous, article)
      writeBookmarks(next)
      return next
    })
  }, [article])

  return { isBookmarked: isBookmarked(bookmarks, article.id), toggle }
}

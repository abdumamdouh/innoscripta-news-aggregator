import { useCallback, useState } from 'react'
import { readBookmarks, toggleBookmark, writeBookmarks } from '@/features/Articles/utils/bookmarks'

/**
 * ponytail: one article's saved flag, backed by localStorage. No context, no store — the
 * details page is the only place that toggles one today. Item 9 (reading lists) is where
 * a shared store earns its keep.
 */
export function useBookmark(articleId: string) {
  const [ids, setIds] = useState(readBookmarks)

  const toggle = useCallback(() => {
    setIds((previous) => {
      const next = toggleBookmark(previous, articleId)
      writeBookmarks(next)
      return next
    })
  }, [articleId])

  return { isBookmarked: ids.includes(articleId), toggle }
}

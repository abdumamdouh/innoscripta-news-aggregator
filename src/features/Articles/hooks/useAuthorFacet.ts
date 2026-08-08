import { useMemo, useRef } from 'react'
import type { Article } from '@/core/sources/types'
import { mergeAuthors } from '@/features/Articles/utils/authorFacet'

/** Remembers the bylines seen across queries, so the dropdown grows rather than narrows. */
export function useAuthorFacet(articles: Article[], selected: string): string[] {
  const seen = useRef<string[]>([])

  return useMemo(() => {
    seen.current = mergeAuthors(seen.current, articles, selected)
    return seen.current
  }, [articles, selected])
}

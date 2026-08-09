import { useEffect, useRef, useState } from 'react'
import type { Article } from '@/core/sources/types'
import { mergeAuthors } from '@/features/Articles/utils/authorFacet'

/**
 * Remembers the bylines seen across queries, so the dropdown grows rather than narrows —
 * an author who appeared on page 1 stays selectable on page 3.
 *
 * The accumulation happens in an effect rather than inside `useMemo`. A memo is a cache React
 * may throw away and recompute, so folding new authors into a ref from inside one is a
 * render-phase mutation that double-counts under StrictMode and concurrent rendering. It
 * happens to be harmless today only because merging is idempotent; that is a property of the
 * current merge function, not something this hook should depend on.
 */
export function useAuthorFacet(articles: Article[], selected: string): string[] {
  const seen = useRef<string[]>([])
  const [authors, setAuthors] = useState<string[]>([])

  useEffect(() => {
    const next = mergeAuthors(seen.current, articles, selected)
    // Same list means same array from `mergeAuthors`, so this settles after one pass
    // instead of scheduling a render on every fetch.
    if (next === seen.current) return

    seen.current = next
    setAuthors(next)
  }, [articles, selected])

  return authors
}

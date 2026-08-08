import { useCallback, useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { appTheme } from '@/config/theme'
import { DEFAULT_ARTICLES_STATE } from '@/features/Articles/constants'
import type { ArticlesState } from '@/features/Articles/types/articles.types'
import { parseArticlesState, toSearchParams } from '@/features/Articles/utils/articlesState'
import { useDebounce } from '@/hooks/useDebounce'

function readSnapshot(): unknown {
  try {
    return JSON.parse(localStorage.getItem(appTheme.storageKeys.directoryState) ?? 'null')
  } catch {
    // A corrupt snapshot is not worth a blank screen — fall through to the defaults.
    return null
  }
}

function writeSnapshot(state: ArticlesState) {
  try {
    localStorage.setItem(appTheme.storageKeys.directoryState, JSON.stringify(state))
  } catch {
    // Private mode / quota. The URL is still the source of truth, so nothing is lost.
  }
}

/**
 * Owns where the query lives: the URL, mirrored into localStorage so a bare `/` restores
 * the last view. Resolution is URL → snapshot → defaults, and every write is `replace`,
 * so typing a search term does not bury the previous page under history entries.
 */
export function useArticlesState() {
  const [searchParams, setSearchParams] = useSearchParams()
  // Read once: after the first render the URL is authoritative and the snapshot is output.
  const [snapshot, setSnapshot] = useState(readSnapshot)

  const state = useMemo(() => parseArticlesState(searchParams, snapshot), [searchParams, snapshot])

  const update = useCallback(
    (patch: Partial<ArticlesState>) => {
      // The snapshot seeds the first view only. Once the user has changed something, an
      // empty URL means "no filters" — otherwise clearing the last filter re-hydrates it.
      setSnapshot(null)
      setSearchParams(
        (previous) => {
          const current = parseArticlesState(previous, snapshot)
          // Any change but paging puts you back on page 1 — page 7 of a new filter is a lie.
          return toSearchParams({ ...current, page: 1, ...patch })
        },
        { replace: true },
      )
    },
    [setSearchParams, snapshot],
  )

  const reset = useCallback(
    () => update({ ...DEFAULT_ARTICLES_STATE, sort: state.sort }),
    [update, state.sort],
  )

  // Raw term drives the input; the debounced one drives the URL and therefore the query.
  const [term, setTerm] = useState(state.q)
  const debouncedTerm = useDebounce(term)

  // A chip removal, a reset or a shared link changes `q` from the outside — follow it here,
  // during render rather than in an effect, so the sync-back below sees the new term in the
  // same pass. In an effect it would still read the old one and re-apply the cleared keyword.
  const [lastQ, setLastQ] = useState(state.q)
  if (lastQ !== state.q) {
    setLastQ(state.q)
    setTerm(state.q)
  }

  useEffect(() => {
    // Only once the debounce has caught up with what is actually in the input.
    if (debouncedTerm === term && debouncedTerm !== state.q) update({ q: debouncedTerm })
  }, [debouncedTerm, term, state.q, update])

  // Canonicalise: a snapshot-resolved or junk-carrying URL is rewritten to what we parsed,
  // so the address bar always shows exactly the state that is rendered.
  const canonical = useMemo(() => toSearchParams(state).toString(), [state])
  useEffect(() => {
    if (canonical !== searchParams.toString()) setSearchParams(canonical, { replace: true })
  }, [canonical, searchParams, setSearchParams])

  useEffect(() => writeSnapshot(state), [state])

  return { state, term, setTerm, update, reset }
}

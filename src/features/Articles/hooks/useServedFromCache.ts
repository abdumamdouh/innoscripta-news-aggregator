import { useRef } from 'react'

/**
 * Whether the list on screen came off disk rather than the wire — the condition for the
 * "showing cached results from …" notice.
 *
 * The obvious signals are both wrong. `isStale` means "due a refetch", so with a short
 * staleTime it fires on data that arrived a second ago. `isFetchedAfterMount` counts a
 * *failed* fetch, which is precisely the offline case: the persisted feed restores, the
 * refetch dies with no network, and the flag flips true — clearing the notice on the one
 * screen that needed it.
 *
 * Comparing timestamps asks the actual question. It also clears itself for free: a
 * successful refetch pushes `dataUpdatedAt` past the mount, and the notice goes away.
 */
export function useServedFromCache(data: unknown, dataUpdatedAt: number) {
  const mountedAt = useRef(Date.now()).current

  return Boolean(data) && dataUpdatedAt > 0 && dataUpdatedAt < mountedAt
}

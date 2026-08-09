import '@/i18n'
import '@/config/themeMode'
import { QueryClient } from '@tanstack/react-query'
import { PersistQueryClientProvider } from '@tanstack/react-query-persist-client'
import { createSyncStoragePersister } from '@tanstack/query-sync-storage-persister'
import { RouterProvider } from 'react-router-dom'
import { ToastProvider, TooltipProvider } from '@/components/common/design-system'
import { appTheme } from '@/config/theme'
import { router } from '@/routes/router'

/** A feed older than this is not worth showing back, even to a reader with no network. */
const CACHE_MAX_AGE = 24 * 60 * 60 * 1000

/**
 * Bump when the shape of a cached `Article` or `ArticleQuery` changes. An upgrading reader
 * has the old shape in storage, and a cold offline start would render it — fields the new
 * cards read simply missing. Discarding one stale feed is the cheap failure; a grid of
 * half-built cards is not.
 */
const CACHE_SCHEMA = 'v2'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 60_000,
      refetchOnWindowFocus: false,
      // A query only rejects when *every* provider failed, so the default three retries mean
      // hammering four rate-limited free APIs while the reader watches a spinner. One retry
      // covers the flaky-connection case; beyond that the honest answer is the error state.
      retry: 1,
      // The persisted copy is a starting point, not an answer. Without this, a cache that now
      // outlives the tab turns `staleTime` into "a reload shows you the news from a minute ago
      // and never asks again" — the cached grid paints instantly either way, but a live one
      // has to be on its way behind it.
      refetchOnMount: 'always',
      // Only a query that outlives the tab is worth writing to storage.
      gcTime: CACHE_MAX_AGE,
    },
  },
})

/**
 * React Query's cache lives in memory, so a reload with no network showed an error card where
 * stories had been a moment earlier. That gap used to be filled by a hand-written localStorage
 * cache: a second store with its own keys, its own staleness rules, and hooks that had to
 * consult both and reconcile them. This is the same behaviour from the library that already
 * owns the cache — one store, keyed the way the queries already are.
 */
const persister = createSyncStoragePersister({
  storage: typeof window === 'undefined' ? undefined : window.localStorage,
  key: appTheme.storageKeys.queryCache,
  // No throttle. The write's only reader is the next cold start, so a reload a few hundred
  // milliseconds after a fetch must already find it on disk — that is exactly the case this
  // whole mechanism exists for. Throttling buys nothing here: there are two queries, not two
  // thousand, and serialising them costs less than the window where the cache is silently empty.
  throttleTime: 0,
})

/** Provider stack only — no markup. */
export default function App() {
  return (
    <PersistQueryClientProvider
      client={queryClient}
      persistOptions={{ persister, maxAge: CACHE_MAX_AGE, buster: CACHE_SCHEMA }}
    >
      <TooltipProvider delayDuration={200}>
        <ToastProvider>
          <RouterProvider router={router} />
        </ToastProvider>
      </TooltipProvider>
    </PersistQueryClientProvider>
  )
}

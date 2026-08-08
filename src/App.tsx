import '@/i18n'
import '@/config/themeMode'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { RouterProvider } from 'react-router-dom'
import { TooltipProvider } from '@/components/common/design-system'
import { router } from '@/routes/router'

const queryClient = new QueryClient({
  defaultOptions: { queries: { staleTime: 60_000, refetchOnWindowFocus: false } },
})

/**
 * Provider stack only — no markup. `ToastProvider` belongs between TooltipProvider and
 * RouterProvider; it ships with backlog item 11 and is not stubbed here.
 */
export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider delayDuration={200}>
        <RouterProvider router={router} />
      </TooltipProvider>
    </QueryClientProvider>
  )
}

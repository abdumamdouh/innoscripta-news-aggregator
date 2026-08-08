import { createBrowserRouter } from 'react-router-dom'
import { AppLayout } from '@/components/layout/AppLayout'
import { NotFoundPage } from '@/routes/NotFoundPage'
import { PlaceholderPage } from '@/routes/PlaceholderPage'
import { RouteErrorPage } from '@/routes/RouteErrorPage'

export const router = createBrowserRouter([
  {
    element: <AppLayout />,
    // Last resort: AppLayout itself threw, so there is no shell left to render into.
    errorElement: <RouteErrorPage />,
    children: [
      {
        // Pathless boundary: page errors replace only the Outlet, keeping Header/Footer.
        errorElement: <RouteErrorPage />,
        children: [
          // Backlog items 5 and 6 replace these two with `...articlesRoutes` spread from
          // `src/features/Articles/index.ts`. The shape here is the shape they slot into.
          { index: true, element: <PlaceholderPage titleKey="nav.articles" /> },
          { path: 'articles/:articleId', element: <PlaceholderPage titleKey="nav.articles" /> },
          { path: '*', element: <NotFoundPage /> },
        ],
      },
    ],
  },
])

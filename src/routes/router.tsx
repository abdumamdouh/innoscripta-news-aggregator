import { createBrowserRouter } from 'react-router-dom'
import { AppLayout } from '@/components/layout/AppLayout'
import { articlesRoutes } from '@/features/Articles'
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
          ...articlesRoutes,
          // Backlog item 6 replaces this last placeholder with the details page.
          { path: 'articles/:articleId', element: <PlaceholderPage titleKey="nav.articles" /> },
          { path: '*', element: <NotFoundPage /> },
        ],
      },
    ],
  },
])

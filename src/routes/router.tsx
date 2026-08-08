import { createBrowserRouter } from 'react-router-dom'
import { AppLayout } from '@/components/layout/AppLayout'
import { articlesRoutes } from '@/features/Articles'
import { NotFoundPage } from '@/routes/NotFoundPage'
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
        children: [...articlesRoutes, { path: '*', element: <NotFoundPage /> }],
      },
    ],
  },
])

import type { RouteObject } from 'react-router-dom'
import { ArticleDetailsPage } from '@/features/Articles/pages/ArticleDetailsPage'
import { ArticlesPage } from '@/features/Articles/pages/ArticlesPage'
import { FeedPage } from '@/features/Articles/pages/FeedPage'

/** The list is the app's front door; the details page and the personal feed hang off it. */
export const articlesRoutes: RouteObject[] = [
  { index: true, element: <ArticlesPage /> },
  { path: 'articles/:articleId', element: <ArticleDetailsPage /> },
  { path: 'feed', element: <FeedPage /> },
]

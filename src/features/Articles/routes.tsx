import type { RouteObject } from 'react-router-dom'
import { ArticleDetailsPage } from '@/features/Articles/pages/ArticleDetailsPage'
import { ArticlesPage } from '@/features/Articles/pages/ArticlesPage'
import { BookmarksPage } from '@/features/Articles/pages/BookmarksPage'
import { FeedPage } from '@/features/Articles/pages/FeedPage'

/** The list is the app's front door; details, the personal feed and the saved page hang off it. */
export const articlesRoutes: RouteObject[] = [
  { index: true, element: <ArticlesPage /> },
  { path: 'articles/:articleId', element: <ArticleDetailsPage /> },
  { path: 'feed', element: <FeedPage /> },
  { path: 'bookmarks', element: <BookmarksPage /> },
]

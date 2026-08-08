import type { RouteObject } from 'react-router-dom'
import { ArticlesPage } from '@/features/Articles/pages/ArticlesPage'

/** The list is the app's front door. The details route arrives with backlog item 6. */
export const articlesRoutes: RouteObject[] = [{ index: true, element: <ArticlesPage /> }]

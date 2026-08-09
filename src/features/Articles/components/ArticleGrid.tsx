import type { ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { AppCard } from '@/components/common/design-system'
import { appTheme } from '@/config/theme'
import type { Article } from '@/core/sources/types'
import { ArticleCard } from '@/features/Articles/components/ArticleCard'

const GRID = 'grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3'

function SkeletonGrid() {
  const { t } = useTranslation()
  return (
    <div className={GRID} role="status" aria-label={t('articles.loading')}>
      {Array.from({ length: appTheme.pageSize }, (_, index) => (
        <AppCard key={index} className="flex flex-col gap-3">
          <div className="aspect-video w-full rounded-lg bg-paper-50 dark:bg-ink-700" />
          <div className="h-4 w-2/3 rounded bg-paper-50 dark:bg-ink-700" />
          <div className="h-15 w-full rounded bg-paper-50 dark:bg-ink-700" />
        </AppCard>
      ))}
    </div>
  )
}

export interface ArticleGridProps {
  articles: Article[]
  isLoading: boolean
  /** Per-card controls. Absent on the list pages, which show the story and nothing else. */
  renderActions?: (article: Article) => ReactNode
}

export function ArticleGrid({ articles, isLoading, renderActions }: ArticleGridProps) {
  const { t } = useTranslation()

  if (isLoading) return <SkeletonGrid />

  if (!articles.length) {
    return (
      <AppCard as="section" className="text-center">
        <h2 className="text-lg font-semibold text-ink-900 dark:text-ink-100">
          {t('articles.empty.title')}
        </h2>
        <p className="mt-2 text-ink-500">{t('articles.empty.body')}</p>
      </AppCard>
    )
  }

  return (
    <ul className={GRID}>
      {articles.map((article) => (
        <li key={article.id}>
          <ArticleCard article={article} actions={renderActions?.(article)} />
        </li>
      ))}
    </ul>
  )
}

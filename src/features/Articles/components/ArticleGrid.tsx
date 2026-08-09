import type { ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { AppEmptyState } from '@/components/common/design-system'
import { appTheme } from '@/config/theme'
import type { Article } from '@/core/sources/types'
import { ArticleCard } from '@/features/Articles/components/ArticleCard'
import { ArticleLead } from '@/features/Articles/components/ArticleLead'
import { SkeletonCard } from '@/features/Articles/components/SkeletonCard'

const GRID = 'grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3'

/** A full page of placeholders, so the grid it becomes is the same size it started. */
function SkeletonGrid() {
  const { t } = useTranslation()
  return (
    <div className={GRID} role="status" aria-label={t('articles.loading')}>
      {Array.from({ length: appTheme.pageSize }, (_, index) => (
        <SkeletonCard key={index} />
      ))}
    </div>
  )
}

export interface ArticleGridProps {
  articles: Article[]
  isLoading: boolean
  /** Per-card controls. Absent on the list pages, which show the story and nothing else. */
  renderActions?: (article: Article) => ReactNode
  /**
   * Give the first story front-page weight. Only true on the first page of a feed — a lead
   * on page 5 is just whichever article happened to land there.
   */
  lead?: boolean
}

export function ArticleGrid({ articles, isLoading, renderActions, lead }: ArticleGridProps) {
  const { t } = useTranslation()

  if (isLoading) return <SkeletonGrid />

  if (!articles.length) {
    return <AppEmptyState title={t('articles.empty.title')} body={t('articles.empty.body')} />
  }

  const [top, ...rest] = articles
  // Per-card controls belong on cards; a saved-articles view passes them and gets no lead.
  const showLead = lead && !renderActions && top

  return (
    <div className="flex flex-col gap-4">
      {showLead && <ArticleLead article={top} />}

      <ul className={GRID}>
        {(showLead ? rest : articles).map((article) => (
          <li key={article.id}>
            <ArticleCard article={article} actions={renderActions?.(article)} />
          </li>
        ))}
      </ul>
    </div>
  )
}

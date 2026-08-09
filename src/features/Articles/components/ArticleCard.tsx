import type { ReactNode } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { AppCard } from '@/components/common/design-system'
import type { Article } from '@/core/sources/types'
import { ArticleDescription } from '@/features/Articles/components/ArticleDescription'
import { SourceBadge } from '@/features/Articles/components/SourceBadge'
import { formatArticleDate } from '@/features/Articles/utils/formatArticleDate'

export interface ArticleCardProps {
  article: Article
  /** Per-card controls, e.g. the saved page's remove and add-to-list. The list pages pass none. */
  actions?: ReactNode
}

export function ArticleCard({ article, actions }: ArticleCardProps) {
  const { i18n } = useTranslation()
  // The list's search, filters and page ride along, so the details page can hand them back.
  const { search } = useLocation()

  return (
    <AppCard as="article" className="motion-card flex h-full flex-col gap-3">
      {article.imageUrl ? (
        <img
          src={article.imageUrl}
          alt=""
          loading="lazy"
          className="aspect-video w-full rounded-lg bg-paper-50 object-cover dark:bg-ink-700"
        />
      ) : (
        // A card with no picture keeps the same silhouette, so the grid stays level.
        <div className="aspect-video w-full rounded-lg bg-paper-50 dark:bg-ink-700" aria-hidden />
      )}

      <div className="flex flex-wrap items-center gap-2">
        <SourceBadge sourceId={article.sourceId} sourceLabel={article.sourceLabel} />
        <time dateTime={article.publishedAt} className="text-xs text-ink-500">
          {formatArticleDate(article.publishedAt, i18n.language)}
        </time>
        {actions && <div className="ms-auto flex items-center gap-1">{actions}</div>}
      </div>

      <h2 className="text-base font-semibold text-ink-900 dark:text-ink-100">
        <Link
          to={{ pathname: `/articles/${encodeURIComponent(article.id)}`, search }}
          // Clamped text cannot take a min-height, so the touch target comes from padding.
          className="line-clamp-3 py-3 hover:text-accent-600 hover:underline lg:py-0"
        >
          {article.title}
        </Link>
      </h2>

      {/* Clamped and floor-height here, so the box keeps its silhouette either way. */}
      <ArticleDescription
        description={article.description}
        className="line-clamp-3 min-h-15 text-sm"
      />

      {article.author && (
        <p className="mt-auto line-clamp-1 text-xs text-ink-500">{article.author}</p>
      )}
    </AppCard>
  )
}

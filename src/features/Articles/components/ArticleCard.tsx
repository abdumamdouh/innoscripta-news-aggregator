import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { AppCard } from '@/components/common/design-system'
import type { Article } from '@/core/sources/types'
import { SourceBadge } from '@/features/Articles/components/SourceBadge'
import { formatArticleDate } from '@/features/Articles/utils/formatArticleDate'
import { cn } from '@/utils/cn'

export function ArticleCard({ article }: { article: Article }) {
  const { t, i18n } = useTranslation()

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
      </div>

      <h2 className="text-base font-semibold text-ink-900 dark:text-ink-100">
        <Link
          to={`/articles/${encodeURIComponent(article.id)}`}
          className="line-clamp-3 hover:text-accent-600 hover:underline"
        >
          {article.title}
        </Link>
      </h2>

      {/*
        An empty description is a legitimate provider answer (item 3 defaults it to ''),
        not a defect — so it gets its own words, and the box keeps its height either way.
      */}
      <p
        className={cn(
          'line-clamp-3 min-h-15 text-sm',
          article.description ? 'text-ink-700 dark:text-ink-300' : 'italic text-ink-500',
        )}
      >
        {article.description || t('articles.noDescription')}
      </p>

      {article.author ? (
        <p className="mt-auto line-clamp-1 text-xs text-ink-500">{article.author}</p>
      ) : null}
    </AppCard>
  )
}

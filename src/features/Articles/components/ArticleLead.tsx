import { Link, useLocation } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { AppCard } from '@/components/common/design-system'
import type { Article } from '@/core/sources/types'
import { ArticleDescription } from '@/features/Articles/components/ArticleDescription'
import { ArticleImage } from '@/features/Articles/components/ArticleImage'
import { SourceBadge } from '@/features/Articles/components/SourceBadge'
import { formatArticleDate } from '@/features/Articles/utils/formatArticleDate'

/**
 * The top story, given the weight a front page gives it: a wide picture beside a headline
 * two steps larger than the cards below. Same data as an `ArticleCard` — only the emphasis
 * differs, which is what stops a grid of nine equal cards reading like a search result.
 *
 * It is the picture for the page, so it loads eagerly while the cards stay lazy.
 */
export function ArticleLead({ article }: { article: Article }) {
  const { t, i18n } = useTranslation()
  const { search } = useLocation()

  return (
    <AppCard as="article" className="motion-card flex flex-col gap-4 lg:flex-row lg:items-start">
      <div className="lg:w-1/2 lg:shrink-0">
        <ArticleImage src={article.imageUrl} priority />
      </div>

      <div className="flex flex-col gap-3 lg:w-1/2">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs font-semibold uppercase tracking-wide text-accent-600">
            {t('articles.lead')}
          </span>
          <SourceBadge sourceId={article.sourceId} sourceLabel={article.sourceLabel} />
          <time dateTime={article.publishedAt} className="text-xs text-ink-500">
            {formatArticleDate(article.publishedAt, i18n.language)}
          </time>
        </div>

        <h2 className="text-2xl font-semibold leading-tight text-ink-900 lg:text-3xl dark:text-ink-100">
          <Link
            to={{ pathname: `/articles/${encodeURIComponent(article.id)}`, search }}
            // Clamped text cannot take a min-height, so the touch target comes from padding.
            className="line-clamp-4 py-3 hover:text-accent-600 hover:underline lg:py-0"
          >
            {article.title}
          </Link>
        </h2>

        <ArticleDescription description={article.description} className="line-clamp-4 text-base" />

        {article.author && <p className="text-sm text-ink-500">{article.author}</p>}
      </div>
    </AppCard>
  )
}

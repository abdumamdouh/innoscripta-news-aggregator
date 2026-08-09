import { Link, useLocation, useParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { ArrowLeft, Bookmark, ExternalLink } from 'lucide-react'
import { AppButton, AppCard, AppIconButton } from '@/components/common/design-system'
import type { Article } from '@/core/sources/types'
import { ArticleDescription } from '@/features/Articles/components/ArticleDescription'
import { SourceBadge } from '@/features/Articles/components/SourceBadge'
import { useArticleDetails } from '@/features/Articles/hooks/useArticleDetails'
import { useBookmark } from '@/features/Articles/hooks/useBookmark'
import { formatArticleDate } from '@/features/Articles/utils/formatArticleDate'
import { cn } from '@/utils/cn'

/** The reader's search, filters and page came along in the URL — hand them straight back. */
function BackLink({ search }: { search: string }) {
  const { t } = useTranslation()
  return (
    <Link
      to={{ pathname: '/', search }}
      className="inline-flex items-center gap-2 text-sm text-ink-700 hover:text-accent-600 hover:underline dark:text-ink-100"
    >
      <ArrowLeft className="size-4 rtl:rotate-180" aria-hidden />
      {t('articles.details.back')}
    </Link>
  )
}

function BookmarkButton({ article }: { article: Article }) {
  const { t } = useTranslation()
  const { isBookmarked, toggle } = useBookmark(article)

  return (
    <AppIconButton
      label={t(isBookmarked ? 'articles.details.unsave' : 'articles.details.save')}
      aria-pressed={isBookmarked}
      onClick={toggle}
    >
      <Bookmark
        className={cn('size-5', isBookmarked && 'fill-current text-accent-600')}
        aria-hidden
      />
    </AppIconButton>
  )
}

export function ArticleDetailsPage() {
  const { t, i18n } = useTranslation()
  const { articleId = '' } = useParams()
  const { search } = useLocation()
  const { article, actions, isLoading, isError } = useArticleDetails(articleId)

  if (isLoading) {
    return (
      // The way back is there from the first frame — a slow cold load must not trap the reader.
      <section className="flex flex-col gap-4">
        <BackLink search={search} />
        <AppCard
          as="section"
          role="status"
          aria-label={t('articles.details.loading')}
          className="flex flex-col gap-4"
        >
          <div className="aspect-video w-full rounded-lg bg-paper-50 dark:bg-ink-700" />
          <div className="h-6 w-2/3 rounded bg-paper-50 dark:bg-ink-700" />
          <div className="h-20 w-full rounded bg-paper-50 dark:bg-ink-700" />
        </AppCard>
      </section>
    )
  }

  // A failed fetch is not a missing article: it says so, and offers the same retry the list does.
  if (isError) {
    return (
      <section className="flex flex-col gap-4">
        <BackLink search={search} />
        <AppCard as="section" className="text-center">
          <h1 className="text-2xl font-semibold text-ink-900 dark:text-ink-100">
            {t('articles.error.title')}
          </h1>
          <p className="mt-2 text-ink-500">{t('articles.error.body')}</p>
          <AppButton
            className="mt-4"
            onClick={() => void actions.retry()}
            disabled={actions.isRetrying}
          >
            {t('articles.error.retry')}
          </AppButton>
        </AppCard>
      </section>
    )
  }

  if (!article) {
    return (
      <section className="flex flex-col gap-4">
        <BackLink search={search} />
        <AppCard as="section" className="text-center">
          <h1 className="text-2xl font-semibold text-ink-900 dark:text-ink-100">
            {t('articles.details.missing.title')}
          </h1>
          <p className="mt-2 text-ink-500">{t('articles.details.missing.body')}</p>
        </AppCard>
      </section>
    )
  }

  return (
    <section className="flex flex-col gap-4">
      <BackLink search={search} />

      <AppCard as="article" className="flex flex-col gap-4">
        {article.imageUrl ? (
          <img
            src={article.imageUrl}
            alt=""
            className="aspect-video w-full rounded-lg bg-paper-50 object-cover dark:bg-ink-700"
          />
        ) : null}

        <div className="flex flex-wrap items-center gap-2">
          <SourceBadge sourceId={article.sourceId} sourceLabel={article.sourceLabel} />
          <time dateTime={article.publishedAt} className="text-xs text-ink-500">
            {formatArticleDate(article.publishedAt, i18n.language)}
          </time>
          <div className="ms-auto">
            <BookmarkButton article={article} />
          </div>
        </div>

        <h1 className="text-2xl font-semibold text-ink-900 dark:text-ink-100">{article.title}</h1>

        {article.author ? <p className="text-sm text-ink-500">{article.author}</p> : null}

        {/*
          The Guardian is the only provider that serves a body; the other three give a summary
          and nothing more. Either way it is the whole text there is, shown in full rather than
          clamped — and `content` is already flattened to text by the adapter, so no markup is
          injected here.
        */}
        {article.content ? (
          <p className="whitespace-pre-line text-base text-ink-700 dark:text-ink-300">
            {article.content}
          </p>
        ) : (
          <ArticleDescription description={article.description} className="text-base" />
        )}

        <a
          href={article.url}
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center gap-2 self-start text-sm font-medium text-accent-600 hover:underline"
        >
          {t('articles.details.readOriginal')}
          <ExternalLink className="size-4" aria-hidden />
        </a>
      </AppCard>
    </section>
  )
}

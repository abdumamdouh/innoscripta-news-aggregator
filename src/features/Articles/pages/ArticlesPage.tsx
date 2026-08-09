import { useTranslation } from 'react-i18next'
import { AppButton, AppCard } from '@/components/common/design-system'
import type { SourceFailure } from '@/core/sources/aggregator'
import { SOURCE_LABELS } from '@/core/sources/registry'
import { ArticleGrid } from '@/features/Articles/components/ArticleGrid'
import { ArticlesFilters } from '@/features/Articles/components/ArticlesFilters'
import { ArticlesToolbar } from '@/features/Articles/components/ArticlesToolbar'
import { FilterChips } from '@/features/Articles/components/FilterChips'
import { Pagination } from '@/features/Articles/components/Pagination'
import { useArticlesDirectory } from '@/features/Articles/hooks/useArticlesDirectory'
import { useAuthorFacet } from '@/features/Articles/hooks/useAuthorFacet'

/** Names what is missing. A provider that fell over is information, not a blank page. */
function PartialFailureBanner({ failures }: { failures: SourceFailure[] }) {
  const { t } = useTranslation()
  if (!failures.length) return null

  return (
    <p
      // Assertive: a provider outage means the page in front of you is incomplete,
      // which a reader needs to hear now, not at the next idle moment.
      role="alert"
      className="rounded-lg border border-danger-600 bg-paper-0 p-3 text-sm text-danger-600 dark:border-danger-600 dark:bg-ink-800 dark:text-danger-600"
    >
      {t('articles.partial', {
        sources: failures
          .map((failure) => SOURCE_LABELS[failure.sourceId] ?? failure.sourceId)
          .join(', '),
      })}
    </p>
  )
}

export function ArticlesPage() {
  const { t } = useTranslation()
  const { state, term, setTerm, update, reset, list, actions, isLoading, isFetching, isError } =
    useArticlesDirectory()

  // Every byline seen so far, not just this page's — see `useAuthorFacet`.
  const authors = useAuthorFacet(list.articles, state.author)

  return (
    <section className="flex flex-col gap-6" aria-busy={isFetching}>
      <h1 className="text-2xl font-semibold text-ink-900 dark:text-ink-100">{t('nav.articles')}</h1>

      <ArticlesToolbar
        term={term}
        onTermChange={setTerm}
        sort={state.sort}
        onSortChange={(sort) => update({ sort })}
      />
      <ArticlesFilters state={state} authors={authors} onChange={update} />
      <FilterChips state={state} onChange={update} onClear={reset} />

      <PartialFailureBanner failures={list.failures} />

      {isError ? (
        <AppCard as="section" className="text-center">
          <h2 className="text-lg font-semibold text-ink-900 dark:text-ink-100">
            {t('articles.error.title')}
          </h2>
          <p className="mt-2 text-ink-500">{t('articles.error.body')}</p>
          <AppButton
            className="mt-4"
            onClick={() => void actions.retry()}
            disabled={actions.isRetrying}
          >
            {t('articles.error.retry')}
          </AppButton>
        </AppCard>
      ) : (
        <>
          <p role="status" className="text-sm text-ink-500">
            {t('articles.results', { total: list.articles.length })}
          </p>
          <ArticleGrid articles={list.articles} isLoading={isLoading} />
          <Pagination
            page={state.page}
            totalPages={list.knownPages}
            onPageChange={(page) => update({ page })}
          />
        </>
      )}
    </section>
  )
}

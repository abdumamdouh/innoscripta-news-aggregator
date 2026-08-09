import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { SlidersHorizontal } from 'lucide-react'
import { AppButton, AppModal } from '@/components/common/design-system'
import { ArticleGrid } from '@/features/Articles/components/ArticleGrid'
import { ArticlesErrorState } from '@/features/Articles/components/ArticlesErrorState'
import { ArticlesFilters } from '@/features/Articles/components/ArticlesFilters'
import { ArticlesToolbar } from '@/features/Articles/components/ArticlesToolbar'
import { CachedResultsNotice } from '@/features/Articles/components/CachedResultsNotice'
import { FilterChips } from '@/features/Articles/components/FilterChips'
import { Pagination } from '@/features/Articles/components/Pagination'
import { PartialFailureBanner } from '@/features/Articles/components/PartialFailureBanner'
import { SavedSearches } from '@/features/Articles/components/SavedSearches'
import { useArticlesDirectory } from '@/features/Articles/hooks/useArticlesDirectory'
import { useAuthorFacet } from '@/features/Articles/hooks/useAuthorFacet'

export function ArticlesPage() {
  const { t } = useTranslation()
  const [filtersOpen, setFiltersOpen] = useState(false)
  const {
    state,
    term,
    setTerm,
    update,
    reset,
    list,
    cachedAt,
    actions,
    isLoading,
    isFetching,
    isError,
  } = useArticlesDirectory()

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
      {/*
        One filter panel, two homes: the card the desktop layout has room for, and a drawer
        below `lg` where it would otherwise push the stories off the first screen. The card
        is `display:none` on a phone, so only one copy is ever in the accessibility tree.
      */}
      <div className="hidden lg:block">
        <ArticlesFilters state={state} authors={authors} onChange={update} />
      </div>
      <AppButton
        variant="secondary"
        className="self-start lg:hidden"
        onClick={() => setFiltersOpen(true)}
      >
        <SlidersHorizontal className="size-4" aria-hidden />
        {t('articles.filters.title')}
      </AppButton>
      <AppModal
        variant="drawer"
        open={filtersOpen}
        onOpenChange={setFiltersOpen}
        title={t('articles.filters.title')}
        footer={
          <AppButton onClick={() => setFiltersOpen(false)}>{t('articles.filters.apply')}</AppButton>
        }
      >
        <ArticlesFilters state={state} authors={authors} onChange={update} embedded />
      </AppModal>
      <FilterChips state={state} onChange={update} onClear={reset} />
      <SavedSearches state={state} onApply={update} />

      {cachedAt ? (
        <CachedResultsNotice savedAt={cachedAt} actions={actions} />
      ) : (
        <PartialFailureBanner failures={list.failures} />
      )}

      {isError ? (
        <ArticlesErrorState actions={actions} />
      ) : (
        <>
          <p role="status" className="text-sm text-ink-500">
            {t('articles.results', { shown: list.articles.length, total: list.total })}
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

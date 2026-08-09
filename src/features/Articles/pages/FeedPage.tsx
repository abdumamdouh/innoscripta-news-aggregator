import { useTranslation } from 'react-i18next'
import { AppEmptyState } from '@/components/common/design-system'
import { ArticleGrid } from '@/features/Articles/components/ArticleGrid'
import { ArticlesErrorState } from '@/features/Articles/components/ArticlesErrorState'
import { CachedResultsNotice } from '@/features/Articles/components/CachedResultsNotice'
import { PartialFailureBanner } from '@/features/Articles/components/PartialFailureBanner'
import { useFeed } from '@/features/Articles/hooks/useFeed'
import { PreferencesButton, usePreferences } from '@/features/Preferences'

/**
 * The article list narrowed to what this reader asked for, and nothing else on screen:
 * the feed's only filter is the preferences, so it carries no toolbar of its own. The three
 * fetch states are the list's: a provider that fell over is named, a whole failed load
 * offers the same retry — unless the last good feed is still in storage, in which case the
 * reader gets those stories under a notice saying how old they are.
 */
export function FeedPage() {
  const { t } = useTranslation()
  const preferences = usePreferences()
  const { ready, articles, failures, cachedAt, actions, isLoading, isFetching, isError } =
    useFeed(preferences)

  return (
    <section className="flex flex-col gap-6" aria-busy={isFetching}>
      <h1 className="text-2xl font-semibold text-ink-900 dark:text-ink-100">{t('nav.feed')}</h1>

      {!ready ? (
        <AppEmptyState
          title={t('feed.empty.title')}
          body={t('feed.empty.body')}
          // Preferences have no route, so the way in is the same trigger the header uses.
          action={<PreferencesButton />}
        />
      ) : isError ? (
        <ArticlesErrorState actions={actions} />
      ) : (
        <>
          {cachedAt ? (
            <CachedResultsNotice savedAt={cachedAt} actions={actions} />
          ) : (
            <PartialFailureBanner failures={failures} />
          )}
          <p role="status" className="text-sm text-ink-500">
            {t('feed.results', { total: articles.length })}
          </p>
          <ArticleGrid articles={articles} isLoading={isLoading} />
        </>
      )}
    </section>
  )
}

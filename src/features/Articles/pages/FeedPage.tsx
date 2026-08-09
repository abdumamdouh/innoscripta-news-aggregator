import { useTranslation } from 'react-i18next'
import { AppButton, AppCard } from '@/components/common/design-system'
import { ArticleGrid } from '@/features/Articles/components/ArticleGrid'
import { PartialFailureBanner } from '@/features/Articles/components/PartialFailureBanner'
import { useFeed } from '@/features/Articles/hooks/useFeed'
import { PreferencesButton, usePreferences } from '@/features/Preferences'

/**
 * The article list narrowed to what this reader asked for, and nothing else on screen:
 * the feed's only filter is the preferences, so it carries no toolbar of its own. The three
 * fetch states are the list's: a provider that fell over is named, a whole failed load
 * offers the same retry.
 */
export function FeedPage() {
  const { t } = useTranslation()
  const preferences = usePreferences()
  const { ready, articles, failures, actions, isLoading, isFetching, isError } =
    useFeed(preferences)

  return (
    <section className="flex flex-col gap-6" aria-busy={isFetching}>
      <h1 className="text-2xl font-semibold text-ink-900 dark:text-ink-100">{t('nav.feed')}</h1>

      {!ready ? (
        <AppCard as="section" className="text-center">
          <h2 className="text-lg font-semibold text-ink-900 dark:text-ink-100">
            {t('feed.empty.title')}
          </h2>
          <p className="mt-2 text-ink-500">{t('feed.empty.body')}</p>
          {/* Preferences have no route, so the way in is the same trigger the header uses. */}
          <div className="mt-4 flex justify-center">
            <PreferencesButton />
          </div>
        </AppCard>
      ) : isError ? (
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
          <PartialFailureBanner failures={failures} />
          <p role="status" className="text-sm text-ink-500">
            {t('articles.results', { total: articles.length })}
          </p>
          <ArticleGrid articles={articles} isLoading={isLoading} />
        </>
      )}
    </section>
  )
}

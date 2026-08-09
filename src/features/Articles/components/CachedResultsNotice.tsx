import { useTranslation } from 'react-i18next'
import { AppButton } from '@/components/common/design-system'

export interface CachedResultsNoticeProps {
  /** ISO timestamp of the fetch these stories came from. */
  savedAt: string
  actions: { retry: () => Promise<unknown>; isRetrying: boolean }
}

/**
 * Says out loud that the stories below are not today's. A stale list shown silently is the
 * worse failure of the two — the reader would have no way to tell it from a live one — so
 * this names the moment they were fetched and keeps the same retry the error card offers.
 *
 * Shared by the feed and the directory: keep the copy list-agnostic.
 */
export function CachedResultsNotice({ savedAt, actions }: CachedResultsNoticeProps) {
  const { t, i18n } = useTranslation()
  const at = Date.parse(savedAt)
  const when = Number.isNaN(at)
    ? savedAt
    : new Intl.DateTimeFormat(i18n.language, { dateStyle: 'medium', timeStyle: 'short' }).format(at)

  return (
    <div
      // Assertive, like the partial-failure banner: what is on screen is not what the
      // reader asked for, and they need to hear that now rather than at the next idle moment.
      role="alert"
      className="flex flex-wrap items-center gap-3 rounded-lg border border-ink-100 bg-paper-0 p-3 text-sm text-ink-700 dark:border-ink-700 dark:bg-ink-800 dark:text-ink-300"
    >
      <span>{t('articles.cached.notice', { when })}</span>
      <AppButton
        size="sm"
        variant="secondary"
        className="ms-auto"
        onClick={() => void actions.retry()}
        disabled={actions.isRetrying}
      >
        {t('articles.error.retry')}
      </AppButton>
    </div>
  )
}

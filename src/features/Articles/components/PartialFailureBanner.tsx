import { useTranslation } from 'react-i18next'
import type { SourceFailure } from '@/core/sources/aggregator'
import { SOURCE_LABELS } from '@/core/sources/registry'

/** Names what is missing. A provider that fell over is information, not a blank page. */
export function PartialFailureBanner({ failures }: { failures: SourceFailure[] }) {
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

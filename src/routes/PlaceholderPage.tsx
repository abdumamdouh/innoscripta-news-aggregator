import { useParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { AppCard } from '@/components/common/design-system'

/**
 * ponytail: stands in until the Articles feature lands (backlog items 5 and 6). Deleted then —
 * it exists only so item 1's acceptance ("both routes render inside the layout") is checkable.
 */
export function PlaceholderPage({ titleKey }: { titleKey: string }) {
  const { t } = useTranslation()
  const { articleId } = useParams()

  return (
    <AppCard as="section">
      <h1 className="text-2xl font-semibold text-ink-900 dark:text-ink-100">{t(titleKey)}</h1>
      <p className="mt-2 text-ink-500">{articleId ?? t('app.tagline')}</p>
    </AppCard>
  )
}

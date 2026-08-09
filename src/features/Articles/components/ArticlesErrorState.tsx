import { useTranslation } from 'react-i18next'
import { AppButton, AppEmptyState } from '@/components/common/design-system'

export interface ArticlesErrorStateProps {
  /** The action surface from `useArticleActions` — retry plus its busy flag. */
  actions: { retry: () => Promise<unknown>; isRetrying: boolean }
  /** `1` on the details route, where this card is the whole page. */
  headingLevel?: 1 | 2
}

/**
 * A failed fetch, worded and recovered the same way on all three routes. The wording is
 * the feature's, so it stays here rather than in the design system — `AppEmptyState` is
 * the card, this is what the article pages say into it.
 */
export function ArticlesErrorState({ actions, headingLevel }: ArticlesErrorStateProps) {
  const { t } = useTranslation()

  return (
    <AppEmptyState
      headingLevel={headingLevel}
      title={t('articles.error.title')}
      body={t('articles.error.body')}
      action={
        <AppButton onClick={() => void actions.retry()} disabled={actions.isRetrying}>
          {t('articles.error.retry')}
        </AppButton>
      }
    />
  )
}

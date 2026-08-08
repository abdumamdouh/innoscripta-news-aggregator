import { useTranslation } from 'react-i18next'
import { cn } from '@/utils/cn'

/**
 * An empty description is a legitimate provider answer (item 3 defaults it to ''), not a
 * defect — so it gets its own words rather than a blank line. One rule, one place: the card
 * and the details page differ only in size and clamping, never in what an empty one says.
 */
export function ArticleDescription({
  description,
  className,
}: {
  description: string
  className?: string
}) {
  const { t } = useTranslation()

  return (
    <p
      className={cn(
        className,
        description ? 'text-ink-700 dark:text-ink-300' : 'italic text-ink-500',
      )}
    >
      {description || t('articles.noDescription')}
    </p>
  )
}

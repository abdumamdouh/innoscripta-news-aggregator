import type { ReactNode } from 'react'
import { AppCard } from '@/components/common/design-system/AppCard'
import { cn } from '@/utils/cn'

export interface AppEmptyStateProps {
  title: string
  body: string
  /** `1` when the state *is* the page (a details route that failed), `2` inside one. */
  headingLevel?: 1 | 2
  /** The way out — a retry, a CTA. Absent when there is nothing useful to offer. */
  action?: ReactNode
}

/**
 * The one card every "there is nothing here" answer is made of: empty results, missing
 * article, failed fetch. Domain-agnostic on purpose — it takes finished strings, so the
 * translation keys stay with the feature that owns them.
 */
export function AppEmptyState({ title, body, headingLevel = 2, action }: AppEmptyStateProps) {
  const Heading = headingLevel === 1 ? 'h1' : 'h2'

  return (
    <AppCard as="section" className="motion-card text-center">
      <Heading
        className={cn(
          'font-semibold text-ink-900 dark:text-ink-100',
          headingLevel === 1 ? 'text-2xl' : 'text-lg',
        )}
      >
        {title}
      </Heading>
      <p className="mt-2 text-ink-500">{body}</p>
      {action && <div className="mt-4 flex justify-center">{action}</div>}
    </AppCard>
  )
}

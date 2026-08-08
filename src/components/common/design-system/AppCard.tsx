import type { HTMLAttributes } from 'react'
import { cn } from '@/utils/cn'

export interface AppCardProps extends HTMLAttributes<HTMLDivElement> {
  as?: 'div' | 'article' | 'section'
}

export function AppCard({ as: Tag = 'div', className, ...props }: AppCardProps) {
  return (
    <Tag
      className={cn(
        'rounded-xl border border-ink-100 bg-paper-0 p-4 shadow-soft',
        'dark:border-ink-700 dark:bg-ink-800',
        className,
      )}
      {...props}
    />
  )
}

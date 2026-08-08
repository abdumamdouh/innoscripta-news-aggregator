import type { ButtonHTMLAttributes, ReactNode } from 'react'
import { cn } from '@/utils/cn'
import { appFocusRing } from '@/components/common/design-system/tokens'

export interface AppIconButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  /** Icon-only control, so a label is not optional. */
  label: string
  children: ReactNode
}

export function AppIconButton({
  label,
  className,
  type = 'button',
  children,
  ...props
}: AppIconButtonProps) {
  return (
    <button
      type={type}
      aria-label={label}
      title={label}
      className={cn(
        'inline-flex size-11 items-center justify-center rounded-lg text-ink-700 transition-colors',
        'hover:bg-accent-50 disabled:cursor-not-allowed disabled:opacity-50',
        'dark:text-ink-100 dark:hover:bg-ink-800',
        appFocusRing,
        className,
      )}
      {...props}
    >
      {children}
    </button>
  )
}

import type { ButtonHTMLAttributes, ReactNode } from 'react'
import { cn } from '@/utils/cn'
import { appFocusRing } from '@/components/common/design-system/tokens'

/** Our vocabulary, not any library's. Swapping the implementation must not rename these. */
export type AppButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger'
export type AppButtonSize = 'sm' | 'md'

const VARIANTS: Record<AppButtonVariant, string> = {
  primary: 'bg-accent-600 text-paper-0 hover:bg-accent-700',
  secondary:
    'border border-ink-300 bg-paper-0 text-ink-800 hover:bg-accent-50 dark:border-ink-700 dark:bg-ink-800 dark:text-ink-100 dark:hover:bg-ink-700',
  ghost: 'text-ink-700 hover:bg-accent-50 dark:text-ink-100 dark:hover:bg-ink-800',
  danger: 'bg-danger-600 text-paper-0 hover:bg-danger-700',
}

// Below `lg` the pointer is a thumb, so the small size grows to the 44px touch target and
// only the desktop layout keeps the compact one.
const SIZES: Record<AppButtonSize, string> = {
  sm: 'min-h-11 px-3 text-sm lg:min-h-9',
  md: 'min-h-11 px-4 text-base',
}

export interface AppButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: AppButtonVariant
  size?: AppButtonSize
  children?: ReactNode
}

export function AppButton({
  variant = 'primary',
  size = 'md',
  className,
  type = 'button',
  ...props
}: AppButtonProps) {
  return (
    <button
      type={type}
      className={cn(
        'inline-flex items-center justify-center gap-2 rounded-lg font-medium transition-colors',
        'disabled:cursor-not-allowed disabled:opacity-50',
        appFocusRing,
        VARIANTS[variant],
        SIZES[size],
        className,
      )}
      {...props}
    />
  )
}

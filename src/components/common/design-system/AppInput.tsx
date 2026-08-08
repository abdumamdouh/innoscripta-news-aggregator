import type { InputHTMLAttributes, ReactNode } from 'react'
import { useId } from 'react'
import { cn } from '@/utils/cn'
import { appFocusRing } from '@/components/common/design-system/tokens'

export interface AppInputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: ReactNode
  error?: string
}

export function AppInput({ label, error, className, id, ...props }: AppInputProps) {
  const autoId = useId()
  const inputId = id ?? autoId
  const errorId = `${inputId}-error`

  return (
    <div className="flex flex-col gap-1">
      {label ? (
        <label htmlFor={inputId} className="text-sm font-medium text-ink-700 dark:text-ink-100">
          {label}
        </label>
      ) : null}
      <input
        id={inputId}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? errorId : undefined}
        className={cn(
          'min-h-11 w-full rounded-lg border bg-paper-0 px-3 text-base text-ink-800 transition-colors',
          'placeholder:text-ink-500 dark:bg-ink-800 dark:text-ink-100',
          error ? 'border-red-600' : 'border-ink-300 dark:border-ink-700',
          appFocusRing,
          className,
        )}
        {...props}
      />
      {error ? (
        <p id={errorId} className="text-sm text-red-600">
          {error}
        </p>
      ) : null}
    </div>
  )
}

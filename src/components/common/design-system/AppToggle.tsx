import { useId } from 'react'
import type { ReactNode } from 'react'
import * as Switch from '@radix-ui/react-switch'
import { cn } from '@/utils/cn'
import { appFocusRing } from '@/components/common/design-system/tokens'

export interface AppToggleProps {
  checked: boolean
  onCheckedChange: (checked: boolean) => void
  label: ReactNode
  disabled?: boolean
  id?: string
  className?: string
}

export function AppToggle({
  checked,
  onCheckedChange,
  label,
  disabled,
  id,
  className,
}: AppToggleProps) {
  const autoId = useId()
  const switchId = id ?? autoId

  return (
    <div className={cn('flex items-center gap-3', className)}>
      <Switch.Root
        id={switchId}
        checked={checked}
        onCheckedChange={onCheckedChange}
        disabled={disabled}
        className={cn(
          'relative h-6 w-11 shrink-0 rounded-full bg-ink-300 transition-colors',
          'data-[state=checked]:bg-accent-600 disabled:cursor-not-allowed disabled:opacity-50',
          'dark:bg-ink-700',
          appFocusRing,
        )}
      >
        {/* Radix does not mirror the thumb — translate-x is a physical transform, so the
            rtl: variants below hand-code the flip against <html dir="rtl">. */}
        <Switch.Thumb className="block size-5 translate-x-0.5 rounded-full bg-paper-0 transition-transform data-[state=checked]:translate-x-[1.375rem] rtl:-translate-x-0.5 rtl:data-[state=checked]:-translate-x-[1.375rem]" />
      </Switch.Root>
      <label
        htmlFor={switchId}
        className={cn(
          'text-base text-ink-800 dark:text-ink-100',
          disabled ? 'cursor-not-allowed opacity-50' : 'cursor-pointer',
        )}
      >
        {label}
      </label>
    </div>
  )
}

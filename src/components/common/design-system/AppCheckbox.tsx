import { useId } from 'react'
import type { ReactNode } from 'react'
import * as Checkbox from '@radix-ui/react-checkbox'
import { Check } from 'lucide-react'
import { cn } from '@/utils/cn'
import { appFocusRing } from '@/components/common/design-system/tokens'

export interface AppCheckboxProps {
  checked: boolean
  onCheckedChange: (checked: boolean) => void
  label: ReactNode
  disabled?: boolean
  id?: string
  className?: string
}

export function AppCheckbox({
  checked,
  onCheckedChange,
  label,
  disabled,
  id,
  className,
}: AppCheckboxProps) {
  const autoId = useId()
  const boxId = id ?? autoId

  return (
    <div className={cn('flex items-center gap-2', className)}>
      <Checkbox.Root
        id={boxId}
        checked={checked}
        onCheckedChange={(next) => onCheckedChange(next === true)}
        disabled={disabled}
        className={cn(
          'flex size-5 shrink-0 items-center justify-center rounded border border-ink-300 bg-paper-0 transition-colors',
          'data-[state=checked]:border-accent-600 data-[state=checked]:bg-accent-600',
          'disabled:cursor-not-allowed disabled:opacity-50 dark:border-ink-700 dark:bg-ink-800',
          appFocusRing,
        )}
      >
        <Checkbox.Indicator>
          <Check className="size-4 text-paper-0" aria-hidden />
        </Checkbox.Indicator>
      </Checkbox.Root>
      <label
        htmlFor={boxId}
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

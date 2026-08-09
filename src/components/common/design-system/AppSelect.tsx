import * as Select from '@radix-ui/react-select'
import { Check, ChevronDown } from 'lucide-react'
import { cn } from '@/utils/cn'
import { appFocusRing } from '@/components/common/design-system/tokens'

export interface AppSelectOption {
  value: string
  label: string
  disabled?: boolean
}

export interface AppSelectProps {
  value: string
  onValueChange: (value: string) => void
  options: AppSelectOption[]
  /** Icon-free selects still need a name for screen readers. */
  label: string
  /** Hide the visible label but keep it for assistive tech. */
  hideLabel?: boolean
  placeholder?: string
  className?: string
}

export function AppSelect({
  value,
  onValueChange,
  options,
  label,
  hideLabel,
  placeholder,
  className,
}: AppSelectProps) {
  return (
    <div className="flex flex-col gap-1">
      {!hideLabel && (
        <span className="text-sm font-medium text-ink-700 dark:text-ink-100">{label}</span>
      )}
      <Select.Root value={value} onValueChange={onValueChange}>
        <Select.Trigger
          aria-label={label}
          className={cn(
            'inline-flex min-h-11 items-center justify-between gap-2 rounded-lg border border-ink-300 bg-paper-0 px-3',
            'text-base text-ink-800 transition-colors hover:bg-accent-50',
            'dark:border-ink-700 dark:bg-ink-800 dark:text-ink-100 dark:hover:bg-ink-700',
            appFocusRing,
            className,
          )}
        >
          <Select.Value placeholder={placeholder} />
          <Select.Icon>
            <ChevronDown className="size-4" aria-hidden />
          </Select.Icon>
        </Select.Trigger>
        <Select.Portal>
          <Select.Content
            position="popper"
            sideOffset={4}
            className="z-50 overflow-hidden rounded-lg border border-ink-300 bg-paper-0 shadow-soft dark:border-ink-700 dark:bg-ink-800"
          >
            <Select.Viewport className="p-1">
              {options.map((option) => (
                <Select.Item
                  key={option.value}
                  value={option.value}
                  disabled={option.disabled}
                  className={cn(
                    'flex min-h-11 cursor-pointer select-none items-center gap-2 rounded-md px-3 text-base text-ink-800',
                    'data-[highlighted]:bg-accent-50 data-[highlighted]:outline-none',
                    'data-[disabled]:cursor-not-allowed data-[disabled]:opacity-50',
                    'dark:text-ink-100 dark:data-[highlighted]:bg-ink-700',
                  )}
                >
                  <Select.ItemIndicator>
                    <Check className="size-4" aria-hidden />
                  </Select.ItemIndicator>
                  <Select.ItemText>{option.label}</Select.ItemText>
                </Select.Item>
              ))}
            </Select.Viewport>
          </Select.Content>
        </Select.Portal>
      </Select.Root>
    </div>
  )
}

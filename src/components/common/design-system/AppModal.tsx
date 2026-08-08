import type { ReactNode } from 'react'
import * as Dialog from '@radix-ui/react-dialog'
import { X } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { cn } from '@/utils/cn'
import { AppIconButton } from '@/components/common/design-system/AppIconButton'

export interface AppModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: string
  description?: string
  children: ReactNode
  footer?: ReactNode
  className?: string
}

export function AppModal({
  open,
  onOpenChange,
  title,
  description,
  children,
  footer,
  className,
}: AppModalProps) {
  const { t } = useTranslation()

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="motion-modal-backdrop fixed inset-0 z-40 bg-ink-900/50" />
        <Dialog.Content
          className={cn(
            'motion-modal-panel fixed inset-x-0 top-1/2 z-50 mx-auto max-h-[90dvh] w-[min(100%-2rem,32rem)]',
            '-translate-y-1/2 overflow-auto rounded-xl bg-paper-0 p-6 shadow-soft dark:bg-ink-800',
            className,
          )}
        >
          <div className="flex items-start justify-between gap-4">
            <div>
              <Dialog.Title className="text-lg font-semibold text-ink-900 dark:text-ink-100">
                {title}
              </Dialog.Title>
              {description ? (
                <Dialog.Description className="mt-1 text-sm text-ink-500">
                  {description}
                </Dialog.Description>
              ) : null}
            </div>
            <Dialog.Close asChild>
              <AppIconButton label={t('common.close')}>
                <X className="size-5" aria-hidden />
              </AppIconButton>
            </Dialog.Close>
          </div>
          <div className="mt-4">{children}</div>
          {footer ? <div className="mt-6 flex justify-end gap-2">{footer}</div> : null}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}

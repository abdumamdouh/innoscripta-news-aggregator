import type { ReactNode } from 'react'
import * as Dialog from '@radix-ui/react-dialog'
import { X } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { cn } from '@/utils/cn'
import { AppIconButton } from '@/components/common/design-system/AppIconButton'

/**
 * Centred panel, or a sheet down the inline edge for the panels a phone opens over the page.
 * Both are the same Radix dialog — only the box it lands in differs, so focus, escape and
 * the scrim behave identically either way.
 */
export type AppModalVariant = 'modal' | 'drawer'

const VARIANTS: Record<AppModalVariant, string> = {
  modal:
    'motion-modal-panel inset-x-0 top-1/2 mx-auto max-h-[90dvh] w-[min(100%-2rem,32rem)] -translate-y-1/2 rounded-xl',
  // `app-drawer-content` already carries the slide-in, RTL included.
  drawer: 'app-drawer-content inset-y-0 end-0 h-dvh w-[min(100%-3rem,24rem)]',
}

export interface AppModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: string
  description?: string
  children: ReactNode
  footer?: ReactNode
  className?: string
  variant?: AppModalVariant
  /**
   * A controlled dialog has no Radix Trigger to hand focus back to on close, so without
   * this a keyboard user lands at the top of the document. Call `preventDefault` and focus
   * the control that opened it.
   */
  onCloseAutoFocus?: (event: Event) => void
}

export function AppModal({
  open,
  onOpenChange,
  title,
  description,
  children,
  footer,
  className,
  variant = 'modal',
  onCloseAutoFocus,
}: AppModalProps) {
  const { t } = useTranslation()

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="motion-modal-backdrop fixed inset-0 z-40 bg-ink-900/50" />
        <Dialog.Content
          onCloseAutoFocus={onCloseAutoFocus}
          className={cn(
            'fixed z-50 flex flex-col bg-paper-0 p-6 shadow-soft dark:bg-ink-800',
            VARIANTS[variant],
            className,
          )}
        >
          <div className="flex shrink-0 items-start justify-between gap-4">
            <div>
              <Dialog.Title className="text-lg font-semibold text-ink-900 dark:text-ink-100">
                {title}
              </Dialog.Title>
              {description && (
                <Dialog.Description className="mt-1 text-sm text-ink-500">
                  {description}
                </Dialog.Description>
              )}
            </div>
            <Dialog.Close asChild>
              {/* A long title must never squeeze the way out below a thumb's width. */}
              <AppIconButton label={t('common.close')} className="shrink-0">
                <X className="size-5" aria-hidden />
              </AppIconButton>
            </Dialog.Close>
          </div>
          {/*
            Only the body scrolls: a tall form must never push the footer's action past the fold,
            which a full-height drawer on a short viewport does the moment the fields outgrow it.
          */}
          <div className="mt-4 min-h-0 flex-1 overflow-auto">{children}</div>
          {footer && <div className="mt-6 flex shrink-0 justify-end gap-2">{footer}</div>}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}

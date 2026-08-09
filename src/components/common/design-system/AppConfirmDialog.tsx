import { useTranslation } from 'react-i18next'
import { AppButton } from '@/components/common/design-system/AppButton'
import { AppModal } from '@/components/common/design-system/AppModal'

export interface AppConfirmDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: string
  /** Say what is about to be lost — a confirm with no stakes named is a speed bump. */
  description: string
  confirmLabel: string
  onConfirm: () => void
}

/**
 * The one gate in front of a destructive action. It is `AppModal` with a fixed footer rather
 * than a second dialog implementation, so focus trapping, escape and the close button behave
 * exactly as every other dialog in the app.
 */
export function AppConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel,
  onConfirm,
}: AppConfirmDialogProps) {
  const { t } = useTranslation()

  return (
    <AppModal
      open={open}
      onOpenChange={onOpenChange}
      title={title}
      description={description}
      footer={
        <>
          <AppButton variant="secondary" onClick={() => onOpenChange(false)}>
            {t('common.cancel')}
          </AppButton>
          <AppButton variant="danger" onClick={onConfirm}>
            {confirmLabel}
          </AppButton>
        </>
      }
    >
      {null}
    </AppModal>
  )
}

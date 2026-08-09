import { useState } from 'react'
import { SlidersHorizontal } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { AppButton } from '@/components/common/design-system'
import { PreferencesModal } from '@/features/Preferences/components/PreferencesModal'

/** The one way in. Preferences are chrome, not a page, so they open from the header. */
export function PreferencesButton() {
  const { t } = useTranslation()
  const [open, setOpen] = useState(false)

  return (
    <>
      <AppButton variant="ghost" size="sm" onClick={() => setOpen(true)}>
        <SlidersHorizontal className="size-4" aria-hidden />
        {t('preferences.title')}
      </AppButton>
      <PreferencesModal open={open} onOpenChange={setOpen} />
    </>
  )
}

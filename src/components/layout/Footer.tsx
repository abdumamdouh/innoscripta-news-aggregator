import { useTranslation } from 'react-i18next'

export function Footer() {
  const { t } = useTranslation()

  return (
    <footer className="border-t border-ink-100 dark:border-ink-700">
      <div className="app-shell flex flex-wrap items-center justify-between gap-2 py-6 text-sm text-ink-500">
        <span>{t('app.tagline')}</span>
        <span>{t('footer.rights')}</span>
      </div>
    </footer>
  )
}

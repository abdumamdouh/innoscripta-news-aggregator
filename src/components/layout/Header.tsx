import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { Navigation } from '@/components/layout/Navigation'
import { LanguageSelect } from '@/components/layout/LanguageSelect'
import { ThemeToggle } from '@/components/layout/ThemeToggle'
import { PreferencesButton } from '@/features/Preferences'

export function Header() {
  const { t } = useTranslation()

  return (
    <header className="border-b border-ink-100 bg-paper-0 dark:border-ink-700 dark:bg-ink-900">
      <div className="app-shell flex flex-wrap items-center gap-x-4 gap-y-2 py-3">
        <Link
          to="/"
          className="inline-flex min-h-11 items-center text-lg font-semibold text-ink-900 lg:min-h-0 dark:text-ink-100"
          aria-label={t('app.name')}
        >
          {t('app.name')}
        </Link>
        <Navigation />
        <div className="ms-auto flex items-center gap-2">
          <PreferencesButton />
          <LanguageSelect />
          <ThemeToggle />
        </div>
      </div>
    </header>
  )
}

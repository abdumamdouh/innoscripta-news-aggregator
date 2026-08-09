import { NavLink } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { cn } from '@/utils/cn'

// ponytail: later items add their route here, not a new nav component.
const NAV_ITEMS = [
  { to: '/', labelKey: 'nav.articles' },
  { to: '/feed', labelKey: 'nav.feed' },
] as const

export function Navigation() {
  const { t } = useTranslation()

  return (
    <nav aria-label={t('nav.label')}>
      <ul className="flex items-center gap-1">
        {NAV_ITEMS.map((item) => (
          <li key={item.to}>
            <NavLink
              to={item.to}
              end
              className={({ isActive }) =>
                cn(
                  'inline-flex min-h-11 items-center rounded-lg px-3 text-base font-medium transition-colors',
                  isActive
                    ? 'bg-accent-50 text-accent-700 dark:bg-ink-800 dark:text-accent-100'
                    : 'text-ink-700 hover:bg-accent-50 dark:text-ink-100 dark:hover:bg-ink-800',
                )
              }
            >
              {t(item.labelKey)}
            </NavLink>
          </li>
        ))}
      </ul>
    </nav>
  )
}

import { useState } from 'react'
import { Moon, Sun } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { readThemeMode, setThemeMode, type ThemeMode } from '@/config/themeMode'
import { AppIconButton } from '@/components/common/design-system'

export function ThemeToggle() {
  const { t } = useTranslation()
  const [theme, setTheme] = useState<ThemeMode>(readThemeMode)

  function toggle() {
    const next: ThemeMode = theme === 'dark' ? 'light' : 'dark'
    setThemeMode(next)
    setTheme(next)
  }

  return (
    <AppIconButton label={t(theme === 'dark' ? 'theme.toLight' : 'theme.toDark')} onClick={toggle}>
      {theme === 'dark' ? (
        <Sun className="size-5" aria-hidden />
      ) : (
        <Moon className="size-5" aria-hidden />
      )}
    </AppIconButton>
  )
}

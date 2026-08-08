import { appTheme } from '@/config/theme'

export type ThemeMode = 'light' | 'dark'

export function readThemeMode(): ThemeMode {
  const stored = localStorage.getItem(appTheme.storageKeys.theme)
  if (stored === 'light' || stored === 'dark') return stored
  // Nothing stored yet: follow the OS.
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
}

/** Single place that owns the `dark` class on <html> and the persisted choice —
 *  the theme counterpart of applyLanguage() in src/i18n/index.ts. */
export function setThemeMode(mode: ThemeMode) {
  // Only a deliberate change writes storage — until then the OS preference stays live.
  localStorage.setItem(appTheme.storageKeys.theme, mode)
  document.documentElement.classList.toggle('dark', mode === 'dark')
}

// Runs at import time, before the first paint, so there is no light-then-dark flash.
document.documentElement.classList.toggle('dark', readThemeMode() === 'dark')

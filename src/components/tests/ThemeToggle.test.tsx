import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { appTheme } from '@/config/theme'

function mockPrefersDark(prefersDark: boolean) {
  vi.stubGlobal(
    'matchMedia',
    vi.fn().mockReturnValue({
      matches: prefersDark,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    }),
  )
}

/** Fresh import so the module-scope "apply before first paint" call re-runs. */
async function loadToggle() {
  vi.resetModules()
  await import('@/i18n') // same fresh module graph, so useTranslation has an instance
  await import('@/config/themeMode') // owns the apply-before-first-paint bootstrap
  const module = await import('@/components/layout/ThemeToggle')
  return module.ThemeToggle
}

describe('ThemeToggle', () => {
  beforeEach(() => {
    localStorage.clear()
    document.documentElement.classList.remove('dark')
  })

  it('honours prefers-color-scheme on first visit and stores nothing', async () => {
    mockPrefersDark(true)
    await loadToggle()

    expect(document.documentElement.classList.contains('dark')).toBe(true)
    expect(localStorage.getItem(appTheme.storageKeys.theme)).toBeNull()
  })

  it('persists an explicit toggle over the system preference', async () => {
    mockPrefersDark(true)
    const ThemeToggle = await loadToggle()
    render(<ThemeToggle />)

    await userEvent.click(screen.getByRole('button'))

    expect(localStorage.getItem(appTheme.storageKeys.theme)).toBe('light')
    expect(document.documentElement.classList.contains('dark')).toBe(false)
  })

  it('restores the stored theme over the system preference on reload', async () => {
    localStorage.setItem(appTheme.storageKeys.theme, 'dark')
    mockPrefersDark(false)
    await loadToggle()

    expect(document.documentElement.classList.contains('dark')).toBe(true)
  })
})

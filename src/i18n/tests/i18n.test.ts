import { beforeEach, describe, expect, it } from 'vitest'
import { appTheme } from '@/config/theme'
import en from '@/i18n/locales/en.json'
import ar from '@/i18n/locales/ar.json'
import de from '@/i18n/locales/de.json'

/** Fresh module graph so the module-scope applyLanguage bootstrap re-runs. */
async function loadI18n() {
  const module = await import('@/i18n')
  return module.default
}

describe('locale files', () => {
  const locales = { en, ar, de } as Record<string, Record<string, string>>

  it('all three locales have identical key sets', () => {
    const reference = Object.keys(en).sort()
    for (const [code, bundle] of Object.entries(locales)) {
      expect(Object.keys(bundle).sort(), `${code}.json key set`).toEqual(reference)
    }
  })

  it('no locale leaves a value empty or falls back to the English string', () => {
    for (const [code, bundle] of Object.entries(locales)) {
      if (code === 'en') continue
      for (const [key, value] of Object.entries(bundle)) {
        expect(value.trim(), `${code}.json ${key}`).not.toBe('')
      }
    }
    // Brand and endonyms are legitimately shared; everything else must be translated.
    const shared = new Set(['app.name', 'language.en', 'language.ar', 'language.de'])
    for (const key of Object.keys(en)) {
      if (shared.has(key)) continue
      expect(de[key as keyof typeof de], `de.json ${key}`).not.toBe(en[key as keyof typeof en])
      expect(ar[key as keyof typeof ar], `ar.json ${key}`).not.toBe(en[key as keyof typeof en])
    }
  })
})

describe('applyLanguage', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  it('sets dir="rtl" only for Arabic, ltr for the other locales', async () => {
    const i18n = await loadI18n()

    await i18n.changeLanguage('ar')
    expect(document.documentElement.dir).toBe('rtl')

    await i18n.changeLanguage('de')
    expect(document.documentElement.lang).toBe('de')
    expect(document.documentElement.dir).toBe('ltr')

    await i18n.changeLanguage('en')
    expect(document.documentElement.dir).toBe('ltr')
  })

  it('persists the chosen language and translates German chrome', async () => {
    const i18n = await loadI18n()

    await i18n.changeLanguage('de')

    expect(localStorage.getItem(appTheme.storageKeys.language)).toBe('de')
    expect(i18n.t('nav.articles')).toBe('Artikel')
  })

  it('falls back to the default language for an unsupported code', async () => {
    const i18n = await loadI18n()

    await i18n.changeLanguage('fr')

    expect(document.documentElement.lang).toBe(appTheme.defaultLanguage)
    expect(document.documentElement.dir).toBe('ltr')
    expect(localStorage.getItem(appTheme.storageKeys.language)).toBe(appTheme.defaultLanguage)
  })
})

import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'
import { appTheme } from '@/config/theme'
import en from '@/i18n/locales/en.json'
import ar from '@/i18n/locales/ar.json'

export const SUPPORTED_LANGUAGES = ['en', 'ar'] as const
export type AppLanguage = (typeof SUPPORTED_LANGUAGES)[number]

function isSupported(value: string | null): value is AppLanguage {
  return SUPPORTED_LANGUAGES.includes(value as AppLanguage)
}

function readStoredLanguage(): AppLanguage {
  const stored = localStorage.getItem(appTheme.storageKeys.language)
  return isSupported(stored) ? stored : appTheme.defaultLanguage
}

/** Single place that owns <html lang>/<html dir> and the persisted choice. */
function applyLanguage(language: string) {
  const lang = isSupported(language) ? language : appTheme.defaultLanguage
  document.documentElement.lang = lang
  document.documentElement.dir = lang === 'ar' ? 'rtl' : 'ltr'
  localStorage.setItem(appTheme.storageKeys.language, lang)
}

// ponytail: flat keys, no namespaces — one resource bundle per language is the whole need.
void i18n.use(initReactI18next).init({
  resources: { en: { translation: en }, ar: { translation: ar } },
  lng: readStoredLanguage(),
  fallbackLng: appTheme.defaultLanguage,
  interpolation: { escapeValue: false },
})

applyLanguage(i18n.language)
i18n.on('languageChanged', applyLanguage)

export default i18n

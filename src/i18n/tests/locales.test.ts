import { describe, expect, it } from 'vitest'
import en from '@/i18n/locales/en.json'
import ar from '@/i18n/locales/ar.json'
import de from '@/i18n/locales/de.json'

// Literal substring scan, not an AST pass. Keys are flat string literals
// everywhere today; upgrade to a parser only if someone builds keys dynamically.
// The glob is relative to this file and must reach all of src/, not just src/i18n/.
const modules = import.meta.glob<string>('../../**/*.{ts,tsx}', {
  query: '?raw',
  import: 'default',
  eager: true,
})
const sources = Object.entries(modules)
  .filter(([path]) => !path.includes('.test.'))
  .map(([, code]) => code)
  .join('\n')

describe('locale bundles', () => {
  it('define the same keys in every language', () => {
    expect(Object.keys(ar).sort()).toEqual(Object.keys(en).sort())
    expect(Object.keys(de).sort()).toEqual(Object.keys(en).sort())
  })

  it('leave no value untranslated by copying the English string', () => {
    // A key present in every file but still holding the English text is the failure this
    // catches — parity alone would call that translated.
    // Identical on purpose: the product name, provider names, and language labels, which a
    // switcher shows as endonyms ("Deutsch", "العربية") in every locale.
    const sameInEveryLanguage = /^(app\.name|language\.|sources\.|articles\.category\.)/
    const untranslated = Object.keys(en).filter(
      (key) =>
        en[key as keyof typeof en] === de[key as keyof typeof de] && !sameInEveryLanguage.test(key),
    )
    expect(untranslated).toEqual([])
  })

  it('have no key without a consumer in src', () => {
    const unused = Object.keys(en).filter((key) => {
      const prefix = key.slice(0, key.lastIndexOf('.'))
      // `language.${code}` style lookups count as consumers of every key under the prefix.
      return !sources.includes(`'${key}'`) && !sources.includes(`\`${prefix}.\${`)
    })
    expect(unused).toEqual([])
  })
})

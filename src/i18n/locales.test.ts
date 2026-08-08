import { describe, expect, it } from 'vitest'
import en from '@/i18n/locales/en.json'
import ar from '@/i18n/locales/ar.json'

// ponytail: literal substring scan, not an AST pass. Keys are flat string literals
// everywhere today; upgrade to a parser only if someone builds keys dynamically.
const modules = import.meta.glob<string>('../**/*.{ts,tsx}', {
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

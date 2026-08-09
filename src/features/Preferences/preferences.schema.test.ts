import { describe, expect, it } from 'vitest'
import type { TFunction } from 'i18next'
import {
  AUTHOR_MAX_LENGTH,
  createPreferencesSchema,
  validatePreferences,
} from '@/features/Preferences/preferences.schema'

/** Messages are translation keys, so the fake `t` echoes the key it was handed. */
const t = ((key: string, options?: Record<string, unknown>) =>
  options ? `${key}:${JSON.stringify(options)}` : key) as unknown as TFunction

const longName = 'a'.repeat(AUTHOR_MAX_LENGTH + 1)

describe('validatePreferences', () => {
  it('passes a selection with at least one source', () => {
    expect(
      validatePreferences({ sources: ['bbc'], categories: ['sport'], authors: ['Jane Doe'] }, t),
    ).toEqual({})
  })

  it('accepts empty categories and authors — those mean "any"', () => {
    expect(validatePreferences({ sources: ['bbc'], categories: [], authors: [] }, t)).toEqual({})
  })

  it('rejects a selection with no source at all', () => {
    expect(validatePreferences({ sources: [], categories: ['sport'], authors: [] }, t)).toEqual({
      sources: 'preferences.errors.sourcesRequired',
    })
  })

  it('reports every field at once, not just the first to fail', () => {
    expect(validatePreferences({ sources: [], categories: [], authors: [longName] }, t)).toEqual({
      sources: 'preferences.errors.sourcesRequired',
      authors: `preferences.errors.authorTooLong:${JSON.stringify({ max: AUTHOR_MAX_LENGTH })}`,
    })
  })

  it('collapses several bad authors into one message on the field', () => {
    const errors = validatePreferences(
      { sources: ['bbc'], categories: [], authors: [longName, `${longName}b`] },
      t,
    )
    expect(Object.keys(errors)).toEqual(['authors'])
  })

  it('allows a name of exactly the maximum length', () => {
    expect(
      validatePreferences(
        { sources: ['bbc'], categories: [], authors: ['a'.repeat(AUTHOR_MAX_LENGTH)] },
        t,
      ),
    ).toEqual({})
  })
})

describe('createPreferencesSchema', () => {
  it('builds its messages from the t it is handed, not at import time', () => {
    const shouty = ((key: string) => key.toUpperCase()) as unknown as TFunction
    expect(() =>
      createPreferencesSchema(shouty).validateSync(
        { sources: [], categories: [], authors: [] },
        { abortEarly: false },
      ),
    ).toThrow('PREFERENCES.ERRORS.SOURCESREQUIRED')
  })
})

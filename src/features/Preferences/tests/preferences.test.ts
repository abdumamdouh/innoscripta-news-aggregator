import { beforeEach, describe, expect, it, vi } from 'vitest'
import { appTheme } from '@/config/theme'
import {
  EMPTY_PREFERENCES,
  formatAuthors,
  parseAuthors,
  parsePreferences,
  readPreferences,
  subscribePreferences,
  toggleValue,
  writePreferences,
} from '@/features/Preferences/utils/preferences'

describe('parsePreferences', () => {
  it('reads a stored selection back field for field', () => {
    expect(
      parsePreferences(
        JSON.stringify({ sources: ['guardian'], categories: ['sport'], authors: ['Jane Doe'] }),
      ),
    ).toEqual({ sources: ['guardian'], categories: ['sport'], authors: ['Jane Doe'] })
  })

  it('treats nothing stored, corrupt JSON and a non-object as nothing chosen', () => {
    expect(parsePreferences(null)).toEqual(EMPTY_PREFERENCES)
    expect(parsePreferences('{not json')).toEqual(EMPTY_PREFERENCES)
    expect(parsePreferences('"guardian"')).toEqual(EMPTY_PREFERENCES)
    expect(parsePreferences('7')).toEqual(EMPTY_PREFERENCES)
  })

  it('keeps the fields it can use and drops the entries it cannot', () => {
    expect(
      parsePreferences(JSON.stringify({ sources: ['bbc', 3, null], categories: 'sport' })),
    ).toEqual({ sources: ['bbc'], categories: [], authors: [] })
  })
})

describe('toggleValue', () => {
  it('adds at the end and removes in place, leaving the rest of the order alone', () => {
    expect(toggleValue(['bbc', 'nyt'], 'guardian')).toEqual(['bbc', 'nyt', 'guardian'])
    expect(toggleValue(['bbc', 'nyt', 'guardian'], 'nyt')).toEqual(['bbc', 'guardian'])
  })

  it('does not mutate the list it was given', () => {
    const values = ['bbc']
    toggleValue(values, 'nyt')
    expect(values).toEqual(['bbc'])
  })
})

describe('parseAuthors', () => {
  it('splits on commas, trims, and drops blanks', () => {
    expect(parseAuthors('  Jane Doe ,, John Smith ,  ')).toEqual(['Jane Doe', 'John Smith'])
  })

  it('collapses duplicates that differ only by surrounding space', () => {
    expect(parseAuthors('Jane Doe, Jane Doe , John Smith')).toEqual(['Jane Doe', 'John Smith'])
  })

  it('reads an empty or whitespace-only field as no authors', () => {
    expect(parseAuthors('')).toEqual([])
    expect(parseAuthors('  ,  ')).toEqual([])
  })

  it('round-trips through formatAuthors', () => {
    const authors = ['Jane Doe', 'John Smith']
    expect(parseAuthors(formatAuthors(authors))).toEqual(authors)
  })
})

describe('the preferences store', () => {
  beforeEach(() => {
    localStorage.clear()
    // Drop the module-level parse cache the same way a real clear does.
    readPreferences()
  })

  it('writes, reads back, and notifies subscribers', () => {
    const listener = vi.fn()
    const unsubscribe = subscribePreferences(listener)

    writePreferences({ sources: ['nyt'], categories: ['world'], authors: [] })

    expect(listener).toHaveBeenCalledTimes(1)
    expect(readPreferences()).toEqual({ sources: ['nyt'], categories: ['world'], authors: [] })
    expect(localStorage.getItem(appTheme.storageKeys.preferences)).toBe(
      JSON.stringify({ sources: ['nyt'], categories: ['world'], authors: [] }),
    )

    unsubscribe()
    writePreferences(EMPTY_PREFERENCES)
    expect(listener).toHaveBeenCalledTimes(1)
  })

  it('hands out the same snapshot until storage actually changes', () => {
    writePreferences({ sources: ['bbc'], categories: [], authors: [] })
    expect(readPreferences()).toBe(readPreferences())

    writePreferences({ sources: ['bbc', 'nyt'], categories: [], authors: [] })
    expect(readPreferences().sources).toEqual(['bbc', 'nyt'])
  })

  it('reparses when storage is changed by someone else', () => {
    writePreferences({ sources: ['bbc'], categories: [], authors: [] })
    localStorage.setItem(
      appTheme.storageKeys.preferences,
      JSON.stringify({ sources: ['guardian'], categories: [], authors: ['Jane Doe'] }),
    )
    expect(readPreferences()).toEqual({
      sources: ['guardian'],
      categories: [],
      authors: ['Jane Doe'],
    })
  })
})

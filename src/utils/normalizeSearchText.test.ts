import { describe, expect, it } from 'vitest'
import { normalizeSearchText } from '@/utils/normalizeSearchText'

describe('normalizeSearchText', () => {
  it('folds case, punctuation and repeated whitespace', () => {
    expect(normalizeSearchText('  Mars Rover — Finds "Ice"!  ')).toBe('mars rover finds ice')
  })

  it('strips Latin diacritics so accents do not split a match', () => {
    expect(normalizeSearchText('Zoë Café')).toBe(normalizeSearchText('Zoe Cafe'))
  })

  it('normalizes Arabic alef, teh marbuta, alef maqsura and harakat', () => {
    expect(normalizeSearchText('الأخبَار')).toBe(normalizeSearchText('الاخبار'))
    expect(normalizeSearchText('القاهرة')).toBe(normalizeSearchText('القاهره'))
    expect(normalizeSearchText('مصطفى')).toBe(normalizeSearchText('مصطفي'))
    expect(normalizeSearchText('ســلام')).toBe(normalizeSearchText('سلام'))
  })

  it('keeps digits, which headlines carry meaning in', () => {
    expect(normalizeSearchText('Apollo 11')).toBe('apollo 11')
  })

  it('returns an empty string for empty input', () => {
    expect(normalizeSearchText(undefined)).toBe('')
    expect(normalizeSearchText(null)).toBe('')
    expect(normalizeSearchText('—!—')).toBe('')
  })
})

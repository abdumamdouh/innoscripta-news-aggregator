import { describe, expect, it } from 'vitest'
import { DEFAULT_ARTICLES_STATE } from '@/features/Articles/constants'
import type { ArticlesState } from '@/features/Articles/types/articles.types'
import {
  hasActiveFilters,
  parseArticlesState,
  sanitizeArticlesState,
  toSearchParams,
} from '@/features/Articles/utils/articlesState'

const allowed = { categories: ['technology', 'sport'], sources: ['guardian', 'bbc'] }
const params = (search: string) => new URLSearchParams(search)
const state = (over: Partial<ArticlesState> = {}): ArticlesState => ({
  ...DEFAULT_ARTICLES_STATE,
  ...over,
})

describe('sanitizeArticlesState — the allow-list', () => {
  it('keeps every value that is on the list', () => {
    expect(
      sanitizeArticlesState(
        {
          q: '  mars ',
          from: '2026-01-01',
          to: '2026-02-01',
          category: 'technology',
          author: 'Ada Lovelace',
          sources: 'bbc,guardian',
          sort: 'oldest',
          page: '3',
        },
        allowed,
      ),
    ).toEqual({
      q: 'mars',
      from: '2026-01-01',
      to: '2026-02-01',
      category: 'technology',
      author: 'Ada Lovelace',
      sources: ['bbc', 'guardian'],
      sort: 'oldest',
      page: 3,
    })
  })

  it('drops junk instead of trusting it', () => {
    const parsed = sanitizeArticlesState(
      {
        category: 'not-a-category',
        sources: 'guardian,evil-source',
        sort: 'drop-table',
        from: '01/02/2026',
        to: '2026-13-45',
        page: '-4',
      },
      allowed,
    )

    expect(parsed.category).toBe('')
    expect(parsed.sources).toEqual(['guardian'])
    expect(parsed.sort).toBe('newest')
    expect(parsed.from).toBe('')
    expect(parsed.to).toBe('')
    expect(parsed.page).toBe(1)
  })

  it('caps free text and de-duplicates sources', () => {
    const parsed = sanitizeArticlesState({ q: 'x'.repeat(500), sources: 'bbc,bbc,bbc' }, allowed)
    expect(parsed.q).toHaveLength(120)
    expect(parsed.sources).toEqual(['bbc'])
  })
})

describe('parseArticlesState — URL → snapshot → defaults', () => {
  it('reads the URL when it carries any of our parameters', () => {
    const parsed = parseArticlesState(
      params('?q=mars&page=2'),
      { q: 'stored', sort: 'oldest' },
      allowed,
    )
    expect(parsed.q).toBe('mars')
    expect(parsed.page).toBe(2)
    // Wholesale, not merged: a shared link must render what the sender saw.
    expect(parsed.sort).toBe('newest')
  })

  it('falls back to the stored snapshot for a bare URL', () => {
    const parsed = parseArticlesState(params(''), { q: 'stored', sources: ['bbc'] }, allowed)
    expect(parsed.q).toBe('stored')
    expect(parsed.sources).toEqual(['bbc'])
  })

  it('falls back to the defaults with neither', () => {
    expect(parseArticlesState(params(''), null, allowed)).toEqual(DEFAULT_ARTICLES_STATE)
  })

  it('ignores parameters that are not ours', () => {
    const parsed = parseArticlesState(params('?utm_source=twitter'), null, allowed)
    expect(parsed).toEqual(DEFAULT_ARTICLES_STATE)
  })

  it('sanitizes a tampered snapshot exactly like a tampered URL', () => {
    const parsed = parseArticlesState(params(''), { sort: 'nonsense', page: 999999 }, allowed)
    expect(parsed.sort).toBe('newest')
    expect(parsed.page).toBe(1)
  })
})

describe('toSearchParams — defaults stay out of the URL', () => {
  it('serializes nothing at all for the default state', () => {
    expect(toSearchParams(DEFAULT_ARTICLES_STATE).toString()).toBe('')
  })

  it('omits page=1, an empty q and the default sort', () => {
    const search = toSearchParams(state({ q: '', page: 1, sort: 'newest', category: 'sport' }))
    expect(search.toString()).toBe('category=sport')
  })

  it('round-trips a full state through the URL', () => {
    const full = state({
      q: 'mars',
      from: '2026-01-01',
      to: '2026-02-01',
      category: 'technology',
      author: 'Ada Lovelace',
      sources: ['bbc', 'guardian'],
      sort: 'relevance',
      page: 4,
    })
    expect(parseArticlesState(toSearchParams(full), null, allowed)).toEqual(full)
  })
})

describe('hasActiveFilters', () => {
  it('is false for defaults, and for sort or page alone', () => {
    expect(hasActiveFilters(DEFAULT_ARTICLES_STATE)).toBe(false)
    expect(hasActiveFilters(state({ sort: 'oldest', page: 7 }))).toBe(false)
  })

  it('is true once anything narrows the feed', () => {
    expect(hasActiveFilters(state({ q: 'mars' }))).toBe(true)
    expect(hasActiveFilters(state({ sources: ['bbc'] }))).toBe(true)
  })
})

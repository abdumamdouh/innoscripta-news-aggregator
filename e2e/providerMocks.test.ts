import { describe, expect, it } from 'vitest'
import { FEEDS, FULL_BYLINE, FULL_HEADLINE_TERM, narrow } from './providerMocks.ts'

/**
 * `narrow()` is the one filter behind all four provider route mocks, so its behaviour is
 * shared by every spec that calls `mockProviders` with a search term. It matches the byline
 * as well as the title (a reader's author preference reaches NewsAPI as a `q` term), which
 * is what makes a collision possible: a title search that happens to appear in a byline
 * would return stories the title never matched, and the spec asserting on the result would
 * pass for the wrong reason.
 */
describe('narrow', () => {
  const guardian = FEEDS.guardian

  it('returns everything for an empty term', () => {
    expect(narrow(guardian, '')).toBe(guardian)
  })

  it('matches the title, case-insensitively', () => {
    const hits = narrow(guardian, 'HARVEST')
    expect(hits.length).toBeGreaterThan(0)
    expect(hits.every((item) => item.title.toLowerCase().includes('harvest'))).toBe(true)
    expect(hits.length).toBeLessThan(guardian.length)
  })

  it('matches the byline, which is how an author preference reaches NewsAPI', () => {
    const hits = narrow(FEEDS.newsapi, FULL_BYLINE)
    expect(hits).toHaveLength(1)
    expect(hits[0]?.title).toContain('supercollider')
  })

  it('strips the quotes the adapter wraps a multi-word term in', () => {
    expect(narrow(FEEDS.newsapi, `"${FULL_BYLINE}"`)).toEqual(narrow(FEEDS.newsapi, FULL_BYLINE))
  })

  it('returns nothing for a term no fixture carries', () => {
    expect(narrow(guardian, 'quidditch')).toHaveLength(0)
  })

  /**
   * Every term a spec types into "Search articles" — i.e. searched for its title, not its
   * byline. If one of these ever appears in a fixture byline, the byline match silently
   * widens that spec's result set. Add a term here when a spec adds one.
   */
  const TITLE_SEARCH_TERMS = [
    'quantum',
    'harvest',
    'quidditch',
    FULL_HEADLINE_TERM,
    'Guardian story 1 on',
    'Guardian story 2 on',
  ]

  it.each(TITLE_SEARCH_TERMS)('no fixture byline contains the title search term %s', (term) => {
    const bylines = Object.values(FEEDS).flatMap((items) => items.map((item) => item.author))
    expect(bylines.filter((byline) => byline.toLowerCase().includes(term.toLowerCase()))).toEqual(
      [],
    )
  })
})

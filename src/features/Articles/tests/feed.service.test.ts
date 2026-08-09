import { describe, expect, it } from 'vitest'
import { appTheme } from '@/config/theme'
import type { Article, NewsSource, SourceCapabilities } from '@/core/sources/types'
import { fetchFeed, hasPreferences, toFeedQuery } from '@/features/Articles/services/feed.service'
import type { Preferences } from '@/features/Preferences'

/**
 * The feed's whole behaviour is "preferences in, the aggregator's filters out", so it is
 * asserted through that path — preferences → `toFeedQuery` → `aggregate` — the same way
 * articles.service.test.ts asserts the directory's. What is specific here is that every
 * dimension is multi-valued, which the directory's single-value mapping cannot express.
 */

const NO_CAPS: SourceCapabilities = {
  query: false,
  dateRange: false,
  category: false,
  author: false,
  pagination: false,
}

const article = (over: Partial<Article> & { id: string; sourceId: string }): Article => ({
  title: `Story ${over.id}`,
  description: '',
  url: `https://example.test/${over.id}`,
  publishedAt: '2026-02-01T00:00:00.000Z',
  sourceLabel: over.sourceId.toUpperCase(),
  ...over,
})

const ARTICLES: Article[] = [
  article({ id: 'g1', sourceId: 'guardian', category: 'science', author: 'Ada Lovelace' }),
  article({ id: 'g2', sourceId: 'guardian', category: 'politics', author: 'Grace Hopper' }),
  article({ id: 'n1', sourceId: 'nyt', category: 'science', author: 'Alan Turing' }),
  article({ id: 'n2', sourceId: 'nyt', category: 'business', author: 'Grace Hopper' }),
  article({ id: 'b1', sourceId: 'bbc', category: 'politics' }),
]

/** Capability-poor on purpose: the app is what makes the reader's preference true. */
const source = (id: string): NewsSource =>
  ({
    id,
    label: id.toUpperCase(),
    capabilities: NO_CAPS,
    available: true,
    fetch: () => Promise.resolve(ARTICLES.filter((entry) => entry.sourceId === id)),
    normalize: (raw) => raw as Article,
  }) as NewsSource

const SOURCES = [source('guardian'), source('nyt'), source('bbc')]

const preferences = (over: Partial<Preferences> = {}): Preferences => ({
  sources: [],
  categories: [],
  authors: [],
  ...over,
})

const idsFor = async (over: Partial<Preferences>) =>
  (await fetchFeed(preferences(over), undefined, SOURCES)).articles.map((entry) => entry.id).sort()

describe('toFeedQuery', () => {
  it('drops every dimension the reader left empty rather than filtering on nothing', () => {
    expect(toFeedQuery(preferences())).toEqual({
      categories: undefined,
      authors: undefined,
      sources: undefined,
      limit: appTheme.sourceWindow,
    })
  })

  it('passes each dimension through whole, not one value of it', () => {
    const query = toFeedQuery(
      preferences({
        sources: ['guardian', 'nyt'],
        categories: ['science', 'politics'],
        authors: ['Ada Lovelace', 'Grace Hopper'],
      }),
    )

    expect(query.sources).toEqual(['guardian', 'nyt'])
    expect(query.categories).toEqual(['science', 'politics'])
    expect(query.authors).toEqual(['Ada Lovelace', 'Grace Hopper'])
  })

  it('widens per dimension: a filled one filters, an empty one beside it does not', () => {
    const query = toFeedQuery(preferences({ sources: ['bbc'] }))
    expect(query.sources).toEqual(['bbc'])
    expect(query.categories).toBeUndefined()
    expect(query.authors).toBeUndefined()
  })
})

describe('hasPreferences', () => {
  it('is false only when nothing at all is chosen', () => {
    expect(hasPreferences(preferences())).toBe(false)
    // Not identity against EMPTY_PREFERENCES: a reader who unticks everything gets a
    // freshly built object with the same empty arrays.
    expect(hasPreferences({ sources: [], categories: [], authors: [] })).toBe(false)
  })

  it('is true when any single dimension has something in it', () => {
    expect(hasPreferences(preferences({ sources: ['bbc'] }))).toBe(true)
    expect(hasPreferences(preferences({ categories: ['science'] }))).toBe(true)
    expect(hasPreferences(preferences({ authors: ['Ada Lovelace'] }))).toBe(true)
  })
})

describe('fetchFeed', () => {
  it('returns only the preferred sources', async () => {
    expect(await idsFor({ sources: ['guardian', 'bbc'] })).toEqual(['b1', 'g1', 'g2'])
  })

  it('ORs several preferred categories instead of narrowing to their intersection', async () => {
    expect(await idsFor({ categories: ['science', 'business'] })).toEqual(['g1', 'n1', 'n2'])
  })

  it('ORs several preferred authors, and leaves a bylineless article out', async () => {
    // b1 has no author at all — a preference for people must not sweep it in.
    expect(await idsFor({ authors: ['Ada Lovelace', 'Alan Turing'] })).toEqual(['g1', 'n1'])
  })

  it('ANDs across dimensions: source, then category within it', async () => {
    expect(await idsFor({ sources: ['guardian', 'nyt'], categories: ['science'] })).toEqual([
      'g1',
      'n1',
    ])
  })

  it('leaves the other dimensions alone when only one is set', async () => {
    // Categories empty must not mean "no category matches" — every guardian story stays.
    expect(await idsFor({ sources: ['guardian'] })).toEqual(['g1', 'g2'])
  })

  it('can come back empty when the preferences agree on nothing', async () => {
    expect(await idsFor({ sources: ['bbc'], categories: ['business'] })).toEqual([])
  })
})

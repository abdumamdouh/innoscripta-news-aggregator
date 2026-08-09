import { describe, expect, it } from 'vitest'
import { appTheme } from '@/config/theme'
import type { Article, NewsSource, SourceCapabilities } from '@/core/sources/types'
import { DEFAULT_ARTICLES_STATE } from '@/features/Articles/constants'
import { fetchArticles, toArticleQuery } from '@/features/Articles/services/articles.service'
import type { ArticlesState } from '@/features/Articles/types/articles.types'

/**
 * Filtering is executed by the aggregator, capability by capability — so it is asserted
 * here, through the exact path the screen uses: state → `toArticleQuery` → `aggregate`.
 * A mapping mistake (a category that never reaches `categories`) fails these too.
 */

const NO_CAPS: SourceCapabilities = {
  query: false,
  dateRange: false,
  category: false,
  author: false,
  pagination: false,
}
const ALL_CAPS: SourceCapabilities = {
  query: true,
  dateRange: true,
  category: true,
  author: true,
  pagination: true,
}

const article = (over: Partial<Article> & { id: string; sourceId: string }): Article => ({
  title: 'Untitled',
  description: '',
  url: `https://example.test/${over.id}`,
  publishedAt: '2026-02-01T00:00:00.000Z',
  sourceLabel: over.sourceId.toUpperCase(),
  ...over,
})

/** One fixed multi-source set. Every case below filters this same shelf of articles. */
const ARTICLES: Article[] = [
  article({
    id: 'g1',
    sourceId: 'guardian',
    title: 'Mars rover lands safely',
    description: 'A long descent ends well.',
    publishedAt: '2026-01-10T12:00:00.000Z',
    category: 'science',
    author: 'Ada Lovelace',
  }),
  article({
    id: 'g2',
    sourceId: 'guardian',
    title: 'Budget talks stall',
    description: 'Ministers meet again on Mars Street.',
    publishedAt: '2026-01-20T12:00:00.000Z',
    category: 'politics',
    author: 'Grace Hopper',
  }),
  article({
    id: 'n1',
    sourceId: 'nyt',
    title: 'Météo extrême sur la côte',
    description: 'Storms batter the coast.',
    publishedAt: '2026-02-05T12:00:00.000Z',
    category: 'science',
    author: 'Ada Lovelace',
  }),
  article({
    id: 'n2',
    sourceId: 'nyt',
    title: 'Markets shrug off the news',
    description: 'Traders were unmoved.',
    publishedAt: '2026-02-15T12:00:00.000Z',
    category: 'business',
    author: 'Grace Hopper',
  }),
  article({
    id: 'b1',
    sourceId: 'bbc',
    title: 'Rover images reach Earth',
    description: 'The first Mars pictures arrive.',
    publishedAt: '2026-03-01T12:00:00.000Z',
    category: 'science',
  }),
]

const bySource = (sourceId: string) => ARTICLES.filter((entry) => entry.sourceId === sourceId)

function source(id: string, capabilities: SourceCapabilities = NO_CAPS): NewsSource {
  return {
    id,
    label: id.toUpperCase(),
    capabilities,
    available: true,
    fetch: () => Promise.resolve(bySource(id)),
    normalize: (raw) => raw as Article,
  } as NewsSource
}

/** Capability-poor by default: this is the BBC case, where the app does the filtering. */
const SOURCES = [source('guardian'), source('nyt'), source('bbc')]

const state = (over: Partial<ArticlesState> = {}): ArticlesState => ({
  ...DEFAULT_ARTICLES_STATE,
  ...over,
})

const idsFor = async (over: Partial<ArticlesState>, sources = SOURCES) =>
  (await fetchArticles(state(over), undefined, sources)).articles.map((entry) => entry.id).sort()

describe('toArticleQuery', () => {
  it('maps empty fields to absent filters and single values to the array shapes', () => {
    expect(toArticleQuery(state())).toEqual({
      q: undefined,
      from: undefined,
      to: undefined,
      categories: undefined,
      authors: undefined,
      sources: undefined,
      limit: appTheme.sourceWindow,
    })

    const query = toArticleQuery(
      state({ category: 'science', author: 'Ada Lovelace', sources: ['bbc'] }),
    )
    expect(query.categories).toEqual(['science'])
    expect(query.authors).toEqual(['Ada Lovelace'])
    expect(query.sources).toEqual(['bbc'])
  })
})

describe('keyword filtering', () => {
  it('matches the title and the description alike', async () => {
    // g1 matches on its headline, g2 and b1 only in their summaries.
    expect(await idsFor({ q: 'mars' })).toEqual(['b1', 'g1', 'g2'])
  })

  it('ignores case and diacritics', async () => {
    expect(await idsFor({ q: 'METEO' })).toEqual(['n1'])
    expect(await idsFor({ q: 'meteo extreme' })).toEqual(['n1'])
  })

  it('returns nothing for a term in neither field', async () => {
    expect(await idsFor({ q: 'quidditch' })).toEqual([])
  })

  it('still filters a source that declares it cannot query — the BBC case', async () => {
    // Only bbc is asked, and it serves a whole feed regardless of the term. The
    // capability system is why the term is honoured anyway.
    const bbcOnly = [source('bbc', NO_CAPS)]
    expect(await idsFor({ q: 'mars', sources: ['bbc'] }, bbcOnly)).toEqual(['b1'])
    expect(await idsFor({ q: 'quidditch', sources: ['bbc'] }, bbcOnly)).toEqual([])
  })

  it('re-checks the keyword even when the source says it already searched', async () => {
    // `query: true` is trusted for narrowing, not for what reaches the grid. Providers that
    // search the full body return stories whose match is invisible on a card, and a reader
    // seeing an unrelated headline concludes the filter is broken.
    const capable = [source('bbc', ALL_CAPS)]
    expect(await idsFor({ q: 'quidditch', sources: ['bbc'] }, capable)).toEqual([])
    expect(await idsFor({ q: 'mars', sources: ['bbc'] }, capable)).toEqual(['b1'])
  })
})

describe('date range filtering', () => {
  it('includes both bounds', async () => {
    expect(await idsFor({ from: '2026-01-10', to: '2026-02-05' })).toEqual(['g1', 'g2', 'n1'])
  })

  it('treats a date-only upper bound as the whole day', async () => {
    // n1 is published at 12:00 on the 5th — an exclusive bound would drop it.
    expect(await idsFor({ from: '2026-02-05', to: '2026-02-05' })).toEqual(['n1'])
  })

  it('yields empty when from is later than to, rather than throwing', async () => {
    expect(await idsFor({ from: '2026-03-01', to: '2026-01-01' })).toEqual([])
  })
})

describe('source, category and author filtering', () => {
  it('returns only the selected providers', async () => {
    expect(await idsFor({ sources: ['guardian', 'bbc'] })).toEqual(['b1', 'g1', 'g2'])
  })

  it('makes a deselected source genuinely disappear', async () => {
    const withoutNyt = await idsFor({ sources: ['guardian', 'bbc'] })
    expect(withoutNyt).not.toContain('n1')
    expect(withoutNyt).not.toContain('n2')
    // And it comes back when it is selected again.
    expect(await idsFor({})).toContain('n1')
  })

  it('filters by category', async () => {
    expect(await idsFor({ category: 'science' })).toEqual(['b1', 'g1', 'n1'])
    expect(await idsFor({ category: 'business' })).toEqual(['n2'])
  })

  it('filters by author, and an article with no byline is not swept in', async () => {
    expect(await idsFor({ author: 'Ada Lovelace' })).toEqual(['g1', 'n1'])
    expect(await idsFor({ author: 'Nobody At All' })).toEqual([])
  })
})

describe('combined filters', () => {
  it('ANDs together, and clearing one restores exactly what it had removed', async () => {
    const keyword = await idsFor({ q: 'mars' })
    expect(keyword).toEqual(['b1', 'g1', 'g2'])

    const narrowed = await idsFor({ q: 'mars', category: 'science' })
    expect(narrowed).toEqual(['b1', 'g1'])

    const narrowedFurther = await idsFor({ q: 'mars', category: 'science', sources: ['guardian'] })
    expect(narrowedFurther).toEqual(['g1'])

    // Dropping the source filter gives back g1's sibling and nothing else.
    expect(await idsFor({ q: 'mars', category: 'science' })).toEqual(narrowed)
    // Dropping the category filter gives back exactly the article it had hidden.
    expect(await idsFor({ q: 'mars' })).toEqual(keyword)
  })
})

describe('partial failure', () => {
  it('names the failing source and still returns the rest', async () => {
    const dead: NewsSource = {
      ...source('nyt'),
      fetch: () => Promise.reject(new Error('503 Service Unavailable')),
    }
    const result = await fetchArticles(state(), undefined, [
      source('guardian'),
      dead,
      source('bbc'),
    ])

    expect(result.articles.map((entry) => entry.sourceId)).not.toContain('nyt')
    expect(result.articles.length).toBeGreaterThan(0)
    expect(result.failures).toEqual([{ sourceId: 'nyt', reason: '503 Service Unavailable' }])
  })
})

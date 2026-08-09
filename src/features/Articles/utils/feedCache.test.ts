import { describe, expect, it } from 'vitest'
import type { Article } from '@/core/sources/types'
import { parseFeedCache } from '@/features/Articles/utils/feedCache'

const article: Article = {
  id: 'guardian:1',
  title: 'Mars rover lands safely',
  description: 'A long descent ends well.',
  url: 'https://example.test/mars',
  publishedAt: '2026-01-10T12:00:00.000Z',
  sourceId: 'guardian',
  sourceLabel: 'The Guardian',
}

const stored = (value: unknown) => JSON.stringify(value)

describe('parseFeedCache', () => {
  it('reads back a feed that was written', () => {
    const cache = { savedAt: '2026-06-01T09:30:00.000Z', articles: [article] }
    expect(parseFeedCache(stored(cache))).toEqual(cache)
  })

  it('keeps the optional fields a provider did supply', () => {
    const rich = { ...article, author: 'A Reporter', imageUrl: 'https://example.test/a.jpg' }
    const parsed = parseFeedCache(stored({ savedAt: article.publishedAt, articles: [rich] }))
    expect(parsed?.articles[0]).toEqual(rich)
  })

  it('has nothing to offer before anything is cached', () => {
    expect(parseFeedCache(null)).toBeNull()
  })

  it('treats an empty cache as no cache, so it never reads as "your feed is empty"', () => {
    expect(parseFeedCache(stored({ savedAt: article.publishedAt, articles: [] }))).toBeNull()
  })

  it('rejects a corrupt entry rather than breaking the page', () => {
    expect(parseFeedCache('{ not json')).toBeNull()
  })

  it('rejects shapes that are not the cache object', () => {
    expect(parseFeedCache(stored([article]))).toBeNull()
    expect(parseFeedCache(stored('a string'))).toBeNull()
    expect(parseFeedCache(stored(null))).toBeNull()
  })

  it('rejects a cache with no usable timestamp — the notice has to name a time', () => {
    expect(parseFeedCache(stored({ articles: [article] }))).toBeNull()
    expect(parseFeedCache(stored({ savedAt: 'not a date', articles: [article] }))).toBeNull()
    expect(parseFeedCache(stored({ savedAt: 1_700_000_000, articles: [article] }))).toBeNull()
  })

  it('rejects the whole cache when any entry is missing a field the grid renders', () => {
    for (const field of ['id', 'title', 'description', 'url', 'publishedAt', 'sourceId']) {
      const broken: Record<string, unknown> = { ...article }
      delete broken[field]
      expect(
        parseFeedCache(stored({ savedAt: article.publishedAt, articles: [article, broken] })),
      ).toBeNull()
    }
  })

  it('rejects entries whose fields are the wrong type', () => {
    const wrong = { ...article, title: 42 }
    expect(parseFeedCache(stored({ savedAt: article.publishedAt, articles: [wrong] }))).toBeNull()
    expect(parseFeedCache(stored({ savedAt: article.publishedAt, articles: [null] }))).toBeNull()
    expect(
      parseFeedCache(stored({ savedAt: article.publishedAt, articles: ['guardian:1'] })),
    ).toBeNull()
  })
})

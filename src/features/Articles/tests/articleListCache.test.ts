import { beforeEach, describe, expect, it } from 'vitest'
import type { Article } from '@/core/sources/types'
import {
  directoryCache,
  feedCache,
  parseArticleListCache,
} from '@/features/Articles/utils/articleListCache'

const article: Article = {
  id: 'guardian:1',
  title: 'Mars rover lands safely',
  description: 'A long descent ends well.',
  url: 'https://example.test/mars',
  publishedAt: '2026-01-10T12:00:00.000Z',
  sourceId: 'guardian',
  sourceLabel: 'The Guardian',
}

const key = '["feed",{"authors":[],"categories":[],"sources":["guardian"]}]'

const stored = (value: unknown) => JSON.stringify(value)

describe('parseArticleListCache', () => {
  it('reads back a feed that was written', () => {
    const cache = { key, savedAt: '2026-06-01T09:30:00.000Z', articles: [article] }
    expect(parseArticleListCache(stored(cache))).toEqual(cache)
  })

  it('keeps the optional fields a provider did supply', () => {
    const rich = { ...article, author: 'A Reporter', imageUrl: 'https://example.test/a.jpg' }
    const parsed = parseArticleListCache(
      stored({ key, savedAt: article.publishedAt, articles: [rich] }),
    )
    expect(parsed?.articles[0]).toEqual(rich)
  })

  it('has nothing to offer before anything is cached', () => {
    expect(parseArticleListCache(null)).toBeNull()
  })

  it('treats an empty cache as no cache, so it never reads as "your feed is empty"', () => {
    expect(
      parseArticleListCache(stored({ key, savedAt: article.publishedAt, articles: [] })),
    ).toBeNull()
  })

  it('rejects a corrupt entry rather than breaking the page', () => {
    expect(parseArticleListCache('{ not json')).toBeNull()
  })

  it('rejects shapes that are not the cache object', () => {
    expect(parseArticleListCache(stored([article]))).toBeNull()
    expect(parseArticleListCache(stored('a string'))).toBeNull()
    expect(parseArticleListCache(stored(null))).toBeNull()
  })

  it('rejects a cache with no usable timestamp — the notice has to name a time', () => {
    expect(parseArticleListCache(stored({ key, articles: [article] }))).toBeNull()
    expect(
      parseArticleListCache(stored({ key, savedAt: 'not a date', articles: [article] })),
    ).toBeNull()
    expect(
      parseArticleListCache(stored({ key, savedAt: 1_700_000_000, articles: [article] })),
    ).toBeNull()
  })

  it('rejects the whole cache when any entry is missing a field the grid renders', () => {
    for (const field of ['id', 'title', 'description', 'url', 'publishedAt', 'sourceId']) {
      const broken: Record<string, unknown> = { ...article }
      delete broken[field]
      expect(
        parseArticleListCache(
          stored({ key, savedAt: article.publishedAt, articles: [article, broken] }),
        ),
      ).toBeNull()
    }
  })

  it('rejects a cache with no key — it belongs to no known selection', () => {
    const cache = { savedAt: article.publishedAt, articles: [article] }
    expect(parseArticleListCache(stored(cache))).toBeNull()
    expect(parseArticleListCache(stored({ ...cache, key: '' }))).toBeNull()
    expect(parseArticleListCache(stored({ ...cache, key: 7 }))).toBeNull()
  })

  it('rejects entries whose fields are the wrong type', () => {
    const wrong = { ...article, title: 42 }
    expect(
      parseArticleListCache(stored({ key, savedAt: article.publishedAt, articles: [wrong] })),
    ).toBeNull()
    expect(
      parseArticleListCache(stored({ key, savedAt: article.publishedAt, articles: [null] })),
    ).toBeNull()
    expect(
      parseArticleListCache(
        stored({ key, savedAt: article.publishedAt, articles: ['guardian:1'] }),
      ),
    ).toBeNull()
  })
})

describe('the per-screen caches', () => {
  const cache = { key, savedAt: '2026-06-01T09:30:00.000Z', articles: [article] }

  beforeEach(() => {
    localStorage.clear()
  })

  it('offers the feed back to the selection that wrote it', () => {
    feedCache.write(cache)
    expect(feedCache.read(key)).toEqual(cache)
  })

  it('offers nothing to a different selection, so its stories are never labelled as theirs', () => {
    feedCache.write(cache)
    expect(feedCache.read('["feed",{"authors":[],"categories":[],"sources":["nyt"]}]')).toBeNull()
    // Same sources, one category added — still a different feed.
    expect(
      feedCache.read('["feed",{"authors":[],"categories":["sport"],"sources":["guardian"]}]'),
    ).toBeNull()
  })

  it('offers nothing when nothing was ever written', () => {
    expect(feedCache.read(key)).toBeNull()
  })

  it('keeps the directory in its own slot, so neither screen evicts the other', () => {
    const directory = {
      key: '["articles",{"page":1}]',
      savedAt: '2026-06-02T09:30:00.000Z',
      articles: [{ ...article, title: 'Directory story' }],
    }
    feedCache.write(cache)
    directoryCache.write(directory)

    expect(feedCache.read(key)).toEqual(cache)
    expect(directoryCache.read(directory.key)).toEqual(directory)
    // And neither answers for the other's key.
    expect(directoryCache.read(key)).toBeNull()
    expect(feedCache.read(directory.key)).toBeNull()
  })
})

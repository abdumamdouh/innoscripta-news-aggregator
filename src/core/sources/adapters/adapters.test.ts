import { describe, expect, it, vi } from 'vitest'
import {
  bbcNewsSource,
  resolveCategories,
  selectItems as selectBbc,
} from '@/core/sources/adapters/bbc-rss'
import { guardianSource, selectItems as selectGuardian } from '@/core/sources/adapters/guardian'
import { newsapiSource, selectItems as selectNewsapi } from '@/core/sources/adapters/newsapi'
import { nytSource, selectItems as selectNyt } from '@/core/sources/adapters/nyt'
import { newsCredSource } from '@/core/sources/adapters/newscred.unavailable'
import { openNewsSource } from '@/core/sources/adapters/opennews.unavailable'
import { SOURCES } from '@/core/sources/registry'
import type { Article, ArticleQuery } from '@/core/sources/types'
import bbcFixture from '@/core/sources/adapters/__fixtures__/bbc-rss.json'
import guardianFixture from '@/core/sources/adapters/__fixtures__/guardian.json'
import newsapiFixture from '@/core/sources/adapters/__fixtures__/newsapi.json'
import nytFixture from '@/core/sources/adapters/__fixtures__/nyt.json'

/** Exactly the keys of `Article` — the homogeneity test's yardstick. */
const CANONICAL_KEYS = [
  'author',
  'category',
  'description',
  'id',
  'imageUrl',
  'publishedAt',
  'sourceId',
  'sourceLabel',
  'title',
  'url',
]

/** What `new Date().toISOString()` produces, and nothing else. */
const ISO = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/

const query = (over: Partial<ArticleQuery>): ArticleQuery => ({ page: 1, pageSize: 20, ...over })

const fromNewsapi = () => selectNewsapi(newsapiFixture).map((raw) => newsapiSource.normalize(raw))
const fromGuardian = () =>
  selectGuardian(guardianFixture).map((raw) => guardianSource.normalize(raw))
const fromNyt = () => selectNyt(nytFixture).map((raw) => nytSource.normalize(raw))
const fromBbc = () =>
  selectBbc(bbcFixture.xml, 'general').map((raw) => bbcNewsSource.normalize(raw))

const feeds = [
  { id: 'newsapi', label: 'NewsAPI', normalizeFixture: fromNewsapi },
  { id: 'guardian', label: 'The Guardian', normalizeFixture: fromGuardian },
  { id: 'nyt', label: 'The New York Times', normalizeFixture: fromNyt },
  { id: 'bbc', label: 'BBC News', normalizeFixture: fromBbc },
]

describe.each(feeds)('$id adapter — canonical mapping of the captured fixture', (feed) => {
  const articles = feed.normalizeFixture()

  it('maps every usable entry in the fixture', () => {
    expect(articles.length).toBeGreaterThan(0)
  })

  it('gives every article a non-empty title, description and url with no placeholders', () => {
    for (const article of articles) {
      expect(article.title).toBeTypeOf('string')
      expect(article.title.length).toBeGreaterThan(0)
      expect(article.description.length).toBeGreaterThan(0)
      expect(article.url).toMatch(/^https?:\/\//)
      expect(`${article.title} ${article.description} ${article.url}`).not.toMatch(/\[removed\]/i)
      // Markup is stripped, not passed through to a text node.
      expect(article.description).not.toMatch(/<[a-z/]/i)
    }
  })

  it('emits publishedAt in one ISO-8601 shape that Date.parse accepts', () => {
    for (const article of articles) {
      expect(article.publishedAt).toMatch(ISO)
      expect(Number.isNaN(Date.parse(article.publishedAt))).toBe(false)
    }
  })

  it('stamps its own sourceId and sourceLabel on every article', () => {
    for (const article of articles) {
      expect(article.sourceId).toBe(feed.id)
      expect(article.sourceLabel).toBe(feed.label)
    }
  })

  it('leaves imageUrl either a usable absolute URL or undefined', () => {
    // The provider supplies images in this fixture, so all-undefined means the
    // mapping missed them rather than that there was nothing to map.
    expect(articles.some((article) => article.imageUrl)).toBe(true)
    for (const article of articles) {
      if (article.imageUrl === undefined) continue
      expect(article.imageUrl).toMatch(/^https?:\/\/\S+$/)
    }
  })

  it('produces ids that are unique in the fixture and stable across re-normalization', () => {
    const ids = articles.map((article) => article.id)
    expect(new Set(ids).size).toBe(ids.length)
    expect(feed.normalizeFixture().map((article) => article.id)).toEqual(ids)
  })
})

describe('newsapi adapter — provider quirks', () => {
  const articles = fromNewsapi()

  it('drops the [Removed] tombstone entirely rather than rendering it', () => {
    expect(newsapiFixture.articles).toHaveLength(5)
    expect(articles).toHaveLength(4)
    expect(articles.map((article) => article.url)).not.toContain('https://removed.com')
  })

  it('keeps the author where NewsAPI supplies one and leaves it undefined where it is null', () => {
    expect(articles.map((article) => article.author)).toEqual([
      'Emma Roth',
      'Kate Abnett',
      undefined,
      'Olivia Raimonde, Sam Kim',
    ])
  })

  it('turns a null urlToImage into undefined, never an empty string', () => {
    const withoutImage = articles.find((article) => article.author === undefined) as Article
    expect(withoutImage.imageUrl).toBeUndefined()
    expect(Object.hasOwn(withoutImage, 'imageUrl')).toBe(true)
  })

  it('drops a partial entry and defaults a null description instead of half-building an Article', () => {
    const [real] = newsapiFixture.articles
    const items = selectNewsapi({
      articles: [
        { ...real, url: null },
        { ...real, publishedAt: 'not a date' },
        { ...real, description: null },
      ],
    })

    expect(items).toHaveLength(1)
    expect(items[0]?.description).toBeNull()
    expect(newsapiSource.normalize(items[0]!).description).toBe('')
  })
})

describe('guardian adapter — provider quirks', () => {
  const articles = fromGuardian()

  it('reads the byline and section the show-fields request asked for', () => {
    for (const article of articles) {
      expect(article.author?.length).toBeGreaterThan(0)
      expect(article.category?.length).toBeGreaterThan(0)
    }
  })

  it('converts webPublicationDate from Z-form to the same ISO shape as the others', () => {
    const [first] = articles
    expect(first?.publishedAt).toBe(
      new Date(guardianFixture.response.results[0]!.webPublicationDate).toISOString(),
    )
  })

  it('drops an entry with no webUrl and defaults a null trailText and absent thumbnail', () => {
    const [real] = guardianFixture.response.results
    const items = selectGuardian({
      response: {
        results: [
          { ...real, webUrl: '' },
          { ...real, id: 'mutated/no-fields', fields: { trailText: null, byline: null } },
        ],
      },
    })

    expect(items).toHaveLength(1)
    const article = guardianSource.normalize(items[0]!)
    expect(article.description).toBe('')
    expect(article.imageUrl).toBeUndefined()
    expect(article.author).toBeUndefined()
    expect(article.url).toMatch(/^https:\/\//)
  })
})

describe('nyt adapter — provider quirks', () => {
  const articles = fromNyt()

  it('takes the headline, abstract and section out of their nested shapes', () => {
    expect(articles[0]?.title).toBe('Nvidia Says Its Newest Chip Is Sold Out Into 2027')
    expect(articles[0]?.description).toMatch(/^The chipmaker/)
    expect(articles[0]?.category).toBe('Technology')
  })

  it('parses the +0000 pub_date form and strips the byline prefix', () => {
    expect(articles[0]?.publishedAt).toBe('2026-08-08T15:12:04.000Z')
    expect(articles[0]?.author).toBe('Tripp Mickle and Cade Metz')
  })

  it('resolves the legacy relative multimedia path and tolerates the object form', () => {
    const [real] = nytFixture.response.docs
    const [legacy, none] = selectNyt({
      response: {
        docs: [
          {
            ...real,
            _id: 'legacy',
            multimedia: [{ url: 'images/2026/08/08/legacy-articleLarge.jpg' }],
          },
          { ...real, _id: 'no-media', multimedia: null },
        ],
      },
    })

    expect(nytSource.normalize(legacy!).imageUrl).toBe(
      'https://static01.nyt.com/images/2026/08/08/legacy-articleLarge.jpg',
    )
    expect(nytSource.normalize(none!).imageUrl).toBeUndefined()
  })

  it('drops a doc with no headline, no web_url or an unparseable pub_date', () => {
    const [real] = nytFixture.response.docs
    const items = selectNyt({
      response: {
        docs: [
          { ...real, headline: { main: null } },
          { ...real, web_url: null },
          { ...real, pub_date: '' },
        ],
      },
    })

    expect(items).toEqual([])
  })

  it('falls back to snippet then lead_paragraph when the abstract is missing', () => {
    const [real] = nytFixture.response.docs
    const [noAbstract, textless] = selectNyt({
      response: {
        docs: [
          { ...real, abstract: null },
          { ...real, _id: 'bare', abstract: null, snippet: null },
        ],
      },
    })

    expect(nytSource.normalize(noAbstract!).description).toBe(real!.snippet)
    expect(nytSource.normalize(textless!).description).toBe(real!.lead_paragraph)
  })
})

describe('bbc-rss adapter — provider quirks', () => {
  const articles = fromBbc()

  it('parses the RFC-822 pubDate into the same ISO shape as the JSON providers', () => {
    expect(articles[0]?.publishedAt).toMatch(ISO)
    expect(articles[0]?.publishedAt).toBe(new Date('Sat, 08 Aug 2026 11:55:30 GMT').toISOString())
  })

  it('leaves author undefined — RSS carries no byline to read', () => {
    expect(articles.every((article) => article.author === undefined)).toBe(true)
  })

  it('stamps the category of the feed it fetched, since items carry none', () => {
    const technology = selectBbc(bbcFixture.xml, 'technology').map((raw) =>
      bbcNewsSource.normalize(raw),
    )
    expect(technology.every((article) => article.category === 'technology')).toBe(true)
    expect(articles.every((article) => article.category === 'general')).toBe(true)
  })

  it('reads media:thumbnail, preferring the widest crop', () => {
    const items = selectBbc(
      `<rss xmlns:media="http://search.yahoo.com/mrss/"><channel><item>
        <title>Two crops</title><link>https://www.bbc.co.uk/news/articles/x</link>
        <guid isPermaLink="false">https://www.bbc.co.uk/news/articles/x#0</guid>
        <pubDate>Sat, 08 Aug 2026 11:55:30 GMT</pubDate>
        <media:thumbnail width="240" height="135" url="https://ichef.bbci.co.uk/small.jpg"/>
        <media:thumbnail width="640" height="360" url="https://ichef.bbci.co.uk/large.jpg"/>
      </item></channel></rss>`,
    )
    expect(bbcNewsSource.normalize(items[0]!).imageUrl).toBe('https://ichef.bbci.co.uk/large.jpg')
  })

  it('drops an item with no link and defaults a missing description and thumbnail', () => {
    const items = selectBbc(
      `<rss><channel>
        <item><title>No link</title><pubDate>Sat, 08 Aug 2026 11:55:30 GMT</pubDate></item>
        <item><title>Bare but usable</title><link>https://www.bbc.co.uk/news/articles/y</link>
          <pubDate>Sat, 08 Aug 2026 11:55:30 GMT</pubDate></item>
      </channel></rss>`,
    )

    expect(items).toHaveLength(1)
    const article = bbcNewsSource.normalize(items[0]!)
    expect(article.title).toBe('Bare but usable')
    expect(article.description).toBe('')
    expect(article.imageUrl).toBeUndefined()
    // No guid — the link is the fallback id, so React keys still work.
    expect(article.id).toBe('bbc:https://www.bbc.co.uk/news/articles/y')
  })

  it('throws on a feed that is not well-formed, so the aggregator reports it as a failure', () => {
    expect(() => selectBbc('<rss><channel><item>')).toThrow(/well-formed/)
  })

  // It declares `category: true`, so the aggregator applies no client-side category
  // filter: whatever these resolve to is the whole answer to the query.
  describe('resolveCategories', () => {
    it('serves every requested category it has a feed for, not just the first', () => {
      expect(resolveCategories(query({ categories: ['world', 'uk'] }))).toEqual(['world', 'uk'])
    })

    it('drops only the categories BBC has no feed for', () => {
      expect(resolveCategories(query({ categories: ['sports-betting', 'health'] }))).toEqual([
        'health',
      ])
    })

    it('falls back to the front page when no category was asked for', () => {
      expect(resolveCategories(query({}))).toEqual(['general'])
    })

    it('serves nothing when BBC has a feed for none of them', () => {
      expect(resolveCategories(query({ categories: ['crypto'] }))).toEqual([])
    })
  })

  it('fetch merges one feed per requested category, tagging each with its own', async () => {
    const requested: string[] = []
    const stub = vi.spyOn(globalThis, 'fetch').mockImplementation(async (path) => {
      requested.push(String(path))
      return new Response(bbcFixture.xml, { status: 200 })
    })

    const raw = await bbcNewsSource.fetch(query({ categories: ['world', 'uk'] }))
    stub.mockRestore()
    const articles = raw.map((item) => bbcNewsSource.normalize(item))

    expect(requested).toEqual(['/api/bbc/news/world/rss.xml', '/api/bbc/news/uk/rss.xml'])
    expect(new Set(articles.map((a) => a.category))).toEqual(new Set(['world', 'uk']))
    expect(articles).toHaveLength(selectBbc(bbcFixture.xml).length * 2)
  })
})

describe('the single-interface guarantee', () => {
  const merged = [...fromNewsapi(), ...fromGuardian(), ...fromNyt(), ...fromBbc()]

  it('yields one homogeneous array — nothing downstream can tell the providers apart', () => {
    expect(merged.length).toBeGreaterThan(20)
    for (const article of merged) {
      expect(Object.keys(article).sort()).toEqual(CANONICAL_KEYS)
    }
    expect(new Set(merged.map((article) => article.sourceId))).toEqual(
      new Set(['newsapi', 'guardian', 'nyt', 'bbc']),
    )
  })

  it('carries no provider field name into the merged feed', () => {
    const keys = new Set(merged.flatMap((article) => Object.keys(article)))
    for (const providerKey of ['webUrl', 'webTitle', 'urlToImage', 'web_url', 'pub_date', 'guid']) {
      expect(keys.has(providerKey)).toBe(false)
    }
  })
})

describe('registry', () => {
  it('lists six sources, four of them available', () => {
    expect(SOURCES).toHaveLength(6)
    expect(SOURCES.filter((source) => source.available).map((source) => source.id)).toEqual([
      'newsapi',
      'guardian',
      'nyt',
      'bbc',
    ])
  })

  it('keeps the two unreachable providers listed with a reason instead of hiding them', () => {
    for (const source of [openNewsSource, newsCredSource]) {
      expect(SOURCES).toContain(source)
      expect(source.available).toBe(false)
      expect(source.unavailableReason?.length).toBeGreaterThan(20)
    }
  })
})

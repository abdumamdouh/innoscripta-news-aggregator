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
import { description } from '@/core/sources/adapters/shared'
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

/**
 * What the provider itself put in the description slot, index-aligned with
 * `normalizeFixture()`. Real captures contain entries the provider left null, and
 * "non-empty description" only means anything for the ones where it did not.
 */
const feeds = [
  {
    id: 'newsapi',
    label: 'NewsAPI',
    normalizeFixture: fromNewsapi,
    suppliedDescriptions: () => selectNewsapi(newsapiFixture).map((raw) => raw.description),
    suppliedAuthors: () => selectNewsapi(newsapiFixture).map((raw) => raw.author),
  },
  {
    id: 'guardian',
    label: 'The Guardian',
    normalizeFixture: fromGuardian,
    suppliedDescriptions: () => selectGuardian(guardianFixture).map((raw) => raw.fields?.trailText),
    suppliedAuthors: () => selectGuardian(guardianFixture).map((raw) => raw.fields?.byline),
  },
  {
    id: 'nyt',
    label: 'The New York Times',
    normalizeFixture: fromNyt,
    suppliedDescriptions: () =>
      selectNyt(nytFixture).map((raw) => raw.abstract ?? raw.snippet ?? raw.lead_paragraph),
    suppliedAuthors: () => selectNyt(nytFixture).map((raw) => raw.byline?.original),
  },
  {
    id: 'bbc',
    label: 'BBC News',
    normalizeFixture: fromBbc,
    suppliedDescriptions: () =>
      selectBbc(bbcFixture.xml, 'general').map(
        ({ item }) => item.getElementsByTagName('description')[0]?.textContent,
      ),
    // BBC RSS has no author field at all, so nothing is ever supplied.
    suppliedAuthors: () => selectBbc(bbcFixture.xml, 'general').map(() => undefined),
  },
]

describe.each(feeds)('$id adapter — canonical mapping of the captured fixture', (feed) => {
  const articles = feed.normalizeFixture()

  it('maps every usable entry in the fixture', () => {
    expect(articles.length).toBeGreaterThan(0)
  })

  it('gives every article a non-empty title and url with no placeholders', () => {
    for (const article of articles) {
      expect(article.title).toBeTypeOf('string')
      expect(article.title.length).toBeGreaterThan(0)
      expect(article.url).toMatch(/^https?:\/\//)
      expect(`${article.title} ${article.description} ${article.url}`).not.toMatch(/\[removed\]/i)
      // Markup is stripped, not passed through to a text node.
      expect(article.description).not.toMatch(/<[a-z/]/i)
    }
  })

  it('carries a description through wherever the provider supplied one, and "" where it did not', () => {
    const supplied = feed.suppliedDescriptions()
    expect(supplied).toHaveLength(articles.length)
    // A capture in which the provider described nothing would make this vacuous.
    expect(supplied.filter((value) => value?.trim()).length).toBeGreaterThan(0)

    articles.forEach((article, index) => {
      expect(article.description).toBeTypeOf('string')
      if (supplied[index]?.trim()) {
        expect(article.description.length).toBeGreaterThan(0)
      } else {
        expect(article.description).toBe('')
      }
    })
  })

  it('populates author exactly where the provider supplied one, never inventing it', () => {
    const supplied = feed.suppliedAuthors()
    articles.forEach((article, index) => {
      if (supplied[index]?.trim()) {
        expect(article.author?.length).toBeGreaterThan(0)
      } else {
        expect(article.author).toBeUndefined()
      }
      // Present as a key either way, so the merged shape stays homogeneous.
      expect(Object.hasOwn(article, 'author')).toBe(true)
    })
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

  it('maps the whole captured page — the real response carries no unusable entry', () => {
    expect(newsapiFixture.articles).toHaveLength(100)
    expect(articles).toHaveLength(100)
  })

  // The capture happens to hold no tombstone, so this is the hand-mutated case: a
  // verbatim `[Removed]` entry as NewsAPI emits it, spliced into the real payload.
  it('drops the [Removed] tombstone entirely rather than rendering it', () => {
    const items = selectNewsapi({
      articles: [
        ...newsapiFixture.articles,
        {
          source: { id: null, name: '[Removed]' },
          author: null,
          title: '[Removed]',
          description: '[Removed]',
          url: 'https://removed.com',
          urlToImage: null,
          publishedAt: '1970-01-01T00:00:00Z',
          content: '[Removed]',
        },
      ],
    })

    expect(items).toHaveLength(newsapiFixture.articles.length)
    expect(items.map((raw) => raw.url)).not.toContain('https://removed.com')
  })

  it('has real entries on both sides of the author and image branches', () => {
    // Keeps the generic per-field assertions from passing vacuously.
    expect(newsapiFixture.articles.some((raw) => raw.author === null)).toBe(true)
    expect(newsapiFixture.articles.some((raw) => raw.author !== null)).toBe(true)
    expect(newsapiFixture.articles.some((raw) => raw.urlToImage === null)).toBe(true)
    expect(newsapiFixture.articles.some((raw) => raw.description === null)).toBe(true)
  })

  it('turns a null urlToImage into undefined, never an empty string', () => {
    const index = newsapiFixture.articles.findIndex((raw) => raw.urlToImage === null)
    const withoutImage = articles[index] as Article

    expect(withoutImage.url).toBe(newsapiFixture.articles[index]?.url)
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
    expect(articles[0]?.title).toBe(
      'Journalist Quits Kenosha Paper in Protest of Its Jacob Blake Rally Coverage',
    )
    expect(articles[0]?.description).toMatch(/^Daniel Thompson, an editor at The Kenosha News/)
    expect(articles[0]?.category).toBe('Business Day')
  })

  it('parses the +0000 pub_date form and strips the byline prefix', () => {
    expect(nytFixture.response.docs[0]?.pub_date).toBe('2020-08-31T22:13:27+0000')
    expect(articles[0]?.publishedAt).toBe('2020-08-31T22:13:27.000Z')
    expect(nytFixture.response.docs[0]?.byline?.original).toBe('By Marc Tracy')
    expect(articles[0]?.author).toBe('Marc Tracy')
  })

  it('resolves the relative multimedia path in the capture against the image CDN', () => {
    // NYT ships `multimedia[].url` without a host; a raw pass-through would 404.
    expect(nytFixture.response.docs[0]?.multimedia[0]?.url).toMatch(/^images\//)
    expect(articles[0]?.imageUrl).toBe(
      `https://static01.nyt.com/${nytFixture.response.docs[0]?.multimedia[0]?.url}`,
    )
  })

  it('leaves imageUrl undefined for the docs the capture gives no multimedia at all', () => {
    const bare = nytFixture.response.docs.flatMap((doc, index) =>
      doc.multimedia.length === 0 ? [index] : [],
    )
    expect(bare.length).toBeGreaterThan(0)
    for (const index of bare) expect(articles[index]?.imageUrl).toBeUndefined()
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

/**
 * The `?? ''` that used to sit in all four adapters, now one shared function. `''` is the
 * only empty string `Article` is allowed to carry, so this is where that is pinned down —
 * items 5/6 render `articles.noDescription` for it rather than a blank line.
 */
describe('description()', () => {
  it('returns "" — never undefined — when the provider supplied nothing usable', () => {
    for (const absent of [undefined, null, '', '   ', '[Removed]', 'null', 'NONE', 42, {}]) {
      expect(description(absent)).toBe('')
    }
    // No candidates at all is the same story, not a crash.
    expect(description()).toBe('')
  })

  it('strips markup and collapses whitespace instead of emitting a text node of HTML', () => {
    expect(description('<p>Two  <b>words</b></p>\n')).toBe('Two words')
    // Markup that leaves nothing behind is absence, not an empty-looking description.
    expect(description('<br/>')).toBe('')
  })

  it('takes the first usable candidate, skipping empty and placeholder ones', () => {
    // NYT's real fallback order: abstract → snippet → lead_paragraph.
    expect(description(null, '  ', 'the snippet')).toBe('the snippet')
    expect(description('[removed]', 'the lead paragraph')).toBe('the lead paragraph')
    expect(description('the abstract', 'the snippet')).toBe('the abstract')
  })

  it('is the single path all four adapters take, so none can drift back to its own default', () => {
    const sources = [newsapiSource, guardianSource, nytSource, bbcNewsSource]
    expect(sources.map((source) => source.id)).toEqual(['newsapi', 'guardian', 'nyt', 'bbc'])
    // Descriptionless payloads through each adapter's own normalize, one shared answer.
    const descriptionless: Record<string, unknown>[] = [
      { title: 't', url: 'https://e.test/a', publishedAt: '2024-01-01T00:00:00Z' },
      { webTitle: 't', webUrl: 'https://e.test/a', webPublicationDate: '2024-01-01T00:00:00Z' },
      { headline: { main: 't' }, web_url: 'https://e.test/a', pub_date: '2024-01-01T00:00:00Z' },
    ]
    for (const [index, source] of [newsapiSource, guardianSource, nytSource].entries()) {
      expect(source.normalize(descriptionless[index] as never).description).toBe('')
    }
    // BBC's raw is a DOM element, so its descriptionless item comes from real feed XML.
    const [bare] = selectBbc(
      `<rss><channel><item><title>t</title><link>https://e.test/a</link>
        <pubDate>Sat, 08 Aug 2026 11:55:30 GMT</pubDate></item></channel></rss>`,
    )
    expect(bbcNewsSource.normalize(bare!).description).toBe('')
  })
})

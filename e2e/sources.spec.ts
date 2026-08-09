import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { expect, test } from '@playwright/test'

/**
 * Item 3 ships no screen of its own — the article list is item 5. What it does ship is
 * code that only a real browser can vouch for: `DOMParser` over BBC's XML, and the
 * `/api/*` proxy hop. So this spec drives the adapter through the running dev server
 * with the captured feed served from the network layer, exactly as the app will.
 */
const fixture = fileURLToPath(
  new URL('../src/core/sources/adapters/__fixtures__/bbc-rss.json', import.meta.url),
)
const feedXml = (JSON.parse(readFileSync(fixture, 'utf8')) as { xml: string }).xml

const readFixture = (name: string) =>
  readFileSync(
    fileURLToPath(new URL(`../src/core/sources/adapters/__fixtures__/${name}`, import.meta.url)),
    'utf8',
  )

interface Crop {
  url: string
  width: number
}

test.describe('news source adapters in the browser', () => {
  test('the BBC adapter turns the proxied RSS feed into canonical articles', async ({ page }) => {
    let requestedPath = ''
    await page.route('**/api/bbc/**', async (route) => {
      requestedPath = new URL(route.request().url()).pathname
      await route.fulfill({ contentType: 'application/rss+xml', body: feedXml })
    })

    await page.goto('/')
    await expect(page.getByRole('navigation', { name: 'Primary' })).toBeVisible()

    await page.addScriptTag({
      type: 'module',
      content: `
        import { bbcNewsSource } from '/src/core/sources/adapters/bbc-rss.ts'
        const raw = await bbcNewsSource.fetch({ page: 1, pageSize: 5, categories: ['technology'] })
        window.__articles = raw.map((item) => bbcNewsSource.normalize(item))
      `,
    })
    await page.waitForFunction(() => '__articles' in globalThis)

    const articles = (await page.evaluate(
      () => (globalThis as unknown as Record<string, unknown>).__articles,
    )) as Record<string, unknown>[]

    expect(requestedPath).toBe('/api/bbc/news/technology/rss.xml')
    expect(articles.length).toBeGreaterThan(10)
    for (const article of articles as Record<string, unknown>[]) {
      expect(String(article.title).length).toBeGreaterThan(0)
      expect(String(article.url)).toMatch(/^https?:\/\//)
      expect(String(article.publishedAt)).toMatch(/^\d{4}-\d{2}-\d{2}T[\d:.]+Z$/)
      expect(article.sourceLabel).toBe('BBC News')
      expect(article.category).toBe('technology')
      expect(article.author).toBeUndefined()
    }
  })

  /**
   * The JSON providers' captured responses are real bodies, so this is the one place
   * they are pushed through the whole browser path — proxy hop, `fetch`, `normalize` —
   * rather than imported straight into a Node test.
   */
  const jsonFeeds = [
    { id: 'newsapi', label: 'NewsAPI', route: '**/api/newsapi/**', file: 'newsapi.json' },
    { id: 'nyt', label: 'The New York Times', route: '**/api/nyt/**', file: 'nyt.json' },
  ]

  for (const feed of jsonFeeds) {
    test(`the ${feed.id} adapter normalizes its captured response in the browser`, async ({
      page,
    }) => {
      await page.route(feed.route, (route) =>
        route.fulfill({ contentType: 'application/json', body: readFixture(feed.file) }),
      )

      await page.goto('/')
      await page.addScriptTag({
        type: 'module',
        content: `
          import { SOURCES } from '/src/core/sources/registry.ts'
          const source = SOURCES.find((candidate) => candidate.id === '${feed.id}')
          const raw = await source.fetch({ page: 1, pageSize: 20, q: 'technology' })
          window.__articles = raw.map((item) => source.normalize(item))
        `,
      })
      await page.waitForFunction(() => '__articles' in globalThis)

      const articles = (await page.evaluate(
        () => (globalThis as unknown as Record<string, unknown>).__articles,
      )) as Record<string, unknown>[]

      expect(articles.length).toBeGreaterThan(0)
      for (const article of articles) {
        expect(String(article.title).length).toBeGreaterThan(0)
        expect(String(article.url)).toMatch(/^https?:\/\//)
        expect(String(article.publishedAt)).toMatch(/^\d{4}-\d{2}-\d{2}T[\d:.]+Z$/)
        expect(article.sourceId).toBe(feed.id)
        expect(article.sourceLabel).toBe(feed.label)
        // Either a usable URL or absent — never an empty string.
        expect(article.imageUrl === undefined || String(article.imageUrl).startsWith('http')).toBe(
          true,
        )
      }
      // Stable, unique ids: React keys and dedupe both depend on it.
      expect(new Set(articles.map((article) => article.id)).size).toBe(articles.length)
    })
  }

  test('the nyt adapter picks the widest legacy crop through the proxy hop', async ({ page }) => {
    const body = readFixture('nyt.json')
    await page.route('**/api/nyt/**', (route) =>
      route.fulfill({ contentType: 'application/json', body }),
    )

    await page.goto('/')
    await page.addScriptTag({
      type: 'module',
      content: `
        import { nytSource } from '/src/core/sources/adapters/nyt.ts'
        const raw = await nytSource.fetch({ page: 1, pageSize: 20, q: 'technology' })
        window.__articles = raw.map((item) => nytSource.normalize(item))
      `,
    })
    await page.waitForFunction(() => '__articles' in globalThis)

    const imageUrl = await page.evaluate(
      () =>
        (
          (globalThis as unknown as Record<string, unknown>).__articles as Record<string, string>[]
        )[0]?.imageUrl,
    )

    const crops = (JSON.parse(body) as { response: { docs: { multimedia: Crop[] }[] } }).response
      .docs[0]!.multimedia
    const widest = crops.reduce((best, crop) => (crop.width > best.width ? crop : best), crops[0]!)
    expect(imageUrl).toBe(`https://static01.nyt.com/${widest.url}`)
    // The capture's first crop is a small one — proving index 0 is not what got picked.
    expect(imageUrl).not.toBe(`https://static01.nyt.com/${crops[0]!.url}`)
  })

  /**
   * Same reason this file exists at all: there is no article view yet (items 5/6), so the
   * empty-description contract is proved where it is real — through the browser fetch and
   * normalize path, with the description stripped out of the captured responses exactly as
   * a provider that has none would send them. `''`, never `undefined`, never a blank
   * `null` leaking into a text node.
   */
  const stripDescriptions = (json: string) =>
    JSON.parse(json, (key, value) =>
      ['description', 'trailText', 'abstract', 'snippet', 'lead_paragraph'].includes(key)
        ? null
        : (value as unknown),
    ) as unknown

  for (const feed of jsonFeeds) {
    test(`the ${feed.id} adapter yields "" for every description-less article`, async ({
      page,
    }) => {
      await page.route(feed.route, (route) =>
        route.fulfill({
          contentType: 'application/json',
          body: JSON.stringify(stripDescriptions(readFixture(feed.file))),
        }),
      )

      await page.goto('/')
      await page.addScriptTag({
        type: 'module',
        content: `
          import { SOURCES } from '/src/core/sources/registry.ts'
          const source = SOURCES.find((candidate) => candidate.id === '${feed.id}')
          const raw = await source.fetch({ page: 1, pageSize: 20, q: 'technology' })
          window.__articles = raw.map((item) => source.normalize(item))
        `,
      })
      await page.waitForFunction(() => '__articles' in globalThis)

      const articles = (await page.evaluate(
        () => (globalThis as unknown as Record<string, unknown>).__articles,
      )) as Record<string, unknown>[]

      // Stripping the summary must not drop the article — title/url/publishedAt still stand.
      expect(articles.length).toBeGreaterThan(0)
      for (const article of articles) {
        expect(article.description).toBe('')
        expect(String(article.title).length).toBeGreaterThan(0)
        expect(String(article.url)).toMatch(/^https?:\/\//)
      }
    })
  }

  test('the BBC adapter yields "" when the feed carries no <description>', async ({ page }) => {
    await page.route('**/api/bbc/**', (route) =>
      route.fulfill({
        contentType: 'application/rss+xml',
        body: feedXml.replace(/<description>[\s\S]*?<\/description>/g, ''),
      }),
    )

    await page.goto('/')
    await page.addScriptTag({
      type: 'module',
      content: `
        import { bbcNewsSource } from '/src/core/sources/adapters/bbc-rss.ts'
        const raw = await bbcNewsSource.fetch({ page: 1, pageSize: 5 })
        window.__articles = raw.map((item) => bbcNewsSource.normalize(item))
      `,
    })
    await page.waitForFunction(() => '__articles' in globalThis)

    const articles = (await page.evaluate(
      () => (globalThis as unknown as Record<string, unknown>).__articles,
    )) as Record<string, unknown>[]

    expect(articles.length).toBeGreaterThan(10)
    for (const article of articles) {
      expect(article.description).toBe('')
      expect(String(article.title).length).toBeGreaterThan(0)
    }
    // The shell is untouched by any of this — no blank-description crash.
    await expect(page.getByRole('navigation', { name: 'Primary' })).toBeVisible()
  })

  test('a dead provider surfaces as a failure, not a thrown page', async ({ page }) => {
    await page.route('**/api/bbc/**', (route) => route.fulfill({ status: 503, body: 'nope' }))
    await page.goto('/')

    await page.addScriptTag({
      type: 'module',
      content: `
        import { aggregate } from '/src/core/sources/aggregator.ts'
        import { bbcNewsSource } from '/src/core/sources/adapters/bbc-rss.ts'

        // A second source that answers, so this is a partial failure. BBC alone would be a
        // total one, and those reject rather than resolving an empty feed.
        const alive = {
          id: 'stub', label: 'Stub', available: true,
          capabilities: { query: true, dateRange: true, category: true, author: true, pagination: true },
          fetch: async () => [{ id: 'a', title: 'Still standing', description: '', url: 'https://stub.test/a', publishedAt: '2026-06-01T00:00:00.000Z', sourceId: 'stub', sourceLabel: 'Stub' }],
          normalize: (raw) => raw,
        }
        window.__result = await aggregate({ limit: 5 }, [bbcNewsSource, alive])
      `,
    })
    await page.waitForFunction(() => '__result' in globalThis)

    const result = (await page.evaluate(
      () => (globalThis as unknown as Record<string, unknown>).__result,
    )) as { articles: unknown[]; failures: unknown[] }

    expect(result.articles).toHaveLength(1)
    expect(result.failures).toEqual([{ sourceId: 'bbc', reason: expect.stringContaining('503') }])
    // The shell is still standing — a dead provider must not take the page down.
    await expect(page.getByRole('navigation', { name: 'Primary' })).toBeVisible()
  })
})

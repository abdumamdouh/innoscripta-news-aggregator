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

  test('a dead provider surfaces as a failure, not a thrown page', async ({ page }) => {
    await page.route('**/api/bbc/**', (route) => route.fulfill({ status: 503, body: 'nope' }))
    await page.goto('/')

    await page.addScriptTag({
      type: 'module',
      content: `
        import { aggregate } from '/src/core/sources/aggregator.ts'
        import { bbcNewsSource } from '/src/core/sources/adapters/bbc-rss.ts'
        window.__result = await aggregate({ page: 1, pageSize: 5 }, [bbcNewsSource])
      `,
    })
    await page.waitForFunction(() => '__result' in globalThis)

    const result = (await page.evaluate(
      () => (globalThis as unknown as Record<string, unknown>).__result,
    )) as { articles: unknown[]; failures: unknown[] }

    expect(result.articles).toEqual([])
    expect(result.failures).toEqual([{ sourceId: 'bbc', reason: expect.stringContaining('503') }])
    // The shell is still standing — a dead provider must not take the page down.
    await expect(page.getByRole('navigation', { name: 'Primary' })).toBeVisible()
  })
})

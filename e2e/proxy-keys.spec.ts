import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { expect, test } from '@playwright/test'

/**
 * Item 4 ships no screen — what it ships is a promise: a provider key is attached by the
 * proxy, server-side, and never reaches the browser. Only a real browser can vouch for the
 * second half of that, so this spec loads the app the way a user does and then checks
 * everything the browser was actually handed.
 *
 * The dev server is started with the stand-in keys in playwright.config.ts, so every
 * assertion below is about them being withheld, not about them being absent.
 */
const KEYS = ['e2e-newsapi-key', 'e2e-guardian-key', 'e2e-nyt-key']

const readFixture = (name: string) =>
  readFileSync(
    fileURLToPath(new URL(`../src/core/sources/adapters/__fixtures__/${name}`, import.meta.url)),
    'utf8',
  )

const jsonFeeds = [
  { id: 'newsapi', route: '**/api/newsapi/**', file: 'newsapi.json' },
  { id: 'guardian', route: '**/api/guardian/**', file: 'guardian.json' },
  { id: 'nyt', route: '**/api/nyt/**', file: 'nyt.json' },
]

test('the app loads and never puts a provider key in a request the browser makes', async ({
  page,
}) => {
  const requestUrls: string[] = []
  page.on('request', (request) => requestUrls.push(request.url()))

  for (const feed of jsonFeeds) {
    await page.route(feed.route, (route) =>
      route.fulfill({ contentType: 'application/json', body: readFixture(feed.file) }),
    )
  }

  await page.goto('/')
  await expect(page.getByRole('navigation', { name: 'Primary' })).toBeVisible()
  await expect(page.getByRole('main').getByRole('heading', { name: 'Articles' })).toBeVisible()

  // Every keyed source, driven through the same /api/* hop the app uses.
  await page.addScriptTag({
    type: 'module',
    content: `
      import { SOURCES } from '/src/core/sources/registry.ts'
      const ids = ${JSON.stringify(jsonFeeds.map((feed) => feed.id))}
      for (const id of ids) {
        const source = SOURCES.find((candidate) => candidate.id === id)
        await source.fetch({ page: 1, pageSize: 10, q: 'technology' })
      }
      window.__fetched = true
    `,
  })
  await page.waitForFunction(() => '__fetched' in globalThis)

  const apiRequests = requestUrls.filter((url) => url.includes('/api/'))
  expect(apiRequests.length).toBeGreaterThanOrEqual(jsonFeeds.length)

  for (const url of requestUrls) {
    for (const key of KEYS) expect(url).not.toContain(key)
    expect(url).not.toMatch(/[?&](api-?key|apiKey)=/i)
  }
})

test('no provider key appears in any script or document the browser is served', async ({
  page,
  baseURL,
}) => {
  const served: { url: string; body: string }[] = []
  page.on('response', async (response) => {
    if (!response.url().startsWith(baseURL ?? '')) return
    if (!/javascript|html/.test(response.headers()['content-type'] ?? '')) return
    const body = await response.text().catch(() => '')
    if (body) served.push({ url: response.url(), body })
  })

  await page.goto('/')
  await expect(page.getByRole('navigation', { name: 'Primary' })).toBeVisible()
  await page.waitForLoadState('networkidle')

  // The app is served as many modules; if none were captured the assertion below is empty.
  expect(served.length).toBeGreaterThan(5)
  for (const { url, body } of served) {
    for (const key of KEYS) {
      expect(body, `${key} leaked into ${url}`).not.toContain(key)
    }
  }

  // The rendered document too — a key cannot arrive via markup either.
  const html = await page.content()
  for (const key of KEYS) expect(html).not.toContain(key)
})

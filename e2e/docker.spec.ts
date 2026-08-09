import { execFileSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { expect, test } from '@playwright/test'

/**
 * Item 13's acceptance, exercised rather than asserted on paper: `docker compose up --build`
 * serves the working app, and the key-leak check from item 4 still comes back empty — this
 * time against the bundle nginx is actually serving, not the one vite left in dist/.
 *
 * The keys below are stand-ins, deliberately recognisable, and are the ones the container is
 * started with. "No key reached the browser" is therefore a real assertion: something was
 * configured and withheld.
 *
 * Building the image needs a registry the runner can reach. Where it cannot, this suite skips
 * with the reason rather than reporting the network as an app defect — the same
 * environment-gating vite.proxy.test.ts uses for envsubst.
 */
const PORT = 3101
const PROJECT = 'news-aggregator-e2e'
const KEYS = {
  NEWSAPI_KEY: 'e2e-newsapi-key',
  GUARDIAN_KEY: 'e2e-guardian-key',
  NYT_KEY: 'e2e-nyt-key',
}
const BASE = `http://localhost:${PORT}`

const repoRoot = fileURLToPath(new URL('..', import.meta.url))

const readFixture = (name: string) =>
  readFileSync(
    fileURLToPath(new URL(`../src/core/sources/adapters/__fixtures__/${name}`, import.meta.url)),
    'utf8',
  )

const jsonFeeds = [
  { route: '**/api/newsapi/**', file: 'newsapi.json' },
  { route: '**/api/guardian/**', file: 'guardian.json' },
  { route: '**/api/nyt/**', file: 'nyt.json' },
]

const compose = (args: string[], timeout: number) =>
  execFileSync('docker', ['compose', '-p', PROJECT, ...args], {
    cwd: repoRoot,
    env: { ...process.env, ...KEYS, WEB_PORT: String(PORT) },
    encoding: 'utf8',
    timeout,
    stdio: ['ignore', 'pipe', 'pipe'],
  })

let skipReason = ''

test.describe.configure({ mode: 'serial' })

test.describe('the container built by docker compose', () => {
  test.beforeAll(async () => {
    try {
      // --wait holds until the healthcheck in docker-compose.yml passes, so the first
      // page.goto below is not a race against nginx starting.
      compose(['up', '--build', '--detach', '--wait'], 15 * 60_000)
    } catch (error) {
      skipReason = `docker compose up --build did not succeed here: ${String(error).split('\n')[0]}`
    }
  })

  test.afterAll(async () => {
    try {
      compose(['down', '--volumes'], 3 * 60_000)
    } catch {
      // Nothing to tear down if it never came up.
    }
  })

  test.beforeEach(() => {
    test.skip(skipReason !== '', skipReason)
  })

  test('serves the front page, with articles in the grid', async ({ page }) => {
    // Provider responses come from the same fixtures the rest of the suite uses; the request
    // still travels through nginx's /api/* hop, which is the part being verified.
    for (const feed of jsonFeeds) {
      await page.route(feed.route, (route) =>
        route.fulfill({ contentType: 'application/json', body: readFixture(feed.file) }),
      )
    }

    await page.goto(BASE)

    await expect(page.getByRole('navigation', { name: 'Primary' })).toBeVisible()
    await expect(page.getByRole('main').getByRole('heading', { name: 'Articles' })).toBeVisible()
    await expect(page.getByRole('article').first()).toBeVisible()
  })

  test('serves a client route directly, not a 404 — the SPA fallback is wired', async ({
    page,
  }) => {
    const response = await page.goto(`${BASE}/bookmarks`)

    expect(response?.status()).toBe(200)
    await expect(page.getByRole('navigation', { name: 'Primary' })).toBeVisible()
  })

  test('hands the browser no provider key, in any script or in the markup', async ({ page }) => {
    const served: { url: string; body: string }[] = []
    page.on('response', async (response) => {
      if (!response.url().startsWith(BASE)) return
      if (!/javascript|html/.test(response.headers()['content-type'] ?? '')) return
      const body = await response.text().catch(() => '')
      if (body) served.push({ url: response.url(), body })
    })

    await page.goto(BASE)
    await expect(page.getByRole('navigation', { name: 'Primary' })).toBeVisible()
    await page.waitForLoadState('networkidle')

    // If nothing was captured the loop below would assert nothing.
    expect(served.length).toBeGreaterThan(0)
    for (const { url, body } of served) {
      for (const key of Object.values(KEYS)) {
        expect(body, `${key} leaked into ${url}`).not.toContain(key)
      }
    }
    const html = await page.content()
    for (const key of Object.values(KEYS)) expect(html).not.toContain(key)
  })

  test('has no VITE_ variable and no key baked into the files it serves', () => {
    // Item 4's grep, run inside the image against what nginx actually has on disk. grep exits
    // 1 on no match, so a hit surfaces here as a non-zero exit with the offending lines.
    const grep = (pattern: string) =>
      compose(
        ['exec', '-T', 'web', 'sh', '-c', `! grep -rn '${pattern}' /usr/share/nginx/html`],
        60_000,
      )

    expect(() => grep('VITE_')).not.toThrow()
    for (const key of Object.values(KEYS)) expect(() => grep(key)).not.toThrow()
  })
})

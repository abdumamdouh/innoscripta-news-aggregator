import { execFileSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { expect, test } from '@playwright/test'
import { mockProviders } from './providerMocks.ts'

/**
 * The item's acceptance is one sentence — `docker compose up --build` serves the working app —
 * and nothing short of building the image and opening it in a browser can vouch for it. Every
 * other spec runs against the vite dev server, which papers over exactly the things the image
 * can get wrong: a bundle copied to the wrong root, an entrypoint that never renders the
 * config, and SPA deep links, which vite answers for free and nginx only answers if
 * `try_files` is really in the config the container rendered.
 *
 * So this one builds and runs the real stack. It is skipped, not failed, where there is no
 * docker daemon — same treatment vite.proxy.test.ts gives a machine without envsubst.
 */
const repoRoot = fileURLToPath(new URL('..', import.meta.url))

/**
 * Its own project name and its own port, so the run cannot collide with — or tear down — a
 * stack the developer already has up on the compose default.
 */
const PROJECT = 'news-aggregator-e2e'
const PORT = 8099
const base = `http://localhost:${PORT}`

/**
 * Recognisable stand-ins, passed to the container the way real keys would be. The leak
 * assertion is then about them being withheld, not about there being nothing to leak.
 */
const KEYS = {
  NEWSAPI_KEY: 'docker-newsapi-key',
  GUARDIAN_KEY: 'docker-guardian-key',
  NYT_KEY: 'docker-nyt-key',
}

const dockerAvailable = (() => {
  try {
    execFileSync('docker', ['info', '--format', '{{.ServerVersion}}'], { stdio: 'ignore' })
    return true
  } catch {
    return false
  }
})()

const compose = (...args: string[]) =>
  execFileSync('docker', ['compose', '-p', PROJECT, ...args], {
    cwd: repoRoot,
    env: { ...process.env, ...KEYS, WEB_PORT: String(PORT) },
    stdio: 'inherit',
    timeout: 15 * 60_000,
  })

test.describe('the container serves the working app', () => {
  test.skip(!dockerAvailable, 'no docker daemon on this machine')
  // One build, shared by the assertions below.
  test.describe.configure({ mode: 'serial', timeout: 20 * 60_000 })

  test.beforeAll(() => {
    compose('up', '--build', '--detach', '--wait')
  })

  test.afterAll(() => {
    compose('down', '--volumes')
  })

  test.beforeEach(async ({ page }) => {
    await mockProviders(page)
  })

  test('opens the front page from the image, with real stories in the grid', async ({ page }) => {
    await page.goto(`${base}/`)

    await expect(page.getByRole('navigation', { name: 'Primary' })).toBeVisible()
    await expect(page.getByRole('main').getByRole('heading', { name: 'Articles' })).toBeVisible()
    await expect(page.locator('[aria-busy="true"]')).toHaveCount(0)
    // The bundle landed where nginx serves from, and the app actually ran.
    expect(await page.getByRole('article').count()).toBeGreaterThan(0)
  })

  test('answers a deep link with the app rather than a 404', async ({ page }) => {
    // Typed straight into the address bar: no client-side navigation gets a say. This is
    // the `try_files $uri $uri/ /index.html` line, and only nginx can answer it.
    const response = await page.goto(`${base}/bookmarks`)

    expect(response?.status()).toBe(200)
    await expect(
      page.getByRole('main').getByRole('heading', { name: 'Nothing saved yet' }),
    ).toBeVisible()
  })

  test('hands the browser no provider key, exactly as the dev proxy does not', async ({ page }) => {
    const served: { url: string; body: string }[] = []
    page.on('response', async (response) => {
      if (!response.url().startsWith(base)) return
      if (!/javascript|html/.test(response.headers()['content-type'] ?? '')) return
      const body = await response.text().catch(() => '')
      if (body) served.push({ url: response.url(), body })
    })

    await page.goto(`${base}/`)
    await expect(page.getByRole('navigation', { name: 'Primary' })).toBeVisible()
    await page.waitForLoadState('networkidle')

    expect(served.length).toBeGreaterThan(1)
    for (const { url, body } of served) {
      for (const key of Object.values(KEYS)) {
        expect(body, `${key} leaked into ${url}`).not.toContain(key)
      }
    }
    expect(await page.content()).not.toContain('docker-')
  })
})

import { expect, test } from '@playwright/test'
import type { Page } from '@playwright/test'
import { PAGE_SIZE, mockProviders } from './providerMocks.ts'

/** The article list, driven as a reader drives it. Feeds and provider mocks are shared. */

const cards = (page: Page) => page.getByRole('article')

/** The grid keeps the previous page on screen while the next loads — wait it out. */
async function settle(page: Page) {
  await expect(page.locator('[aria-busy="true"]')).toHaveCount(0)
}

async function titles(page: Page): Promise<string[]> {
  await settle(page)
  await expect(cards(page).first()).toBeVisible()
  return cards(page).getByRole('heading').allInnerTexts()
}

async function dates(page: Page): Promise<number[]> {
  await settle(page)
  const stamps = await page
    .locator('article time')
    .evaluateAll((nodes) => nodes.map((node) => node.getAttribute('datetime') ?? ''))
  return stamps.map((stamp) => Date.parse(stamp))
}

test.describe('article list', () => {
  test.beforeEach(async ({ page }) => {
    await mockProviders(page)
  })

  test('merges all four newsrooms and labels every card with its source', async ({ page }) => {
    await page.goto('/')

    await expect(cards(page)).toHaveCount(PAGE_SIZE)
    // The badge is the visible proof the aggregation is real, so every card carries one.
    await expect(page.locator('article [data-source-id]')).toHaveCount(PAGE_SIZE)

    const badges = await page.locator('article [data-source-id]').allInnerTexts()
    expect(new Set(badges.map((text) => text.replace('Source:', '').trim()))).toEqual(
      new Set(['NewsAPI', 'The Guardian', 'The New York Times', 'BBC News']),
    )
  })

  test('says so when a provider published no summary, instead of leaving a gap', async ({
    page,
  }) => {
    await page.goto('/')
    await expect(cards(page).first()).toBeVisible()

    // Guardian story 1 has a null trailText — item 3 normalizes that to ''.
    await expect(page.getByText('This source published no summary.').first()).toBeVisible()
  })

  test('narrows the grid to articles that match a typed keyword', async ({ page }) => {
    await page.goto('/')
    await expect(cards(page)).toHaveCount(PAGE_SIZE)
    const before = await titles(page)
    expect(before.some((title) => !title.toLowerCase().includes('quantum'))).toBe(true)

    await page.getByRole('searchbox', { name: 'Search articles' }).fill('quantum')
    await page.waitForURL(/q=quantum/)
    // Retry until the non-matching stories are gone: the grid holds the previous page
    // on screen deliberately, so "the URL changed" is not "the results changed".
    await expect(cards(page).filter({ hasText: 'on harvest' })).toHaveCount(0)

    const after = await titles(page)
    expect(after.length).toBeGreaterThan(0)
    for (const title of after) expect(title.toLowerCase()).toContain('quantum')
    // Including the BBC ones, whose feed cannot search — the app filtered those itself.
    expect(after.some((title) => title.startsWith('BBC'))).toBe(true)
  })

  test('restores the removed articles when the keyword chip is dismissed', async ({ page }) => {
    await page.goto('/')
    await expect(cards(page)).toHaveCount(PAGE_SIZE)

    await page.getByRole('searchbox', { name: 'Search articles' }).fill('quantum')
    await page.waitForURL(/q=quantum/)
    await expect(cards(page).filter({ hasText: 'on harvest' })).toHaveCount(0)

    await page.getByRole('button', { name: 'Remove filter: quantum' }).click()

    // The debounce must not write the stale term back over the clear.
    await expect(page).toHaveURL((url) => !url.searchParams.has('q'))
    await expect(cards(page)).toHaveCount(PAGE_SIZE)
    await expect(page.getByRole('searchbox', { name: 'Search articles' })).toHaveValue('')
    await expect(page.getByRole('button', { name: 'Remove filter: quantum' })).toHaveCount(0)
  })

  test('makes a deselected source disappear from the grid entirely', async ({ page }) => {
    await page.goto('/')
    await expect(page.getByText('The Guardian').first()).toBeVisible()

    await page.getByRole('checkbox', { name: 'The Guardian' }).click()
    await page.waitForURL(/sources=/)

    await expect(cards(page).first()).toBeVisible()
    await expect(page.locator('article [data-source-id="guardian"]')).toHaveCount(0)
    for (const title of await titles(page)) expect(title.startsWith('Guardian')).toBe(false)
  })

  test('puts search, filter, sort and page in a URL that another browser can open', async ({
    page,
    browser,
  }) => {
    await page.goto('/')
    await page.getByRole('searchbox', { name: 'Search articles' }).fill('harvest')
    await page.waitForURL(/q=harvest/)
    await page.getByRole('checkbox', { name: 'BBC News' }).click()
    await page.waitForURL(/sources=/)
    // Both filters have to have actually landed before the result is worth comparing.
    await expect(cards(page).filter({ hasText: 'on quantum' })).toHaveCount(0)
    await expect(page.locator('article [data-source-id="bbc"]')).toHaveCount(0)

    const shared = page.url()
    expect(shared).toContain('q=harvest')
    const expected = await titles(page)

    const context = await browser.newContext()
    await mockProviders(context)
    const fresh = await context.newPage()
    await fresh.goto(shared)

    expect(await titles(fresh)).toEqual(expected)
    await context.close()
  })

  test('restores the last view from storage on a bare URL', async ({ page }) => {
    await page.goto('/')
    await page.getByRole('searchbox', { name: 'Search articles' }).fill('harvest')
    await page.waitForURL(/q=harvest/)
    // Let the search land before leaving — the snapshot is written once the view settles.
    await titles(page)

    await page.goto('/')

    await page.waitForURL(/q=harvest/)
    await expect(page.getByRole('searchbox', { name: 'Search articles' })).toHaveValue('harvest')
  })

  test('orders newest first, and oldest first when asked', async ({ page }) => {
    await page.goto('/')
    await expect(cards(page)).toHaveCount(PAGE_SIZE)

    const newest = await dates(page)
    expect(newest[0]).toBeGreaterThanOrEqual(newest[newest.length - 1] as number)
    expect([...newest].sort((a, b) => b - a)).toEqual(newest)

    await page.getByRole('combobox', { name: 'Sort' }).click()
    await page.getByRole('option', { name: 'Oldest first' }).click()
    await page.waitForURL(/sort=oldest/)

    const oldest = await dates(page)
    expect([...oldest].sort((a, b) => a - b)).toEqual(oldest)
  })

  test('pages forward to different articles, still labelled by source', async ({ page }) => {
    await page.goto('/')
    const first = await titles(page)

    await page.getByRole('navigation', { name: 'Pagination' }).getByLabel('Page 2').click()
    await page.waitForURL(/page=2/)
    await expect(page.getByRole('link', { name: first[0] as string })).toHaveCount(0)

    const second = await titles(page)
    expect(second).not.toEqual(first)
    expect(second.filter((title) => first.includes(title))).toEqual([])
    await expect(page.locator('article [data-source-id]')).toHaveCount(second.length)
  })

  test('keeps every byline seen so far in the author filter after one is picked', async ({
    page,
  }) => {
    await page.goto('/')
    await expect(cards(page)).toHaveCount(PAGE_SIZE)

    const author = page.getByRole('combobox', { name: 'Author' })
    await author.click()
    const before = await page.getByRole('option').allInnerTexts()
    // "All authors" plus the bylines on this page — several newsrooms' worth.
    expect(before.length).toBeGreaterThan(2)

    const picked = before[1] as string
    const other = before[2] as string
    await page.getByRole('option', { name: picked, exact: true }).click()
    await page.waitForURL(/author=/)
    await settle(page)

    // The fetch has narrowed to one byline, but the vocabulary must not narrow with it:
    // every other author stays reachable, so the filter is not a one-way door.
    await author.click()
    const after = await page.getByRole('option').allInnerTexts()
    expect(after).toContain(other)
    expect(after).toEqual(before)
  })

  test('degrades to a banner naming a blocked provider, not an empty page', async ({ page }) => {
    await mockProviders(page, ['nyt'])
    await page.goto('/')

    // Announced assertively: the banner is the only sign the page is short a newsroom,
    // so a screen reader must interrupt rather than wait for the next idle moment.
    await expect(
      page.getByRole('alert').filter({ hasText: 'Some sources did not answer' }),
    ).toHaveText('Some sources did not answer: The New York Times')
    await expect(cards(page)).toHaveCount(PAGE_SIZE)
    // The other three carried the page.
    await expect(page.locator('article [data-source-id="nyt"]')).toHaveCount(0)
    await expect(page.locator('article [data-source-id="guardian"]').first()).toBeVisible()
  })

  test('offers an empty state rather than a blank grid when nothing matches', async ({ page }) => {
    await page.goto('/')
    await page.getByRole('searchbox', { name: 'Search articles' }).fill('quidditch')
    await page.waitForURL(/q=quidditch/)

    await expect(page.getByText('No articles match these filters')).toBeVisible()
    await expect(cards(page)).toHaveCount(0)
  })

  test('has no horizontal scroll at 375, 768 or 1280', async ({ page }) => {
    await page.goto('/')
    for (const width of [375, 768, 1280]) {
      await page.setViewportSize({ width, height: 900 })
      await expect(cards(page).first()).toBeVisible()
      // Expression form: the e2e tsconfig has no DOM lib, the same reason the other
      // specs reach for `globalThis` rather than typed browser globals.
      const overflowing = await page.evaluate<boolean>(
        'document.documentElement.scrollWidth > document.documentElement.clientWidth',
      )
      expect(overflowing, `viewport ${width}`).toBe(false)
    }
  })
})

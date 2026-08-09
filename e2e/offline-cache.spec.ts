import { expect, test } from '@playwright/test'
import type { Page } from '@playwright/test'
import { mockProviders } from './providerMocks.ts'

/**
 * The feed after the network goes away: the stories the reader loaded last time are still
 * there, clearly labelled as old, and one retry brings the live ones back.
 */

const cards = (page: Page) => page.getByRole('article')
const feed = (page: Page) => page.getByRole('main')
const dialog = (page: Page) => page.getByRole('dialog')

async function settle(page: Page) {
  await expect(page.locator('[aria-busy="true"]')).toHaveCount(0)
}

/** Every provider refused, from the very first request — the cold-failure case. */
async function killTheNetwork(page: Page) {
  await page.route('**/api/**', (route) => route.abort('failed'))
}

/** Choose a source and wait for the feed it fills with — that load is what gets cached. */
async function loadTheFeedOnce(page: Page) {
  await page.goto('/feed')
  await feed(page).getByRole('button', { name: 'Preferences' }).click()
  await dialog(page).getByRole('checkbox', { name: 'The Guardian' }).click()
  await dialog(page).getByRole('button', { name: 'Save preferences' }).click()
  await expect(dialog(page)).toBeHidden()
  await settle(page)
  await expect(cards(page)).toHaveCount(9)
}

test.describe('offline feed cache', () => {
  test('shows the last loaded feed, dated, when a cold load finds no network', async ({ page }) => {
    await mockProviders(page)
    await loadTheFeedOnce(page)
    const titles = await cards(page).getByRole('heading').allInnerTexts()

    // Same reader, same preferences, no network at all this time.
    await killTheNetwork(page)
    await page.reload()
    await settle(page)

    // Not an error card and not a blank page: the stories from last time, still readable.
    await expect(feed(page).getByRole('heading', { name: 'Could not load articles' })).toHaveCount(
      0,
    )
    await expect(cards(page)).toHaveCount(9)
    expect(await cards(page).getByRole('heading').allInnerTexts()).toEqual(titles)

    // And said out loud, with the moment they were fetched.
    await expect(feed(page).getByRole('alert')).toContainText('Showing cached results from')
  })

  test('claims no cached feed when nothing was ever cached', async ({ page }) => {
    await mockProviders(page)
    await page.goto('/feed')
    // Preferences are chosen only after the network is dead, so no feed ever loaded and
    // there is nothing in storage to fall back to.
    await killTheNetwork(page)
    await feed(page).getByRole('button', { name: 'Preferences' }).click()
    await dialog(page).getByRole('checkbox', { name: 'The Guardian' }).click()
    await dialog(page).getByRole('button', { name: 'Save preferences' }).click()
    await settle(page)

    await expect(cards(page)).toHaveCount(0)
    // The dead provider is still named — but nothing pretends to be a cached result.
    // Every provider is dead, which is an error, not a partial one — the banner naming the
    // ones that failed belongs over results that survived, and here nothing did.
    await expect(feed(page).getByRole('heading', { name: 'Could not load articles' })).toBeVisible()
    await expect(feed(page).getByText('Showing cached results from')).toHaveCount(0)
  })

  test('offers no cached feed after the preferences that produced it changed', async ({ page }) => {
    await mockProviders(page)
    await loadTheFeedOnce(page)

    // Network dies, then the reader switches newsroom: the stored feed is The Guardian's,
    // so showing it under "cached results" would read as the new selection's stories.
    await killTheNetwork(page)
    // The feed has loaded, so the trigger is the header's rather than the empty card's.
    await page.getByRole('button', { name: 'Preferences' }).click()
    await dialog(page).getByRole('checkbox', { name: 'The Guardian' }).click()
    await dialog(page).getByRole('checkbox', { name: 'The New York Times' }).click()
    await dialog(page).getByRole('button', { name: 'Save preferences' }).click()
    await expect(dialog(page)).toBeHidden()
    await settle(page)

    await expect(cards(page)).toHaveCount(0)
    await expect(feed(page).getByText('Showing cached results from')).toHaveCount(0)
    // Every provider is dead, which is an error, not a partial one — the banner naming the
    // ones that failed belongs over results that survived, and here nothing did.
    await expect(feed(page).getByRole('heading', { name: 'Could not load articles' })).toBeVisible()
  })

  test('drops a feed cached before the upgrade rather than labelling it as this selection', async ({
    page,
  }) => {
    await mockProviders(page)
    await loadTheFeedOnce(page)

    // Exactly what an upgrading reader has in storage: the same stories, written by a build
    // whose Article shape has since changed. The fallback is lost this once, on purpose —
    // rendering last week's fields into this week's cards is the worse outcome.
    await page.evaluate(() => {
      const raw = localStorage.getItem('ina-query-cache')
      if (!raw) throw new Error('nothing was persisted — the test is not exercising the cache')

      const cached = JSON.parse(raw) as Record<string, unknown>
      localStorage.setItem('ina-query-cache', JSON.stringify({ ...cached, buster: 'v1' }))
    })

    await killTheNetwork(page)
    await page.reload()
    await settle(page)

    await expect(cards(page)).toHaveCount(0)
    await expect(feed(page).getByText('Showing cached results from')).toHaveCount(0)
    // Every provider is dead, which is an error, not a partial one — the banner naming the
    // ones that failed belongs over results that survived, and here nothing did.
    await expect(feed(page).getByRole('heading', { name: 'Could not load articles' })).toBeVisible()
  })

  test('retry from the notice puts the live feed back and drops the notice', async ({ page }) => {
    await mockProviders(page)
    await loadTheFeedOnce(page)

    await killTheNetwork(page)
    await page.reload()
    await settle(page)
    await expect(feed(page).getByRole('alert')).toContainText('Showing cached results from')

    // Network back: the same retry the error card offers is on the notice too.
    await page.unrouteAll({ behavior: 'ignoreErrors' })
    await mockProviders(page)
    await feed(page).getByRole('alert').getByRole('button', { name: 'Try again' }).click()

    await settle(page)
    await expect(feed(page).getByRole('alert')).toHaveCount(0)
    await expect(cards(page)).toHaveCount(9)
  })
})

test.describe('offline directory cache', () => {
  /** The directory at `/`, loaded once so the page in front of the reader gets cached. */
  async function loadTheDirectoryOnce(page: Page) {
    await page.goto('/')
    await settle(page)
    await expect(cards(page)).toHaveCount(9)
  }

  test('shows the last loaded page, dated, when a cold load finds no network', async ({ page }) => {
    await mockProviders(page)
    await loadTheDirectoryOnce(page)
    const titles = await cards(page).getByRole('heading').allInnerTexts()

    // Same filters, no network at all this time.
    await killTheNetwork(page)
    await page.reload()
    await settle(page)

    await expect(feed(page).getByRole('heading', { name: 'Could not load articles' })).toHaveCount(
      0,
    )
    await expect(cards(page)).toHaveCount(9)
    expect(await cards(page).getByRole('heading').allInnerTexts()).toEqual(titles)
    await expect(feed(page).getByRole('alert')).toContainText('Showing cached results from')
  })

  test('offers no cached page to a search the cache was never filled under', async ({ page }) => {
    await mockProviders(page)
    await loadTheDirectoryOnce(page)

    // The stored page is the unfiltered one — showing it under a search term would read
    // as that term's results.
    await killTheNetwork(page)
    await page.goto('/?q=quantum')
    await settle(page)

    await expect(cards(page)).toHaveCount(0)
    await expect(feed(page).getByText('Showing cached results from')).toHaveCount(0)
    // Every provider is dead, which is an error, not a partial one — the banner naming the
    // ones that failed belongs over results that survived, and here nothing did.
    await expect(feed(page).getByRole('heading', { name: 'Could not load articles' })).toBeVisible()
  })

  test('never offers the last filter set as the next one when the search fails', async ({
    page,
  }) => {
    await mockProviders(page)
    await loadTheDirectoryOnce(page)
    const titles = await cards(page).getByRole('heading').allInnerTexts()

    // No reload this time: the previous page is still on screen as the placeholder while
    // the search is in flight, which is exactly when it must not be cached or offered.
    await killTheNetwork(page)
    await page.getByRole('searchbox', { name: 'Search articles' }).fill('quantum')
    await expect(page.getByRole('button', { name: 'Remove filter: quantum' })).toBeVisible()
    await settle(page)

    await expect(cards(page)).toHaveCount(0)
    await expect(feed(page).getByText('Showing cached results from')).toHaveCount(0)
    // Every provider is dead, which is an error, not a partial one — the banner naming the
    // ones that failed belongs over results that survived, and here nothing did.
    await expect(feed(page).getByRole('heading', { name: 'Could not load articles' })).toBeVisible()

    // And the unfiltered page is still the one in storage — the failed search never
    // restamped it as its own. Clearing the term goes back to the key that filled it.
    // Clearing the term restores the filter set that filled the cache, and the reload
    // drops React Query's in-memory copy so storage is the only thing left to answer with.
    await page.getByRole('searchbox', { name: 'Search articles' }).fill('')
    await expect(page.getByRole('button', { name: 'Remove filter: quantum' })).toHaveCount(0)
    await page.reload()
    await settle(page)
    await expect(feed(page).getByRole('alert')).toContainText('Showing cached results from')
    expect(await cards(page).getByRole('heading').allInnerTexts()).toEqual(titles)
  })

  test('retry from the notice puts the live page back and drops the notice', async ({ page }) => {
    await mockProviders(page)
    await loadTheDirectoryOnce(page)

    await killTheNetwork(page)
    await page.reload()
    await settle(page)
    await expect(feed(page).getByRole('alert')).toContainText('Showing cached results from')

    await page.unrouteAll({ behavior: 'ignoreErrors' })
    await mockProviders(page)
    await feed(page).getByRole('alert').getByRole('button', { name: 'Try again' }).click()

    await settle(page)
    await expect(feed(page).getByRole('alert')).toHaveCount(0)
    await expect(cards(page)).toHaveCount(9)
  })
})

test.describe('loading and empty states', () => {
  test('holds a full grid of placeholders while the articles are in flight', async ({ page }) => {
    await mockProviders(page)
    // Hold every response open so the loading state is observable rather than a flash.
    let release = () => {}
    const held = new Promise<void>((resolve) => (release = resolve))
    await page.route('**/api/**', async (route) => {
      await held
      await route.fallback()
    })

    await page.goto('/')
    const loading = page.getByRole('status', { name: 'Loading articles' })
    await expect(loading).toBeVisible()
    // Shaped to the grid it becomes — a page of cards, not a spinner.
    await expect(loading.locator('.motion-shimmer')).toHaveCount(27)

    release()
    await settle(page)
    await expect(cards(page)).toHaveCount(9)
    await expect(loading).toHaveCount(0)
  })

  test('says so when the filters match nothing, instead of an empty grid', async ({ page }) => {
    await mockProviders(page)
    await page.goto('/?q=nothingmatchesthisterm')
    await settle(page)

    await expect(
      feed(page).getByRole('heading', { name: 'No articles match these filters' }),
    ).toBeVisible()
    await expect(cards(page)).toHaveCount(0)
  })
})

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
    await expect(feed(page).getByRole('alert')).toContainText('Some sources did not answer')
    await expect(feed(page).getByText('Showing cached results from')).toHaveCount(0)
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

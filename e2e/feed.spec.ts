import { expect, test } from '@playwright/test'
import type { Page } from '@playwright/test'
import { mockProviders } from './providerMocks.ts'

/**
 * The personal feed as a reader reaches it: nothing chosen yet, set preferences from the
 * feed itself, and see the feed come back holding only what was asked for.
 */

const cards = (page: Page) => page.getByRole('article')
const dialog = (page: Page) => page.getByRole('dialog')
/** Scoped to the page body: the header carries a Preferences button of its own. */
const feed = (page: Page) => page.getByRole('main')
const emptyHeading = (page: Page) => feed(page).getByRole('heading', { name: 'No preferences yet' })

async function settle(page: Page) {
  await expect(page.locator('[aria-busy="true"]')).toHaveCount(0)
}

const sourceLabels = async (page: Page) =>
  new Set(
    (await page.locator('article [data-source-id]').allInnerTexts()).map((text) =>
      text.replace('Source:', '').trim(),
    ),
  )

test.beforeEach(async ({ page }) => {
  await mockProviders(page)
})

test.describe('personalized feed', () => {
  test('is reachable from the primary navigation', async ({ page }) => {
    await page.goto('/')

    await page
      .getByRole('navigation', { name: 'Primary' })
      .getByRole('link', { name: 'My feed' })
      .click()

    await expect(page).toHaveURL(/\/feed$/)
    await expect(page.getByRole('heading', { name: 'My feed', level: 1 })).toBeVisible()
  })

  test('asks for preferences instead of showing an unfiltered list', async ({ page }) => {
    await page.goto('/feed')

    await expect(emptyHeading(page)).toBeVisible()
    await expect(feed(page)).toContainText('Pick your sources, categories and authors')
    // No stories at all — an unfiltered feed would just be the article list again.
    await expect(cards(page)).toHaveCount(0)
    // Nor the grid's own "no match" wording: nothing was asked for yet.
    await expect(page.getByText('No articles match these filters')).toHaveCount(0)
  })

  test('opens preferences from its empty state and fills with the chosen source', async ({
    page,
  }) => {
    await page.goto('/feed')

    await feed(page).getByRole('button', { name: 'Preferences' }).click()
    await expect(dialog(page)).toBeVisible()

    await dialog(page).getByRole('checkbox', { name: 'The Guardian' }).click()
    await dialog(page).getByRole('button', { name: 'Save preferences' }).click()
    await expect(dialog(page)).toBeHidden()

    // The empty state gives way to the feed without a reload — same store, one subscription.
    await expect(emptyHeading(page)).toHaveCount(0)
    await settle(page)
    await expect(cards(page)).toHaveCount(9)
    expect(await sourceLabels(page)).toEqual(new Set(['The Guardian']))
    await expect(page.getByRole('status')).toHaveText('9 articles on this page')
  })

  test('narrows to a preferred author within the preferred source', async ({ page }) => {
    await page.goto('/feed')

    await feed(page).getByRole('button', { name: 'Preferences' }).click()
    await dialog(page).getByRole('checkbox', { name: 'The Guardian' }).click()
    await dialog(page).getByLabel('Preferred authors').fill('Guardian Reporter 1')
    await dialog(page).getByRole('button', { name: 'Save preferences' }).click()
    await expect(dialog(page)).toBeHidden()

    await settle(page)
    // The Guardian serves a byline but cannot filter on it, so the app does — every card
    // left is that reporter's, and the other two reporters' stories are gone.
    await expect(cards(page)).toHaveCount(3)
    await expect(page.getByText('Guardian Reporter 2')).toHaveCount(0)
    for (const text of await cards(page).allInnerTexts()) {
      expect(text).toContain('Guardian Reporter 1')
    }
  })

  test('names a preferred provider that fell over, and still shows the rest', async ({ page }) => {
    // Re-route with the Guardian down: `aggregate` is `allSettled`, so this is the partial
    // case — a banner plus the BBC stories, not an error card.
    await mockProviders(page, ['guardian'])
    await page.goto('/feed')

    await feed(page).getByRole('button', { name: 'Preferences' }).click()
    await dialog(page).getByRole('checkbox', { name: 'The Guardian' }).click()
    await dialog(page).getByRole('checkbox', { name: 'BBC News' }).click()
    await dialog(page).getByRole('button', { name: 'Save preferences' }).click()

    await settle(page)
    await expect(page.getByRole('alert')).toContainText('The Guardian')
    expect(await sourceLabels(page)).toEqual(new Set(['BBC News']))
  })

  test('keeps the feed across a reload, since the preferences outlive the page', async ({
    page,
  }) => {
    await page.goto('/feed')
    await feed(page).getByRole('button', { name: 'Preferences' }).click()
    await dialog(page).getByRole('checkbox', { name: 'BBC News' }).click()
    await dialog(page).getByRole('button', { name: 'Save preferences' }).click()

    await page.reload()
    await settle(page)
    await expect(emptyHeading(page)).toHaveCount(0)
    expect(await sourceLabels(page)).toEqual(new Set(['BBC News']))
  })
})

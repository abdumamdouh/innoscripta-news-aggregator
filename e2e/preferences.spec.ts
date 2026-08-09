import { expect, test } from '@playwright/test'
import type { Page } from '@playwright/test'
import { mockProviders } from './providerMocks.ts'

/**
 * Preferences as a reader uses them: open from the header, tick, type, save, come back
 * tomorrow and find the choices still there. The article list behind the modal is mocked
 * only so the page it opens over is stable — nothing here asserts on it.
 */

const dialog = (page: Page) => page.getByRole('dialog')

async function openPreferences(page: Page) {
  await page.getByRole('button', { name: 'Preferences' }).click()
  await expect(dialog(page)).toBeVisible()
}

const storedPreferences = (page: Page) =>
  page.evaluate(() => JSON.parse(localStorage.getItem('ina-preferences') ?? 'null') as unknown)

test.beforeEach(async ({ page }) => {
  await mockProviders(page)
  await page.goto('/')
})

test.describe('preferences', () => {
  test('lists all six registered sources, with the two unavailable ones disabled', async ({
    page,
  }) => {
    await openPreferences(page)

    // Ten category boxes plus the six sources — the sources are what this asserts.
    for (const name of ['NewsAPI', 'The Guardian', 'The New York Times', 'BBC News']) {
      await expect(dialog(page).getByRole('checkbox', { name })).toBeEnabled()
    }
    for (const name of ['OpenNews', 'NewsCred']) {
      await expect(dialog(page).getByRole('checkbox', { name })).toBeDisabled()
    }
  })

  test('explains why a disabled source cannot be chosen', async ({ page }) => {
    await openPreferences(page)

    await dialog(page).getByRole('checkbox', { name: 'OpenNews' }).hover()
    await expect(page.getByRole('tooltip')).toContainText('no article API')
  })

  test('refuses to save with no source chosen, then saves once one is', async ({ page }) => {
    await openPreferences(page)

    await dialog(page).getByRole('button', { name: 'Save preferences' }).click()
    await expect(dialog(page).getByRole('alert')).toHaveText('Choose at least one source.')
    await expect(dialog(page)).toBeVisible()
    expect(await storedPreferences(page)).toBeNull()

    await dialog(page).getByRole('checkbox', { name: 'The Guardian' }).click()
    await dialog(page).getByRole('button', { name: 'Save preferences' }).click()
    await expect(dialog(page)).toBeHidden()
    expect(await storedPreferences(page)).toEqual({
      sources: ['guardian'],
      categories: [],
      authors: [],
    })
  })

  test('rejects an author name that is too long', async ({ page }) => {
    await openPreferences(page)

    await dialog(page).getByRole('checkbox', { name: 'BBC News' }).click()
    await dialog(page).getByLabel('Preferred authors').fill('a'.repeat(81))
    await dialog(page).getByRole('button', { name: 'Save preferences' }).click()

    await expect(
      dialog(page).getByText('An author name may be at most 80 characters.'),
    ).toBeVisible()
    expect(await storedPreferences(page)).toBeNull()
  })

  test('keeps sources, categories and authors across a reload', async ({ page }) => {
    await openPreferences(page)

    await dialog(page).getByRole('checkbox', { name: 'BBC News' }).click()
    await dialog(page).getByRole('checkbox', { name: 'Technology' }).click()
    await dialog(page).getByLabel('Preferred authors').fill(' Jane Doe , Jane Doe , John Smith ')
    await dialog(page).getByRole('button', { name: 'Save preferences' }).click()
    await expect(dialog(page)).toBeHidden()

    // Trimmed, deduped, and stored under the key item 8's feed reads.
    expect(await storedPreferences(page)).toEqual({
      sources: ['bbc'],
      categories: ['technology'],
      authors: ['Jane Doe', 'John Smith'],
    })

    await page.reload()
    await openPreferences(page)
    await expect(dialog(page).getByRole('checkbox', { name: 'BBC News' })).toBeChecked()
    await expect(dialog(page).getByRole('checkbox', { name: 'Technology' })).toBeChecked()
    await expect(dialog(page).getByRole('checkbox', { name: 'The Guardian' })).not.toBeChecked()
    await expect(dialog(page).getByLabel('Preferred authors')).toHaveValue('Jane Doe, John Smith')
  })

  test('discards edits when the reader cancels', async ({ page }) => {
    await openPreferences(page)
    await dialog(page).getByRole('checkbox', { name: 'BBC News' }).click()
    await dialog(page).getByRole('button', { name: 'Save preferences' }).click()
    await expect(dialog(page)).toBeHidden()

    await openPreferences(page)
    await dialog(page).getByRole('checkbox', { name: 'The Guardian' }).click()
    await dialog(page).getByRole('button', { name: 'Cancel' }).click()
    await expect(dialog(page)).toBeHidden()

    expect(await storedPreferences(page)).toEqual({
      sources: ['bbc'],
      categories: [],
      authors: [],
    })
    await openPreferences(page)
    await expect(dialog(page).getByRole('checkbox', { name: 'The Guardian' })).not.toBeChecked()
  })

  test('translates the whole form and stays inside a 375px viewport', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 })
    await page.getByRole('combobox', { name: 'Language' }).click()
    await page.getByRole('option', { name: 'Deutsch' }).click()

    await page.getByRole('button', { name: 'Einstellungen' }).click()
    await expect(
      dialog(page).getByRole('button', { name: 'Einstellungen speichern' }),
    ).toBeVisible()
    await expect(page.getByText(/preferences\./)).toHaveCount(0)

    // Evaluated as a string: the e2e tsconfig carries no DOM lib (see theme-tokens.spec).
    const overflow = await page.evaluate<number>(
      `document.documentElement.scrollWidth - document.documentElement.clientWidth`,
    )
    expect(overflow).toBeLessThanOrEqual(0)
  })
})

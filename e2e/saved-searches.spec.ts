import { expect, test } from '@playwright/test'
import type { Page } from '@playwright/test'
import { mockProviders } from './providerMocks.ts'

/**
 * Saved search presets: name the filters on screen, then apply, rename and delete them.
 * Applying is asserted through the URL and the grid, because a preset is only worth
 * anything if it puts the reader back in the exact view they saved.
 */

const cards = (page: Page) => page.getByRole('article')
const dialog = (page: Page) => page.getByRole('dialog')
const presets = (page: Page) => page.getByRole('list', { name: 'Saved searches' })
/** Exact, so a preset's own button is not confused with its "Rename search: …" icon. */
const preset = (page: Page, name: string) =>
  presets(page).getByRole('button', { name, exact: true })
/** The app-wide toast region — it lives outside `main`, next to the router. */
const announcement = (page: Page) => page.getByRole('status').last()

async function savePreset(page: Page, name: string) {
  await page.getByRole('button', { name: 'Save this search' }).click()
  await dialog(page).getByLabel('Search name').fill(name)
  await dialog(page).getByRole('button', { name: 'Save search' }).click()
  await expect(dialog(page)).toBeHidden()
}

/** Put a recognisable filter set on screen: a keyword plus a deselected source. */
async function filterDown(page: Page, term: string) {
  await page.getByRole('searchbox', { name: 'Search articles' }).fill(term)
  await page.waitForURL(new RegExp(`q=${term}`))
  await page.getByRole('checkbox', { name: 'BBC News' }).click()
  await page.waitForURL(/sources=/)
  await expect(page.locator('article [data-source-id="bbc"]')).toHaveCount(0)
}

test.beforeEach(async ({ page }) => {
  await mockProviders(page)
})

test.describe('saved search presets', () => {
  test('saves the current filters under a name, and applies them again later', async ({ page }) => {
    await page.goto('/')
    await filterDown(page, 'harvest')
    const expected = await cards(page).getByRole('heading').allInnerTexts()

    await savePreset(page, 'Harvest, no BBC')
    await expect(announcement(page)).toHaveText('Search saved.')
    await expect(preset(page, 'Harvest, no BBC')).toBeVisible()

    // Back to everything, so applying has something real to restore.
    await page.getByRole('button', { name: 'Clear filters' }).click()
    await expect(page).toHaveURL((url) => !url.searchParams.has('q'))

    await preset(page, 'Harvest, no BBC').click()
    await expect(announcement(page)).toHaveText('Applied “Harvest, no BBC”.')

    await page.waitForURL(/q=harvest/)
    await expect(page).toHaveURL(/sources=/)
    await expect(page.getByRole('searchbox', { name: 'Search articles' })).toHaveValue('harvest')
    await expect(page.locator('article [data-source-id="bbc"]')).toHaveCount(0)
    await expect(cards(page).getByRole('heading')).toHaveText(expected)
  })

  test('survives a reload, because a preset is worth nothing for one session', async ({ page }) => {
    await page.goto('/')
    await filterDown(page, 'quantum')
    await savePreset(page, 'Quantum beat')

    await page.reload()
    await expect(preset(page, 'Quantum beat')).toBeVisible()
  })

  test('refuses a blank name and a name already taken', async ({ page }) => {
    await page.goto('/')
    await savePreset(page, 'Quantum beat')

    await page.getByRole('button', { name: 'Save this search' }).click()
    await dialog(page).getByRole('button', { name: 'Save search' }).click()
    await expect(dialog(page).getByText('Enter a search name.')).toBeVisible()

    // Same name in a different case is the same preset to the reader who typed it.
    await dialog(page).getByLabel('Search name').fill('quantum BEAT')
    await dialog(page).getByRole('button', { name: 'Save search' }).click()
    await expect(
      dialog(page).getByText('A saved search with that name already exists.'),
    ).toBeVisible()
    await expect(dialog(page)).toBeVisible()

    await dialog(page).getByLabel('Search name').fill('Second one')
    await dialog(page).getByRole('button', { name: 'Save search' }).click()
    await expect(dialog(page)).toBeHidden()
    await expect(preset(page, 'Second one')).toBeVisible()
  })

  test('renames a preset, keeping the filters it holds', async ({ page }) => {
    await page.goto('/')
    await filterDown(page, 'harvest')
    await savePreset(page, 'Harvest beat')

    await presets(page).getByRole('button', { name: 'Rename search: Harvest beat' }).click()
    await dialog(page).getByLabel('Search name').fill('Autumn beat')
    await dialog(page).getByRole('button', { name: 'Save search' }).click()

    await expect(announcement(page)).toHaveText('Search renamed.')
    await expect(preset(page, 'Autumn beat')).toBeVisible()
    await expect(preset(page, 'Harvest beat')).toHaveCount(0)

    await page.getByRole('button', { name: 'Clear filters' }).click()
    await expect(page).toHaveURL((url) => !url.searchParams.has('q'))
    await preset(page, 'Autumn beat').click()
    await page.waitForURL(/q=harvest/)
  })

  test('asks before deleting a preset', async ({ page }) => {
    await page.goto('/')
    await filterDown(page, 'harvest')
    await savePreset(page, 'Harvest beat')

    await presets(page).getByRole('button', { name: 'Delete search: Harvest beat' }).click()
    await expect(dialog(page).getByText('“Harvest beat” is deleted')).toBeVisible()
    await dialog(page).getByRole('button', { name: 'Cancel' }).click()
    await expect(preset(page, 'Harvest beat')).toBeVisible()

    await presets(page).getByRole('button', { name: 'Delete search: Harvest beat' }).click()
    await dialog(page).getByRole('button', { name: 'Delete search' }).click()

    await expect(announcement(page)).toHaveText('Search deleted.')
    await expect(preset(page, 'Harvest beat')).toHaveCount(0)
    // Deleting the name must not touch the view it named.
    await expect(page).toHaveURL(/q=harvest/)
  })
})

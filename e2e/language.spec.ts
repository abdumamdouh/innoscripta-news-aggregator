import { expect, test, type Page } from '@playwright/test'

/** The language picker is a Radix Select: open the trigger, click the option. */
async function chooseLanguage(page: Page, label: string) {
  await page.getByRole('combobox').first().click()
  await page.getByRole('option', { name: label, exact: true }).click()
}

test.beforeEach(async ({ page }) => {
  await page.goto('/')
})

test('switching to Deutsch translates the chrome and keeps dir="ltr"', async ({ page }) => {
  await expect(page.getByRole('link', { name: 'Articles' })).toBeVisible()

  await chooseLanguage(page, 'Deutsch')

  await expect(page.getByRole('link', { name: 'Artikel' })).toBeVisible()
  await expect(page.locator('html')).toHaveAttribute('lang', 'de')
  await expect(page.locator('html')).toHaveAttribute('dir', 'ltr')
  await expect(page.getByText('Für die innoscripta-Challenge entwickelt.')).toBeVisible()
})

test('the German choice survives a reload', async ({ page }) => {
  await chooseLanguage(page, 'Deutsch')
  await page.reload()

  await expect(page.getByRole('link', { name: 'Artikel' })).toBeVisible()
  await expect(page.locator('html')).toHaveAttribute('lang', 'de')
  await expect(page.locator('html')).toHaveAttribute('dir', 'ltr')
})

test('leaving Arabic for German flips the document back to ltr', async ({ page }) => {
  await chooseLanguage(page, 'العربية')
  await expect(page.locator('html')).toHaveAttribute('dir', 'rtl')

  await chooseLanguage(page, 'Deutsch')

  await expect(page.locator('html')).toHaveAttribute('dir', 'ltr')
  await expect(page.getByRole('link', { name: 'Artikel' })).toBeVisible()
})

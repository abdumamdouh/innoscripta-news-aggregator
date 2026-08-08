import { expect, test } from '@playwright/test'

test.describe('primary navigation', () => {
  test('shows Articles and none of the removed nav strings', async ({ page }) => {
    await page.goto('/')

    const nav = page.getByRole('navigation', { name: 'Primary' })
    await expect(nav.getByRole('link')).toHaveText(['Articles'])

    // The deleted keys (nav.feed / nav.menu.open / nav.menu.close) had no UI behind
    // them — nothing may render their wording, and nothing may render a raw key.
    await expect(page.getByText(/My feed|Open menu|Close menu|nav\./)).toHaveCount(0)
  })

  test('keeps the same single item in Arabic', async ({ page }) => {
    await page.goto('/')
    await page.getByRole('combobox', { name: 'Language' }).click()
    await page.getByRole('option', { name: 'العربية' }).click()

    const nav = page.getByRole('navigation', { name: 'التنقل الرئيسي' })
    await expect(nav.getByRole('link')).toHaveText(['المقالات'])
    await expect(page.getByText(/خلاصتي|فتح القائمة|إغلاق القائمة/)).toHaveCount(0)
  })
})

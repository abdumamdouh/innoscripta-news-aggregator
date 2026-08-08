import { expect, test } from '@playwright/test'

// Deterministic starting point: no stored theme + light OS preference means the app
// boots light, so the toggle assertions below are about the click, not the machine.
test.use({ colorScheme: 'light' })

test('boots and renders the app shell', async ({ page }) => {
  await page.goto('/')

  await expect(
    page.getByRole('banner').getByRole('link', { name: 'innoscripta News' }),
  ).toBeVisible()
  await expect(page.getByRole('navigation', { name: 'Primary' })).toBeVisible()
  await expect(page.getByRole('main').getByRole('heading', { name: 'Articles' })).toBeVisible()
  await expect(page.getByRole('contentinfo')).toContainText('Built for the innoscripta challenge.')
})

test('switching to Arabic flips the document to RTL and shows Arabic copy', async ({ page }) => {
  await page.goto('/')
  await expect(page.locator('html')).toHaveAttribute('dir', 'ltr')

  await page.getByRole('combobox', { name: 'Language' }).click()
  await page.getByRole('option', { name: 'العربية' }).click()

  await expect(page.locator('html')).toHaveAttribute('dir', 'rtl')
  await expect(page.locator('html')).toHaveAttribute('lang', 'ar')
  await expect(page.getByRole('main').getByRole('heading', { name: 'المقالات' })).toBeVisible()
  await expect(page.getByRole('contentinfo')).toContainText('مبني لتحدي إنوسكريبتا.')
})

test('theme toggle switches to dark, persists, and survives a reload', async ({ page }) => {
  await page.goto('/')
  await expect(page.locator('html')).not.toHaveClass(/dark/)

  await page.getByRole('button', { name: 'Switch to dark theme' }).click()

  await expect(page.locator('html')).toHaveClass(/dark/)
  await expect(page.getByRole('button', { name: 'Switch to light theme' })).toBeVisible()
  expect(await page.evaluate(() => localStorage.getItem('ina-theme'))).toBe('dark')

  await page.reload()
  await expect(page.locator('html')).toHaveClass(/dark/)
  await expect(page.getByRole('button', { name: 'Switch to light theme' })).toBeVisible()
})

test.describe('with a dark OS preference and nothing stored', () => {
  test.use({ colorScheme: 'dark' })

  test('boots dark without any interaction', async ({ page }) => {
    await page.goto('/')

    await expect(page.locator('html')).toHaveClass(/dark/)
    await expect(page.getByRole('button', { name: 'Switch to light theme' })).toBeVisible()
    expect(await page.evaluate(() => localStorage.getItem('ina-theme'))).toBeNull()
  })
})

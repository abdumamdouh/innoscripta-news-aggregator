import { expect, test } from '@playwright/test'
import type { Page } from '@playwright/test'
import { mockProviders } from './providerMocks.ts'

/**
 * The brief's requirement #3, checked the way a reader would hit it: every screen and every
 * modal at phone, tablet and laptop width. Two machine-checkable rules — the page never
 * scrolls sideways, and below `lg` every control is a 44px touch target — plus the one
 * layout change mobile actually needs, the filter panel moving into a drawer.
 */

const VIEWPORTS = [
  { name: 'mobile', width: 375, height: 812 },
  { name: 'tablet', width: 768, height: 1024 },
  { name: 'desktop', width: 1280, height: 800 },
] as const

/** Under 1024 the app is driven by a thumb, so that is where the 44px rule bites. */
const TOUCH_WIDTH = 1024
const MIN_TAP = 44
/** Sub-pixel layout rounding: 43.996px is a 44px control, not a failure. */
const SUB_PIXEL = 0.5

/** Names the widest element too, so a failure says *what* overflowed, not just that it did. */
async function overflow(page: Page) {
  return page.evaluate(() => {
    const root = document.documentElement
    const widest = [...document.body.querySelectorAll<HTMLElement>('*')]
      .map((node) => ({ node, right: node.getBoundingClientRect().right }))
      .filter((entry) => entry.right > root.clientWidth + 1)
      .sort((a, b) => b.right - a.right)[0]
    return {
      scrollWidth: root.scrollWidth,
      clientWidth: root.clientWidth,
      widest: widest ? `${widest.node.tagName}.${widest.node.className} @${widest.right}` : null,
    }
  })
}

/** Every visible control that a thumb has to hit, with the ones under 44×44 called out. */
async function smallTargets(page: Page, min: number) {
  return page.evaluate((limit) => {
    const selector = 'button, a[href], summary, [role="button"], [role="checkbox"], input, select'
    return (
      [...document.querySelectorAll<HTMLElement>(selector)]
        // Radix mirrors each checkbox into a hidden native input; only what a thumb can hit counts.
        .filter((node) => node.closest('[aria-hidden="true"]') === null)
        .filter((node) => node.getClientRects().length > 0)
        .map((node) => ({
          node,
          box: node.getBoundingClientRect(),
        }))
        .filter(({ box }) => box.width < limit || box.height < limit)
        .map(
          ({ node, box }) =>
            `${node.tagName}[${node.getAttribute('aria-label') ?? node.textContent?.trim().slice(0, 24) ?? ''}] ${box.width.toFixed(2)}x${box.height.toFixed(2)}`,
        )
    )
  }, min - SUB_PIXEL)
}

/**
 * Entry animations scale their panel, and a panel measured mid-scale is smaller than the one
 * a reader's thumb lands on. Wait them out — skipping the skeleton shimmer, which never ends.
 */
async function settled(page: Page) {
  await page.evaluate(() =>
    Promise.all(
      document
        .getAnimations()
        .filter((animation) => animation.effect?.getComputedTiming().iterations !== Infinity)
        .map((animation) => animation.finished.catch(() => undefined)),
    ).then(() => undefined),
  )
}

async function expectResponsive(page: Page, width: number) {
  await settled(page)
  const measured = await overflow(page)
  expect(measured.widest, `horizontal overflow: ${JSON.stringify(measured)}`).toBeNull()
  expect(measured.scrollWidth).toBeLessThanOrEqual(measured.clientWidth)

  if (width < TOUCH_WIDTH) {
    expect(await smallTargets(page, MIN_TAP)).toEqual([])
  }
}

/** The list page's filters live behind a drawer below `lg`, so open it before measuring. */
async function openFiltersIfDrawer(page: Page, width: number) {
  if (width >= TOUCH_WIDTH) return page.getByRole('main')
  await page.getByRole('button', { name: 'Filters', exact: true }).click()
  const drawer = page.getByRole('dialog', { name: 'Filters' })
  await expect(drawer).toBeVisible()
  return drawer
}

test.beforeEach(async ({ page }) => {
  await mockProviders(page)
})

for (const viewport of VIEWPORTS) {
  test.describe(`at ${viewport.name} (${viewport.width}px)`, () => {
    test.use({ viewport: { width: viewport.width, height: viewport.height } })

    test('the article list, its filters and its pagination fit the viewport', async ({ page }) => {
      await page.goto('/?q=quantum&category=technology')
      await expect(page.locator('[aria-busy="true"]')).toHaveCount(0)
      await expect(page.getByRole('article').first()).toBeVisible()

      await expectResponsive(page, viewport.width)

      const filters = await openFiltersIfDrawer(page, viewport.width)
      await expect(filters.getByLabel('From')).toBeVisible()
      await expectResponsive(page, viewport.width)
    })

    test('article details fits the viewport', async ({ page }) => {
      await page.goto('/')
      await expect(page.locator('[aria-busy="true"]')).toHaveCount(0)
      await page.getByRole('article').first().getByRole('link').click()
      await expect(page.getByRole('button', { name: 'Save article' })).toBeVisible()

      await expectResponsive(page, viewport.width)
    })

    test('the feed fits the viewport', async ({ page }) => {
      await page.goto('/feed')
      await expect(page.getByRole('heading', { name: 'My feed', level: 1 })).toBeVisible()

      await expectResponsive(page, viewport.width)
    })

    test('saved articles and the reading-list modals fit the viewport', async ({ page }) => {
      await page.goto('/bookmarks')
      await expect(page.getByRole('heading', { name: 'Saved articles', level: 1 })).toBeVisible()
      await expectResponsive(page, viewport.width)

      await page.getByRole('button', { name: 'New list' }).click()
      await expect(page.getByRole('dialog')).toBeVisible()
      await expectResponsive(page, viewport.width)
    })

    test('the preferences modal fits the viewport', async ({ page }) => {
      await page.goto('/')
      await page.getByRole('button', { name: 'Preferences' }).click()
      await expect(page.getByRole('dialog')).toBeVisible()

      await expectResponsive(page, viewport.width)
    })

    test('saving a search fits the viewport, drawer or not', async ({ page }) => {
      await page.goto('/?q=quantum')
      await expect(page.locator('[aria-busy="true"]')).toHaveCount(0)

      await page.getByRole('button', { name: 'Save this search' }).click()
      await expect(page.getByRole('dialog')).toBeVisible()
      await expectResponsive(page, viewport.width)
    })
  })
}

test.describe('the filter panel below lg', () => {
  test.use({ viewport: { width: 375, height: 812 } })

  test('is a drawer: hidden until asked for, and its changes reach the list', async ({ page }) => {
    await page.goto('/')
    await expect(page.locator('[aria-busy="true"]')).toHaveCount(0)

    // Nothing of the panel is on screen until the reader opens it.
    await expect(page.getByRole('dialog', { name: 'Filters' })).toBeHidden()

    await page.getByRole('button', { name: 'Filters', exact: true }).click()
    const drawer = page.getByRole('dialog', { name: 'Filters' })
    await expect(drawer).toBeVisible()

    await drawer.getByRole('combobox', { name: 'Category' }).click()
    await page.getByRole('option', { name: 'Technology' }).click()
    await drawer.getByRole('button', { name: 'Show results' }).click()

    await expect(drawer).toBeHidden()
    await expect(page).toHaveURL(/category=technology/)
    await expect(page.getByRole('button', { name: /Remove filter: Technology/ })).toBeVisible()
  })
})

test.describe('at desktop the filter panel stays inline', () => {
  test.use({ viewport: { width: 1280, height: 800 } })

  test('shows the filters without a drawer trigger', async ({ page }) => {
    await page.goto('/')
    await expect(page.getByRole('main').getByLabel('From')).toBeVisible()
    await expect(page.getByRole('button', { name: 'Filters', exact: true })).toBeHidden()
  })
})

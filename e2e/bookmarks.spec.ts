import { expect, test } from '@playwright/test'
import type { Page } from '@playwright/test'
import { mockProviders } from './providerMocks.ts'

/**
 * Saved articles and the reading lists over them, driven the way a reader gets there:
 * open a story, save it, then organise from `/bookmarks`.
 */

const cards = (page: Page) => page.getByRole('article')
const dialog = (page: Page) => page.getByRole('dialog')
const saved = (page: Page) => page.getByRole('main')
const announcement = (page: Page) => saved(page).getByRole('status')

/** Save the nth story on the front page, from its own details view. */
async function saveStory(page: Page, index: number) {
  await page.goto('/')
  await expect(page.locator('[aria-busy="true"]')).toHaveCount(0)
  const title = (await cards(page).nth(index).getByRole('link').innerText()).trim()
  await cards(page).nth(index).getByRole('link').click()
  await page.getByRole('button', { name: 'Save article' }).click()
  await expect(page.getByRole('button', { name: 'Remove saved article' })).toBeVisible()
  return title
}

async function createList(page: Page, name: string) {
  await page.getByRole('button', { name: 'New list' }).click()
  await dialog(page).getByLabel('List name').fill(name)
  await dialog(page).getByRole('button', { name: 'Save list' }).click()
  await expect(dialog(page)).toBeHidden()
}

test.beforeEach(async ({ page }) => {
  await mockProviders(page)
})

test.describe('saved articles and reading lists', () => {
  test('is reachable from the primary navigation and says nothing is saved yet', async ({
    page,
  }) => {
    await page.goto('/')
    await page
      .getByRole('navigation', { name: 'Primary' })
      .getByRole('link', { name: 'Saved' })
      .click()

    await expect(page).toHaveURL(/\/bookmarks$/)
    await expect(saved(page).getByRole('heading', { name: 'Nothing saved yet' })).toBeVisible()
    await expect(cards(page)).toHaveCount(0)
  })

  test('shows a story saved from its details page, and survives a reload', async ({ page }) => {
    const title = await saveStory(page, 0)

    await page.goto('/bookmarks')
    await expect(cards(page)).toHaveCount(1)
    await expect(cards(page).getByRole('link', { name: title })).toBeVisible()

    await page.reload()
    await expect(cards(page).getByRole('link', { name: title })).toBeVisible()
  })

  test('creates a list, files an article into it, and filters down to it', async ({ page }) => {
    const first = await saveStory(page, 0)
    const second = await saveStory(page, 1)
    await page.goto('/bookmarks')

    await createList(page, 'Weekend reading')
    await expect(announcement(page)).toHaveText('Reading list created.')

    // File only the second story, so the filter has something to actually leave out.
    await cards(page)
      .filter({ hasText: second })
      .getByRole('button', { name: 'Add to a reading list' })
      .click()
    await dialog(page).getByRole('checkbox', { name: 'Weekend reading' }).click()
    await dialog(page).getByRole('button', { name: 'Done' }).click()
    await expect(announcement(page)).toHaveText('Added to “Weekend reading”.')

    await expect(cards(page)).toHaveCount(2)
    await saved(page).getByRole('button', { name: 'Weekend reading' }).click()
    await expect(cards(page)).toHaveCount(1)
    await expect(cards(page).getByRole('link', { name: second })).toBeVisible()
    await expect(saved(page).getByText(first)).toHaveCount(0)

    // "All saved" is not a list — both stories are still saved.
    await saved(page).getByRole('button', { name: 'All saved' }).click()
    await expect(cards(page)).toHaveCount(2)
  })

  test('refuses a blank name and a name already taken', async ({ page }) => {
    await page.goto('/bookmarks')
    await createList(page, 'Weekend reading')

    await page.getByRole('button', { name: 'New list' }).click()
    await dialog(page).getByRole('button', { name: 'Save list' }).click()
    await expect(dialog(page).getByText('Enter a list name.')).toBeVisible()

    // Same name in a different case is the same list to the reader who typed it.
    await dialog(page).getByLabel('List name').fill('weekend READING')
    await dialog(page).getByRole('button', { name: 'Save list' }).click()
    await expect(dialog(page).getByText('A list with that name already exists.')).toBeVisible()
    await expect(dialog(page)).toBeVisible()

    await dialog(page).getByLabel('List name').fill('Later')
    await dialog(page).getByRole('button', { name: 'Save list' }).click()
    await expect(dialog(page)).toBeHidden()
    await expect(saved(page).getByRole('button', { name: 'Later' })).toBeVisible()
  })

  test('renames the selected list, keeping the articles filed in it', async ({ page }) => {
    const title = await saveStory(page, 0)
    await page.goto('/bookmarks')
    await createList(page, 'Weekend reading')

    await cards(page).getByRole('button', { name: 'Add to a reading list' }).click()
    await dialog(page).getByRole('checkbox', { name: 'Weekend reading' }).click()
    await dialog(page).getByRole('button', { name: 'Done' }).click()

    await saved(page).getByRole('button', { name: 'Weekend reading' }).click()
    await saved(page).getByRole('button', { name: 'Rename list' }).click()
    await dialog(page).getByLabel('List name').fill('Monday reading')
    await dialog(page).getByRole('button', { name: 'Save list' }).click()

    await expect(announcement(page)).toHaveText('Reading list renamed.')
    await expect(saved(page).getByRole('button', { name: 'Monday reading' })).toBeVisible()
    await expect(saved(page).getByRole('button', { name: 'Weekend reading' })).toHaveCount(0)
    await expect(cards(page).getByRole('link', { name: title })).toBeVisible()
  })

  test('asks before deleting a list, and leaves the articles saved', async ({ page }) => {
    const title = await saveStory(page, 0)
    await page.goto('/bookmarks')
    await createList(page, 'Weekend reading')
    await saved(page).getByRole('button', { name: 'Weekend reading' }).click()

    await saved(page).getByRole('button', { name: 'Delete list' }).click()
    await expect(dialog(page).getByText('“Weekend reading” is deleted')).toBeVisible()
    await dialog(page).getByRole('button', { name: 'Cancel' }).click()
    await expect(saved(page).getByRole('button', { name: 'Weekend reading' })).toBeVisible()

    await saved(page).getByRole('button', { name: 'Delete list' }).click()
    await dialog(page).getByRole('button', { name: 'Delete list' }).click()

    await expect(announcement(page)).toHaveText('Reading list deleted.')
    await expect(saved(page).getByRole('button', { name: 'Weekend reading' })).toHaveCount(0)
    // Deleting the name must not delete the reading — the story is still saved.
    await expect(cards(page).getByRole('link', { name: title })).toBeVisible()
  })

  test('asks before removing a save, and drops it from the list holding it', async ({ page }) => {
    const title = await saveStory(page, 0)
    await page.goto('/bookmarks')
    await createList(page, 'Weekend reading')
    await cards(page).getByRole('button', { name: 'Add to a reading list' }).click()
    await dialog(page).getByRole('checkbox', { name: 'Weekend reading' }).click()
    await dialog(page).getByRole('button', { name: 'Done' }).click()

    await cards(page).getByRole('button', { name: 'Remove saved article' }).click()
    await expect(
      dialog(page).getByRole('heading', { name: 'Remove this saved article?' }),
    ).toBeVisible()
    await dialog(page).getByRole('button', { name: 'Cancel' }).click()
    await expect(cards(page).getByRole('link', { name: title })).toBeVisible()

    await cards(page).getByRole('button', { name: 'Remove saved article' }).click()
    await dialog(page).getByRole('button', { name: 'Remove saved article' }).click()

    await expect(announcement(page)).toHaveText('Article removed from saved.')
    await expect(saved(page).getByRole('heading', { name: 'Nothing saved yet' })).toBeVisible()

    // The list outlives the article, and reads as empty rather than holding a hole.
    await saved(page).getByRole('button', { name: 'Weekend reading' }).click()
    await expect(saved(page).getByRole('heading', { name: 'This list is empty' })).toBeVisible()
  })

  test('asks on the details page too, before an unsave empties the list holding the story', async ({
    page,
  }) => {
    const title = await saveStory(page, 0)
    const permalink = new URL(page.url()).pathname
    await page.goto('/bookmarks')
    await createList(page, 'Weekend reading')
    await cards(page).getByRole('button', { name: 'Add to a reading list' }).click()
    await dialog(page).getByRole('checkbox', { name: 'Weekend reading' }).click()
    await dialog(page).getByRole('button', { name: 'Done' }).click()

    // Same mutation, other entry point: the bookmark icon on the story itself.
    await page.goto(permalink)
    await page.getByRole('button', { name: 'Remove saved article' }).click()
    await expect(
      dialog(page).getByRole('heading', { name: 'Remove this saved article?' }),
    ).toBeVisible()
    await dialog(page).getByRole('button', { name: 'Cancel' }).click()
    await expect(page.getByRole('button', { name: 'Remove saved article' })).toHaveAttribute(
      'aria-pressed',
      'true',
    )

    await page.getByRole('button', { name: 'Remove saved article' }).click()
    await dialog(page).getByRole('button', { name: 'Remove saved article' }).click()
    await expect(page.getByRole('button', { name: 'Save article' })).toBeVisible()

    await page.goto('/bookmarks')
    await expect(saved(page).getByText(title)).toHaveCount(0)
    await saved(page).getByRole('button', { name: 'Weekend reading' }).click()
    await expect(saved(page).getByRole('heading', { name: 'This list is empty' })).toBeVisible()
  })

  test('unsaves a story filed in no list without a dialog in the way', async ({ page }) => {
    await saveStory(page, 0)

    await page.getByRole('button', { name: 'Remove saved article' }).click()
    await expect(dialog(page)).toHaveCount(0)
    await expect(page.getByRole('button', { name: 'Save article' })).toHaveAttribute(
      'aria-pressed',
      'false',
    )
  })

  test('keeps card actions at the 44px touch target on a phone viewport', async ({ page }) => {
    await saveStory(page, 0)
    await page.setViewportSize({ width: 375, height: 900 })
    await page.goto('/bookmarks')

    for (const name of ['Add to a reading list', 'Remove saved article']) {
      const button = cards(page).getByRole('button', { name })
      // Polled: the card's entry animation scales it up, so the first box is still mid-flight.
      await expect
        .poll(
          async () => {
            const box = await button.boundingBox()
            return Math.min(box?.width ?? 0, box?.height ?? 0)
          },
          { message: name },
        )
        .toBeGreaterThanOrEqual(44)
    }
  })

  test('has no horizontal scroll at 375, 768 or 1280', async ({ page }) => {
    await saveStory(page, 0)
    await page.goto('/bookmarks')
    await createList(page, 'Weekend reading')

    for (const width of [375, 768, 1280]) {
      await page.setViewportSize({ width, height: 900 })
      // Evaluated as a string: the e2e tsconfig carries no DOM lib (see theme-tokens.spec).
      const overflow = await page.evaluate<number>(
        `document.documentElement.scrollWidth - document.documentElement.clientWidth`,
      )
      expect(overflow, `viewport ${width}`).toBeLessThanOrEqual(0)
    }
  })
})

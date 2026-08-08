import { expect, test } from '@playwright/test'
import type { Page } from '@playwright/test'
import { mockProviders } from './providerMocks.ts'

/**
 * The details page, reached the way a reader reaches it: from a list they had already
 * filtered. The two things worth proving are that leaving and coming back does not lose
 * their search, and that arriving does not re-fetch a feed the app already has.
 */

const firstCard = (page: Page) => page.getByRole('article').first()
const firstHeading = (page: Page) => firstCard(page).getByRole('heading')

/** Open the first result and return the headline it was opened from. */
async function openFirstArticle(page: Page): Promise<string> {
  // The grid deliberately holds the previous page while the next loads, so the headline
  // under the cursor is only the right one once the list has settled.
  await expect(page.locator('[aria-busy="true"]')).toHaveCount(0)
  const link = firstCard(page).getByRole('heading').getByRole('link')
  await expect(link).toBeVisible()
  const title = (await link.innerText()).trim()
  await link.click()
  await page.waitForURL(/\/articles\//)
  await expect(page.getByRole('heading', { level: 1, name: title })).toBeVisible()
  return title
}

test.describe('article details', () => {
  test.beforeEach(async ({ page }) => {
    await mockProviders(page)
  })

  test('shows the story with its source, byline, date and a link to the original', async ({
    page,
  }) => {
    await page.goto('/')
    const title = await openFirstArticle(page)

    const story = page.getByRole('article')
    await expect(story.locator('[data-source-id]')).toHaveCount(1)
    // Every fake byline is "<Prefix> Reporter <n>", and the provider prefix leads the title.
    const prefix = title.split(' ')[0] as string
    await expect(story.getByText(`${prefix} Reporter`, { exact: false })).toBeVisible()

    const stamp = await story.locator('time').getAttribute('datetime')
    expect(Number.isNaN(Date.parse(stamp ?? ''))).toBe(false)

    const original = page.getByRole('link', { name: 'Read the full story at the source' })
    await expect(original).toHaveAttribute('href', /^https?:\/\//)
    await expect(original).toHaveAttribute('target', '_blank')
  })

  test('renders from what the list already loaded, with no skeleton and no refetch', async ({
    page,
  }) => {
    await page.goto('/')
    await expect(firstCard(page)).toBeVisible()

    // Everything the app could ask a provider for is now refused. If the details page
    // refetched the collection — the blueprint's mistake — this is where it would break.
    const requests: string[] = []
    await page.route('**/api/**', (route) => {
      requests.push(route.request().url())
      return route.abort()
    })

    await openFirstArticle(page)
    await expect(page.getByRole('status')).toHaveCount(0)
    expect(requests).toEqual([])
  })

  test('goes back to the same filtered page of results the reader left', async ({ page }) => {
    await page.goto('/')
    await page.getByRole('searchbox', { name: 'Search articles' }).fill('harvest')
    await page.waitForURL(/q=harvest/)
    await expect(page.getByRole('article').filter({ hasText: 'on quantum' })).toHaveCount(0)

    const onPageOne = await firstHeading(page).innerText()
    await page.getByRole('navigation', { name: 'Pagination' }).getByLabel('Page 2').click()
    await page.waitForURL(/page=2/)
    // The URL changing is not the results changing — wait for the second page to land.
    await expect(firstHeading(page)).not.toHaveText(onPageOne)
    const listUrl = page.url()
    const title = await openFirstArticle(page)
    // The query state travels with the reader rather than being rebuilt on the way back.
    expect(page.url()).toContain('q=harvest')

    await page.getByRole('link', { name: 'Back to results' }).click()

    await expect(page).toHaveURL(listUrl)
    await expect(page.getByRole('searchbox', { name: 'Search articles' })).toHaveValue('harvest')
    await expect(page.getByRole('link', { name: title })).toBeVisible()
  })

  test('says a source published no summary rather than leaving a blank line', async ({ page }) => {
    await page.goto('/')
    // Guardian story 1 is the one with a null trailText.
    await page.getByRole('searchbox', { name: 'Search articles' }).fill('Guardian story 1 on')
    await page.waitForURL(/q=Guardian/)
    await expect(firstHeading(page)).toHaveText(/^Guardian story 1 on/)

    await openFirstArticle(page)
    await expect(page.getByText('This source published no summary.')).toBeVisible()
  })

  test('keeps a bookmarked article bookmarked across a cold reload', async ({ page }) => {
    await page.goto('/')
    await openFirstArticle(page)

    const save = page.getByRole('button', { name: 'Save article' })
    await expect(save).toHaveAttribute('aria-pressed', 'false')
    await save.click()

    const saved = page.getByRole('button', { name: 'Remove saved article' })
    await expect(saved).toHaveAttribute('aria-pressed', 'true')

    // A reload is a cold load: nothing is in the query cache, so this also proves the
    // details URL alone is enough to rebuild the page.
    await page.reload()
    await expect(page.getByRole('button', { name: 'Remove saved article' })).toHaveAttribute(
      'aria-pressed',
      'true',
    )

    await page.getByRole('button', { name: 'Remove saved article' }).click()
    await expect(page.getByRole('button', { name: 'Save article' })).toHaveAttribute(
      'aria-pressed',
      'false',
    )
  })

  test('offers a way back instead of a broken page for an unknown article id', async ({ page }) => {
    await page.goto('/articles/guardian%3Ano-such-story')

    await expect(page.getByRole('heading', { name: 'Article not available' })).toBeVisible()
    await page.getByRole('link', { name: 'Back to results' }).click()
    await expect(page.getByRole('article').first()).toBeVisible()
  })
})

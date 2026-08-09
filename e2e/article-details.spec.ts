import { expect, test } from '@playwright/test'
import type { Page } from '@playwright/test'
import { mockProviders } from './providerMocks.ts'

/**
 * The details page, reached the way a reader reaches it: from a list they had already
 * filtered. The two things worth proving are that leaving and coming back does not lose
 * their search, and that arriving does not re-fetch a feed the app already has.
 *
 * The page's failed-cold-load card has no case here on purpose: `aggregate` is `allSettled`,
 * so aborting or 500-ing every provider route still resolves the query (into `failures`) and
 * renders the missing-article card, not the error one. That branch is covered where it can
 * actually be provoked — src/features/Articles/pages/ArticleDetailsPage.test.tsx.
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

  test('shows the full body, not the summary, for a source that serves one', async ({ page }) => {
    await page.goto('/')
    // Guardian story 2 is the one the provider returns a body for.
    await page.getByRole('searchbox', { name: 'Search articles' }).fill('Guardian story 2 on')
    await page.waitForURL(/q=Guardian/)
    await expect(firstHeading(page)).toHaveText(/^Guardian story 2 on/)

    // The card only ever has room for the summary.
    await expect(firstCard(page).getByText('Guardian summary 2')).toBeVisible()
    await openFirstArticle(page)

    const story = page.getByRole('article')
    await expect(story.getByText(/The full body opens here & runs on\./)).toBeVisible()
    await expect(story.getByText(/A second paragraph the summary never had\./)).toBeVisible()
    await expect(story.getByText('Guardian summary 2')).toHaveCount(0)
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

  test('announces every save and unsave, not just the icon changing state', async ({ page }) => {
    await page.goto('/')
    await openFirstArticle(page)

    // sr-only, so assert the text rather than visibility: what a screen reader gets is the
    // whole point, and there is nothing on screen to look at.
    const announcement = page.locator('[aria-live="polite"]')
    await expect(announcement).toBeEmpty()

    await page.getByRole('button', { name: 'Save article' }).click()
    await expect(announcement).toHaveText('Article saved.')

    await page.getByRole('button', { name: 'Remove saved article' }).click()
    await expect(announcement).toHaveText('Article removed from saved.')

    // Saving again has to re-announce, not sit on the stale "removed" line.
    await page.getByRole('button', { name: 'Save article' }).click()
    await expect(announcement).toHaveText('Article saved.')
  })

  test('still reads as saved when the story is reopened without a reload', async ({ page }) => {
    await page.goto('/')
    const title = await openFirstArticle(page)
    await page.getByRole('button', { name: 'Save article' }).click()
    await expect(page.getByRole('button', { name: 'Remove saved article' })).toBeVisible()

    // Back and in again, all within one page lifecycle: nothing is re-read from a cold
    // start here, so a reader holding its own copy of the list is what would go stale.
    await page.getByRole('link', { name: 'Back to results' }).click()
    await expect(page.getByRole('link', { name: title })).toBeVisible()
    await openFirstArticle(page)

    await expect(page.getByRole('button', { name: 'Remove saved article' })).toHaveAttribute(
      'aria-pressed',
      'true',
    )
  })

  test('opens a saved story from a bare permalink after it has left the first page', async ({
    page,
  }) => {
    await page.goto('/')
    // Page 2 of the feed: nothing here is in the default first page a bare permalink
    // would otherwise be resolved against.
    const onPageOne = await firstHeading(page).innerText()
    await page.getByRole('navigation', { name: 'Pagination' }).getByLabel('Page 2').click()
    await page.waitForURL(/page=2/)
    await expect(firstHeading(page)).not.toHaveText(onPageOne)

    const title = await openFirstArticle(page)
    await page.getByRole('button', { name: 'Save article' }).click()
    await expect(page.getByRole('button', { name: 'Remove saved article' })).toBeVisible()

    // The link a reader keeps: no query string, and here not even a provider to ask.
    const permalink = new URL(page.url()).pathname
    await page.route('**/api/**', (route) => route.abort())
    await page.goto(permalink)

    await expect(page.getByRole('heading', { level: 1, name: title })).toBeVisible()
    await expect(page.getByRole('heading', { name: 'Article not available' })).toHaveCount(0)
  })

  test('upgrades a bookmark saved by the earlier id-only shape so its permalink resolves', async ({
    page,
  }) => {
    await page.goto('/')
    const title = await openFirstArticle(page)
    const permalink = new URL(page.url()).pathname
    const id = decodeURIComponent(permalink.split('/articles/')[1] as string)

    // Exactly what a reader who saved this before the snapshot shipped has in storage.
    await page.evaluate((saved) => {
      localStorage.setItem('ina-bookmarks', JSON.stringify([saved]))
    }, id)
    await page.goto(permalink)

    // Just opening it reads as saved and upgrades the entry — no click, no surprise.
    await expect(page.getByRole('button', { name: 'Remove saved article' })).toHaveAttribute(
      'aria-pressed',
      'true',
    )

    await page.route('**/api/**', (route) => route.abort())
    await page.goto(permalink)
    await expect(page.getByRole('heading', { level: 1, name: title })).toBeVisible()
    await expect(page.getByRole('heading', { name: 'Article not available' })).toHaveCount(0)

    // And the button still means what it says: one click unsaves it.
    await page.getByRole('button', { name: 'Remove saved article' }).click()
    await expect(page.getByRole('button', { name: 'Save article' })).toHaveAttribute(
      'aria-pressed',
      'false',
    )
  })

  test('serves the corrected story from a permalink once the reader has seen the fix', async ({
    page,
  }) => {
    // One Guardian story, under our control, so "the newsroom corrected it" is a real event.
    let headline = 'Guardian story 3 on quantum'
    await page.route('**/api/guardian/**', (route) =>
      route.fulfill({
        contentType: 'application/json',
        body: JSON.stringify({
          response: {
            results: [
              {
                id: 'https://guardian.test/story-3',
                webTitle: headline,
                webUrl: 'https://guardian.test/story-3',
                webPublicationDate: '2026-06-01T09:00:00.000Z',
                sectionId: 'technology',
                fields: { trailText: 'Guardian summary 3', byline: 'Guardian Reporter 3' },
              },
            ],
          },
        }),
      }),
    )

    // No other provider publishes a story by this name, so the list holds exactly ours.
    await page.goto('/?q=Guardian+story+3')
    const title = await openFirstArticle(page)
    expect(title).toBe(headline)
    await page.getByRole('button', { name: 'Save article' }).click()
    await expect(page.getByRole('button', { name: 'Remove saved article' })).toBeVisible()
    const permalink = new URL(page.url()).pathname

    // The correction lands, and the reader meets it the ordinary way: back on the list.
    headline = 'Guardian story 3 on quantum, corrected'
    await page.goto('/?q=Guardian+story+3')
    await openFirstArticle(page)
    await expect(page.getByRole('button', { name: 'Remove saved article' })).toBeVisible()

    // The kept link, cold and with nothing left to ask: the saved copy is the corrected one.
    await page.route('**/api/**', (route) => route.abort())
    await page.goto(permalink)
    await expect(page.getByRole('heading', { level: 1, name: headline })).toBeVisible()
  })

  test('keeps the story readable while the reader saves and unsaves it on a bare permalink', async ({
    page,
  }) => {
    // Page 2, so this story is nowhere in the default first page a bare permalink resolves
    // against — once the providers are gone, the saved copy is the only copy there is.
    await page.goto('/')
    const onPageOne = await firstHeading(page).innerText()
    await page.getByRole('navigation', { name: 'Pagination' }).getByLabel('Page 2').click()
    await page.waitForURL(/page=2/)
    await expect(firstHeading(page)).not.toHaveText(onPageOne)

    const title = await openFirstArticle(page)
    await page.getByRole('button', { name: 'Save article' }).click()
    const permalink = new URL(page.url()).pathname

    await page.route('**/api/**', (route) => route.abort())
    await page.goto(permalink)
    await expect(page.getByRole('heading', { level: 1, name: title })).toBeVisible()

    // Saving and unsaving are read through one list now, so the button tracks the store on
    // every click — and unsaving is not "the story is gone": it stays on screen either way.
    await page.getByRole('button', { name: 'Remove saved article' }).click()
    await expect(page.getByRole('button', { name: 'Save article' })).toHaveAttribute(
      'aria-pressed',
      'false',
    )
    await expect(page.getByRole('heading', { level: 1, name: title })).toBeVisible()
    await expect(page.getByRole('heading', { name: 'Article not available' })).toHaveCount(0)

    await page.getByRole('button', { name: 'Save article' }).click()
    await expect(page.getByRole('button', { name: 'Remove saved article' })).toHaveAttribute(
      'aria-pressed',
      'true',
    )
    await expect(page.getByRole('heading', { level: 1, name: title })).toBeVisible()
  })

  test('offers a way back instead of a broken page for an unknown article id', async ({ page }) => {
    await page.goto('/articles/guardian%3Ano-such-story')

    await expect(page.getByRole('heading', { name: 'Article not available' })).toBeVisible()
    await page.getByRole('link', { name: 'Back to results' }).click()
    await expect(page.getByRole('article').first()).toBeVisible()
  })
})

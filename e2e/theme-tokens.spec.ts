import { expect, test } from '@playwright/test'

// Boot light so the dark state below comes from the user's click, not the machine.
test.use({ colorScheme: 'light' })

// Tailwind v4 drops a utility whose token is undefined — no error, just an element that
// keeps its inherited colour. AppInput's error state is the only thing shipping
// `dark:*-danger-300`, and nothing in the app passes it an `error` prop yet, so the
// styles are read off a probe carrying AppInput's own classes rather than off a field.
// Move these assertions onto the real field the day a form can fail validation.
const DANGER_300 = 'rgb(239, 154, 154)'

test('the dark error colour AppInput asks for actually paints once the user goes dark', async ({
  page,
}) => {
  await page.goto('/')

  // String form, like the scrollWidth probe in articles.spec.ts: the e2e tsconfig has no
  // DOM lib, so page-side code stays out of the type checker.
  const probe = () =>
    page.evaluate<{ color: string; borderTopColor: string }>(`(() => {
      const el = document.createElement('p')
      el.className = 'border border-danger-600 text-danger-600 dark:border-danger-300 dark:text-danger-300'
      document.body.append(el)
      const { color, borderTopColor } = getComputedStyle(el)
      el.remove()
      return { color, borderTopColor }
    })()`)

  // Light: the dark: variant is inert, so the light error colour stands.
  expect(await probe()).toEqual({ color: 'rgb(198, 40, 40)', borderTopColor: 'rgb(198, 40, 40)' })

  await page.getByRole('button', { name: 'Switch to dark theme' }).click()
  await expect(page.locator('html')).toHaveClass(/dark/)

  expect(await probe()).toEqual({ color: DANGER_300, borderTopColor: DANGER_300 })
})

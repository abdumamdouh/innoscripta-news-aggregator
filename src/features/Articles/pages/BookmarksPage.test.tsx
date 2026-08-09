import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it } from 'vitest'
import '@/i18n'
import type { Article } from '@/core/sources/types'
import { ToastProvider } from '@/components/common/design-system'
import { BookmarksPage } from '@/features/Articles/pages/BookmarksPage'
import { readBookmarks, writeBookmarks } from '@/features/Articles/utils/bookmarks'
import {
  createList,
  readReadingLists,
  writeReadingLists,
} from '@/features/Articles/utils/readingLists'
import en from '@/i18n/locales/en.json'

/**
 * The page's wiring, not its arithmetic: `readingLists.test.ts` and `bookmarks.test.ts`
 * already pin what `createList`/`renameList`/`toggleArticleInList` return. What is only
 * reachable from here is the click path through the dialogs, the confirm gate in front of
 * the two destructive actions, and the toast each mutation is supposed to announce.
 */
const article: Article = {
  id: 'guardian:1',
  title: 'Mars rover lands safely',
  description: 'A long descent ends well.',
  url: 'https://example.test/mars',
  publishedAt: '2026-01-10T12:00:00.000Z',
  sourceId: 'guardian',
  sourceLabel: 'The Guardian',
}

/** The live region `ToastProvider` keeps mounted — empty until a mutation says something. */
const toastText = () => screen.getByRole('status').textContent ?? ''

const seedList = (name: string, articleIds: string[] = []) => {
  writeReadingLists(
    createList(readReadingLists(), name).map((list) =>
      list.name === name ? { ...list, articleIds } : list,
    ),
  )
}

function renderPage() {
  return render(
    <ToastProvider>
      <MemoryRouter initialEntries={['/bookmarks']}>
        <BookmarksPage />
      </MemoryRouter>
    </ToastProvider>,
  )
}

beforeEach(() => {
  localStorage.clear()
  readBookmarks()
  readReadingLists()
  writeBookmarks([{ id: article.id, article }])
})

describe('BookmarksPage — reading lists', () => {
  it('creates a list from the dialog and says so', async () => {
    renderPage()
    await userEvent.click(screen.getByRole('button', { name: en['bookmarks.list.new'] }))

    await userEvent.type(screen.getByLabelText(en['bookmarks.list.nameLabel']), 'Weekend{enter}')

    // On screen as a filter, in storage, and announced — all three, from one click path.
    expect(screen.getByRole('button', { name: 'Weekend' })).toBeInTheDocument()
    expect(readReadingLists().map((list) => list.name)).toEqual(['Weekend'])
    expect(toastText()).toContain(en['bookmarks.toast.listCreated'])
  })

  it('refuses a duplicate name without writing or announcing anything', async () => {
    seedList('Weekend')
    renderPage()
    await userEvent.click(screen.getByRole('button', { name: en['bookmarks.list.new'] }))

    await userEvent.type(screen.getByLabelText(en['bookmarks.list.nameLabel']), 'weekend {enter}')

    expect(screen.getByText(en['bookmarks.list.errors.duplicate'])).toBeInTheDocument()
    expect(readReadingLists()).toHaveLength(1)

    // Nothing was written, so nothing is announced either — checked with the dialog shut,
    // since an open Radix dialog `aria-hidden`s the live region behind it.
    await userEvent.click(screen.getByRole('button', { name: en['bookmarks.list.cancel'] }))
    expect(toastText()).toBe('')
  })

  it('renames the active list in place', async () => {
    seedList('Weekend')
    renderPage()
    // Rename and delete only exist once a list is the active filter.
    expect(
      screen.queryByRole('button', { name: en['bookmarks.list.rename'] }),
    ).not.toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Weekend' }))

    await userEvent.click(screen.getByRole('button', { name: en['bookmarks.list.rename'] }))
    const field = screen.getByLabelText(en['bookmarks.list.nameLabel'])
    expect(field).toHaveValue('Weekend')
    await userEvent.clear(field)
    await userEvent.type(field, 'Later{enter}')

    expect(screen.getByRole('button', { name: 'Later' })).toHaveAttribute('aria-pressed', 'true')
    expect(readReadingLists()[0]?.name).toBe('Later')
    expect(toastText()).toContain(en['bookmarks.toast.listRenamed'])
  })

  it('keeps the list when the delete confirmation is cancelled', async () => {
    seedList('Weekend')
    renderPage()
    await userEvent.click(screen.getByRole('button', { name: 'Weekend' }))
    await userEvent.click(screen.getByRole('button', { name: en['bookmarks.list.delete'] }))

    await userEvent.click(
      within(screen.getByRole('dialog')).getByRole('button', { name: en['common.cancel'] }),
    )

    expect(readReadingLists()).toHaveLength(1)
    expect(screen.getByRole('button', { name: 'Weekend' })).toBeInTheDocument()
    expect(toastText()).toBe('')
  })

  it('deletes the list on confirm and falls back to everything saved', async () => {
    seedList('Weekend', [article.id])
    renderPage()
    await userEvent.click(screen.getByRole('button', { name: 'Weekend' }))
    await userEvent.click(screen.getByRole('button', { name: en['bookmarks.list.delete'] }))

    const dialog = screen.getByRole('dialog')
    expect(dialog).toHaveTextContent('Weekend')
    await userEvent.click(within(dialog).getByRole('button', { name: en['bookmarks.list.delete'] }))

    expect(readReadingLists()).toEqual([])
    expect(screen.queryByRole('button', { name: 'Weekend' })).not.toBeInTheDocument()
    // The filter it was showing is gone, so "All saved" is pressed again — and the
    // articles the list held are still saved.
    expect(screen.getByRole('button', { name: en['bookmarks.all'] })).toHaveAttribute(
      'aria-pressed',
      'true',
    )
    expect(screen.getByRole('link', { name: article.title })).toBeInTheDocument()
    expect(toastText()).toContain(en['bookmarks.toast.listDeleted'])
  })
})

describe('BookmarksPage — membership and removal', () => {
  it('adds a saved article to a list, then takes it back out of the same dialog', async () => {
    seedList('Weekend')
    renderPage()
    await userEvent.click(screen.getByRole('button', { name: en['bookmarks.addTo.label'] }))

    const tick = screen.getByRole('checkbox', { name: 'Weekend' })
    expect(tick).toHaveAttribute('aria-checked', 'false')
    await userEvent.click(tick)

    expect(readReadingLists()[0]?.articleIds).toEqual([article.id])
    // Same dialog, same tick: membership is a toggle, not an add-only picker.
    expect(screen.getByRole('checkbox', { name: 'Weekend' })).toHaveAttribute(
      'aria-checked',
      'true',
    )
    // Read once the dialog is shut: Radix `aria-hidden`s everything behind an open one.
    await userEvent.click(screen.getByRole('button', { name: en['bookmarks.addTo.done'] }))
    expect(toastText()).toContain(en['bookmarks.toast.addedToList'].replace('{{list}}', 'Weekend'))

    await userEvent.click(screen.getByRole('button', { name: en['bookmarks.addTo.label'] }))
    await userEvent.click(screen.getByRole('checkbox', { name: 'Weekend' }))
    await userEvent.click(screen.getByRole('button', { name: en['bookmarks.addTo.done'] }))

    expect(readReadingLists()[0]?.articleIds).toEqual([])
    expect(toastText()).toContain(
      en['bookmarks.toast.removedFromList'].replace('{{list}}', 'Weekend'),
    )
  })

  it('shows the empty-list card for a list holding nothing', async () => {
    seedList('Weekend')
    renderPage()
    await userEvent.click(screen.getByRole('button', { name: 'Weekend' }))

    // Not the "nothing saved yet" copy — there is a save, it is just not in this list.
    expect(screen.getByText(en['bookmarks.emptyList.title'])).toBeInTheDocument()
    expect(screen.queryByText(en['bookmarks.empty.title'])).not.toBeInTheDocument()
    expect(screen.queryByRole('link', { name: article.title })).not.toBeInTheDocument()
  })

  it('keeps the article when the remove confirmation is cancelled', async () => {
    renderPage()
    await userEvent.click(screen.getByRole('button', { name: en['bookmarks.remove'] }))

    await userEvent.click(
      within(screen.getByRole('dialog')).getByRole('button', { name: en['common.cancel'] }),
    )

    expect(readBookmarks()).toHaveLength(1)
    expect(screen.getByRole('link', { name: article.title })).toBeInTheDocument()
    expect(toastText()).toBe('')
  })

  it('removes the article on confirm, out of saved and out of every list holding it', async () => {
    seedList('Weekend', [article.id])
    renderPage()
    await userEvent.click(screen.getByRole('button', { name: en['bookmarks.remove'] }))

    await userEvent.click(
      within(screen.getByRole('dialog')).getByRole('button', { name: en['bookmarks.remove'] }),
    )

    expect(readBookmarks()).toEqual([])
    // An id left in a list would be a card nothing can render — the snapshot went with it.
    expect(readReadingLists()[0]?.articleIds).toEqual([])
    expect(screen.getByText(en['bookmarks.empty.title'])).toBeInTheDocument()
    expect(toastText()).toContain(en['bookmarks.toast.saveRemoved'])
  })
})

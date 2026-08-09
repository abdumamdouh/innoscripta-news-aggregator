import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import '@/i18n'
import { ToastProvider } from '@/components/common/design-system'
import { SavedSearches } from '@/features/Articles/components/SavedSearches'
import { DEFAULT_ARTICLES_STATE } from '@/features/Articles/constants'
import type { ArticlesState } from '@/features/Articles/types/articles.types'
import {
  createSearch,
  readSavedSearches,
  writeSavedSearches,
} from '@/features/Articles/utils/savedSearches'
import en from '@/i18n/locales/en.json'

/**
 * The click path, not the arithmetic: `savedSearches.test.ts` already pins what
 * `createSearch`/`renameSearch`/`deleteSearch` return. Only reachable from here is what a
 * reader does — save what is on screen, apply it back, rename it, and the confirm gate in
 * front of delete — plus the toast each of those is supposed to announce.
 */
const onScreen: ArticlesState = {
  ...DEFAULT_ARTICLES_STATE,
  q: 'mars',
  category: 'science',
  page: 3,
}

/** The live region `ToastProvider` keeps mounted — empty until a mutation says something. */
const toastText = () => screen.getByRole('status').textContent ?? ''

const seed = (name: string, patch: Partial<ArticlesState> = {}) =>
  writeSavedSearches(
    createSearch(readSavedSearches(), name, { ...DEFAULT_ARTICLES_STATE, ...patch }),
  )

function renderBar(onApply = vi.fn()) {
  render(
    <ToastProvider>
      <SavedSearches state={onScreen} onApply={onApply} />
    </ToastProvider>,
  )
  return onApply
}

beforeEach(() => {
  localStorage.clear()
  readSavedSearches()
})

describe('SavedSearches', () => {
  it('saves the filters on screen under a name and says so', async () => {
    renderBar()
    await userEvent.click(screen.getByRole('button', { name: en['articles.presets.save'] }))

    await userEvent.type(screen.getByLabelText(en['articles.presets.nameLabel']), 'Mars{enter}')

    expect(screen.getByRole('button', { name: 'Mars' })).toBeInTheDocument()
    // The whole filter set is stored, not just the query — that is what applying restores.
    expect(readSavedSearches()[0]?.state).toEqual(onScreen)
    expect(toastText()).toContain(en['articles.presets.toast.saved'])
  })

  it('hands the stored filter set back on apply', async () => {
    seed('Science', { category: 'science', sort: 'oldest' })
    const onApply = renderBar()

    await userEvent.click(screen.getByRole('button', { name: 'Science' }))

    expect(onApply).toHaveBeenCalledWith({
      ...DEFAULT_ARTICLES_STATE,
      category: 'science',
      sort: 'oldest',
    })
    expect(toastText()).toContain('Science')
  })

  it('refuses a duplicate name without writing or announcing anything', async () => {
    seed('Mars')
    renderBar()
    await userEvent.click(screen.getByRole('button', { name: en['articles.presets.save'] }))

    await userEvent.type(screen.getByLabelText(en['articles.presets.nameLabel']), ' mARS {enter}')

    expect(screen.getByText(en['articles.presets.errors.duplicate'])).toBeInTheDocument()
    expect(readSavedSearches()).toHaveLength(1)

    // Read with the dialog shut: an open Radix dialog `aria-hidden`s the live region.
    await userEvent.click(screen.getByRole('button', { name: en['common.cancel'] }))
    expect(toastText()).toBe('')
  })

  it('renames a preset in place, keeping its filters', async () => {
    seed('Mars', { q: 'mars' })
    renderBar()

    await userEvent.click(
      screen.getByRole('button', {
        name: en['articles.presets.rename'].replace('{{name}}', 'Mars'),
      }),
    )
    const field = screen.getByLabelText(en['articles.presets.nameLabel'])
    expect(field).toHaveValue('Mars')
    await userEvent.clear(field)
    await userEvent.type(field, 'Red planet{enter}')

    expect(screen.getByRole('button', { name: 'Red planet' })).toBeInTheDocument()
    expect(readSavedSearches()[0]).toMatchObject({ name: 'Red planet' })
    expect(readSavedSearches()[0]?.state.q).toBe('mars')
    expect(toastText()).toContain(en['articles.presets.toast.renamed'])
  })

  it('keeps the preset when the delete confirmation is cancelled', async () => {
    seed('Mars')
    renderBar()
    await userEvent.click(
      screen.getByRole('button', {
        name: en['articles.presets.delete'].replace('{{name}}', 'Mars'),
      }),
    )

    await userEvent.click(
      within(screen.getByRole('dialog')).getByRole('button', { name: en['common.cancel'] }),
    )

    expect(readSavedSearches()).toHaveLength(1)
    expect(screen.getByRole('button', { name: 'Mars' })).toBeInTheDocument()
    expect(toastText()).toBe('')
  })

  it('deletes the preset on confirm', async () => {
    seed('Mars')
    seed('Sport')
    renderBar()
    await userEvent.click(
      screen.getByRole('button', {
        name: en['articles.presets.delete'].replace('{{name}}', 'Mars'),
      }),
    )

    const dialog = screen.getByRole('dialog')
    expect(dialog).toHaveTextContent('Mars')
    await userEvent.click(
      within(dialog).getByRole('button', { name: en['articles.presets.confirm.delete'] }),
    )

    // Only the named one goes.
    expect(readSavedSearches().map((search) => search.name)).toEqual(['Sport'])
    expect(screen.queryByRole('button', { name: 'Mars' })).not.toBeInTheDocument()
    expect(toastText()).toContain(en['articles.presets.toast.deleted'])
  })
})

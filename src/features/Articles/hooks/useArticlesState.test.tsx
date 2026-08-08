import { act, renderHook, waitFor } from '@testing-library/react'
import type { ReactNode } from 'react'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it } from 'vitest'
import { appTheme } from '@/config/theme'
import { useArticlesState } from '@/features/Articles/hooks/useArticlesState'

function wrapper(initial: string) {
  return ({ children }: { children: ReactNode }) => (
    <MemoryRouter initialEntries={[initial]}>{children}</MemoryRouter>
  )
}

describe('useArticlesState — clearing a keyword', () => {
  beforeEach(() => localStorage.clear())

  it('stays cleared when the last filter is removed from outside the input', async () => {
    const { result } = renderHook(useArticlesState, { wrapper: wrapper('/?q=quantum') })
    expect(result.current.state.q).toBe('quantum')

    // What the chip's remove button does.
    act(() => result.current.update({ q: '' }))
    await waitFor(() => expect(result.current.term).toBe(''))

    // The debounce still holds "quantum" for another tick — it must not write it back.
    await new Promise((resolve) => setTimeout(resolve, appTheme.debounceDelay * 2))
    expect(result.current.state.q).toBe('')
    expect(result.current.term).toBe('')
  })

  it('does not re-hydrate a cleared keyword from the stored snapshot', async () => {
    localStorage.setItem(
      appTheme.storageKeys.directoryState,
      JSON.stringify({ q: 'quantum', sources: [], sort: 'newest', page: 1 }),
    )

    // A bare URL restores the snapshot...
    const { result } = renderHook(useArticlesState, { wrapper: wrapper('/') })
    await waitFor(() => expect(result.current.state.q).toBe('quantum'))

    // ...but clearing it must not bring it straight back.
    act(() => result.current.update({ q: '' }))
    await new Promise((resolve) => setTimeout(resolve, appTheme.debounceDelay * 2))
    expect(result.current.state.q).toBe('')
  })
})

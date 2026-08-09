import { act, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import '@/i18n'
import { ToastProvider } from '@/components/common/design-system/AppToast'
import { useToast } from '@/components/common/design-system/toastContext'
import en from '@/i18n/locales/en.json'

/** Two buttons so the "same message twice" and "newer wins" cases both have a trigger. */
function Trigger() {
  const toast = useToast()
  return (
    <>
      <button onClick={() => toast('Saved.')}>saved</button>
      <button onClick={() => toast('Removed.')}>removed</button>
    </>
  )
}

function renderToaster() {
  return render(
    <ToastProvider>
      <Trigger />
    </ToastProvider>,
  )
}

describe('ToastProvider', () => {
  beforeEach(() => vi.useFakeTimers())
  afterEach(() => vi.useRealTimers())

  // FireEvent, not userEvent — userEvent's own timers fight the fake clock this
  // suite needs, and a toast has nothing to type into.
  const click = (element: HTMLElement) => fireEvent.click(element)

  it('starts with an empty live region rather than a stray announcement', () => {
    renderToaster()
    expect(screen.getByRole('status')).toBeEmptyDOMElement()
  })

  it('shows what the mutation did, inside the live region', () => {
    renderToaster()
    click(screen.getByText('saved'))
    expect(screen.getByRole('status')).toHaveTextContent('Saved.')
  })

  it('clears itself instead of sitting on screen forever', () => {
    renderToaster()
    click(screen.getByText('saved'))
    act(() => vi.advanceTimersByTime(4999))
    expect(screen.getByRole('status')).toHaveTextContent('Saved.')
    act(() => vi.advanceTimersByTime(1))
    expect(screen.getByRole('status')).toBeEmptyDOMElement()
  })

  it('lets the newest message win and restarts its countdown', () => {
    renderToaster()
    click(screen.getByText('saved'))
    act(() => vi.advanceTimersByTime(4000))
    click(screen.getByText('removed'))

    expect(screen.getByRole('status')).toHaveTextContent('Removed.')
    expect(screen.getByRole('status')).not.toHaveTextContent('Saved.')
    // The first toast's remaining 1s must not take the second one down with it.
    act(() => vi.advanceTimersByTime(1000))
    expect(screen.getByRole('status')).toHaveTextContent('Removed.')
  })

  it('replaces the node when the same message repeats, so it is announced again', () => {
    renderToaster()
    click(screen.getByText('saved'))
    const first = screen.getByRole('status').firstElementChild
    click(screen.getByText('saved'))

    expect(screen.getByRole('status')).toHaveTextContent('Saved.')
    expect(screen.getByRole('status').firstElementChild).not.toBe(first)
  })

  it('can be dismissed by hand before the timeout', () => {
    renderToaster()
    click(screen.getByText('saved'))
    click(screen.getByRole('button', { name: en['common.dismiss'] }))
    expect(screen.getByRole('status')).toBeEmptyDOMElement()
  })

  it('refuses to swallow feedback when no provider is mounted', () => {
    const quiet = vi.spyOn(console, 'error').mockImplementation(() => {})
    expect(() => render(<Trigger />)).toThrow(/ToastProvider/)
    quiet.mockRestore()
  })
})

import { createContext, useContext } from 'react'

/** The whole toast API: hand it a line of text, it announces it. */
export type ShowToast = (message: string) => void

export const toastContext = createContext<ShowToast | null>(null)

/** Announce one line of mutation feedback. Throws outside the provider — a silent toast is a bug. */
export function useToast(): ShowToast {
  const show = useContext(toastContext)
  if (!show) throw new Error('useToast must be used inside <ToastProvider>')
  return show
}

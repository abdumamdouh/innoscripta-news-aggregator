import { useCallback, useEffect, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { X } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { AppIconButton } from '@/components/common/design-system/AppIconButton'
import { toastContext } from '@/components/common/design-system/toastContext'

/** How long a toast stays up before it clears itself. */
const TOAST_MS = 5000

interface Toast {
  /** Bumped per call so an identical message still replaces the node — see `key` below. */
  id: number
  message: string
}

/**
 * One toast at a time, in one live region for the whole app. A mutation says what it did and
 * the line clears itself; the newest message wins rather than stacking.
 *
 * ponytail: latest-wins, no queue — every call site here fires one message per user action.
 * Add a queue when a single action starts producing several.
 */
export function ToastProvider({ children }: { children: ReactNode }) {
  const { t } = useTranslation()
  const [toast, setToast] = useState<Toast | null>(null)
  const nextId = useRef(0)

  const show = useCallback((message: string) => {
    nextId.current += 1
    setToast({ id: nextId.current, message })
  }, [])

  // Keyed on the toast object, so a newer message restarts the countdown instead of
  // inheriting the tail of the previous one.
  useEffect(() => {
    if (!toast) return
    const timer = setTimeout(() => setToast(null), TOAST_MS)
    return () => clearTimeout(timer)
  }, [toast])

  return (
    <toastContext.Provider value={show}>
      {children}
      {/* Always mounted so the live region exists before the first message lands in it. */}
      <div
        role="status"
        className="pointer-events-none fixed inset-x-0 bottom-4 z-50 flex justify-center px-4"
      >
        {toast ? (
          <div
            // A fresh node per message: same text twice in a row is still a DOM change, so a
            // screen reader announces the second one instead of sitting on the first.
            key={toast.id}
            className="motion-toast pointer-events-auto flex items-center gap-2 rounded-xl bg-ink-900 py-1 ps-4 pe-1 text-sm text-paper-0 shadow-soft dark:bg-ink-100 dark:text-ink-900"
          >
            <span>{toast.message}</span>
            <AppIconButton
              label={t('common.dismiss')}
              onClick={() => setToast(null)}
              className="text-paper-0 hover:bg-ink-700 dark:text-ink-900 dark:hover:bg-paper-50"
            >
              <X className="size-4" aria-hidden />
            </AppIconButton>
          </div>
        ) : null}
      </div>
    </toastContext.Provider>
  )
}

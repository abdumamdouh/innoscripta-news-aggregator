import { useEffect, useState } from 'react'
import { appTheme } from '@/config/theme'

/** Trailing-edge debounce of a value. Raw value drives the input, this drives the query. */
export function useDebounce<T>(value: T, delay: number = appTheme.debounceDelay): T {
  const [debounced, setDebounced] = useState(value)

  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delay)
    return () => clearTimeout(timer)
  }, [value, delay])

  return debounced
}

/**
 * `localStorage` that cannot take the app down with it.
 *
 * Reading the property throws outright — not returns null — when storage is denied: Safari
 * with "Block All Cookies", a partitioned third-party iframe, some enterprise policies. Two
 * modules read it during import to set the theme and language before first paint, so an
 * unguarded call there is a white screen rather than a lost preference.
 *
 * `createLocalStorageStore` guards its own access the same way; this is the primitive for
 * the two call sites that need a single value rather than a parsed collection.
 */
export function readStored(key: string): string | null {
  try {
    return localStorage.getItem(key)
  } catch {
    return null
  }
}

/** Persisting a preference is a convenience — never worth failing the interaction over. */
export function writeStored(key: string, value: string): void {
  try {
    localStorage.setItem(key, value)
  } catch {
    // Denied or full: the app keeps the choice in memory for this session.
  }
}

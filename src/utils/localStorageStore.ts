/**
 * localStorage as the one source of truth, with a single parse over it — the read model
 * bookmarks and preferences both need.
 *
 * It exists for identity, not speed: `useSyncExternalStore` tears the render down if a
 * snapshot is a fresh object every call, and a second reader that re-parses on its own
 * drifts the moment another one writes. The cache is keyed on the raw string rather than
 * invalidated by hand, so a change this module did not make — a cleared store, another
 * tab — still reparses on the next read.
 *
 * `parse` must be total: it takes whatever is stored (or `null`) and always returns a
 * value, so unreadable and corrupt storage read as "nothing saved yet".
 */
export function createLocalStorageStore<T>(key: string, parse: (raw: string | null) => T) {
  /** Parsed once so the unreadable-storage path is a stable snapshot too, not a new value. */
  const empty = parse(null)
  let cached: { raw: string | null; value: T } | undefined
  const listeners = new Set<() => void>()

  const read = (): T => {
    try {
      const raw = localStorage.getItem(key)
      if (!cached || cached.raw !== raw) cached = { raw, value: parse(raw) }
      return cached.value
    } catch {
      return empty
    }
  }

  return {
    read,
    /** Returns the unsubscribe, which is the shape `useSyncExternalStore` asks for. */
    subscribe: (listener: () => void) => {
      listeners.add(listener)
      return () => listeners.delete(listener)
    },
    write: (value: T) => {
      try {
        localStorage.setItem(key, JSON.stringify(value))
      } catch {
        // Private mode / quota: persisting is a convenience, never a blocker.
      }
      // After the write, so every reader that wakes up re-reads what was actually stored —
      // and unchanged storage (quota, private mode) is then honestly reported as unchanged.
      read()
      listeners.forEach((listener) => listener())
    },
  }
}

/**
 * The few things every adapter needs. Provider field names never appear here — they
 * stop at each adapter's `normalize`.
 */

/** Placeholders providers emit instead of omitting a field. Treated as "absent". */
const PLACEHOLDER = /^(\[removed\]|null|undefined|none)$/i

/** A usable string, or undefined. Never an empty string, never a provider placeholder. */
export function text(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined
  const trimmed = value.trim()
  return !trimmed || PLACEHOLDER.test(trimmed) ? undefined : trimmed
}

/** `text` with markup stripped — Guardian trailText and NYT abstracts carry inline HTML. */
function plainText(value: unknown): string | undefined {
  const raw = text(value)
  return raw && text(raw.replace(/<[^>]*>/g, '').replace(/\s+/g, ' '))
}

/**
 * `Article.description`, the one field allowed to be `''`. Everything else absent stays
 * `undefined`; description is typed `string`, so a provider that omits it normalizes to
 * `''` rather than half-building the Article. Candidates are tried in order — NYT falls
 * back abstract → snippet → lead_paragraph.
 *
 * `''` is a legitimate value, not a defect, so it has to survive to the views intact:
 * items 5/6 render `articles.noDescription` for it, never a blank line. Every adapter
 * routes through here so that contract lives in exactly one place.
 */
export function description(...candidates: unknown[]): string {
  return candidates.map(plainText).find(Boolean) ?? ''
}

/** An absolute http(s) URL, or undefined. Relative provider paths are resolved against `base`. */
export function url(value: unknown, base?: string): string | undefined {
  const raw = text(value)
  if (!raw) return undefined
  try {
    const parsed = new URL(raw, base)
    return parsed.protocol === 'http:' || parsed.protocol === 'https:' ? parsed.href : undefined
  } catch {
    return undefined
  }
}

/**
 * Every provider dates differently — ISO-Z (Guardian, NewsAPI), `+0000` (NYT), RFC-822
 * (BBC RSS). One `Date` round-trip makes all four identical in shape.
 */
export function isoDate(value: unknown): string | undefined {
  const raw = text(value)
  if (!raw) return undefined
  const at = new Date(raw).getTime()
  return Number.isNaN(at) ? undefined : new Date(at).toISOString()
}

async function request(path: string, signal?: AbortSignal): Promise<Response> {
  // No key here, ever: /api/* is proxied by Vite in dev and nginx in prod, and the
  // proxy is what appends the key.
  const response = await fetch(path, { signal, headers: { accept: '*/*' } })
  if (!response.ok) throw new Error(`${response.status} ${response.statusText}`)
  return response
}

export async function getJson<T>(path: string, signal?: AbortSignal): Promise<T> {
  return (await request(path, signal)).json() as Promise<T>
}

export async function getText(path: string, signal?: AbortSignal): Promise<string> {
  return (await request(path, signal)).text()
}

/** `?a=1&b=2` from defined values only — an absent filter must not become `q=undefined`. */
export function queryString(params: Record<string, string | number | undefined>): string {
  const search = new URLSearchParams()
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== '') search.set(key, String(value))
  }
  return search.toString()
}

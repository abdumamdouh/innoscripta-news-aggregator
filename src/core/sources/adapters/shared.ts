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

const ENTITIES: Record<string, string> = {
  amp: '&',
  lt: '<',
  gt: '>',
  quot: '"',
  apos: "'",
  nbsp: ' ',
}

/**
 * `Article.content` — a provider's full article HTML flattened to text: block ends become
 * paragraph breaks, every tag goes, entities are decoded. Text, not markup, so no sanitizer
 * and no `dangerouslySetInnerHTML` anywhere downstream.
 * Drops images, links and emphasis with the tags. Render real markup only if the
 * details page is ever asked to look like the original article.
 */
/** Below this, the longer field is the same sentence with a comma moved. */
const MEANINGFUL_GAIN = 40

export function bodyText(value: unknown): string | undefined {
  const raw = text(value)
  if (!raw) return undefined
  const flat = raw
    .replace(/<\/(p|div|li|h[1-6]|blockquote|figcaption|tr)>/gi, '\n\n')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<[^>]*>/g, '')
    .replace(/&(#\d+|#x[0-9a-f]+|[a-z]+);/gi, (entity, name: string) => {
      if (!name.startsWith('#')) return ENTITIES[name.toLowerCase()] ?? entity
      const code = Number(name.replace(/^#x/i, '0x').replace(/^#/, ''))
      return code <= 0x10ffff ? String.fromCodePoint(code) : entity
    })
    .replace(/[^\S\n]+/g, ' ')
    .replace(/ *\n */g, '\n')
    .replace(/\n{3,}/g, '\n\n')
  return text(flat)
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

/**
 * The richer of two summary fields, or nothing when the longer one adds no reading.
 *
 * Only the Guardian serves a real body. The others publish a summary and a slightly longer
 * one — NYT's lead paragraph over its abstract, NewsAPI's truncated content over its
 * description — and the details page is worth the extra sentences. Returning undefined when
 * they are the same length keeps it from repeating the standfirst back at the reader.
 */
export function longerThan(candidate: unknown, current: unknown): string | undefined {
  const longer = bodyText(candidate)
  const shorter = bodyText(current)
  if (!longer) return undefined

  return !shorter || longer.length > shorter.length + MEANINGFUL_GAIN ? longer : undefined
}

/**
 * Swap the width baked into an image URL for a larger one.
 *
 * Both providers that publish a width do it in the path and serve every size from the same
 * master: the Guardian ends its URL with the pixel width (`…/500.jpg`), the BBC puts it in a
 * segment (`…/ace/standard/240/…`). Both hand back a thumbnail far too small for a card at 2x
 * — 240px stretched across 578 is the worst of them — so each adapter names its own pattern
 * and this asks for the bigger rendition.
 *
 * `pattern` must capture the width in group 1. Anything that does not match is returned
 * untouched, so a provider changing its URL shape degrades to the original image.
 */
export function upscale(
  source: string | undefined,
  pattern: RegExp,
  target: number,
): string | undefined {
  if (!source) return undefined

  return source.replace(pattern, (whole: string, width: string) =>
    Number(width) < target ? whole.replace(width, String(target)) : whole,
  )
}

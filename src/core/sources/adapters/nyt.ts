import type { Article, NewsSource } from '@/core/sources/types'
import { toArticleCategory } from '@/core/sources/categories'
import {
  description,
  getJson,
  isoDate,
  queryString,
  text,
  url,
  longerThan,
  widenDay,
} from '@/core/sources/adapters/shared'

const ID = 'nyt'
const LABEL = 'The New York Times'

/** Legacy `multimedia[].url` values are relative to the image CDN, not to nytimes.com. */
const IMAGE_BASE = 'https://static01.nyt.com/'

interface NytImage {
  url?: string | null
  width?: number | null
}

// Nullable throughout: this is a wire shape, not a shape we control.
interface NytRaw {
  _id?: string | null
  uri?: string | null
  web_url?: string | null
  abstract?: string | null
  snippet?: string | null
  lead_paragraph?: string | null
  pub_date?: string | null
  news_desk?: string | null
  section_name?: string | null
  headline?: { main?: string | null } | null
  byline?: { original?: string | null } | null
  // Article Search moved from an array of crops to a single object in late 2024.
  // Both shapes are still in the wild, so both are read here.
  multimedia?: NytImage[] | { default?: NytImage | null; thumbnail?: NytImage | null } | null
}

interface NytPayload {
  response?: { docs?: NytRaw[] }
}

/** `YYYYMMDD` — the only date format Article Search accepts. */
const compactDate = (value: string | undefined) =>
  value ? isoDate(value)?.slice(0, 10).replace(/-/g, '') : undefined

function image(multimedia: NytRaw['multimedia']): string | undefined {
  if (!multimedia) return undefined
  if (!Array.isArray(multimedia)) {
    return url(multimedia.default?.url ?? multimedia.thumbnail?.url, IMAGE_BASE)
  }
  // Legacy crops are ordered by crop name, not size, so index 0 is an arbitrary size —
  // take the widest one that has a url, the same way the BBC adapter picks a thumbnail.
  const widest = multimedia.reduce<NytImage | undefined>((best, crop) => {
    if (!crop?.url) return best
    return !best || (crop.width ?? 0) > (best.width ?? 0) ? crop : best
  }, undefined)

  return url(widest?.url, IMAGE_BASE)
}

export function selectItems(payload: NytPayload): NytRaw[] {
  return (payload.response?.docs ?? []).filter(
    (raw) => text(raw.headline?.main) && url(raw.web_url) && isoDate(raw.pub_date),
  )
}

function normalize(raw: NytRaw): Article {
  return {
    id: `${ID}:${text(raw._id) ?? text(raw.uri) ?? raw.web_url}`,
    title: text(raw.headline?.main) ?? '',
    // `abstract` is the summary; snippet and lead paragraph are the fallbacks NYT
    // leaves populated when a doc has no abstract at all.
    description: description(raw.abstract, raw.snippet, raw.lead_paragraph),
    url: url(raw.web_url) ?? '',
    imageUrl: image(raw.multimedia),
    publishedAt: isoDate(raw.pub_date) ?? '',
    sourceId: ID,
    sourceLabel: LABEL,
    // "By Tripp Mickle and Cade Metz" — the prefix is presentation, not a name.
    author: text(raw.byline?.original?.replace(/^by\s+/i, '')),
    // Folded into our taxonomy so the aggregator's check compares like with like.
    category: toArticleCategory(text(raw.section_name) ?? text(raw.news_desk)),
    // Article Search never returns a body. It documents `lead_paragraph` and the captured
    // fixture carries one, but live responses have come back with it empty on every doc —
    // so in practice this resolves to undefined and the details page shows the abstract.
    // Kept because the field is real when populated, and `longerThan` ignores it when not.
    content: longerThan(raw.lead_paragraph, raw.abstract),
  }
}

export const nytSource: NewsSource<NytRaw> = {
  id: ID,
  label: LABEL,
  capabilities: {
    query: true,
    dateRange: true,
    // Article Search documents fq on section_name but it matched zero for every value tried,
    // including ones live documents carry. Filtering the results is the honest option.
    category: false,
    author: false,
    pagination: true,
  },
  available: true,
  async fetch(query, signal) {
    const search = queryString({
      q: query.q,
      begin_date: compactDate(widenDay(query.from, -1)),
      end_date: compactDate(widenDay(query.to, 1)),
      // Article Search pages are a fixed 10 docs and ignore any size we ask for, so this
      // source contributes 10 to the window however large the window is.
      sort: 'newest',
    })

    return selectItems(await getJson<NytPayload>(`/api/nyt/articlesearch.json?${search}`, signal))
  },
  normalize,
}

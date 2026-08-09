import type { Article, NewsSource } from '@/core/sources/types'
import {
  bodyText,
  description,
  getJson,
  isoDate,
  queryString,
  text,
  url,
} from '@/core/sources/adapters/shared'

const ID = 'guardian'
const LABEL = 'The Guardian'

// Nullable throughout: this is a wire shape, not a shape we control.
interface GuardianRaw {
  id?: string | null
  sectionId?: string | null
  webPublicationDate?: string | null
  webTitle?: string | null
  webUrl?: string | null
  fields?: {
    trailText?: string | null
    byline?: string | null
    thumbnail?: string | null
    body?: string | null
  } | null
}

interface GuardianPayload {
  response?: { results?: GuardianRaw[] }
}

export function selectItems(payload: GuardianPayload): GuardianRaw[] {
  return (payload.response?.results ?? []).filter(
    (raw) => text(raw.webTitle) && url(raw.webUrl) && isoDate(raw.webPublicationDate),
  )
}

/**
 * `show-fields=thumbnail` always returns the 500px rendition, which is soft on a card at 2x.
 * The final path segment of a media.guim.co.uk URL is the width, and the crop box earlier in
 * the path (`612_198_5360_4291`) shows the master is far larger, so asking for a wider
 * rendition is safe. Anything that doesn't match the pattern is left exactly as it came.
 */
const WIDER_RENDITION = 1000

function widen(thumbnail: string | undefined): string | undefined {
  if (!thumbnail) return undefined
  return thumbnail.replace(/\/(\d+)(\.[a-z]+)$/i, (whole, width: string, ext: string) =>
    Number(width) < WIDER_RENDITION ? `/${WIDER_RENDITION}${ext}` : whole,
  )
}

function normalize(raw: GuardianRaw): Article {
  return {
    id: `${ID}:${text(raw.id) ?? raw.webUrl}`,
    title: text(raw.webTitle) ?? '',
    // trailText is the Guardian's standfirst and carries inline markup.
    description: description(raw.fields?.trailText),
    url: url(raw.webUrl) ?? '',
    imageUrl: widen(url(raw.fields?.thumbnail)),
    publishedAt: isoDate(raw.webPublicationDate) ?? '',
    sourceId: ID,
    sourceLabel: LABEL,
    author: text(raw.fields?.byline),
    category: text(raw.sectionId),
    // The one provider of the four that serves a body. It is HTML; `bodyText` flattens it.
    content: bodyText(raw.fields?.body),
  }
}

export const guardianSource: NewsSource<GuardianRaw> = {
  id: ID,
  label: LABEL,
  // A byline is a returned field, not a filter — author stays client-side.
  capabilities: { query: true, dateRange: true, category: true, author: false, pagination: true },
  available: true,
  async fetch(query, signal) {
    const search = queryString({
      q: query.q,
      'from-date': query.from,
      'to-date': query.to,
      section: query.categories?.join('|'),
      page: query.page,
      'page-size': query.pageSize,
      'order-by': 'newest',
      'show-fields': 'trailText,thumbnail,byline,body',
    })
    return selectItems(await getJson<GuardianPayload>(`/api/guardian/search?${search}`, signal))
  },
  normalize,
}

import type { Article, NewsSource } from '@/core/sources/types'
import { GUARDIAN_SECTIONS, isArticleCategory } from '@/core/sources/categories'
import {
  bodyText,
  description,
  getJson,
  isoDate,
  queryString,
  text,
  upscale,
  url,
  dayInstant,
} from '@/core/sources/adapters/shared'

/** The Guardian caps `page-size` at 50. */
const MAX_PAGE_SIZE = 50

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
 * The width is the final path segment of a media.guim.co.uk URL, and the crop box before it
 * (`612_198_5360_4291`) shows the master is far larger, so asking for more is safe.
 */
const GUARDIAN_WIDTH = /\/(\d+)\.[a-z]+$/i
const WIDER_RENDITION = 1000

/** Our taxonomy → Guardian `section` ids, dropping anything it has no equivalent for. */
function sections(categories: string[] | undefined): string | undefined {
  const mapped = (categories ?? [])
    .filter(isArticleCategory)
    .map((category) => GUARDIAN_SECTIONS[category])
    .filter((section): section is string => Boolean(section))

  return mapped.length ? mapped.join('|') : undefined
}

function normalize(raw: GuardianRaw): Article {
  return {
    id: `${ID}:${text(raw.id) ?? raw.webUrl}`,
    title: text(raw.webTitle) ?? '',
    // trailText is the Guardian's standfirst and carries inline markup.
    description: description(raw.fields?.trailText),
    url: url(raw.webUrl) ?? '',
    imageUrl: upscale(url(raw.fields?.thumbnail), GUARDIAN_WIDTH, WIDER_RENDITION),
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
      'from-date': dayInstant(query.from, 'start'),
      'to-date': dayInstant(query.to, 'end'),
      // Our slugs are not the Guardian's: it files entertainment under `culture`. An
      // unmappable category contributes no constraint rather than a guess that matches nothing.
      section: sections(query.categories),
      // One window, page 1: the merged set is what gets paginated.
      'page-size': Math.min(query.limit, MAX_PAGE_SIZE),
      'order-by': 'newest',
      'show-fields': 'trailText,thumbnail,byline,body',
      // Narrow the provider's own search to the fields a card shows, so fewer of its results
      // are thrown away by the visible-match guarantee in the aggregator.
      'query-fields': query.q ? 'headline,standfirst' : undefined,
    })

    return selectItems(await getJson<GuardianPayload>(`/api/guardian/search?${search}`, signal))
  },
  normalize,
}

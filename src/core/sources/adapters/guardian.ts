import type { Article, NewsSource } from '@/core/sources/types'
import { getJson, isoDate, plainText, queryString, text, url } from '@/core/sources/adapters/shared'

const ID = 'guardian'
const LABEL = 'The Guardian'

// Nullable throughout: this is a wire shape, not a shape we control.
interface GuardianRaw {
  id?: string | null
  sectionId?: string | null
  webPublicationDate?: string | null
  webTitle?: string | null
  webUrl?: string | null
  fields?: { trailText?: string | null; byline?: string | null; thumbnail?: string | null } | null
}

interface GuardianPayload {
  response?: { results?: GuardianRaw[] }
}

export function selectItems(payload: GuardianPayload): GuardianRaw[] {
  return (payload.response?.results ?? []).filter(
    (raw) => text(raw.webTitle) && url(raw.webUrl) && isoDate(raw.webPublicationDate),
  )
}

function normalize(raw: GuardianRaw): Article {
  return {
    id: `${ID}:${text(raw.id) ?? raw.webUrl}`,
    title: text(raw.webTitle) ?? '',
    // trailText is the Guardian's standfirst and carries inline markup.
    description: plainText(raw.fields?.trailText) ?? '',
    url: url(raw.webUrl) ?? '',
    imageUrl: url(raw.fields?.thumbnail),
    publishedAt: isoDate(raw.webPublicationDate) ?? '',
    sourceId: ID,
    sourceLabel: LABEL,
    author: text(raw.fields?.byline),
    category: text(raw.sectionId),
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
      'show-fields': 'trailText,thumbnail,byline',
    })
    return selectItems(await getJson<GuardianPayload>(`/api/guardian/search?${search}`, signal))
  },
  normalize,
}

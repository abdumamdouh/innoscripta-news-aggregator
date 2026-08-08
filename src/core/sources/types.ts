/** The one article shape the whole app sees. Provider field names stop at the adapter. */
export interface Article {
  id: string
  title: string
  description: string
  url: string
  imageUrl?: string
  /** ISO 8601. */
  publishedAt: string
  sourceId: string
  sourceLabel: string
  author?: string
  category?: string
}

export interface ArticleQuery {
  q?: string
  /** ISO date, inclusive. */
  from?: string
  /** ISO date, inclusive. */
  to?: string
  categories?: string[]
  /** Source ids to fan out to. Empty or absent means every available source. */
  sources?: string[]
  authors?: string[]
  page: number
  pageSize: number
}

/** What a provider can do server-side. Anything false, the aggregator does client-side. */
export interface SourceCapabilities {
  query: boolean
  dateRange: boolean
  category: boolean
  author: boolean
  pagination: boolean
}

export interface NewsSource<Raw = unknown> {
  id: string
  label: string
  capabilities: SourceCapabilities
  /** False for a source with no key configured — it is skipped, not failed. */
  available: boolean
  unavailableReason?: string
  fetch(query: ArticleQuery, signal?: AbortSignal): Promise<Raw[]>
  normalize(raw: Raw): Article
}

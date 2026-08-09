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
  /**
   * The full article text, plain, with a blank line between paragraphs. Only a provider
   * that actually serves a body fills this in — today only the Guardian.
   */
  content?: string
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
  /**
   * How many articles to ask each source for — a window, not a page.
   *
   * Global page N is not the union of each source's page N: they disagree on page size
   * (the Guardian honours it, NewsAPI under-delivers, NYT is fixed at 10, BBC has no paging
   * at all), so merging four page-1s and slicing to 9 threw away the rest permanently —
   * page 2 asked each source for *its* page 2 and never went back. Each source contributes
   * up to `limit`; the merged, deduped, sorted result is what gets paginated, in the one
   * place the whole set actually exists.
   */
  limit: number
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
  /** i18n key, not a sentence — this reason is shown to the reader (see `PreferencesModal`). */
  unavailableReasonKey?: string
  fetch(query: ArticleQuery, signal?: AbortSignal): Promise<Raw[]>
  normalize(raw: Raw): Article
}

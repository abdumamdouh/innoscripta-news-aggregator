import { ARTICLE_CATEGORIES } from '@/core/sources/categories'
import { DEFAULT_ARTICLES_STATE, SELECTABLE_SOURCES } from '@/features/Articles/constants'
import { ARTICLE_SORTS } from '@/features/Articles/types/articles.types'
import type { ArticleSort, ArticlesState } from '@/features/Articles/types/articles.types'

/** Every parameter this screen owns. Anything else in the URL is not ours and is dropped. */
export const ARTICLES_PARAMS = [
  'q',
  'from',
  'to',
  'category',
  'author',
  'sources',
  'sort',
  'page',
] as const

export interface AllowedValues {
  categories: readonly string[]
  sources: readonly string[]
}

const DEFAULT_ALLOWED: AllowedValues = {
  categories: ARTICLE_CATEGORIES,
  sources: SELECTABLE_SOURCES.map((source) => source.id),
}

/** Free text still gets a ceiling: a URL is a trust boundary, not a text field. */
const MAX_TEXT = 120
const MAX_PAGE = 999

const isDate = (value: string) =>
  /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(Date.parse(value))

const asText = (value: unknown) =>
  typeof value === 'string' ? value.trim().slice(0, MAX_TEXT) : ''

const asList = (value: unknown): string[] =>
  Array.isArray(value)
    ? value.filter((entry): entry is string => typeof entry === 'string')
    : typeof value === 'string'
      ? value.split(',')
      : []

/**
 * Validate a candidate against the values that actually exist. Junk is dropped, never
 * trusted: a hand-edited `?sort=drop-table` must fall back to the default, not reach a query.
 */
export function sanitizeArticlesState(
  raw: Partial<Record<keyof ArticlesState, unknown>>,
  allowed: AllowedValues = DEFAULT_ALLOWED,
): ArticlesState {
  const from = asText(raw.from)
  const to = asText(raw.to)
  const category = asText(raw.category)
  const sort = asText(raw.sort)
  const page = Number(raw.page)

  return {
    q: asText(raw.q),
    from: isDate(from) ? from : '',
    to: isDate(to) ? to : '',
    category: allowed.categories.includes(category) ? category : '',
    author: asText(raw.author),
    sources: [
      ...new Set(
        asList(raw.sources)
          .map((id) => id.trim())
          .filter((id) => allowed.sources.includes(id)),
      ),
    ],
    sort: ARTICLE_SORTS.includes(sort as ArticleSort)
      ? (sort as ArticleSort)
      : DEFAULT_ARTICLES_STATE.sort,
    page: Number.isInteger(page) && page >= 1 && page <= MAX_PAGE ? page : 1,
  }
}

/**
 * URL params → localStorage snapshot → defaults.
 *
 * Wholesale, not field by field: a URL that carries any of our parameters is a complete
 * description of a view someone shared, so mixing the recipient's stored sources into it
 * would render them something other than what the sender saw.
 */
export function parseArticlesState(
  params: URLSearchParams,
  stored?: unknown,
  allowed: AllowedValues = DEFAULT_ALLOWED,
): ArticlesState {
  if (ARTICLES_PARAMS.some((key) => params.has(key))) {
    return sanitizeArticlesState(
      Object.fromEntries(ARTICLES_PARAMS.map((key) => [key, params.get(key) ?? undefined])),
      allowed,
    )
  }
  if (stored && typeof stored === 'object') {
    return sanitizeArticlesState(stored as Partial<Record<keyof ArticlesState, unknown>>, allowed)
  }
  return { ...DEFAULT_ARTICLES_STATE }
}

/** Defaults are absent, not spelled out: no `page=1`, no empty `q`, no `sort=newest`. */
export function toSearchParams(state: ArticlesState): URLSearchParams {
  const params = new URLSearchParams()
  if (state.q) params.set('q', state.q)
  if (state.from) params.set('from', state.from)
  if (state.to) params.set('to', state.to)
  if (state.category) params.set('category', state.category)
  if (state.author) params.set('author', state.author)
  if (state.sources.length) params.set('sources', state.sources.join(','))
  if (state.sort !== DEFAULT_ARTICLES_STATE.sort) params.set('sort', state.sort)
  if (state.page !== DEFAULT_ARTICLES_STATE.page) params.set('page', String(state.page))
  return params
}

/**
 * True when a filter is narrowing the feed — drives the "clear filters" affordance.
 * Sort and page are excluded: neither hides an article, so neither is something to clear.
 */
export function hasActiveFilters(state: ArticlesState): boolean {
  return toSearchParams({ ...state, page: 1, sort: DEFAULT_ARTICLES_STATE.sort }).toString() !== ''
}

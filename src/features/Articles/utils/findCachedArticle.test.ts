import { describe, expect, it } from 'vitest'
import type { AggregateResult } from '@/core/sources/aggregator'
import type { Article } from '@/core/sources/types'
import { findCachedArticle } from '@/features/Articles/utils/findCachedArticle'

const article = (id: string, title = 'Untitled'): Article => ({
  id,
  title,
  description: '',
  url: `https://example.test/${id}`,
  publishedAt: '2026-01-01T00:00:00.000Z',
  sourceId: 'guardian',
  sourceLabel: 'The Guardian',
})

const page = (...ids: string[]): AggregateResult => ({
  articles: ids.map((id) => article(id)),
  failures: [],
})

type Entries = readonly (readonly [unknown, AggregateResult | undefined])[]

const entries = (...pages: (AggregateResult | undefined)[]): Entries =>
  pages.map((result, index) => [['articles', { page: index + 1 }], result] as const)

describe('findCachedArticle', () => {
  it('finds an article that is on a later cached page, not just the first', () => {
    const found = findCachedArticle(entries(page('a', 'b'), page('c', 'd')), 'd')
    expect(found?.id).toBe('d')
  })

  it('returns undefined when no cached page holds the id', () => {
    expect(findCachedArticle(entries(page('a'), page('b')), 'zz')).toBeUndefined()
  })

  it('skips pages that were never fetched instead of throwing on them', () => {
    // getQueriesData reports keys with no data yet as `undefined` — a cold entry
    // must not stop the search before it reaches a warm one.
    expect(findCachedArticle(entries(undefined, page('a')), 'a')?.id).toBe('a')
  })

  it('handles an empty cache and an empty result page', () => {
    expect(findCachedArticle([], 'a')).toBeUndefined()
    expect(findCachedArticle(entries(page()), 'a')).toBeUndefined()
  })

  it('matches the id exactly, never a prefix of a composite id', () => {
    // Ids are `sourceId:providerId`; 'guardian' must not resolve to 'guardian:1'.
    expect(findCachedArticle(entries(page('guardian:1')), 'guardian')).toBeUndefined()
    expect(findCachedArticle(entries(page('guardian:1')), 'guardian:1')?.id).toBe('guardian:1')
  })

  it('returns the first match when the same story is cached on two pages', () => {
    const first = page('x')
    const second: AggregateResult = { articles: [article('x', 'Later copy')], failures: [] }
    expect(findCachedArticle(entries(first, second), 'x')).toBe(first.articles[0])
  })
})

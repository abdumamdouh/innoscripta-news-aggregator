import { describe, expect, it } from 'vitest'
import type { Article } from '@/core/sources/types'
import { relevanceScore, sortArticles } from '@/features/Articles/utils/sortArticles'

const article = (over: Partial<Article> & { id: string }): Article => ({
  title: 'Untitled',
  description: '',
  url: `https://example.test/${over.id}`,
  publishedAt: '2026-01-01T00:00:00.000Z',
  sourceId: 'guardian',
  sourceLabel: 'The Guardian',
  ...over,
})

const set = [
  article({ id: 'a', publishedAt: '2026-03-01T00:00:00.000Z', title: 'Mars rover lands' }),
  article({ id: 'b', publishedAt: '2026-01-01T00:00:00.000Z', title: 'Budget talks' }),
  article({ id: 'c', publishedAt: '2026-02-01T00:00:00.000Z', title: 'Weather turns' }),
]

describe('sortArticles', () => {
  it('orders newest and oldest first, and does not mutate its input', () => {
    expect(sortArticles(set, 'newest').map((a) => a.id)).toEqual(['a', 'c', 'b'])
    expect(sortArticles(set, 'oldest').map((a) => a.id)).toEqual(['b', 'c', 'a'])
    expect(set.map((a) => a.id)).toEqual(['a', 'b', 'c'])
  })

  it('puts a headline match above a summary match, and both above no match', () => {
    const scored = [
      article({
        id: 'summary',
        description: 'A mars mission update',
        publishedAt: '2026-04-01T00:00:00.000Z',
      }),
      article({
        id: 'headline',
        title: 'Mars mission update',
        publishedAt: '2026-01-01T00:00:00.000Z',
      }),
      article({ id: 'neither', title: 'Budget talks', publishedAt: '2026-05-01T00:00:00.000Z' }),
    ]
    expect(sortArticles(scored, 'relevance', 'mars').map((a) => a.id)).toEqual([
      'headline',
      'summary',
      'neither',
    ])
  })

  it('falls back to newest when relevance has no term to rank by', () => {
    expect(sortArticles(set, 'relevance', '').map((a) => a.id)).toEqual(['a', 'c', 'b'])
  })

  it('treats an unparseable date as the oldest rather than throwing', () => {
    const broken = [article({ id: 'broken', publishedAt: 'not a date' }), set[0] as Article]
    expect(sortArticles(broken, 'newest').map((a) => a.id)).toEqual(['a', 'broken'])
  })
})

describe('relevanceScore', () => {
  it('ignores case and diacritics on both sides', () => {
    const accented = article({ id: 'x', title: 'MÉTÉO extrême' })
    expect(relevanceScore(accented, 'meteo')).toBeGreaterThan(0)
  })

  it('is zero for a term the article does not carry', () => {
    expect(relevanceScore(article({ id: 'x', title: 'Budget talks' }), 'mars')).toBe(0)
  })
})

import { describe, expect, it } from 'vitest'
import type { Article } from '@/core/sources/types'
import { mergeAuthors } from '@/features/Articles/utils/authorFacet'

const article = (over: Partial<Article> & { id: string }): Article => ({
  title: 'Untitled',
  description: '',
  url: `https://example.test/${over.id}`,
  publishedAt: '2026-01-01T00:00:00.000Z',
  sourceId: 'guardian',
  sourceLabel: 'The Guardian',
  ...over,
})

describe('mergeAuthors', () => {
  it('keeps bylines from earlier pages once the fetch narrows to one author', () => {
    const firstPage = mergeAuthors(
      [],
      [article({ id: 'a', author: 'Ada Lovelace' }), article({ id: 'b', author: 'Bo Peep' })],
    )
    expect(firstPage).toEqual(['Ada Lovelace', 'Bo Peep'])

    // Picking Ada narrows the next fetch to her articles alone — Bo must survive it.
    const narrowed = mergeAuthors(
      firstPage,
      [article({ id: 'c', author: 'Ada Lovelace' })],
      'Ada Lovelace',
    )
    expect(narrowed).toEqual(['Ada Lovelace', 'Bo Peep'])
  })

  it('adds the selected author even when no fetched article carries the byline', () => {
    expect(mergeAuthors([], [], 'Carol Danvers')).toEqual(['Carol Danvers'])
  })

  it('dedupes and sorts case-insensitively by locale', () => {
    expect(
      mergeAuthors(
        ['zoe'],
        [article({ id: 'a', author: 'Ada' }), article({ id: 'b', author: 'ada' })],
        'Ada',
      ),
    ).toEqual(['ada', 'Ada', 'zoe'])
  })

  it('drops missing and blank bylines rather than offering an empty option', () => {
    const authors = mergeAuthors(
      [],
      [
        article({ id: 'a' }),
        article({ id: 'b', author: '' }),
        article({ id: 'c', author: '   ' }),
        article({ id: 'd', author: '  Ada Lovelace  ' }),
      ],
    )
    expect(authors).toEqual(['Ada Lovelace'])
  })

  it('does not mutate the list it was handed', () => {
    const seen = ['Ada Lovelace']
    mergeAuthors(seen, [article({ id: 'a', author: 'Bo Peep' })])
    expect(seen).toEqual(['Ada Lovelace'])
  })
})

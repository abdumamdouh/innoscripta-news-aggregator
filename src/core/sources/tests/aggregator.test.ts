import { describe, expect, it, vi } from 'vitest'
import { aggregate } from '@/core/sources/aggregator'
import type { Article, ArticleQuery, NewsSource, SourceCapabilities } from '@/core/sources/types'

const ALL_CAPS: SourceCapabilities = {
  query: true,
  dateRange: true,
  category: true,
  author: true,
  pagination: true,
}
const NO_CAPS: SourceCapabilities = {
  query: false,
  dateRange: false,
  category: false,
  author: false,
  pagination: false,
}

const query = (over: Partial<ArticleQuery> = {}): ArticleQuery => ({
  limit: 10,
  ...over,
})

function article(sourceId: string, over: Partial<Article> = {}): Article {
  return {
    id: `${sourceId}-${over.url ?? over.title ?? '1'}`,
    title: 'Mars rover finds ice',
    description: 'A description',
    url: `https://${sourceId}.test/mars-rover`,
    publishedAt: '2024-05-01T00:00:00.000Z',
    sourceId,
    sourceLabel: sourceId.toUpperCase(),
    ...over,
  }
}

/** Raw is already canonical here — adapters are item 3; this exercises the aggregator. */
function fakeSource(
  id: string,
  articles: Article[],
  over: Partial<NewsSource<Article>> = {},
): NewsSource {
  return {
    id,
    label: id.toUpperCase(),
    capabilities: ALL_CAPS,
    available: true,
    fetch: () => Promise.resolve(articles),
    normalize: (raw) => raw,
    ...over,
  } as NewsSource
}

describe('aggregate — partial failure', () => {
  it('keeps a failing source from blanking the feed and names it in failures', async () => {
    const alive = fakeSource('guardian', [article('guardian')])
    const dead = fakeSource('newsapi', [], {
      fetch: () => Promise.reject(new Error('429 rate limited')),
    })

    const result = await aggregate(query(), [dead, alive])

    expect(result.articles.map((a) => a.sourceId)).toEqual(['guardian'])
    expect(result.failures).toEqual([{ sourceId: 'newsapi', reason: '429 rate limited' }])
  })

  it('reports a source whose normalize throws instead of crashing the run', async () => {
    const broken = fakeSource('nyt', [article('nyt')], {
      normalize: () => {
        throw new Error('unexpected payload')
      },
    })
    const alive = fakeSource('bbc', [article('bbc', { url: 'https://bbc.test/other' })])

    const result = await aggregate(query(), [broken, alive])

    expect(result.articles).toHaveLength(1)
    expect(result.failures).toEqual([{ sourceId: 'nyt', reason: 'unexpected payload' }])
  })

  it('skips unavailable sources without fetching or failing them', async () => {
    const fetch = vi.fn()
    const offline = fakeSource('nyt', [], {
      available: false,
      unavailableReasonKey: 'sources.unavailableReason.nyt',
      fetch,
    })

    const result = await aggregate(query(), [offline, fakeSource('bbc', [article('bbc')])])

    expect(fetch).not.toHaveBeenCalled()
    expect(result.failures).toEqual([])
    expect(result.articles).toHaveLength(1)
  })

  it('fans out only to the source ids the query asked for', async () => {
    const guardianFetch = vi.fn(() => Promise.resolve([article('guardian')]))
    const nytFetch = vi.fn(() => Promise.resolve([article('nyt')]))

    await aggregate(query({ sources: ['guardian'] }), [
      fakeSource('guardian', [], { fetch: guardianFetch }),
      fakeSource('nyt', [], { fetch: nytFetch }),
    ])

    expect(guardianFetch).toHaveBeenCalledTimes(1)
    expect(nytFetch).not.toHaveBeenCalled()
  })
})

describe('aggregate — dedupe and ordering', () => {
  it('drops the same story syndicated across sources, by URL then title', async () => {
    const first = fakeSource('guardian', [
      article('guardian', {
        url: 'https://news.test/mars-rover',
        publishedAt: '2024-05-03T00:00:00.000Z',
      }),
    ])
    // Same URL modulo www/trailing slash/campaign params.
    const second = fakeSource('newsapi', [
      article('newsapi', {
        url: 'https://www.news.test/mars-rover/?utm_source=twitter#top',
        publishedAt: '2024-05-02T00:00:00.000Z',
      }),
    ])
    // Different URL, same headline modulo punctuation and case.
    const third = fakeSource('nyt', [
      article('nyt', {
        url: 'https://nyt.test/science/mars',
        title: 'Mars Rover Finds Ice!',
        publishedAt: '2024-05-01T00:00:00.000Z',
      }),
    ])

    const result = await aggregate(query(), [first, second, third])

    expect(result.articles.map((a) => a.sourceId)).toEqual(['guardian'])
  })

  it('keeps distinct stories from the same source', async () => {
    const source = fakeSource('bbc', [
      article('bbc', { url: 'https://bbc.test/a', title: 'A' }),
      article('bbc', { url: 'https://bbc.test/b', title: 'B' }),
    ])

    const result = await aggregate(query(), [source])

    expect(result.articles.map((a) => a.title)).toEqual(['A', 'B'])
  })

  it('merge-sorts every source into one publishedAt-desc list', async () => {
    const older = fakeSource('guardian', [
      article('guardian', {
        url: 'https://g.test/1',
        title: 'oldest',
        publishedAt: '2024-01-01T00:00:00.000Z',
      }),
      article('guardian', {
        url: 'https://g.test/2',
        title: 'newest',
        publishedAt: '2024-03-01T12:00:00.000Z',
      }),
    ])
    const middle = fakeSource('nyt', [
      article('nyt', {
        url: 'https://n.test/1',
        title: 'middle',
        // Different offset, same instant class — string sort would get this wrong.
        publishedAt: '2024-02-01T03:00:00.000+03:00',
      }),
    ])

    const result = await aggregate(query(), [older, middle])

    expect(result.articles.map((a) => a.title)).toEqual(['newest', 'middle', 'oldest'])
  })
})

describe('aggregate — capability degradation', () => {
  const feed = [
    article('bbc', {
      url: 'https://bbc.test/mars',
      title: 'Mars rover finds ice',
      author: 'Ada Lovelace',
      category: 'science',
      publishedAt: '2024-05-10T00:00:00.000Z',
    }),
    article('bbc', {
      url: 'https://bbc.test/election',
      title: 'Election night results',
      author: 'Grace Hopper',
      category: 'politics',
      publishedAt: '2024-05-20T00:00:00.000Z',
    }),
    article('bbc', {
      url: 'https://bbc.test/budget',
      title: 'Budget reaction',
      author: 'Ada Lovelace',
      category: 'politics',
      publishedAt: '2024-06-05T00:00:00.000Z',
    }),
  ]
  const poor = () => fakeSource('bbc', feed, { capabilities: NO_CAPS })

  it('keyword-filters a source that cannot query, matching title, description and author', async () => {
    const result = await aggregate(query({ q: 'grace hopper' }), [poor()])
    expect(result.articles.map((a) => a.title)).toEqual(['Election night results'])
  })

  it('date-filters a source that cannot, treating a date-only `to` as end of day', async () => {
    const result = await aggregate(query({ from: '2024-05-15', to: '2024-05-20' }), [poor()])
    expect(result.articles.map((a) => a.title)).toEqual(['Election night results'])
  })

  it('category- and author-filters a source that cannot', async () => {
    const byCategory = await aggregate(query({ categories: ['politics'] }), [poor()])
    expect(byCategory.articles.map((a) => a.title)).toEqual([
      'Budget reaction',
      'Election night results',
    ])

    const byAuthor = await aggregate(query({ authors: ['ada lovelace'] }), [poor()])
    expect(byAuthor.articles.map((a) => a.title)).toEqual([
      'Budget reaction',
      'Mars rover finds ice',
    ])
  })

  it('bounds a source that cannot bound itself, newest first', async () => {
    // BBC returns its whole feed however small the window; without this one provider would
    // decide how much of the window everyone else gets.
    const bounded = await aggregate(query({ limit: 2 }), [poor()])
    expect(bounded.articles.map((a) => a.title)).toEqual([
      'Budget reaction',
      'Election night results',
    ])
  })

  it('keeps every article from every source — the merged window is not a page', async () => {
    const page = (id: string, offset: number) =>
      fakeSource(
        id,
        Array.from({ length: 3 }, (_, i) => {
          const n = offset + i
          return article(id, {
            url: `https://${id}.test/${n}`,
            title: `${id} story ${n}`,
            publishedAt: `2024-05-${String(10 + n).padStart(2, '0')}T00:00:00.000Z`,
          })
        }),
      )

    const result = await aggregate(query({ limit: 3 }), [page('a', 0), page('b', 10)])

    // The regression that mattered: this used to slice the merged feed to one page, so four
    // sources fetched ~54 articles, showed 9, and discarded 45 — unreachably, because page 2
    // then asked each source for *its* page 2 and never came back for them.
    expect(result.articles).toHaveLength(6)
    expect(result.articles.map((a) => a.title)).toEqual([
      'b story 12',
      'b story 11',
      'b story 10',
      'a story 2',
      'a story 1',
      'a story 0',
    ])
  })

  it('trusts a capable source on every filter except the keyword', async () => {
    // Category and paging are taken at the provider's word: NewsAPI folds a category into its
    // text expression and returns articles with no `category` field at all, so re-checking one
    // downstream would throw away the very results it asked for.
    const capable = fakeSource('newsapi', [
      article('newsapi', { url: 'https://n.test/x', title: 'Whatever the API returned' }),
    ])

    const result = await aggregate(query({ categories: ['sport'] }), [capable])

    expect(result.articles).toHaveLength(1)
  })

  it('drops a capable source’s result when the match is invisible on the card', async () => {
    // The Guardian and NYT search the full body, so a story whose only mention of the term is
    // three paragraphs down arrives here looking unrelated. Shown on a card it reads as a
    // broken filter, so the keyword is the one filter re-checked against what the card shows.
    const bodyMatchOnly = fakeSource('guardian', [
      article('guardian', {
        url: 'https://g.test/ev',
        title: 'Chinese EV sales surge to new high in Europe',
        description: 'Tariffs under pressure as registrations climb.',
      }),
      article('guardian', {
        url: 'https://g.test/t',
        title: 'Trump signs new orders',
        description: 'A second story, matching where a reader can see it.',
      }),
    ])

    const result = await aggregate(query({ q: 'trump' }), [bodyMatchOnly])

    expect(result.articles.map((a) => a.title)).toEqual(['Trump signs new orders'])
  })
})

describe('cancellation', () => {
  const hangs = (id: string): NewsSource => ({
    id,
    label: id,
    capabilities: { query: true, dateRange: true, category: true, author: true, pagination: true },
    available: true,
    fetch: (_query, signal) =>
      new Promise((_resolve, reject) => {
        signal?.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError')))
      }),
    normalize: (raw) => raw as Article,
  })

  it('propagates the abort instead of reporting every source as failed', async () => {
    const controller = new AbortController()
    const promise = aggregate({ limit: 9 }, [hangs('a'), hangs('b')], controller.signal)
    controller.abort()

    // The trap: allSettled swallows each rejection, so without an explicit check this
    // resolves as a success carrying an empty feed and a failure per source.
    await expect(promise).rejects.toThrow()
  })

  it('still reports a genuine failure when nothing was cancelled', async () => {
    const dead: NewsSource = { ...hangs('dead'), fetch: () => Promise.reject(new Error('502')) }

    await expect(aggregate({ limit: 9 }, [dead])).rejects.toThrow('502')
  })
})

describe('aggregate — total failure', () => {
  const dead = (id: string, reason: string) =>
    fakeSource(id, [], { fetch: () => Promise.reject(new Error(reason)) })

  it('throws when every source is down rather than resolving an empty feed', async () => {
    // The offline reload is the case: resolving `{ articles: [] }` here reads as a successful
    // "nothing matched", and it overwrites the persisted feed the reader still wants to see.
    await expect(aggregate(query(), [dead('guardian', '502'), dead('nyt', '429')])).rejects.toThrow(
      '502; 429',
    )
  })

  it('resolves when even one source answers', async () => {
    const result = await aggregate(query(), [
      dead('nyt', '429'),
      fakeSource('bbc', [article('bbc')]),
    ])

    expect(result.articles).toHaveLength(1)
    expect(result.failures).toEqual([{ sourceId: 'nyt', reason: '429' }])
  })

  it('is not a failure when every source was merely unavailable', async () => {
    const offline = fakeSource('opennews', [], { available: false })

    const result = await aggregate(query(), [offline])

    expect(result.articles).toEqual([])
    expect(result.failures).toEqual([])
  })
})

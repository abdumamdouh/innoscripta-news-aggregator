import type { BrowserContext, Page } from '@playwright/test'

/**
 * The four providers, served from a synthetic feed rather than a captured one, because
 * the assertions built on it are about *which* stories survive a filter — which needs
 * titles, dates and sources we chose.
 *
 * The mocks honour `q` and `page` exactly as the real APIs do, so paging and server-side
 * search are exercised for real. BBC is the deliberate exception: its RSS feed cannot
 * search or page, so the app has to do both for it.
 */

export const PAGE_SIZE = 9
const BASE = Date.parse('2026-06-01T12:00:00.000Z')
const TOPICS = ['quantum', 'harvest']

interface Fake {
  title: string
  description: string
  url: string
  publishedAt: string
  author: string
  /** Only the Guardian serves one, and only for some stories. */
  body?: string
}

/**
 * `offsetHours` interleaves the four feeds in time, so a page of the merged result
 * genuinely carries all four newsrooms instead of one provider's block.
 */
function feed(prefix: string, offsetHours: number, count = 30): Fake[] {
  return Array.from({ length: count }, (_, index) => ({
    title: `${prefix} story ${index + 1} on ${TOPICS[index % 2] as string}`,
    // The first Guardian story deliberately has no summary: a provider is allowed to
    // publish none, and the card must say so rather than leave a hole.
    description: prefix === 'Guardian' && index === 0 ? '' : `${prefix} summary ${index + 1}`,
    url: `https://${prefix.toLowerCase()}.test/story-${index + 1}`,
    publishedAt: new Date(BASE - (index * 4 + offsetHours) * 3_600_000).toISOString(),
    author: `${prefix} Reporter ${(index % 3) + 1}`,
    // Guardian story 2 is the one with a full body, as `show-fields=body` returns it.
    body:
      prefix === 'Guardian' && index === 1
        ? '<p>The full body opens here &amp; runs on.</p><p>A second paragraph the summary never had.</p>'
        : undefined,
  }))
}

const FEEDS = {
  newsapi: feed('NewsAPI', 0),
  guardian: feed('Guardian', 1),
  nyt: feed('NYT', 2),
  bbc: feed('BBC', 3),
}

const narrow = (items: Fake[], term: string) =>
  term ? items.filter((item) => item.title.toLowerCase().includes(term.toLowerCase())) : items

const slice = (items: Fake[], page: number) => items.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)

const guardianBody = (items: Fake[]) =>
  JSON.stringify({
    response: {
      results: items.map((item) => ({
        id: item.url,
        webTitle: item.title,
        webUrl: item.url,
        webPublicationDate: item.publishedAt,
        sectionId: 'technology',
        fields: { trailText: item.description || null, byline: item.author, body: item.body },
      })),
    },
  })

const nytBody = (items: Fake[]) =>
  JSON.stringify({
    response: {
      docs: items.map((item) => ({
        _id: item.url,
        web_url: item.url,
        headline: { main: item.title },
        abstract: item.description || null,
        pub_date: item.publishedAt,
        section_name: 'Technology',
        byline: { original: `By ${item.author}` },
      })),
    },
  })

const newsapiBody = (items: Fake[]) =>
  JSON.stringify({
    articles: items.map((item) => ({
      title: item.title,
      description: item.description || null,
      url: item.url,
      publishedAt: item.publishedAt,
      author: item.author,
      source: { id: null, name: 'NewsAPI' },
    })),
  })

const bbcBody = (items: Fake[]) =>
  `<?xml version="1.0" encoding="UTF-8"?><rss version="2.0"><channel><title>BBC News</title>${items
    .map(
      (item) =>
        `<item><title>${item.title}</title><link>${item.url}</link><guid>${item.url}</guid>` +
        `<pubDate>${new Date(item.publishedAt).toUTCString()}</pubDate>` +
        `<description>${item.description}</description></item>`,
    )
    .join('')}</channel></rss>`

/** Wire all four providers up on a page or a whole context. */
export async function mockProviders(target: Page | BrowserContext, blocked: string[] = []) {
  const json = (body: string) => ({ contentType: 'application/json', body })

  await target.route('**/api/guardian/**', (route) => {
    if (blocked.includes('guardian')) return route.fulfill({ status: 503, body: 'down' })
    const params = new URL(route.request().url()).searchParams
    const items = narrow(FEEDS.guardian, params.get('q') ?? '')
    return route.fulfill(json(guardianBody(slice(items, Number(params.get('page') ?? 1)))))
  })

  await target.route('**/api/nyt/**', (route) => {
    if (blocked.includes('nyt')) return route.fulfill({ status: 503, body: 'down' })
    const params = new URL(route.request().url()).searchParams
    const items = narrow(FEEDS.nyt, params.get('q') ?? '')
    // NYT's `page` is a zero-based index, which is why the adapter sends `page - 1`.
    return route.fulfill(json(nytBody(slice(items, Number(params.get('page') ?? 0) + 1))))
  })

  await target.route('**/api/newsapi/**', (route) => {
    if (blocked.includes('newsapi')) return route.fulfill({ status: 503, body: 'down' })
    const params = new URL(route.request().url()).searchParams
    // `/everything` refuses an empty query, so the adapter sends "news" when there is
    // no term. That is not a search — it must not narrow anything.
    const term = params.get('q') === 'news' ? '' : (params.get('q') ?? '')
    const items = narrow(FEEDS.newsapi, term)
    return route.fulfill(json(newsapiBody(slice(items, Number(params.get('page') ?? 1)))))
  })

  await target.route('**/api/bbc/**', (route) => {
    if (blocked.includes('bbc')) return route.fulfill({ status: 503, body: 'down' })
    // RSS carries no query and no paging: the whole feed comes back every time and the
    // app is what makes the reader's filter true.
    return route.fulfill({ contentType: 'application/rss+xml', body: bbcBody(FEEDS.bbc) })
  })
}

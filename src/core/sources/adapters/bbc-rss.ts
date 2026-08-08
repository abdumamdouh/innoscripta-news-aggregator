import type { Article, ArticleQuery, NewsSource } from '@/core/sources/types'
import { description, getText, isoDate, text, url } from '@/core/sources/adapters/shared'

const ID = 'bbc'
const LABEL = 'BBC News'
const MEDIA_NS = 'http://search.yahoo.com/mrss/'

/**
 * BBC publishes RSS, not an API: there is no query, no date range and no paging —
 * a category is a different feed URL, which is the one filter it can serve itself.
 */
const FEEDS: Record<string, string> = {
  general: '/api/bbc/news/rss.xml',
  world: '/api/bbc/news/world/rss.xml',
  uk: '/api/bbc/news/uk/rss.xml',
  business: '/api/bbc/news/business/rss.xml',
  politics: '/api/bbc/news/politics/rss.xml',
  health: '/api/bbc/news/health/rss.xml',
  science: '/api/bbc/news/science_and_environment/rss.xml',
  technology: '/api/bbc/news/technology/rss.xml',
  entertainment: '/api/bbc/news/entertainment_and_arts/rss.xml',
  sport: '/api/bbc/sport/rss.xml',
}

export const BBC_CATEGORIES = Object.keys(FEEDS)

/** An `<item>` plus the category of the feed it came from — RSS items carry no category. */
export interface BbcRaw {
  item: Element
  category: string
}

const child = (item: Element, tag: string) => item.getElementsByTagName(tag)[0]?.textContent

function thumbnail(item: Element): string | undefined {
  const nodes = [
    ...item.getElementsByTagNameNS(MEDIA_NS, 'thumbnail'),
    // jsdom and browsers agree on the namespaced lookup; the qualified name is the
    // fallback for a feed served without the media namespace declared.
    ...item.getElementsByTagName('media:thumbnail'),
  ]
  const widest = nodes.reduce<Element | undefined>((best, node) => {
    const width = Number(node.getAttribute('width') ?? 0)
    return !best || width > Number(best.getAttribute('width') ?? 0) ? node : best
  }, undefined)
  return url(widest?.getAttribute('url'))
}

export function selectItems(xml: string, category = 'general'): BbcRaw[] {
  const document = new DOMParser().parseFromString(xml, 'application/xml')
  if (document.getElementsByTagName('parsererror').length) {
    throw new Error('bbc: feed is not well-formed XML')
  }
  return [...document.getElementsByTagName('item')]
    .map((item) => ({ item, category }))
    .filter(
      ({ item }) =>
        text(child(item, 'title')) && url(child(item, 'link')) && isoDate(child(item, 'pubDate')),
    )
}

function normalize(raw: BbcRaw): Article {
  const { item } = raw
  return {
    // guid is stable across feed rebuilds; the link is the fallback when it is absent.
    id: `${ID}:${text(child(item, 'guid')) ?? text(child(item, 'link'))}`,
    title: text(child(item, 'title')) ?? '',
    description: description(child(item, 'description')),
    url: url(child(item, 'link')) ?? '',
    imageUrl: thumbnail(item),
    // RFC-822: "Sat, 08 Aug 2026 11:55:30 GMT".
    publishedAt: isoDate(child(item, 'pubDate')) ?? '',
    sourceId: ID,
    sourceLabel: LABEL,
    // RSS carries no byline. Left undefined rather than guessed from the description.
    author: undefined,
    category: raw.category,
  }
}

/**
 * Every requested category BBC has a feed for — the front page when none was asked.
 * All of them, not the first: the source declares `category: true`, so the aggregator
 * applies no client-side category filter and dropping the rest would silently return a
 * partial answer to a multi-category query.
 */
export function resolveCategories(query: ArticleQuery): string[] {
  if (!query.categories?.length) return ['general']
  return query.categories.filter((category) => category in FEEDS)
}

export const bbcNewsSource: NewsSource<BbcRaw> = {
  id: ID,
  label: LABEL,
  capabilities: {
    query: false,
    dateRange: false,
    category: true,
    author: false,
    pagination: false,
  },
  available: true,
  async fetch(query, signal) {
    const categories = resolveCategories(query)
    // ponytail: no feed for any asked-for category means BBC genuinely has nothing to
    // contribute — returning the front page instead would smuggle in unfiltered stories.
    if (!categories.length) return []
    const feeds = await Promise.all(
      categories.map(async (category) =>
        selectItems(await getText(FEEDS[category] as string, signal), category),
      ),
    )
    return feeds.flat()
  },
  normalize,
}

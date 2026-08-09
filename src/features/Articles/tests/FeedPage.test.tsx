import { hashKey, QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import '@/i18n'
import { appTheme } from '@/config/theme'
import type { AggregateResult } from '@/core/sources/aggregator'
import type { Article } from '@/core/sources/types'
import { FeedPage } from '@/features/Articles/pages/FeedPage'
import { fetchFeed } from '@/features/Articles/services/feed.service'
import en from '@/i18n/locales/en.json'

/**
 * Same reason as ArticlesPage.test.tsx: `aggregate` is `allSettled`, so a dead provider
 * resolves into `failures` and only a broken fetch reaches `isError`. Mocking the service
 * is the only way to drive both branches from the page.
 */
vi.mock('@/features/Articles/services/feed.service', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/features/Articles/services/feed.service')>()),
  fetchFeed: vi.fn(),
}))

const fetchFeedMock = vi.mocked(fetchFeed)

const article: Article = {
  id: 'guardian:1',
  title: 'Mars rover lands safely',
  description: 'A long descent ends well.',
  url: 'https://example.test/mars',
  publishedAt: '2026-01-10T12:00:00.000Z',
  sourceId: 'guardian',
  sourceLabel: 'The Guardian',
}

const resolved = (over: Partial<AggregateResult> = {}): AggregateResult => ({
  articles: [article],
  failures: [],
  ...over,
})

function renderFeed() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={['/feed']}>
        <FeedPage />
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

describe('FeedPage — a feed that could not load', () => {
  beforeEach(() => {
    localStorage.clear()
    localStorage.setItem(
      appTheme.storageKeys.preferences,
      JSON.stringify({ sources: ['guardian'], categories: [], authors: [] }),
    )
    fetchFeedMock.mockReset()
  })

  it('shows the error card and no result count when the fetch fails', async () => {
    fetchFeedMock.mockRejectedValue(new Error('network down'))
    renderFeed()

    await screen.findByRole('heading', { name: en['articles.error.title'] })
    expect(screen.getByText(en['articles.error.body'])).toBeInTheDocument()
    // "0 articles in your feed" would read as "your preferences match nothing", which is
    // a different, wrong answer.
    expect(screen.queryByRole('status')).not.toBeInTheDocument()
    // Nor the no-preferences card: preferences exist, the network is what broke.
    expect(screen.queryByText(en['feed.empty.title'])).not.toBeInTheDocument()
  })

  it('recovers in place when the retry succeeds', async () => {
    fetchFeedMock.mockRejectedValueOnce(new Error('network down'))
    fetchFeedMock.mockResolvedValue(resolved())
    renderFeed()

    await screen.findByRole('heading', { name: en['articles.error.title'] })
    await userEvent.click(screen.getByRole('button', { name: en['articles.error.retry'] }))

    await waitFor(() =>
      expect(screen.getByRole('link', { name: article.title })).toBeInTheDocument(),
    )
    expect(screen.queryByText(en['articles.error.title'])).not.toBeInTheDocument()
    expect(fetchFeedMock).toHaveBeenCalledTimes(2)
  })

  it('names the provider that fell over instead of looking complete', async () => {
    fetchFeedMock.mockResolvedValue(
      resolved({ failures: [{ sourceId: 'nyt', reason: 'HTTP 503' }] }),
    )
    renderFeed()

    const banner = await screen.findByRole('alert')
    expect(banner).toHaveTextContent('The New York Times')
    // Partial, not broken: the stories that did arrive are still on screen.
    expect(screen.getByRole('link', { name: article.title })).toBeInTheDocument()
  })

  it('counts the feed without implying pages to page through', async () => {
    fetchFeedMock.mockResolvedValue(resolved())
    renderFeed()

    // The feed is page-1-only with no Pagination, so the paginated copy would be a lie here.
    expect(await screen.findByRole('status')).toHaveTextContent('1 articles in your feed')
    expect(screen.getByRole('status')).not.toHaveTextContent(/on this page/)
  })

  it('has no banner when every preferred provider answered', async () => {
    fetchFeedMock.mockResolvedValue(resolved())
    renderFeed()

    await screen.findByRole('link', { name: article.title })
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })
})

describe('FeedPage — the offline fallback', () => {
  const cached: Article = { ...article, id: 'guardian:2', title: 'Yesterday from storage' }
  /** What `useFeed` stamps a write with: the query key of the preferences seeded below. */
  const key = hashKey(['feed', { sources: ['guardian'], categories: [], authors: [] }])

  beforeEach(() => {
    localStorage.clear()
    localStorage.setItem(
      appTheme.storageKeys.preferences,
      JSON.stringify({ sources: ['guardian'], categories: [], authors: [] }),
    )
    fetchFeedMock.mockReset()
  })

  it('keeps the last feed that loaded, so the next cold start has something to show', async () => {
    fetchFeedMock.mockResolvedValue(resolved())
    renderFeed()

    await screen.findByRole('link', { name: article.title })
    await waitFor(() =>
      expect(
        JSON.parse(localStorage.getItem(appTheme.storageKeys.feedCache) ?? 'null'),
      ).toMatchObject({ key, articles: [article] }),
    )
  })

  it('renders the cached feed under a dated notice instead of an error page', async () => {
    localStorage.setItem(
      appTheme.storageKeys.feedCache,
      JSON.stringify({ key, savedAt: '2026-06-01T09:30:00.000Z', articles: [cached] }),
    )
    fetchFeedMock.mockRejectedValue(new Error('network down'))
    renderFeed()

    // The stories are the stored ones, and the reader is told so rather than left guessing.
    expect(await screen.findByRole('link', { name: cached.title })).toBeInTheDocument()
    expect(screen.getByRole('alert')).toHaveTextContent(/Showing cached results from/)
    expect(screen.getByRole('alert')).toHaveTextContent(/2026/)
    expect(screen.queryByText(en['articles.error.title'])).not.toBeInTheDocument()
  })

  it('falls back when every source failed without the query itself rejecting', async () => {
    // The ordinary offline case: `aggregate` is `allSettled`, so it resolves with no
    // stories and one failure per source rather than throwing.
    localStorage.setItem(
      appTheme.storageKeys.feedCache,
      JSON.stringify({ key, savedAt: '2026-06-01T09:30:00.000Z', articles: [cached] }),
    )
    fetchFeedMock.mockResolvedValue(
      resolved({ articles: [], failures: [{ sourceId: 'guardian', reason: 'HTTP 503' }] }),
    )
    renderFeed()

    expect(await screen.findByRole('link', { name: cached.title })).toBeInTheDocument()
    // One message, not two: the notice replaces the partial-failure banner.
    const alerts = screen.getAllByRole('alert')
    expect(alerts).toHaveLength(1)
    expect(alerts[0]).toHaveTextContent(/Showing cached results from/)
  })

  it('does not reach for the cache when stories did arrive, however few', async () => {
    localStorage.setItem(
      appTheme.storageKeys.feedCache,
      JSON.stringify({ key, savedAt: '2026-06-01T09:30:00.000Z', articles: [cached] }),
    )
    fetchFeedMock.mockResolvedValue(
      resolved({ failures: [{ sourceId: 'nyt', reason: 'HTTP 503' }] }),
    )
    renderFeed()

    await screen.findByRole('link', { name: article.title })
    expect(screen.queryByRole('link', { name: cached.title })).not.toBeInTheDocument()
    expect(screen.getByRole('alert')).toHaveTextContent('The New York Times')
  })

  it('drops the notice once a retry brings the live feed back', async () => {
    localStorage.setItem(
      appTheme.storageKeys.feedCache,
      JSON.stringify({ key, savedAt: '2026-06-01T09:30:00.000Z', articles: [cached] }),
    )
    fetchFeedMock.mockRejectedValueOnce(new Error('network down'))
    fetchFeedMock.mockResolvedValue(resolved())
    renderFeed()

    await screen.findByRole('link', { name: cached.title })
    await userEvent.click(screen.getByRole('button', { name: en['articles.error.retry'] }))

    await waitFor(() =>
      expect(screen.getByRole('link', { name: article.title })).toBeInTheDocument(),
    )
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })

  it('ignores a cache from another preference set rather than mislabelling it', async () => {
    // Written while the reader was on NYT; they are on The Guardian now (see beforeEach).
    localStorage.setItem(
      appTheme.storageKeys.feedCache,
      JSON.stringify({
        key: hashKey(['feed', { sources: ['nyt'], categories: [], authors: [] }]),
        savedAt: '2026-06-01T09:30:00.000Z',
        articles: [cached],
      }),
    )
    fetchFeedMock.mockRejectedValue(new Error('network down'))
    renderFeed()

    await screen.findByRole('heading', { name: en['articles.error.title'] })
    expect(screen.queryByRole('link', { name: cached.title })).not.toBeInTheDocument()
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })

  it('falls back to the error card when the cache is corrupt', async () => {
    localStorage.setItem(appTheme.storageKeys.feedCache, '{ not json')
    fetchFeedMock.mockRejectedValue(new Error('network down'))
    renderFeed()

    await screen.findByRole('heading', { name: en['articles.error.title'] })
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })
})

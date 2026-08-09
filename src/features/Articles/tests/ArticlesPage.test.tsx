import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import '@/i18n'
import type { AggregateResult } from '@/core/sources/aggregator'
import { ToastProvider } from '@/components/common/design-system'
import type { Article } from '@/core/sources/types'
import { ArticlesPage } from '@/features/Articles/pages/ArticlesPage'
import { fetchArticles } from '@/features/Articles/services/articles.service'
import en from '@/i18n/locales/en.json'

/**
 * Same reason as ArticleDetailsPage.test.tsx: `aggregate` is `allSettled`, so every
 * provider route can 500 and the query still resolves — into `failures`, which renders
 * the partial banner (covered in e2e/articles.spec.ts), never the error card. Mocking
 * the fetch is the only way to reach this page's `isError` branch.
 */
vi.mock('@/features/Articles/services/articles.service', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/features/Articles/services/articles.service')>()),
  fetchArticles: vi.fn(),
}))

const fetchArticlesMock = vi.mocked(fetchArticles)

const article: Article = {
  id: 'guardian:1',
  title: 'Mars rover lands safely',
  description: 'A long descent ends well.',
  url: 'https://example.test/mars',
  publishedAt: '2026-01-10T12:00:00.000Z',
  sourceId: 'guardian',
  sourceLabel: 'The Guardian',
}

const resolved = (articles: Article[]): AggregateResult => ({ articles, failures: [] })

function renderList() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={client}>
      <ToastProvider>
        <MemoryRouter initialEntries={['/']}>
          <ArticlesPage />
        </MemoryRouter>
      </ToastProvider>
    </QueryClientProvider>,
  )
}

describe('ArticlesPage — cold load that fails', () => {
  beforeEach(() => {
    localStorage.clear()
    fetchArticlesMock.mockReset()
  })

  it('shows the error card instead of an empty result count', async () => {
    fetchArticlesMock.mockRejectedValue(new Error('network down'))
    renderList()

    await screen.findByRole('heading', { name: en['articles.error.title'] })
    expect(screen.getByText(en['articles.error.body'])).toBeInTheDocument()
    // "0 articles on this page" would read as a successful empty search, which this is not.
    // The always-mounted toast region is a live region too, so assert on the count itself.
    expect(screen.queryByText(/articles on this page/)).not.toBeInTheDocument()
    // Filtering still works while the feed is down — the toolbar is outside the branch.
    expect(screen.getByRole('searchbox')).toBeInTheDocument()
  })

  it('recovers in place when the retry succeeds', async () => {
    fetchArticlesMock.mockRejectedValueOnce(new Error('network down'))
    fetchArticlesMock.mockResolvedValue(resolved([article]))
    renderList()

    await screen.findByRole('heading', { name: en['articles.error.title'] })
    await userEvent.click(screen.getByRole('button', { name: en['articles.error.retry'] }))

    await waitFor(() =>
      expect(screen.getByRole('link', { name: article.title })).toBeInTheDocument(),
    )
    expect(screen.queryByText(en['articles.error.title'])).not.toBeInTheDocument()
    // Two live regions on this page now: the result count, then the toast region.
    expect(screen.getAllByRole('status')[0]).toHaveTextContent('1 articles on this page')
    expect(fetchArticlesMock).toHaveBeenCalledTimes(2)
  })
})

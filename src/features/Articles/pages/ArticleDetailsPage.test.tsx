import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import '@/i18n'
import type { AggregateResult } from '@/core/sources/aggregator'
import type { Article } from '@/core/sources/types'
import { ArticleDetailsPage } from '@/features/Articles/pages/ArticleDetailsPage'
import { fetchArticles } from '@/features/Articles/services/articles.service'
import en from '@/i18n/locales/en.json'

/**
 * The cold-load failure the page's `isError` card exists for. It has to be provoked here
 * rather than in Playwright: `aggregate` is `allSettled`, so a dead provider lands in
 * `failures` and the promise still resolves — no route mock a browser can install makes
 * the query itself reject. Mocking the fetch is the only way to reach the branch.
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

function renderDetails() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={[`/articles/${encodeURIComponent(article.id)}`]}>
        <Routes>
          <Route path="/articles/:articleId" element={<ArticleDetailsPage />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

describe('ArticleDetailsPage — cold load that fails', () => {
  beforeEach(() => {
    localStorage.clear()
    fetchArticlesMock.mockReset()
  })

  it('says the fetch failed rather than claiming the article does not exist', async () => {
    fetchArticlesMock.mockRejectedValue(new Error('network down'))
    renderDetails()

    await screen.findByRole('heading', { name: en['articles.error.title'] })
    expect(screen.getByText(en['articles.error.body'])).toBeInTheDocument()
    // The two states are not interchangeable: a missing story is not a broken connection.
    expect(screen.queryByText(en['articles.details.missing.title'])).not.toBeInTheDocument()
    // And the way back is still there, as it is in every other state of this page.
    expect(screen.getByRole('link', { name: en['articles.details.back'] })).toBeInTheDocument()
  })

  it('recovers in place when the retry succeeds', async () => {
    fetchArticlesMock.mockRejectedValueOnce(new Error('network down'))
    fetchArticlesMock.mockResolvedValue(resolved([article]))
    renderDetails()

    await screen.findByRole('heading', { name: en['articles.error.title'] })
    await userEvent.click(screen.getByRole('button', { name: en['articles.error.retry'] }))

    await waitFor(() =>
      expect(screen.getByRole('heading', { level: 1, name: article.title })).toBeInTheDocument(),
    )
    expect(screen.queryByText(en['articles.error.title'])).not.toBeInTheDocument()
    expect(fetchArticlesMock).toHaveBeenCalledTimes(2)
  })
})

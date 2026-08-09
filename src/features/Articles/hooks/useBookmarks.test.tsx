import { act, renderHook, waitFor } from '@testing-library/react'
import type { ReactNode } from 'react'
import { MemoryRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { Article } from '@/core/sources/types'
import { useArticleDetails } from '@/features/Articles/hooks/useArticleDetails'
import { useBookmark } from '@/features/Articles/hooks/useBookmark'
import { useBookmarks } from '@/features/Articles/hooks/useBookmarks'
import { isBookmarked, readBookmarks } from '@/features/Articles/utils/bookmarks'

// A cold load with nothing to fetch: the point here is what the saved list resolves, not
// what the network does. Without this the details hook would go looking for a provider.
vi.mock('@/features/Articles/services/articles.service', () => ({
  fetchArticles: vi.fn(() => Promise.resolve({ articles: [], errors: [] })),
  toArticleQuery: (state: unknown) => state,
}))

const article: Article = {
  id: 'guardian:1',
  title: 'Guardian story 1 on quantum',
  description: 'Guardian summary 1',
  url: 'https://guardian.test/story-1',
  publishedAt: '2026-06-01T09:00:00.000Z',
  sourceId: 'guardian',
  sourceLabel: 'The Guardian',
}

function wrapper({ children }: { children: ReactNode }) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return (
    <MemoryRouter initialEntries={[`/articles/${article.id}`]}>
      <QueryClientProvider client={client}>{children}</QueryClientProvider>
    </MemoryRouter>
  )
}

beforeEach(() => {
  localStorage.clear()
  readBookmarks()
})

describe('two readers of the saved list in one page lifecycle', () => {
  it('shows a save made through one reader to the other, with no reload in between', () => {
    // Exactly the pair the details page mounts: the button writes, something else reads.
    const { result } = renderHook(() => ({ button: useBookmark(article), list: useBookmarks() }), {
      wrapper,
    })
    expect(result.current.button.isBookmarked).toBe(false)
    expect(result.current.list).toEqual([])

    act(() => result.current.button.toggle())

    // The second reader moved on the same click — it did not keep its own first parse.
    expect(isBookmarked(result.current.list, article.id)).toBe(true)
    expect(result.current.list[0]?.article).toEqual(article)
    expect(result.current.button.isBookmarked).toBe(true)

    act(() => result.current.button.toggle())
    expect(result.current.list).toEqual([])
    expect(result.current.button.isBookmarked).toBe(false)
  })

  it('lets the details hook resolve a permalink from a save made after it mounted', async () => {
    const { result } = renderHook(
      () => ({ details: useArticleDetails(article.id), button: useBookmark(article) }),
      { wrapper },
    )
    // Nothing saved and nothing cached: the details hook has no copy of this story.
    await waitFor(() => expect(result.current.details.isLoading).toBe(false))
    expect(result.current.details.article).toBeUndefined()

    act(() => result.current.button.toggle())

    // The snapshot the button just wrote is the copy the details hook now serves.
    expect(result.current.details.article).toEqual(article)
  })

  it('keeps the story on screen when the reader unsaves it', async () => {
    const { result } = renderHook(
      () => ({ details: useArticleDetails(article.id), button: useBookmark(article) }),
      { wrapper },
    )
    await waitFor(() => expect(result.current.details.isLoading).toBe(false))

    act(() => result.current.button.toggle())
    expect(result.current.details.article).toEqual(article)

    // Unsaving is not "this story is gone" — the page must not fall back to the
    // missing-article card under the reader.
    act(() => result.current.button.toggle())
    expect(result.current.button.isBookmarked).toBe(false)
    expect(result.current.details.article).toEqual(article)
  })

  it('reads a save that happened before it mounted, without a second parse', () => {
    const { result, unmount } = renderHook(() => useBookmark(article), { wrapper })
    act(() => result.current.toggle())
    unmount()

    // A later reader in the same session starts from the store, not from stale storage.
    const { result: reader } = renderHook(() => useBookmarks(), { wrapper })
    expect(isBookmarked(reader.current, article.id)).toBe(true)
    expect(reader.current).toBe(readBookmarks())
  })
})

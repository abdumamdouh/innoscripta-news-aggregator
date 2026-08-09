import { describe, expect, it } from 'vitest'
import { isFailedLoad } from '@/features/Articles/hooks/useArticleListCache'

const failure = { sourceId: 'guardian', reason: 'offline' }
const article = { id: 'guardian:1' } as never

describe('isFailedLoad', () => {
  it('is true when the query rejected outright', () => {
    expect(isFailedLoad({ isError: true })).toBe(true)
  })

  it('is true when every source failed and the list came back empty', () => {
    expect(isFailedLoad({ isError: false, data: { articles: [], failures: [failure] } })).toBe(true)
  })

  it('is false for an honest zero-result filter', () => {
    expect(isFailedLoad({ isError: false, data: { articles: [], failures: [] } })).toBe(false)
  })

  it('is false when stories loaded, however many sources were missing', () => {
    expect(
      isFailedLoad({ isError: false, data: { articles: [article], failures: [failure] } }),
    ).toBe(false)
  })

  it('is false while the query is still in flight with nothing to show yet', () => {
    expect(isFailedLoad({ isError: false })).toBe(false)
  })

  it('ignores placeholder data, which belongs to the previous query key', () => {
    // The previous filter's empty-after-failures result re-keyed to the new filter: it
    // says nothing about whether *this* filter's load failed.
    expect(
      isFailedLoad({
        isError: false,
        isPlaceholderData: true,
        data: { articles: [], failures: [failure] },
      }),
    ).toBe(false)
  })
})

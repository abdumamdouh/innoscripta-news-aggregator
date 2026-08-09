import { describe, expect, it } from 'vitest'
import { paginationRange } from '@/features/Articles/utils/paginationRange'

describe('paginationRange', () => {
  it('renders the 1 … 4 5 6 … 20 window in the middle of a long run', () => {
    expect(paginationRange(5, 20)).toEqual([1, 'gap', 4, 5, 6, 'gap', 20])
  })

  it('drops the leading gap near the start and the trailing gap near the end', () => {
    expect(paginationRange(2, 20)).toEqual([1, 2, 3, 'gap', 20])
    expect(paginationRange(19, 20)).toEqual([1, 'gap', 18, 19, 20])
  })

  it('lists every page when they all fit', () => {
    expect(paginationRange(2, 3)).toEqual([1, 2, 3])
    expect(paginationRange(1, 2)).toEqual([1, 2])
  })

  it('never renders a control for a single page or none', () => {
    expect(paginationRange(1, 1)).toEqual([1])
    expect(paginationRange(1, 0)).toEqual([])
  })

  it('never repeats a page number', () => {
    for (let page = 1; page <= 12; page += 1) {
      const items = paginationRange(page, 12).filter((item): item is number => item !== 'gap')
      expect(new Set(items).size).toBe(items.length)
      expect([...items].sort((a, b) => a - b)).toEqual(items)
    }
  })
})

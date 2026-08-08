import { describe, expect, it } from 'vitest'
import { parseBookmarks, toggleBookmark } from '@/features/Articles/utils/bookmarks'

describe('parseBookmarks', () => {
  it('reads a stored list of ids', () => {
    expect(parseBookmarks('["guardian:1","nyt:2"]')).toEqual(['guardian:1', 'nyt:2'])
  })

  it('treats nothing stored, corrupt JSON and a non-array as nothing saved', () => {
    expect(parseBookmarks(null)).toEqual([])
    expect(parseBookmarks('')).toEqual([])
    expect(parseBookmarks('{oops')).toEqual([])
    expect(parseBookmarks('{"guardian:1":true}')).toEqual([])
  })

  it('drops non-string entries rather than handing them on', () => {
    expect(parseBookmarks('["a",1,null,{"id":"b"},"c"]')).toEqual(['a', 'c'])
  })
})

describe('toggleBookmark', () => {
  it('adds a missing id at the end and does not mutate its input', () => {
    const ids = ['a']
    expect(toggleBookmark(ids, 'b')).toEqual(['a', 'b'])
    expect(ids).toEqual(['a'])
  })

  it('removes an id that is already saved', () => {
    expect(toggleBookmark(['a', 'b', 'c'], 'b')).toEqual(['a', 'c'])
  })

  it('round-trips back to the original list', () => {
    expect(toggleBookmark(toggleBookmark(['a'], 'b'), 'b')).toEqual(['a'])
  })
})

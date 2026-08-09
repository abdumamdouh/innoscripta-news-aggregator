import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { Article } from '@/core/sources/types'
import type { Bookmark } from '@/features/Articles/utils/bookmarks'
import {
  findBookmarkedArticle,
  isBookmarked,
  parseBookmarks,
  readBookmarks,
  refreshBookmark,
  subscribeBookmarks,
  toggleBookmark,
  writeBookmarks,
} from '@/features/Articles/utils/bookmarks'

const article = (id: string): Article => ({
  id,
  title: `Story ${id}`,
  description: 'Summary',
  url: `https://example.test/${id}`,
  publishedAt: '2026-06-01T12:00:00.000Z',
  sourceId: id.split(':')[0] as string,
  sourceLabel: 'Example',
})

describe('parseBookmarks', () => {
  it('reads saved articles back with their snapshot intact', () => {
    const saved = article('guardian:1')
    expect(parseBookmarks(JSON.stringify([{ id: saved.id, article: saved }]))).toEqual([
      { id: saved.id, article: saved },
    ])
  })

  it('still reads the earlier id-only shape, without inventing a snapshot', () => {
    expect(parseBookmarks('["guardian:1","nyt:2"]')).toEqual([
      { id: 'guardian:1' },
      { id: 'nyt:2' },
    ])
  })

  it('treats nothing stored, corrupt JSON and a non-array as nothing saved', () => {
    expect(parseBookmarks(null)).toEqual([])
    expect(parseBookmarks('')).toEqual([])
    expect(parseBookmarks('{oops')).toEqual([])
    expect(parseBookmarks('{"guardian:1":true}')).toEqual([])
  })

  it('drops entries with no usable id rather than handing them on', () => {
    expect(parseBookmarks('["a",1,null,{"title":"b"},{"id":2},"c"]')).toEqual([
      { id: 'a' },
      { id: 'c' },
    ])
  })

  it('drops a snapshot that does not belong to the entry it was stored under', () => {
    const stored = JSON.stringify([{ id: 'guardian:1', article: article('nyt:2') }])
    expect(parseBookmarks(stored)).toEqual([{ id: 'guardian:1' }])
  })

  it('drops a half-written snapshot rather than rendering a blank article', () => {
    const { description: _description, ...missingField } = article('guardian:1')
    const wrongType = { ...article('guardian:1'), publishedAt: 1717243200000 }
    expect(
      parseBookmarks(
        JSON.stringify([
          { id: 'guardian:1', article: missingField },
          { id: 'nyt:2', article: { id: 'nyt:2' } },
          { id: 'guardian:1', article: wrongType },
          { id: 'bbc:3', article: 'guardian:1' },
        ]),
      ),
    ).toEqual([{ id: 'guardian:1' }, { id: 'nyt:2' }, { id: 'guardian:1' }, { id: 'bbc:3' }])
  })

  it('keeps a snapshot carrying the optional fields too', () => {
    const saved = { ...article('guardian:1'), author: 'A. Reporter', imageUrl: 'https://i.test/1' }
    expect(parseBookmarks(JSON.stringify([{ id: saved.id, article: saved }]))).toEqual([
      { id: saved.id, article: saved },
    ])
  })
})

describe('toggleBookmark', () => {
  it('adds a missing article at the end, with its snapshot, and does not mutate its input', () => {
    const bookmarks = [{ id: 'a' }]
    const saved = article('guardian:1')
    expect(toggleBookmark(bookmarks, saved)).toEqual([
      { id: 'a' },
      { id: saved.id, article: saved },
    ])
    expect(bookmarks).toEqual([{ id: 'a' }])
  })

  it('removes an article that is already saved with its snapshot', () => {
    const saved = article('guardian:1')
    expect(toggleBookmark([{ id: 'a' }, { id: saved.id, article: saved }], saved)).toEqual([
      { id: 'a' },
    ])
  })

  it('removes an id-only entry on the first toggle, like any other saved article', () => {
    const saved = article('guardian:1')
    expect(toggleBookmark([{ id: saved.id }, { id: 'a' }], saved)).toEqual([{ id: 'a' }])
  })

  it('round-trips back to the original list', () => {
    const saved = article('guardian:1')
    expect(toggleBookmark(toggleBookmark([{ id: 'a' }], saved), saved)).toEqual([{ id: 'a' }])
  })
})

describe('refreshBookmark', () => {
  it('fills in the snapshot an id-only entry lacks, in place', () => {
    const saved = article('guardian:1')
    const bookmarks = [{ id: saved.id }, { id: 'a' }]
    expect(refreshBookmark(bookmarks, saved)).toEqual([
      { id: saved.id, article: saved },
      { id: 'a' },
    ])
    expect(bookmarks).toEqual([{ id: saved.id }, { id: 'a' }])
  })

  it('replaces a snapshot the source has since corrected, leaving the rest alone', () => {
    const stale = article('guardian:1')
    const corrected = { ...stale, title: 'Story guardian:1 (corrected)' }
    const bookmarks = [{ id: 'a' }, { id: stale.id, article: stale }]
    expect(refreshBookmark(bookmarks, corrected)).toEqual([
      { id: 'a' },
      { id: stale.id, article: corrected },
    ])
    expect(bookmarks[1]?.article).toEqual(stale)
  })

  it('notices a field that appeared and one that vanished, not just a changed one', () => {
    const saved = article('guardian:1')
    const withAuthor = { ...saved, author: 'A. Reporter' }
    expect(refreshBookmark([{ id: saved.id, article: saved }], withAuthor)).toEqual([
      { id: saved.id, article: withAuthor },
    ])
    expect(refreshBookmark([{ id: saved.id, article: withAuthor }], saved)).toEqual([
      { id: saved.id, article: saved },
    ])
  })

  it('hands back the very same array when the entry already matches', () => {
    const saved = article('guardian:1')
    const withSnapshot = [{ id: saved.id, article: saved }]
    // A fresh copy carrying identical fields is not a change worth a write.
    expect(refreshBookmark(withSnapshot, { ...saved })).toBe(withSnapshot)

    const unsaved = [{ id: 'a' }]
    expect(refreshBookmark(unsaved, saved)).toBe(unsaved)
  })

  it('never saves an article that was not bookmarked', () => {
    expect(refreshBookmark([], article('guardian:1'))).toEqual([])
  })
})

describe('findBookmarkedArticle', () => {
  it('resolves a permalink from the snapshot taken at save time', () => {
    const saved = article('guardian:1')
    expect(
      findBookmarkedArticle([{ id: 'a' }, { id: saved.id, article: saved }], saved.id),
    ).toEqual(saved)
  })

  it('resolves nothing for an id that was never saved, or was saved without a snapshot', () => {
    expect(findBookmarkedArticle([{ id: 'guardian:1' }], 'guardian:1')).toBeUndefined()
    expect(findBookmarkedArticle([], 'guardian:1')).toBeUndefined()
  })
})

describe('isBookmarked', () => {
  it('is true for a saved id in either shape and false otherwise', () => {
    const saved = article('guardian:1')
    expect(isBookmarked([{ id: saved.id, article: saved }], saved.id)).toBe(true)
    expect(isBookmarked([{ id: saved.id }], saved.id)).toBe(true)
    expect(isBookmarked([{ id: 'nyt:2' }], saved.id)).toBe(false)
  })
})

describe('subscribeBookmarks', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  it('tells every reader to re-read, so two of them never drift apart', () => {
    const saved = article('guardian:1')
    const first: Bookmark[][] = []
    const second: Bookmark[][] = []
    const stopFirst = subscribeBookmarks(() => first.push(readBookmarks()))
    const stopSecond = subscribeBookmarks(() => second.push(readBookmarks()))

    writeBookmarks(toggleBookmark(readBookmarks(), saved))
    expect(first).toEqual([[{ id: saved.id, article: saved }]])
    expect(second).toEqual(first)

    writeBookmarks(toggleBookmark(readBookmarks(), saved))
    expect(first.at(-1)).toEqual([])
    expect(second).toEqual(first)

    stopFirst()
    stopSecond()
  })

  it('stops calling a reader that unsubscribed', () => {
    const seen: number[] = []
    const stop = subscribeBookmarks(() => seen.push(readBookmarks().length))

    writeBookmarks([{ id: 'guardian:1' }])
    stop()
    writeBookmarks([{ id: 'guardian:1' }, { id: 'nyt:2' }])

    expect(seen).toEqual([1])
    // Unsubscribing is not a rollback: the second write still landed in storage.
    expect(readBookmarks()).toHaveLength(2)
  })

  it('still notifies when storage refuses the write, so nobody shows a stale flag', () => {
    const setItem = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('quota exceeded')
    })
    let notified = 0
    const stop = subscribeBookmarks(() => notified++)

    expect(() => writeBookmarks([{ id: 'guardian:1' }])).not.toThrow()
    expect(notified).toBe(1)

    stop()
    setItem.mockRestore()
  })
})

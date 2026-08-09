import { describe, expect, it } from 'vitest'
import type { Article } from '@/core/sources/types'
import type { Bookmark } from '@/features/Articles/utils/bookmarks'
import type { ReadingList } from '@/features/Articles/utils/readingLists'
import {
  createList,
  deleteList,
  isInAnyList,
  listNameError,
  parseReadingLists,
  removeArticleFromLists,
  renameList,
  savedArticles,
  toggleArticleInList,
} from '@/features/Articles/utils/readingLists'

const article = (id: string): Article => ({
  id,
  title: `Story ${id}`,
  description: `Summary ${id}`,
  url: `https://example.test/${id}`,
  publishedAt: '2026-06-01T12:00:00.000Z',
  sourceId: 'guardian',
  sourceLabel: 'The Guardian',
})

const saved = (...ids: string[]): Bookmark[] => ids.map((id) => ({ id, article: article(id) }))

const list = (id: string, name: string, articleIds: string[] = []): ReadingList => ({
  id,
  name,
  articleIds,
})

describe('parseReadingLists', () => {
  it('reads what was stored', () => {
    const stored = JSON.stringify([list('a', 'Weekend', ['guardian:1'])])
    expect(parseReadingLists(stored)).toEqual([list('a', 'Weekend', ['guardian:1'])])
  })

  it('reads nothing-stored, corrupt JSON and a non-array as "no lists yet"', () => {
    expect(parseReadingLists(null)).toEqual([])
    expect(parseReadingLists('{ not json')).toEqual([])
    expect(parseReadingLists('{"a":1}')).toEqual([])
  })

  it('drops entries that could never be picked, and keeps the ones that can', () => {
    const stored = JSON.stringify([
      { id: 'a', name: 'Keep me', articleIds: ['x'] },
      // No name: nothing to click on in the bar.
      { id: 'b', name: '   ', articleIds: ['x'] },
      { id: 'c' },
      { name: 'no id' },
      'a string',
      null,
    ])
    expect(parseReadingLists(stored)).toEqual([list('a', 'Keep me', ['x'])])
  })

  it('keeps a list whose ids are unusable, minus those ids', () => {
    const stored = JSON.stringify([{ id: 'a', name: 'Weekend', articleIds: ['x', 7, null] }])
    expect(parseReadingLists(stored)).toEqual([list('a', 'Weekend', ['x'])])
    expect(parseReadingLists(JSON.stringify([{ id: 'a', name: 'Weekend' }]))).toEqual([
      list('a', 'Weekend'),
    ])
  })
})

describe('listNameError', () => {
  const lists = [list('a', 'Weekend reading')]

  it('rejects a name that is blank or only whitespace', () => {
    expect(listNameError(lists, '')).toBe('required')
    expect(listNameError(lists, '   ')).toBe('required')
  })

  it('rejects a name already taken, ignoring case and surrounding space', () => {
    expect(listNameError(lists, 'Weekend reading')).toBe('duplicate')
    expect(listNameError(lists, '  weekend READING ')).toBe('duplicate')
  })

  it('lets a list keep its own name while renaming', () => {
    expect(listNameError(lists, 'Weekend reading', 'a')).toBeUndefined()
    expect(listNameError(lists, 'Weekend reading', 'b')).toBe('duplicate')
  })

  it('accepts a free name', () => {
    expect(listNameError(lists, 'Later')).toBeUndefined()
  })
})

describe('list CRUD', () => {
  it('appends a new list with a trimmed name, an id of its own and no articles', () => {
    const [first] = createList([], '  Weekend  ')
    expect(first).toMatchObject({ name: 'Weekend', articleIds: [] })

    const two = createList(createList([], 'One'), 'Two')
    expect(two.map((entry) => entry.name)).toEqual(['One', 'Two'])
    expect(new Set(two.map((entry) => entry.id)).size).toBe(2)
  })

  it('renames only the named list, and trims what was typed', () => {
    const lists = [list('a', 'One', ['x']), list('b', 'Two')]
    expect(renameList(lists, 'a', '  Renamed ')).toEqual([
      list('a', 'Renamed', ['x']),
      list('b', 'Two'),
    ])
    expect(renameList(lists, 'missing', 'Nope')).toEqual(lists)
  })

  it('deletes only the named list', () => {
    const lists = [list('a', 'One'), list('b', 'Two')]
    expect(deleteList(lists, 'a')).toEqual([list('b', 'Two')])
    expect(deleteList(lists, 'missing')).toEqual(lists)
  })

  it('adds an article to a list, then takes it back out, touching no other list', () => {
    const lists = [list('a', 'One', ['x']), list('b', 'Two', ['x'])]

    const added = toggleArticleInList(lists, 'a', 'y')
    expect(added[0]?.articleIds).toEqual(['x', 'y'])
    expect(added[1]?.articleIds).toEqual(['x'])

    expect(toggleArticleInList(added, 'a', 'x')[0]?.articleIds).toEqual(['y'])
  })
})

describe('isInAnyList', () => {
  const lists = [list('a', 'One', ['x']), list('b', 'Two', [])]

  it('is true when a single list holds the article', () => {
    expect(isInAnyList(lists, 'x')).toBe(true)
  })

  it('is false for a saved article filed nowhere, and with no lists at all', () => {
    expect(isInAnyList(lists, 'z')).toBe(false)
    expect(isInAnyList([], 'x')).toBe(false)
  })
})

describe('removeArticleFromLists', () => {
  it('drops the id from every list that held it', () => {
    const lists = [list('a', 'One', ['x', 'y']), list('b', 'Two', ['y']), list('c', 'Three', ['x'])]
    expect(removeArticleFromLists(lists, 'x')).toEqual([
      list('a', 'One', ['y']),
      list('b', 'Two', ['y']),
      list('c', 'Three', []),
    ])
  })

  it('returns the very same array when no list held it, so the caller skips the write', () => {
    const lists = [list('a', 'One', ['x'])]
    expect(removeArticleFromLists(lists, 'z')).toBe(lists)
  })
})

describe('savedArticles', () => {
  const bookmarks = saved('one', 'two', 'three')
  const lists = [list('a', 'Weekend', ['three', 'one'])]

  it('shows every save, newest first', () => {
    expect(savedArticles(bookmarks, lists, null).map((entry) => entry.id)).toEqual([
      'three',
      'two',
      'one',
    ])
  })

  it('narrows to one list, still newest-save-first rather than list order', () => {
    // The list holds three-then-one; the page orders by when they were saved, not by
    // when they were filed, so the two views never disagree about recency.
    expect(savedArticles(bookmarks, lists, 'a').map((entry) => entry.id)).toEqual(['three', 'one'])
  })

  it('shows nothing for a list id that no longer resolves', () => {
    // Widening to the whole library here would look like the delete did not happen.
    expect(savedArticles(bookmarks, lists, 'deleted')).toEqual([])
  })

  it('skips entries saved under the old id-only shape, which have no story to render', () => {
    const mixed: Bookmark[] = [{ id: 'legacy' }, ...saved('one')]
    expect(savedArticles(mixed, [], null).map((entry) => entry.id)).toEqual(['one'])
  })

  it('is empty when nothing is saved', () => {
    expect(savedArticles([], lists, null)).toEqual([])
    expect(savedArticles([], lists, 'a')).toEqual([])
  })
})

import { describe, expect, it } from 'vitest'
import { DEFAULT_ARTICLES_STATE } from '@/features/Articles/constants'
import type { ArticlesState } from '@/features/Articles/types/articles.types'
import type { SavedSearch } from '@/features/Articles/utils/savedSearches'
import {
  createSearch,
  deleteSearch,
  parseSavedSearches,
  renameSearch,
} from '@/features/Articles/utils/savedSearches'

const state = (patch: Partial<ArticlesState> = {}): ArticlesState => ({
  ...DEFAULT_ARTICLES_STATE,
  ...patch,
})

const search = (id: string, name: string, patch: Partial<ArticlesState> = {}): SavedSearch => ({
  id,
  name,
  state: state(patch),
})

describe('parseSavedSearches', () => {
  it('reads back what was stored, filters and all', () => {
    const stored = JSON.stringify([search('a', 'Tech', { q: 'ai', category: 'technology' })])
    expect(parseSavedSearches(stored)).toEqual([
      search('a', 'Tech', { q: 'ai', category: 'technology' }),
    ])
  })

  it('reads nothing-stored, corrupt JSON and a non-array as "no searches yet"', () => {
    expect(parseSavedSearches(null)).toEqual([])
    expect(parseSavedSearches('{ not json')).toEqual([])
    expect(parseSavedSearches('{"a":1}')).toEqual([])
  })

  it('drops entries that could never be picked', () => {
    const stored = JSON.stringify([
      { id: 'a', name: 'Keep me', state: {} },
      { id: 'b', name: '   ', state: {} },
      { id: 'c' },
      { name: 'no id' },
      'a string',
      null,
    ])
    expect(parseSavedSearches(stored)).toEqual([search('a', 'Keep me')])
  })

  it('sanitises a hand-edited state instead of trusting it', () => {
    const stored = JSON.stringify([
      {
        id: 'a',
        name: 'Tampered',
        state: {
          q: 'ai',
          sort: 'drop-table',
          category: 'not-a-category',
          sources: ['guardian', 'not-a-source', 'guardian'],
          from: 'yesterday',
          page: -3,
        },
      },
    ])
    expect(parseSavedSearches(stored)).toEqual([
      search('a', 'Tampered', { q: 'ai', sources: ['guardian'] }),
    ])
  })

  it('keeps a preset whose state is missing or unusable, at the defaults', () => {
    const stored = JSON.stringify([
      { id: 'a', name: 'No state' },
      { id: 'b', name: 'Junk state', state: 'nope' },
    ])
    expect(parseSavedSearches(stored)).toEqual([search('a', 'No state'), search('b', 'Junk state')])
  })
})

describe('createSearch', () => {
  it('appends a named snapshot of the state, trimmed, without reshuffling', () => {
    const existing = [search('a', 'Tech')]
    const created = createSearch(existing, '  Weekend  ', state({ q: 'climate', page: 3 }))

    const [kept, added] = created
    expect(created).toHaveLength(2)
    expect(kept).toEqual(existing[0])
    expect(added?.name).toBe('Weekend')
    expect(added?.state).toEqual(state({ q: 'climate', page: 3 }))
    expect(added?.id).not.toBe('a')
  })

  it('copies the state, so later edits to the live filters do not rewrite the preset', () => {
    const live = state({ q: 'ai' })
    const [created] = createSearch([], 'Tech', live)
    live.q = 'something else'
    expect(created?.state.q).toBe('ai')
  })
})

describe('renameSearch / deleteSearch', () => {
  it('renames only the named preset, keeping its filters', () => {
    const searches = [search('a', 'Tech', { q: 'ai' }), search('b', 'Sport')]
    const renamed = renameSearch(searches, 'a', '  AI beat ')

    expect(renamed[0]).toEqual(search('a', 'AI beat', { q: 'ai' }))
    expect(renamed[1]).toEqual(searches[1])
  })

  it('leaves everything alone when the id is unknown', () => {
    const searches = [search('a', 'Tech')]
    expect(renameSearch(searches, 'missing', 'Nope')).toEqual(searches)
    expect(deleteSearch(searches, 'missing')).toEqual(searches)
  })

  it('deletes only the named preset', () => {
    const searches = [search('a', 'Tech'), search('b', 'Sport')]
    expect(deleteSearch(searches, 'a')).toEqual([searches[1]])
  })
})

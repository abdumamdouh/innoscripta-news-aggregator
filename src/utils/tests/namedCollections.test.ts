import { describe, expect, it } from 'vitest'
import { nameError } from '@/utils/namedCollections'

/** One rule, one place: reading lists and saved searches both name things through this. */
describe('nameError', () => {
  const items = [{ id: 'a', name: 'Weekend reading' }]

  it('rejects a name that is blank or only whitespace', () => {
    expect(nameError(items, '')).toBe('required')
    expect(nameError(items, '   ')).toBe('required')
  })

  it('rejects a name already taken, ignoring case and surrounding space', () => {
    expect(nameError(items, 'Weekend reading')).toBe('duplicate')
    expect(nameError(items, '  weekend READING ')).toBe('duplicate')
  })

  it('lets an item keep its own name while renaming', () => {
    expect(nameError(items, 'Weekend reading', 'a')).toBeUndefined()
    expect(nameError(items, 'Weekend reading', 'b')).toBe('duplicate')
  })

  it('accepts a free name, and compares against every item not just the first', () => {
    const two = [...items, { id: 'b', name: 'Later' }]
    expect(nameError(two, 'Tomorrow')).toBeUndefined()
    expect(nameError(two, 'later')).toBe('duplicate')
  })

  it('takes an empty collection as nothing being taken', () => {
    expect(nameError([], 'Anything')).toBeUndefined()
  })
})

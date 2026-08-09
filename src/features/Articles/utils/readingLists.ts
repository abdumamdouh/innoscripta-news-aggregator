import { appTheme } from '@/config/theme'
import type { Article } from '@/core/sources/types'
import type { Bookmark } from '@/features/Articles/utils/bookmarks'
import { createLocalStorageStore } from '@/utils/localStorageStore'

/**
 * A reading list is a name over ids the reader already saved — the snapshot lives once, in
 * the bookmarks store, so a story cannot be in a list and un-openable at the same time.
 * Membership by id also means renaming or deleting a list never touches an article.
 */
export interface ReadingList {
  id: string
  name: string
  articleIds: string[]
}

const asIds = (value: unknown): string[] =>
  Array.isArray(value) ? value.filter((entry): entry is string => typeof entry === 'string') : []

const asList = (entry: unknown): ReadingList | undefined => {
  if (!entry || typeof entry !== 'object') return undefined
  const { id, name, articleIds } = entry as Record<string, unknown>
  // A nameless list has no way to be picked, so it is not a list.
  if (typeof id !== 'string' || typeof name !== 'string' || !name.trim()) return undefined
  return { id, name, articleIds: asIds(articleIds) }
}

export function parseReadingLists(raw: string | null): ReadingList[] {
  try {
    const parsed: unknown = JSON.parse(raw ?? '[]')
    if (!Array.isArray(parsed)) return []
    return parsed.map(asList).filter((list): list is ReadingList => list !== undefined)
  } catch {
    // A corrupt entry reads as "no lists yet" — never a broken page.
    return []
  }
}

export type ListNameError = 'required' | 'duplicate'

/**
 * The one gate every write goes through: blank names cannot be picked and two lists with
 * the same name cannot be told apart. Case- and whitespace-insensitive, because "Weekend"
 * and "weekend " are the same list to the reader who typed them.
 */
export function listNameError(
  lists: readonly ReadingList[],
  name: string,
  exceptId?: string,
): ListNameError | undefined {
  const trimmed = name.trim()
  if (!trimmed) return 'required'
  const taken = lists.some(
    (list) => list.id !== exceptId && list.name.toLowerCase() === trimmed.toLowerCase(),
  )
  return taken ? 'duplicate' : undefined
}

// ponytail: timestamp + random suffix, not `crypto.randomUUID` — ids never leave this device
// and never index anything. Swap in a uuid if lists ever sync between devices.
const newId = () => `list-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`

/** Appended, so the bar keeps its order and a new list does not reshuffle the old ones. */
export const createList = (lists: readonly ReadingList[], name: string): ReadingList[] => [
  ...lists,
  { id: newId(), name: name.trim(), articleIds: [] },
]

export const renameList = (
  lists: readonly ReadingList[],
  id: string,
  name: string,
): ReadingList[] => lists.map((list) => (list.id === id ? { ...list, name: name.trim() } : list))

export const deleteList = (lists: readonly ReadingList[], id: string): ReadingList[] =>
  lists.filter((list) => list.id !== id)

/** Add or drop one article, order preserved so the list does not reshuffle mid-click. */
export function toggleArticleInList(
  lists: readonly ReadingList[],
  listId: string,
  articleId: string,
): ReadingList[] {
  return lists.map((list) =>
    list.id === listId
      ? {
          ...list,
          articleIds: list.articleIds.includes(articleId)
            ? list.articleIds.filter((entry) => entry !== articleId)
            : [...list.articleIds, articleId],
        }
      : list,
  )
}

/** Whether unsaving this article would take it out of a named list as well as out of saved. */
export const isInAnyList = (lists: readonly ReadingList[], articleId: string): boolean =>
  lists.some((list) => list.articleIds.includes(articleId))

/**
 * Unsaving drops the snapshot, so leaving the id in a list would leave a hole nothing can
 * render. Returns the same array when no list held it — the caller then skips the write.
 */
export function removeArticleFromLists(lists: ReadingList[], articleId: string): ReadingList[] {
  if (!isInAnyList(lists, articleId)) return lists
  return lists.map((list) =>
    list.articleIds.includes(articleId)
      ? { ...list, articleIds: list.articleIds.filter((entry) => entry !== articleId) }
      : list,
  )
}

/**
 * What the saved page shows: newest save first, and only entries that carry a snapshot —
 * an id-only entry (the pre-snapshot shape) has no story to put on a card. A list id that
 * no longer resolves shows nothing rather than silently widening to the whole library.
 */
export function savedArticles(
  bookmarks: readonly Bookmark[],
  lists: readonly ReadingList[],
  activeListId: string | null,
): Article[] {
  const ids = activeListId
    ? (lists.find((list) => list.id === activeListId)?.articleIds ?? [])
    : undefined
  return bookmarks
    .flatMap((bookmark) =>
      bookmark.article && (!ids || ids.includes(bookmark.id)) ? [bookmark.article] : [],
    )
    .reverse()
}

/** Same read model as `bookmarks.ts`: one parse, so every reader on the page agrees. */
const store = createLocalStorageStore(appTheme.storageKeys.readingLists, parseReadingLists)

export const readReadingLists = store.read
export const subscribeReadingLists = store.subscribe
export const writeReadingLists = store.write

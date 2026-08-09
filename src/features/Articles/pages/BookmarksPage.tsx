import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { BookmarkX, ListPlus, Pencil, Plus, Trash2 } from 'lucide-react'
import {
  AppButton,
  AppCard,
  AppConfirmDialog,
  AppIconButton,
  useToast,
} from '@/components/common/design-system'
import type { Article } from '@/core/sources/types'
import { AddToListModal } from '@/features/Articles/components/AddToListModal'
import { ArticleGrid } from '@/features/Articles/components/ArticleGrid'
import { ListNameModal } from '@/features/Articles/components/ListNameModal'
import { useBookmarks } from '@/features/Articles/hooks/useBookmarks'
import { unsaveArticle } from '@/features/Articles/hooks/useBookmark'
import { useNamedCrud } from '@/features/Articles/hooks/useNamedCrud'
import { useReadingLists } from '@/features/Articles/hooks/useReadingLists'
import type { ReadingList } from '@/features/Articles/utils/readingLists'
import {
  createList,
  deleteList,
  readReadingLists,
  renameList,
  savedArticles,
  toggleArticleInList,
  writeReadingLists,
} from '@/features/Articles/utils/readingLists'

/**
 * Everything the reader saved, and the named lists over it. Nothing here fetches: the saved
 * copy of a story is the snapshot taken when it was saved, so this page has no loading or
 * error state to show — only "nothing saved yet" and "this list is empty".
 */
export function BookmarksPage() {
  const { t } = useTranslation()
  const bookmarks = useBookmarks()
  const lists = useReadingLists()
  const [activeListId, setActiveListId] = useState<string | null>(null)
  const [adding, setAdding] = useState<Article | null>(null)
  const [removing, setRemoving] = useState<Article | null>(null)
  const [deletingList, setDeletingList] = useState(false)
  const toast = useToast()

  const activeList = lists.find((list) => list.id === activeListId)
  const articles = savedArticles(bookmarks, lists, activeListId)

  const crud = useNamedCrud<ReadingList>({
    read: readReadingLists,
    write: writeReadingLists,
    create: createList,
    rename: renameList,
    remove: deleteList,
    toasts: {
      created: 'bookmarks.toast.listCreated',
      renamed: 'bookmarks.toast.listRenamed',
      deleted: 'bookmarks.toast.listDeleted',
    },
  })

  const confirmDeleteList = () => {
    if (activeList) crud.deleteItem(activeList.id)
    // The filter it was showing is gone, so fall back to everything saved.
    setActiveListId(null)
    setDeletingList(false)
  }

  const confirmRemove = () => {
    if (removing) unsaveArticle(removing.id)
    setRemoving(null)
    toast(t('bookmarks.toast.saveRemoved'))
  }

  const toggleInList = (list: ReadingList, article: Article) => {
    writeReadingLists(toggleArticleInList(readReadingLists(), list.id, article.id))
    const added = !list.articleIds.includes(article.id)
    toast(
      t(added ? 'bookmarks.toast.addedToList' : 'bookmarks.toast.removedFromList', {
        list: list.name,
      }),
    )
  }

  const filter = (id: string | null, label: string) => (
    <li key={id ?? 'all'}>
      <AppButton
        size="sm"
        variant={activeListId === id ? 'primary' : 'secondary'}
        aria-pressed={activeListId === id}
        onClick={() => setActiveListId(id)}
      >
        {label}
      </AppButton>
    </li>
  )

  return (
    <section className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="text-2xl font-semibold text-ink-900 dark:text-ink-100">
          {t('bookmarks.title')}
        </h1>
        <AppButton size="sm" variant="secondary" className="ms-auto" onClick={crud.startNew}>
          <Plus className="size-4" aria-hidden />
          {t('bookmarks.list.new')}
        </AppButton>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <ul className="flex flex-wrap items-center gap-2" aria-label={t('bookmarks.lists.label')}>
          {filter(null, t('bookmarks.all'))}
          {lists.map((list) => filter(list.id, list.name))}
        </ul>
        {activeList ? (
          <div className="flex items-center gap-1">
            <AppIconButton
              label={t('bookmarks.list.rename')}
              onClick={() => crud.startRename(activeList)}
            >
              <Pencil className="size-5" aria-hidden />
            </AppIconButton>
            <AppIconButton label={t('bookmarks.list.delete')} onClick={() => setDeletingList(true)}>
              <Trash2 className="size-5" aria-hidden />
            </AppIconButton>
          </div>
        ) : null}
      </div>

      {articles.length ? (
        <ArticleGrid
          articles={articles}
          isLoading={false}
          renderActions={(article) => (
            <>
              <AppIconButton label={t('bookmarks.addTo.label')} onClick={() => setAdding(article)}>
                <ListPlus className="size-5" aria-hidden />
              </AppIconButton>
              <AppIconButton label={t('bookmarks.remove')} onClick={() => setRemoving(article)}>
                <BookmarkX className="size-5" aria-hidden />
              </AppIconButton>
            </>
          )}
        />
      ) : (
        <AppCard as="section" className="text-center">
          <h2 className="text-lg font-semibold text-ink-900 dark:text-ink-100">
            {t(activeList ? 'bookmarks.emptyList.title' : 'bookmarks.empty.title')}
          </h2>
          <p className="mt-2 text-ink-500">
            {t(activeList ? 'bookmarks.emptyList.body' : 'bookmarks.empty.body')}
          </p>
        </AppCard>
      )}

      <ListNameModal
        open={crud.isNaming}
        list={crud.renaming}
        lists={lists}
        onSubmit={crud.submitName}
        onClose={crud.close}
      />

      <AddToListModal
        article={adding}
        lists={lists}
        onToggle={toggleInList}
        onClose={() => setAdding(null)}
      />

      <AppConfirmDialog
        open={deletingList}
        onOpenChange={setDeletingList}
        title={t('bookmarks.confirm.deleteListTitle')}
        description={t('bookmarks.confirm.deleteListBody', { list: activeList?.name ?? '' })}
        confirmLabel={t('bookmarks.list.delete')}
        onConfirm={confirmDeleteList}
      />

      <AppConfirmDialog
        open={removing !== null}
        onOpenChange={(open) => (open ? undefined : setRemoving(null))}
        title={t('bookmarks.confirm.removeTitle')}
        description={t('bookmarks.confirm.removeBody')}
        confirmLabel={t('bookmarks.remove')}
        onConfirm={confirmRemove}
      />
    </section>
  )
}

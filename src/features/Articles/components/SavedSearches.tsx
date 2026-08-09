import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { BookmarkPlus, Pencil, Trash2 } from 'lucide-react'
import {
  AppButton,
  AppConfirmDialog,
  AppIconButton,
  AppModal,
  useToast,
} from '@/components/common/design-system'
import type { ArticlesState } from '@/features/Articles/types/articles.types'
import { NamedItemForm } from '@/features/Articles/components/NamedItemForm'
import { useNamedCrud } from '@/features/Articles/hooks/useNamedCrud'
import { useSavedSearches } from '@/features/Articles/hooks/useSavedSearches'
import type { SavedSearch } from '@/features/Articles/utils/savedSearches'
import {
  createSearch,
  deleteSearch,
  readSavedSearches,
  renameSearch,
  writeSavedSearches,
} from '@/features/Articles/utils/savedSearches'

export interface SavedSearchesProps {
  /** What "save this search" would store: the filter set currently on screen. */
  state: ArticlesState
  onApply: (state: ArticlesState) => void
}

/**
 * Named filter sets: save what is on screen, then apply, rename or delete it. Applying is
 * one call into the state the URL already owns, so a preset restores the shared view whole.
 */
export function SavedSearches({ state, onApply }: SavedSearchesProps) {
  const { t } = useTranslation()
  const searches = useSavedSearches()
  const [deleting, setDeleting] = useState<SavedSearch | null>(null)
  const toast = useToast()

  const crud = useNamedCrud<SavedSearch>({
    read: readSavedSearches,
    write: writeSavedSearches,
    create: (items, name) => createSearch(items, name, state),
    rename: renameSearch,
    remove: deleteSearch,
    toasts: {
      created: 'articles.presets.toast.saved',
      renamed: 'articles.presets.toast.renamed',
      deleted: 'articles.presets.toast.deleted',
    },
  })

  const confirmDelete = () => {
    if (deleting) crud.deleteItem(deleting.id)
    setDeleting(null)
  }

  const apply = (search: SavedSearch) => {
    onApply(search.state)
    toast(t('articles.presets.toast.applied', { name: search.name }))
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <ul className="flex flex-wrap items-center gap-2" aria-label={t('articles.presets.label')}>
        {searches.map((search) => (
          <li key={search.id} className="flex items-center gap-1">
            <AppButton size="sm" variant="secondary" onClick={() => apply(search)}>
              {search.name}
            </AppButton>
            <AppIconButton
              label={t('articles.presets.rename', { name: search.name })}
              onClick={() => crud.startRename(search)}
            >
              <Pencil className="size-5" aria-hidden />
            </AppIconButton>
            <AppIconButton
              label={t('articles.presets.delete', { name: search.name })}
              onClick={() => setDeleting(search)}
            >
              <Trash2 className="size-5" aria-hidden />
            </AppIconButton>
          </li>
        ))}
      </ul>

      <AppButton size="sm" variant="secondary" className="ms-auto" onClick={crud.startNew}>
        <BookmarkPlus className="size-4" aria-hidden />
        {t('articles.presets.save')}
      </AppButton>

      <AppModal
        open={crud.isNaming}
        onOpenChange={(next) => (next ? undefined : crud.close())}
        title={t(crud.renaming ? 'articles.presets.renameTitle' : 'articles.presets.saveTitle')}
        description={t('articles.presets.description')}
      >
        <NamedItemForm
          item={crud.renaming}
          items={searches}
          labels={{
            name: t('articles.presets.nameLabel'),
            placeholder: t('articles.presets.namePlaceholder'),
            submit: t('articles.presets.submit'),
          }}
          errorText={(error) => t(`articles.presets.errors.${error}`)}
          onSubmit={crud.submitName}
          onClose={crud.close}
        />
      </AppModal>

      <AppConfirmDialog
        open={deleting !== null}
        onOpenChange={(open) => (open ? undefined : setDeleting(null))}
        title={t('articles.presets.confirm.title')}
        description={t('articles.presets.confirm.body', { name: deleting?.name ?? '' })}
        confirmLabel={t('articles.presets.confirm.delete')}
        onConfirm={confirmDelete}
      />
    </div>
  )
}

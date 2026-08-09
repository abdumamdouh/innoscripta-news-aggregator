import { useTranslation } from 'react-i18next'
import { AppModal } from '@/components/common/design-system'
import { NamedItemForm } from '@/features/Articles/components/NamedItemForm'
import type { ReadingList } from '@/features/Articles/utils/readingLists'

export interface ListNameModalProps {
  open: boolean
  /** Present when renaming, absent when creating — the only difference between the two. */
  list?: ReadingList
  lists: readonly ReadingList[]
  onSubmit: (name: string) => void
  onClose: () => void
}

export function ListNameModal({ open, list, lists, onSubmit, onClose }: ListNameModalProps) {
  const { t } = useTranslation()

  return (
    <AppModal
      open={open}
      onOpenChange={(next) => (next ? undefined : onClose())}
      title={t(list ? 'bookmarks.list.rename' : 'bookmarks.list.new')}
      description={t('bookmarks.list.description')}
    >
      <NamedItemForm
        item={list}
        items={lists}
        labels={{
          name: t('bookmarks.list.nameLabel'),
          placeholder: t('bookmarks.list.namePlaceholder'),
          submit: t('bookmarks.list.save'),
        }}
        errorText={(error) => t(`bookmarks.list.errors.${error}`)}
        onSubmit={onSubmit}
        onClose={onClose}
      />
    </AppModal>
  )
}

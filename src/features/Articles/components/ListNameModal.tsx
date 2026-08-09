import { useState } from 'react'
import type { FormEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { AppButton, AppInput, AppModal } from '@/components/common/design-system'
import type { ListNameError, ReadingList } from '@/features/Articles/utils/readingLists'
import { listNameError } from '@/features/Articles/utils/readingLists'

export interface ListNameModalProps {
  open: boolean
  /** Present when renaming, absent when creating — the only difference between the two. */
  list?: ReadingList
  lists: readonly ReadingList[]
  onSubmit: (name: string) => void
  onClose: () => void
}

/**
 * Mounted only while the dialog is open (Radix unmounts the portal), which is what makes
 * seeding the field from the list in `useState` correct — reopening re-reads.
 */
function NameForm({ list, lists, onSubmit, onClose }: Omit<ListNameModalProps, 'open'>) {
  const { t } = useTranslation()
  const [name, setName] = useState(list?.name ?? '')
  const [error, setError] = useState<ListNameError>()

  const submit = (event: FormEvent) => {
    event.preventDefault()
    const found = listNameError(lists, name, list?.id)
    setError(found)
    if (found) return
    onSubmit(name)
  }

  return (
    <form className="flex flex-col gap-4" onSubmit={submit} noValidate>
      <AppInput
        label={t('bookmarks.list.nameLabel')}
        placeholder={t('bookmarks.list.namePlaceholder')}
        value={name}
        error={error ? t(`bookmarks.list.errors.${error}`) : undefined}
        onChange={(event) => setName(event.target.value)}
      />
      <div className="flex justify-end gap-2">
        <AppButton type="button" variant="secondary" onClick={onClose}>
          {t('bookmarks.list.cancel')}
        </AppButton>
        <AppButton type="submit">{t('bookmarks.list.save')}</AppButton>
      </div>
    </form>
  )
}

export function ListNameModal({ open, onClose, ...props }: ListNameModalProps) {
  const { t } = useTranslation()

  return (
    <AppModal
      open={open}
      onOpenChange={(next) => (next ? undefined : onClose())}
      title={t(props.list ? 'bookmarks.list.rename' : 'bookmarks.list.new')}
      description={t('bookmarks.list.description')}
    >
      <NameForm {...props} onClose={onClose} />
    </AppModal>
  )
}

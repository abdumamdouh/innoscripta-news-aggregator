import { useState } from 'react'
import type { FormEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { AppButton, AppInput } from '@/components/common/design-system'
import type { NameError } from '@/utils/namedCollections'
import { nameError } from '@/utils/namedCollections'

export interface NamedItemFormProps {
  /** Present when renaming, absent when creating — the only difference between the two. */
  item?: { id: string; name: string }
  items: readonly { id: string; name: string }[]
  /** Copy stays with the caller, so every i18n key is a literal where it is owned. */
  labels: { name: string; placeholder: string; submit: string }
  errorText: (error: NameError) => string
  onSubmit: (name: string) => void
  onClose: () => void
}

/**
 * Name a thing, uniquely. Shared by reading lists and saved searches: same field, same gate,
 * same two buttons — only the copy differs, so only the copy is a prop.
 *
 * Mounted only while its dialog is open (Radix unmounts the portal), which is what makes
 * seeding the field from the item in `useState` correct — reopening re-reads.
 */
export function NamedItemForm({
  item,
  items,
  labels,
  errorText,
  onSubmit,
  onClose,
}: NamedItemFormProps) {
  const { t } = useTranslation()
  const [name, setName] = useState(item?.name ?? '')
  const [error, setError] = useState<NameError>()

  const submit = (event: FormEvent) => {
    event.preventDefault()
    const found = nameError(items, name, item?.id)
    setError(found)
    if (found) return
    onSubmit(name)
  }

  return (
    <form className="flex flex-col gap-4" onSubmit={submit} noValidate>
      <AppInput
        label={labels.name}
        placeholder={labels.placeholder}
        value={name}
        error={error ? errorText(error) : undefined}
        onChange={(event) => setName(event.target.value)}
      />
      <div className="flex justify-end gap-2">
        <AppButton type="button" variant="secondary" onClick={onClose}>
          {t('common.cancel')}
        </AppButton>
        <AppButton type="submit">{labels.submit}</AppButton>
      </div>
    </form>
  )
}

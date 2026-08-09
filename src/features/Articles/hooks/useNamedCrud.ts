import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useToast } from '@/components/common/design-system'

export interface NamedItem {
  id: string
  name: string
}

/** Which dialog is open, as one value — create and rename can never be open at once. */
type Naming<T> = { mode: 'new' } | { mode: 'rename'; item: T } | null

export interface NamedCrudOptions<T extends NamedItem> {
  /** Re-read before every write: the store, not this hook, is the source of truth. */
  read: () => T[]
  write: (items: T[]) => void
  create: (items: readonly T[], name: string) => T[]
  rename: (items: readonly T[], id: string, name: string) => T[]
  remove: (items: readonly T[], id: string) => T[]
  /** i18n keys for the three announcements — the only per-feature copy in here. */
  toasts: { created: string; renamed: string; deleted: string }
}

/**
 * The create/rename/delete dance every named collection performs: hold which dialog is open,
 * route the submitted name to create or rename, and announce each write once. Reading lists
 * and saved searches differ only in which store functions they hand over.
 */
export function useNamedCrud<T extends NamedItem>(options: NamedCrudOptions<T>) {
  const { t } = useTranslation()
  const toast = useToast()
  const [naming, setNaming] = useState<Naming<T>>(null)

  return {
    isNaming: naming !== null,
    /** The item being renamed, or undefined while creating — what the form seeds from. */
    renaming: naming?.mode === 'rename' ? naming.item : undefined,
    startNew: () => setNaming({ mode: 'new' }),
    startRename: (item: T) => setNaming({ mode: 'rename', item }),
    close: () => setNaming(null),

    submitName: (name: string) => {
      if (!naming) return
      const stored = options.read()
      if (naming.mode === 'new') {
        options.write(options.create(stored, name))
        toast(t(options.toasts.created))
      } else {
        options.write(options.rename(stored, naming.item.id, name))
        toast(t(options.toasts.renamed))
      }
      setNaming(null)
    },

    deleteItem: (id: string) => {
      options.write(options.remove(options.read(), id))
      toast(t(options.toasts.deleted))
    },
  }
}

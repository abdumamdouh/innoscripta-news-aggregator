import { useTranslation } from 'react-i18next'
import { AppButton, AppCheckbox, AppModal } from '@/components/common/design-system'
import type { Article } from '@/core/sources/types'
import type { ReadingList } from '@/features/Articles/utils/readingLists'

export interface AddToListModalProps {
  /** The article being filed. Absent means the dialog is closed. */
  article: Article | null
  lists: readonly ReadingList[]
  onToggle: (list: ReadingList, article: Article) => void
  onClose: () => void
}

/**
 * Membership as a set of ticks rather than an add-only picker: the same dialog puts an
 * article into a list and takes it back out, so there is one place to look either way.
 */
export function AddToListModal({ article, lists, onToggle, onClose }: AddToListModalProps) {
  const { t } = useTranslation()

  return (
    <AppModal
      open={article !== null}
      onOpenChange={(next) => (next ? undefined : onClose())}
      title={t('bookmarks.addTo.title')}
      description={article?.title ?? ''}
      footer={<AppButton onClick={onClose}>{t('bookmarks.addTo.done')}</AppButton>}
    >
      {lists.length ? (
        <div className="flex flex-col gap-2">
          {lists.map((list) => (
            <AppCheckbox
              key={list.id}
              label={list.name}
              checked={article ? list.articleIds.includes(article.id) : false}
              onCheckedChange={() => {
                if (article) onToggle(list, article)
              }}
            />
          ))}
        </div>
      ) : (
        <p className="text-sm text-ink-500">{t('bookmarks.addTo.none')}</p>
      )}
    </AppModal>
  )
}

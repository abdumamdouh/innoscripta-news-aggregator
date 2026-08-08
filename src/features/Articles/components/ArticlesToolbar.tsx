import { useTranslation } from 'react-i18next'
import { AppInput } from '@/components/common/design-system'
import { SortSelect } from '@/features/Articles/components/SortSelect'
import type { ArticleSort } from '@/features/Articles/types/articles.types'

export interface ArticlesToolbarProps {
  term: string
  onTermChange: (term: string) => void
  sort: ArticleSort
  onSortChange: (sort: ArticleSort) => void
}

export function ArticlesToolbar({ term, onTermChange, sort, onSortChange }: ArticlesToolbarProps) {
  const { t } = useTranslation()

  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
      <div className="w-full sm:max-w-md">
        <AppInput
          type="search"
          label={t('articles.search.label')}
          placeholder={t('articles.search.placeholder')}
          value={term}
          onChange={(event) => onTermChange(event.target.value)}
        />
      </div>
      <SortSelect value={sort} onChange={onSortChange} />
    </div>
  )
}

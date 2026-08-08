import { useTranslation } from 'react-i18next'
import { AppSelect } from '@/components/common/design-system'
import { ARTICLE_SORTS } from '@/features/Articles/types/articles.types'
import type { ArticleSort } from '@/features/Articles/types/articles.types'

export function SortSelect({
  value,
  onChange,
}: {
  value: ArticleSort
  onChange: (sort: ArticleSort) => void
}) {
  const { t } = useTranslation()

  return (
    <AppSelect
      label={t('articles.sort.label')}
      hideLabel
      value={value}
      onValueChange={(next) => onChange(next as ArticleSort)}
      options={ARTICLE_SORTS.map((sort) => ({ value: sort, label: t(`articles.sort.${sort}`) }))}
      className="w-full sm:w-56"
    />
  )
}

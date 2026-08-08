import { useTranslation } from 'react-i18next'
import { AppCard, AppCheckbox, AppInput, AppSelect } from '@/components/common/design-system'
import { ARTICLE_CATEGORIES, SELECTABLE_SOURCES } from '@/features/Articles/constants'
import type { ArticlesState } from '@/features/Articles/types/articles.types'

const ALL = '__all__'

export interface ArticlesFiltersProps {
  state: ArticlesState
  authors: string[]
  onChange: (patch: Partial<ArticlesState>) => void
}

export function ArticlesFilters({ state, authors, onChange }: ArticlesFiltersProps) {
  const { t } = useTranslation()
  const allIds = SELECTABLE_SOURCES.map((source) => source.id)
  // `[]` is "every source", so an unticked box only exists once a subset is chosen.
  const selected = state.sources.length ? state.sources : allIds

  const toggleSource = (id: string, checked: boolean) => {
    const next = checked ? [...selected, id] : selected.filter((entry) => entry !== id)
    onChange({ sources: next.length === allIds.length ? [] : next })
  }

  return (
    <AppCard as="section" className="flex flex-col gap-4">
      <h2 className="text-sm font-semibold text-ink-700 dark:text-ink-100">
        {t('articles.filters.title')}
      </h2>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <AppInput
          type="date"
          label={t('articles.filters.from')}
          value={state.from}
          max={state.to || undefined}
          onChange={(event) => onChange({ from: event.target.value })}
        />
        <AppInput
          type="date"
          label={t('articles.filters.to')}
          value={state.to}
          min={state.from || undefined}
          onChange={(event) => onChange({ to: event.target.value })}
        />
        <AppSelect
          label={t('articles.filters.category')}
          value={state.category || ALL}
          onValueChange={(value) => onChange({ category: value === ALL ? '' : value })}
          options={[
            { value: ALL, label: t('articles.filters.anyCategory') },
            ...ARTICLE_CATEGORIES.map((category) => ({
              value: category,
              label: t(`articles.category.${category}`),
            })),
          ]}
        />
        <AppSelect
          label={t('articles.filters.author')}
          value={state.author || ALL}
          onValueChange={(value) => onChange({ author: value === ALL ? '' : value })}
          options={[
            { value: ALL, label: t('articles.filters.anyAuthor') },
            // Bylines are whatever the providers filed today: no fixed vocabulary, so the
            // list is everything seen across this session's results (see `useAuthorFacet`).
            ...authors.map((author) => ({ value: author, label: author })),
          ]}
        />
      </div>

      <fieldset className="flex flex-col gap-2">
        <legend className="mb-2 text-sm font-medium text-ink-700 dark:text-ink-100">
          {t('articles.filters.sources')}
        </legend>
        <div className="flex flex-wrap gap-x-6 gap-y-2">
          {SELECTABLE_SOURCES.map((source) => {
            const checked = selected.includes(source.id)
            return (
              <AppCheckbox
                key={source.id}
                label={source.label}
                checked={checked}
                // Nothing selected cannot be expressed — and an empty feed on purpose is
                // not a filter anyone wants. The last one standing stays put.
                disabled={checked && selected.length === 1}
                onCheckedChange={(next) => toggleSource(source.id, next)}
              />
            )
          })}
        </div>
      </fieldset>
    </AppCard>
  )
}

import { X } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { AppButton, appFocusRing } from '@/components/common/design-system'
import { SOURCE_LABELS } from '@/core/sources/registry'
import type { ArticlesState } from '@/features/Articles/types/articles.types'
import { hasActiveFilters } from '@/features/Articles/utils/articlesState'
import { cn } from '@/utils/cn'

export interface FilterChipsProps {
  state: ArticlesState
  onChange: (patch: Partial<ArticlesState>) => void
  onClear: () => void
}

function chipsFor(state: ArticlesState, label: (key: string) => string) {
  const chips: { key: string; text: string; clear: Partial<ArticlesState> }[] = []
  if (state.q) chips.push({ key: 'q', text: state.q, clear: { q: '' } })
  if (state.from) {
    chips.push({
      key: 'from',
      text: `${label('articles.filters.from')}: ${state.from}`,
      clear: { from: '' },
    })
  }
  if (state.to) {
    chips.push({
      key: 'to',
      text: `${label('articles.filters.to')}: ${state.to}`,
      clear: { to: '' },
    })
  }
  if (state.category) {
    chips.push({
      key: 'category',
      text: label(`articles.category.${state.category}`),
      clear: { category: '' },
    })
  }
  if (state.author) chips.push({ key: 'author', text: state.author, clear: { author: '' } })
  // Only a chosen subset is a filter — `[]` is every source, so it lists nothing.
  for (const id of state.sources) {
    chips.push({
      key: `source-${id}`,
      text: SOURCE_LABELS[id] ?? id,
      clear: { sources: state.sources.filter((entry) => entry !== id) },
    })
  }
  return chips
}

/** What is currently narrowing the feed, and one click to undo each of it. */
export function FilterChips({ state, onChange, onClear }: FilterChipsProps) {
  const { t } = useTranslation()
  if (!hasActiveFilters(state)) return null

  return (
    <div className="flex flex-wrap items-center gap-2">
      {chipsFor(state, (key) => t(key)).map((chip) => (
        <button
          key={chip.key}
          type="button"
          onClick={() => onChange(chip.clear)}
          aria-label={t('articles.filters.remove', { label: chip.text })}
          className={cn(
            'inline-flex min-h-11 items-center gap-1.5 rounded-full border border-ink-300 bg-paper-0 px-3 text-sm text-ink-700 lg:min-h-9',
            'hover:bg-accent-50 dark:border-ink-700 dark:bg-ink-800 dark:text-ink-100 dark:hover:bg-ink-700',
            appFocusRing,
          )}
        >
          {chip.text}
          <X className="size-3.5" aria-hidden />
        </button>
      ))}
      <AppButton variant="ghost" size="sm" onClick={onClear}>
        {t('articles.filters.clear')}
      </AppButton>
    </div>
  )
}

import { ChevronLeft, ChevronRight } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { AppIconButton, appFocusRing } from '@/components/common/design-system'
import { paginationRange } from '@/features/Articles/utils/paginationRange'
import { cn } from '@/utils/cn'

export interface PaginationProps {
  page: number
  totalPages: number
  onPageChange: (page: number) => void
}

export function Pagination({ page, totalPages, onPageChange }: PaginationProps) {
  const { t, i18n } = useTranslation()
  if (totalPages <= 1) return null

  // The caret points at the previous page, which in Arabic is to the right.
  const isRtl = i18n.language === 'ar'
  const PreviousIcon = isRtl ? ChevronRight : ChevronLeft
  const NextIcon = isRtl ? ChevronLeft : ChevronRight

  return (
    <nav
      aria-label={t('pagination.label')}
      className="flex flex-wrap items-center justify-center gap-2"
    >
      <AppIconButton
        label={t('pagination.previous')}
        disabled={page <= 1}
        onClick={() => onPageChange(page - 1)}
      >
        <PreviousIcon className="size-4" aria-hidden />
      </AppIconButton>

      {paginationRange(page, totalPages).map((item, index) =>
        item === 'gap' ? (
          <span key={`gap-${index}`} className="px-1 text-ink-500" aria-hidden>
            …
          </span>
        ) : (
          <button
            key={item}
            type="button"
            onClick={() => onPageChange(item)}
            aria-label={t('pagination.page', { page: item })}
            aria-current={item === page ? 'page' : undefined}
            className={cn(
              'inline-flex min-h-11 min-w-11 items-center justify-center rounded-lg border text-base transition-colors',
              item === page
                ? 'border-accent-600 bg-accent-600 font-semibold text-paper-0'
                : 'border-ink-300 bg-paper-0 text-ink-800 hover:bg-accent-50 dark:border-ink-700 dark:bg-ink-800 dark:text-ink-100 dark:hover:bg-ink-700',
              appFocusRing,
            )}
          >
            {item}
          </button>
        ),
      )}

      <AppIconButton
        label={t('pagination.next')}
        disabled={page >= totalPages}
        onClick={() => onPageChange(page + 1)}
      >
        <NextIcon className="size-4" aria-hidden />
      </AppIconButton>
    </nav>
  )
}

import { useTranslation } from 'react-i18next'

/**
 * Which newsroom this story came from. Not decoration: with four providers merged into
 * one grid it is the only thing that tells a reader an aggregated result apart, so the
 * readable label is real text in the a11y tree and the colour is the redundant half.
 * The tint is looked up per source id, falling back to ink for a source with no token.
 */
export function SourceBadge({ sourceId, sourceLabel }: { sourceId: string; sourceLabel: string }) {
  const { t } = useTranslation()

  return (
    <span
      data-source-id={sourceId}
      className="inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold text-paper-0"
      style={{ backgroundColor: `var(--color-source-${sourceId}, var(--color-ink-700))` }}
    >
      <span className="sr-only">{t('articles.source')}: </span>
      {sourceLabel}
    </span>
  )
}

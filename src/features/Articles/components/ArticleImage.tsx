import { useEffect, useState } from 'react'
import { Newspaper } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { cn } from '@/utils/cn'

interface ArticleImageProps {
  src: string | undefined
  /** The hero on a details page is above the fold; cards below it are not. */
  priority?: boolean
  className?: string
}

const FRAME = 'aspect-video w-full rounded-lg bg-paper-50 dark:bg-ink-700'

/**
 * Provider image URLs go stale — a publisher moves an asset and the picture 404s while the
 * article itself is fine. Plenty of stories never carry one either: a corrections column or a
 * live blog is text. Both land on the same placeholder, at the same aspect ratio, so the grid
 * stays level and neither case reads as the app having failed.
 */
export function ArticleImage({ src, priority = false, className }: ArticleImageProps) {
  const { t } = useTranslation()
  const [failed, setFailed] = useState(false)

  // Recycled rows: React keeps the <img> and swaps src, so a stale failure would hide a
  // perfectly good picture on the next page.
  useEffect(() => setFailed(false), [src])

  if (!src || failed) {
    return (
      <div
        role="img"
        aria-label={t('articles.image.none')}
        className={cn(
          FRAME,
          'flex flex-col items-center justify-center gap-2 border border-dashed border-ink-300 text-ink-500 dark:border-ink-700',
          className,
        )}
      >
        <Newspaper className="size-6" aria-hidden />
        <span className="text-xs">{t('articles.image.none')}</span>
      </div>
    )
  }

  return (
    <img
      src={src}
      alt=""
      loading={priority ? 'eager' : 'lazy'}
      fetchPriority={priority ? 'high' : 'auto'}
      decoding="async"
      onError={() => setFailed(true)}
      className={cn(FRAME, 'object-cover', className)}
    />
  )
}

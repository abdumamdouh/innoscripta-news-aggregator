import { useEffect, useState } from 'react'
import { cn } from '@/utils/cn'

interface ArticleImageProps {
  src: string | undefined
  /** The hero on a details page is above the fold; cards below it are not. */
  priority?: boolean
  className?: string
}

/**
 * Provider image URLs go stale — a publisher moves an asset and the picture 404s while the
 * article itself is fine. A broken-image icon in the middle of the grid looks like the app
 * failed, so a failure falls back to the same empty frame an article without a picture gets
 * and the layout never moves.
 */
export function ArticleImage({ src, priority = false, className }: ArticleImageProps) {
  const [failed, setFailed] = useState(false)

  // Recycled rows: React keeps the <img> and swaps src, so a stale failure would hide a
  // perfectly good picture on the next page.
  useEffect(() => setFailed(false), [src])

  const frame = cn(
    'aspect-video w-full rounded-lg bg-paper-50 object-cover dark:bg-ink-700',
    className,
  )

  if (!src || failed) return <div className={frame} aria-hidden />

  return (
    <img
      src={src}
      alt=""
      loading={priority ? 'eager' : 'lazy'}
      fetchPriority={priority ? 'high' : 'auto'}
      decoding="async"
      onError={() => setFailed(true)}
      className={frame}
    />
  )
}

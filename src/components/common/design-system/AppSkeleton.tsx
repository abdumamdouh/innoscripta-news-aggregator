import { cn } from '@/utils/cn'

/**
 * One shimmering placeholder surface. Shapes stay at the call site — a skeleton is only
 * honest when it matches the box it stands in for, and only that box knows its size.
 * Always `aria-hidden`: the loading announcement belongs to the container's `role="status"`,
 * not to a dozen grey rectangles.
 */
export function AppSkeleton({ className }: { className?: string }) {
  return (
    <div
      className={cn('motion-shimmer rounded bg-paper-50 dark:bg-ink-700', className)}
      aria-hidden
    />
  )
}

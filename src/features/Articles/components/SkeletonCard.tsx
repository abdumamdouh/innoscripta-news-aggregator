import { AppCard, AppSkeleton } from '@/components/common/design-system'

/**
 * `ArticleCard`'s silhouette with the words taken out: same image ratio, same title band,
 * same three-line summary floor. Matching the real card is the whole job — a placeholder
 * of a different height makes the grid jump the moment the stories land.
 */
export function SkeletonCard() {
  return (
    <AppCard className="flex h-full flex-col gap-3">
      <AppSkeleton className="aspect-video w-full rounded-lg" />
      <AppSkeleton className="h-4 w-2/3" />
      <AppSkeleton className="h-15 w-full" />
    </AppCard>
  )
}

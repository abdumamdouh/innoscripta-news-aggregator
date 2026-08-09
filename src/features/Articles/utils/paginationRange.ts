export type PaginationItem = number | 'gap'

/**
 * The `1 … 4 5 6 … 20` window: first page, last page, the current page with `siblings`
 * either side, and an ellipsis wherever a run was skipped.
 */
export function paginationRange(page: number, totalPages: number, siblings = 1): PaginationItem[] {
  if (totalPages <= 1) return totalPages === 1 ? [1] : []

  const start = Math.max(2, page - siblings)
  const end = Math.min(totalPages - 1, page + siblings)

  const items: PaginationItem[] = [1]
  if (start > 2) items.push('gap')
  for (let current = start; current <= end; current += 1) items.push(current)
  if (end < totalPages - 1) items.push('gap')
  items.push(totalPages)

  return items
}

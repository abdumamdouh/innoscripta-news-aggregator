import type { Article } from '@/core/sources/types'

/**
 * The author dropdown's vocabulary: every byline seen so far, plus the ones on this page
 * and whichever is selected. Accumulating matters — the moment an author is picked the
 * fetch narrows to that author, so a facet built from the current page alone collapses to
 * a single entry and no other byline is ever reachable again.
 *
 * ponytail: a running set of what the reader has actually loaded, not a full index — no
 * provider offers an authors endpoint. Upgrade path: a dedicated bylines fetch if one
 * ever exists.
 */
export function mergeAuthors(
  seen: readonly string[],
  articles: Article[],
  selected = '',
): string[] {
  const next = new Set(seen)
  for (const article of articles) {
    const author = article.author?.trim()
    if (author) next.add(author)
  }
  if (selected.trim()) next.add(selected.trim())
  return [...next].sort((a, b) => a.localeCompare(b))
}

import type { NewsSource } from '@/core/sources/types'

/**
 * Registered, not hidden — same reasoning as OpenNews: a named source that cannot be
 * reached is information, and hiding it just looks like it was forgotten.
 */
export const newsCredSource: NewsSource<never> = {
  id: 'newscred',
  label: 'NewsCred',
  capabilities: {
    query: false,
    dateRange: false,
    category: false,
    author: false,
    pagination: false,
  },
  available: false,
  unavailableReason:
    'NewsCred is now Optimizely Content Marketing Platform — its content API is enterprise-only, with no public or free tier to sign up for.',
  fetch: () => Promise.resolve([]),
  normalize: () => {
    throw new Error('newscred: no public API access to normalize')
  },
}

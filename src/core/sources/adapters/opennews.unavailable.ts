import type { NewsSource } from '@/core/sources/types'

/**
 * Registered, not hidden: the brief names OpenNews as a source, and a reader who looks
 * for it deserves the reason it is greyed out rather than its silent absence.
 */
export const openNewsSource: NewsSource<never> = {
  id: 'opennews',
  label: 'OpenNews',
  capabilities: {
    query: false,
    dateRange: false,
    category: false,
    author: false,
    pagination: false,
  },
  available: false,
  unavailableReasonKey: 'sources.unavailableReason.opennews',
  fetch: () => Promise.resolve([]),
  normalize: () => {
    throw new Error('opennews: no article API exists to normalize')
  },
}

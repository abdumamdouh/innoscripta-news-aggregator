import { bbcNewsSource } from '@/core/sources/adapters/bbc-rss'
import { guardianSource } from '@/core/sources/adapters/guardian'
import { newsCredSource } from '@/core/sources/adapters/newscred.unavailable'
import { newsapiSource } from '@/core/sources/adapters/newsapi'
import { nytSource } from '@/core/sources/adapters/nyt'
import { openNewsSource } from '@/core/sources/adapters/opennews.unavailable'
import type { NewsSource } from '@/core/sources/types'

/**
 * The only file that changes when a source is added: one import, one entry.
 * Unavailable sources stay listed — the UI shows them disabled with their reason.
 */
export const SOURCES: NewsSource[] = [
  newsapiSource,
  guardianSource,
  nytSource,
  bbcNewsSource,
  openNewsSource,
  newsCredSource,
]

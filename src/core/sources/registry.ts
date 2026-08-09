import { bbcNewsSource } from '@/core/sources/adapters/bbc-rss'
import { guardianSource } from '@/core/sources/adapters/guardian'
import { newsCredSource } from '@/core/sources/adapters/newscred.unavailable'
import { newsapiSource } from '@/core/sources/adapters/newsapi'
import { nytSource } from '@/core/sources/adapters/nyt'
import { openNewsSource } from '@/core/sources/adapters/opennews.unavailable'
import type { NewsSource } from '@/core/sources/types'

/**
 * The only file the *app* changes when a source is added: one import, one entry. Nothing
 * downstream — no page, hook, filter or component — knows a provider exists.
 *
 * A source that needs a key also needs its route, and that is deployment rather than
 * application: `vite.proxy.ts` for the dev server, which `docker/nginx.conf.template` and
 * `api/proxy.ts` both build from, plus the variable in `.env.example`. Worth stating plainly
 * rather than claiming a one-line change that only holds for a keyless feed.
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

/** Source id → display label, for the places that hold an id and need a name. */
export const SOURCE_LABELS: Record<string, string> = Object.fromEntries(
  SOURCES.map((source) => [source.id, source.label]),
)

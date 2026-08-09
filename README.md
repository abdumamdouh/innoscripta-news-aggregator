# innoscripta News

A news aggregator that pulls articles from four newsrooms into one searchable, filterable feed,
with a personalized "my feed" built from saved reader preferences. React 19 + TypeScript, served
from an nginx container that attaches the provider keys so the browser never sees them. Built for
the innoscripta AG frontend take-home challenge.

## Quick start

Docker — the whole app, one command:

```bash
cp .env.example .env.local   # add your API keys
docker compose up --build    # → http://localhost:8080
```

Local dev instead:

```bash
cp .env.example .env.local   # add your API keys
npm install
npm run dev                  # → http://localhost:3000
```

Keys are optional either way. Without them only BBC answers and the other three report as failed
providers — degraded, not broken.

## API keys

| Source             | Key needed     | Where to get it                                       |
| ------------------ | -------------- | ----------------------------------------------------- |
| NewsAPI.org        | `NEWSAPI_KEY`  | https://newsapi.org/register (free tier: 100 req/day) |
| The Guardian       | `GUARDIAN_KEY` | https://open-platform.theguardian.com/access/         |
| The New York Times | `NYT_KEY`      | https://developer.nytimes.com/get-started             |
| BBC News           | none           | public RSS at feeds.bbci.co.uk                        |

Keys are never bundled. A request from the browser goes to a same-origin path (`/api/...`); the
proxy attaches the key server-side — Vite's proxy in dev (`vite.proxy.ts`), nginx in the container
(`docker/nginx.conf.template`, rendered from env by `docker/entrypoint.sh`). `e2e/proxy-keys.spec.ts`
asserts it against a running app: no key in any request the browser makes, none in any script it is
served. CI runs the same check over `dist/`.

## Challenge requirements

| Requirement                      | How                                                                                                                                                                                                                 | Evidence                                                                                                                                                                                     |
| -------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Search articles                  | Debounced keyword box, applied by providers that support it and client-side for those that don't                                                                                                                    | `src/features/Articles/components/ArticlesToolbar.tsx` · `e2e/articles.spec.ts` "narrows the grid to articles that match a typed keyword"                                                    |
| Filter by date, category, source | Filter panel + dismissible chips; state lives in the URL                                                                                                                                                            | `src/features/Articles/components/ArticlesFilters.tsx`, `src/features/Articles/utils/articlesState.ts` · `e2e/articles.spec.ts` "makes a deselected source disappear from the grid entirely" |
| Personalized feed                | Preferred sources/categories/authors saved to storage, fanned out as one query                                                                                                                                      | `src/features/Articles/services/feed.service.ts`, `src/features/Preferences/preferences.schema.ts` · `e2e/feed.spec.ts` (6 tests)                                                            |
| Mobile-responsive                | Single-column at 375, no horizontal scroll at any breakpoint                                                                                                                                                        | `e2e/responsive.spec.ts` — asserts 375 / 768 / 1280 fit, including real-length headlines                                                                                                     |
| React + TypeScript               | React 19, `strict` + `noUncheckedIndexedAccess`, zero `any`                                                                                                                                                         | `tsconfig.app.json` · `npm run typecheck`                                                                                                                                                    |
| ≥ 3 data sources                 | 4 live adapters (NewsAPI, Guardian, NYT, BBC)                                                                                                                                                                       | `src/core/sources/registry.ts` · `e2e/articles.spec.ts` "merges all four newsrooms and labels every card with its source"                                                                    |
| Docker + docs                    | Multi-stage build → nginx; compose runs it on :8080; this file is the whole doc                                                                                                                                     | `Dockerfile`, `docker-compose.yml` · `docker.test.ts`, `e2e/docker.spec.ts`                                                                                                                  |
| DRY / KISS / SOLID               | One `NewsSource` interface per provider (open/closed: add a source, change no existing one); saved searches and reading lists share `src/utils/namedCollections.ts` + `src/features/Articles/hooks/useNamedCrud.ts` | `src/core/sources/types.ts`, `src/utils/namedCollections.ts`                                                                                                                                 |

## Data sources

The brief lists seven. Four are reachable; the rest are handled honestly rather than quietly
dropped:

| Source             | Status                                                                        |
| ------------------ | ----------------------------------------------------------------------------- |
| NewsAPI.org        | Live. Free tier is localhost-only, so requests go through the proxy.          |
| The Guardian       | Live, via the Open Platform Content API.                                      |
| The New York Times | Live, via the Article Search API.                                             |
| BBC News           | Live, via public RSS — the BBC has no public JSON news API.                   |
| NewsAPI            | Duplicate of NewsAPI.org in the brief; one adapter serves both entries.       |
| OpenNews           | Unavailable. opennews.org is a journalism-tech nonprofit, not an article API. |
| NewsCred           | Unavailable. Now Optimizely CMP — enterprise-only, no public signup.          |

The two unavailable ones stay registered with `available: false` and a reason, and appear in the UI
as disabled options rather than vanishing.

Capabilities differ, so each adapter declares what it supports and the aggregator does the rest
client-side. BBC RSS is the extreme case: no query, no date range, no pagination, so keyword, date
and paging are applied after the fetch.

## Architecture

Every provider implements `NewsSource` — its capabilities, plus a `fetch` that maps the provider's
shape onto one canonical `Article`. Adding a source is a new adapter plus one entry in `SOURCES`
(`src/core/sources/registry.ts`); no page, hook, filter or component changes, because nothing
downstream knows a provider exists. If it needs an API key it also needs a proxy route — one entry
in `vite.proxy.ts`, which the nginx template and the Vercel function both build from, plus the
variable in `.env.example`. Application code: two files. Deployment wiring: two more.

The aggregator fans out with `Promise.allSettled` (never `all`, so one dead provider degrades the
feed instead of blanking it), applies whatever the source couldn't, dedupes by canonical URL, and
merge-sorts.

Capabilities are a contract, and the aggregator only skips a filter the source genuinely performs.
NewsAPI's `/everything` has no taxonomy and no author field, so it declares `category: false` and
`author: false` and gets checked client-side — the alternative was claiming a filter that a bare
search term does not deliver. The keyword is re-checked for *every* source regardless: the Guardian
and NYT search full article bodies, so a match can be real and still invisible on a card.

```
src/
├─ core/sources/      adapters/ (one file per provider) · registry.ts · aggregator.ts · types.ts
├─ features/
│  ├─ Articles/       list, details, bookmarks, reading lists, saved searches, offline cache
│  └─ Preferences/    the feed's saved sources/categories/authors (+ Yup schema)
├─ components/        design-system/ (App* primitives over Radix) · layout/
├─ i18n/              en · ar · de
└─ utils/             shared, feature-agnostic helpers
```

## Beyond the brief

- EN / AR / DE, with full RTL for Arabic
- Dark mode, system-aware
- Bookmarks and named reading lists
- Saved searches (name a filter set, restore it in one click)
- Offline cache — last results are shown with a notice when the network is gone
- URL-shareable state: search, filters, sort and page all live in the query string
- Partial-failure banner naming the provider that fell over, instead of an empty page

## Testing

| Suite                                       | Files | Tests | Command            |
| ------------------------------------------- | ----- | ----- | ------------------ |
| Unit / component (Vitest + Testing Library) | 37    | 436   | `npm test`         |
| End-to-end (Playwright, Chromium)           | 16    | 133   | `npm run test:e2e` |

E2E needs no real keys: every provider response is served from a fixture, and the stand-in keys the
Playwright config injects are what makes "no key reached the browser" a real assertion. `e2e/docker.spec.ts`
builds and runs the actual image; it skips with a reason where Docker is unreachable.

## Scripts

| Script                  | Does                                                        |
| ----------------------- | ----------------------------------------------------------- |
| `npm run dev`           | Vite dev server on :3000, with proxies for all four sources |
| `npm run build`         | Type-check then production build                            |
| `npm run preview`       | Serve the production build locally                          |
| `npm run typecheck`     | `tsc -b --noEmit`                                           |
| `npm run lint`          | oxlint                                                      |
| `npm test`              | Vitest                                                      |
| `npm run test:watch`    | Vitest in watch mode                                        |
| `npm run test:coverage` | Vitest with V8 coverage                                     |
| `npm run test:e2e`      | Playwright                                                  |
| `npm run format`        | Prettier, write                                             |
| `npm run format:check`  | Prettier, check only                                        |

## How this was built

Agentic tooling was used as a copilot, not as the author. The architecture here is the point,
and it was decided before any code existed:

- One `NewsSource` interface per provider, so a fourth newsroom is a new file and a registry
  line rather than a change to anything already working.
- Capabilities declared per source, so BBC's RSS — no query, no date range, no paging — degrades
  in the aggregator instead of being special-cased at the call sites.
- One route table (`vite.proxy.ts`) consumed by three runtimes: the Vite dev server, the nginx
  container, and the Vercel function. The key is attached server-side in all three.
- A four-hook stack per feature — fetch, URL state, pure derive, actions — kept separate on
  purpose, because merging them is what makes a list screen unmaintainable.

Those decisions, the trade-offs behind them, and every review judgement are mine. The tooling
accelerated the typing and held a consistent test bar; it did not choose the design. Where a
provider constraint forced a compromise — permalinks that cannot always resolve, a page count
that can only be known one page ahead — the code says so in a comment rather than hiding it.

## Author

Abdulrahman Mamdouh

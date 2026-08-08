# innoscripta News

A news aggregator that pulls articles from multiple providers and shows them in one clean,
searchable, filterable feed. Built for the innoscripta AG frontend take-home challenge.

> **Status: in progress.** The scaffold and build pipeline are up; features are being built
> iteratively. [GOAL.md](GOAL.md) is the live backlog and the single source of truth for what is
> done, in progress, or still open. This README is expanded in full at backlog item 14.

## Stack

React 19 · TypeScript (strict) · Vite · Tailwind v4 · TanStack Query · React Router · Radix
primitives · i18next (EN/AR + RTL) · Yup · Vitest + Testing Library · Docker + nginx

## Data sources

The challenge lists seven sources and asks for at least three. Four are actually reachable
today; the other three are handled honestly rather than quietly dropped:

| Source         | Status                                                                        |
| -------------- | ----------------------------------------------------------------------------- |
| NewsAPI.org    | Live. Free tier is localhost-only, so requests go through a proxy.            |
| The Guardian   | Live, via the Open Platform Content API.                                      |
| New York Times | Live, via the Article Search API.                                             |
| BBC News       | Live, via public RSS — the BBC has no public JSON news API.                   |
| NewsAPI        | Duplicate of NewsAPI.org in the brief; one adapter serves both entries.       |
| OpenNews       | Unavailable. opennews.org is a journalism-tech nonprofit, not an article API. |
| NewsCred       | Unavailable. Now Optimizely CMP — enterprise-only, no public signup.          |

The two unavailable sources are registered in the source registry with `available: false` and a
reason, and surface in the UI as disabled options rather than being hidden.

## Architecture

Every provider is a `NewsSource` adapter that declares its own capabilities and maps its response
shape onto one canonical `Article`. The aggregator fans out with `Promise.allSettled`, normalizes,
dedupes, and merge-sorts — so one dead provider degrades the feed instead of blanking it, and
adding a fifth source is one new file plus one registry line.

Provider capabilities differ sharply (BBC RSS has no search, no date filter and no pagination),
so adapters declare what they support and the aggregator applies the rest client-side.

## Local development

```bash
npm install
cp .env.example .env.local   # then add your API keys
npm run dev
```

| Script                  | Does                                                        |
| ----------------------- | ----------------------------------------------------------- |
| `npm run dev`           | Vite dev server on :3000, with proxies for all four sources |
| `npm run build`         | Type-check then production build                            |
| `npm run typecheck`     | `tsc -b --noEmit`                                           |
| `npm run lint`          | oxlint                                                      |
| `npm run test`          | Vitest                                                      |
| `npm run test:coverage` | Vitest with V8 coverage                                     |
| `npm run format`        | Prettier                                                    |

API keys are never bundled: in development Vite's proxy attaches them, and in the container nginx
does. `grep -r VITE_ dist/` returns nothing.

## Author

Abdulrahman Mamdouh

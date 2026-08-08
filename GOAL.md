# GOAL — innoscripta News Aggregator

Single source of truth for what is done, in progress, and open. Read and written by
`/implement-feature-loop`. **Never mark an item `done` by hand from an agent's self-report** — an
item is `done` only when the loop itself observed typecheck, lint, test, review, e2e and acceptance
all pass.

Status values: `not started` · `in progress` · `done` · `needs human review`.
Full spec for each item is in **§ Item specs** below, in a `### <id> — <title>` section.

## Definition of done (every item)

- `npm run typecheck && npm run lint && npm run test && npm run test:e2e` pass.
- **Unit tests** for any pure logic added, and a **Playwright spec** for any user-visible behaviour
  added. A feature without tests is not done; a suite that runs zero specs is a failure, not a pass.
- No `any`, no `../../../` imports, no raw hex in components, no `VITE_*` key reachable from client code.
- New i18n keys exist in **all three** locales — `en.json`, `ar.json`, `de.json`. A key in one and
  missing from another is a bug.
- Renders correctly at 375 / 768 / 1280 with no horizontal scroll; desktop must not regress.
- Loading, empty and error states exist for anything that fetches.
- Follows `.claude/rules/patterns.md`.

## Backlog

| #   | Item                                            | Status      | Branch                                        | Notes                                                                                                                                                                                                                       |
| --- | ----------------------------------------------- | ----------- | --------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | App shell + design system                       | done        | feat/app-shell-design-system                  | Human-verified in a browser: boots, routes render, ar → dir=rtl + Arabic copy, theme persists across reload and honours prefers-color-scheme on first visit. e2e agent was BLOCKED by a browser-MCP fault, not by the code. |
| 1b  | Playwright e2e harness                          | done        | feat/playwright-e2e-harness                   | Merged. 9 specs green: shell, language, navigation.                                                                                                                                                                         |
| 1c  | German (de) locale                              | done        | feat/german-de-locale                         | Merged. en/ar/de all 17 keys, de stays ltr.                                                                                                                                                                                 |
| 2   | Domain core: Article, NewsSource, aggregator    | done        | feat/domain-core-article-newssource-aggregato |                                                                                                                                                                                                                             |
| 3   | Four live adapters + two stubs                  | done        | feat/four-live-adapters-two-stubs             |                                                                                                                                                                                                                             |
| 4   | nginx proxy + env wiring                        | not started |                                               |                                                                                                                                                                                                                             |
| 5   | Article list: search, filters, sort, pagination | not started |                                               |                                                                                                                                                                                                                             |
| 6   | Article details page                            | not started |                                               |                                                                                                                                                                                                                             |
| 7   | Preferences (sources / categories / authors)    | not started |                                               |                                                                                                                                                                                                                             |
| 8   | Personalized feed                               | not started |                                               |                                                                                                                                                                                                                             |
| 9   | Bookmarks + reading lists (CRUD)                | not started |                                               |                                                                                                                                                                                                                             |
| 10  | Saved search presets (CRUD)                     | not started |                                               |                                                                                                                                                                                                                             |
| 11  | UI states + offline cache                       | not started |                                               |                                                                                                                                                                                                                             |
| 12  | Responsive pass                                 | not started |                                               |                                                                                                                                                                                                                             |
| 13  | Docker + CI                                     | not started |                                               |                                                                                                                                                                                                                             |
| 14  | README + SETUP                                  | not started |                                               |                                                                                                                                                                                                                             |

## Carry-forward

Findings raised by verifiers on problems outside the item being built. Drained **before** new
backlog rows. Appended by the loop; safe to add to by hand.

- [x] (minor) NewsAPI/Guardian/NYT/BBC descriptions can legitimately render as empty strings downstream: When a provider supplies title/url/publishedAt but no description (null trailText, null abstract/snippet/lead_paragraph, no RSS `<description>`), normalize() defaults description to ''. This is deliberate per the spec ("defaulted... not allowed to produce a half-built Article") and is tested, but nothing downstream (item 5/6 list and detail views) has been reviewed yet for how it renders an empty description — worth confirming those views show an explicit empty state rather than a blank line once they're built. — found in 3
      (Three near-identical bullets were raised for this one finding; folded into this entry.)
      **Resolved in `shared.ts`, plus a binding line in the item 5/6 specs.** The finding is real
      and the `''` is correct, but the `?? ''` that produced it was copy-pasted into all four
      adapters, so the contract lived in four places and nowhere. It is now one function,
      `description(...candidates)` in `src/core/sources/adapters/shared.ts`, which every adapter
      calls — including NYT's abstract → snippet → lead_paragraph fallback, which used to be a
      hand-rolled `??` chain. `plainText` is no longer exported: `description()` is the only way
      a provider summary reaches an `Article`, so no fifth adapter can quietly invent its own
      default. The downstream half of the ask cannot be code today — items 5/6 have zero
      implementation — so it is written into their specs above (`articles.noDescription`
      placeholder, all three locales, `e2e/articles.spec.ts`), binding on those items rather
      than a note that ages out.
      Covered by: `describe('description()')` in `src/core/sources/adapters/adapters.test.ts`
      (absence, placeholders, markup that strips to nothing, candidate order, and all four
      adapters' own `normalize` on a description-less payload), and three specs in
      `e2e/sources.spec.ts` that replay the captured NewsAPI/NYT/BBC responses with the summary
      fields stripped and assert `''` through the real browser fetch + normalize path. Both
      were mutation-checked: relaxing the `?? ''` fails 8 unit tests and 3 e2e specs.
      Status: done. Branch: `feat/newsapi-guardian-nyt-bbc-descriptions-ca`.
- [x] (minor) NYT image() always takes the first multimedia crop, not the largest: image() for the legacy array multimedia form takes multimedia[0]?.url unconditionally. NYT's legacy multimedia arrays are ordered by crop name, not size, so index 0 isn't guaranteed to be the largest/best usable image (contrast bbc-rss.ts's thumbnail(), which explicitly picks the widest crop by width attribute). Low impact — still resolves to a usable URL — but it's an inconsistency in how the two adapters pick 'the best' image. Note: this applies only to the legacy array-shaped `multimedia`; the newer object shape already prefers `default` over `thumbnail`. (Raised twice, deduped to this bullet.) — found in 3
      **Resolved in `src/core/sources/adapters/nyt.ts`.** `image()`'s legacy-array branch now
      reduces over the crops picking the widest one that actually carries a `url` — the same
      shape as `bbc-rss.ts`'s `thumbnail()` — instead of `multimedia[0]?.url`. `NytImage` gained
      an optional `width`. The object-shaped branch (`default` → `thumbnail`) is untouched. On
      the captured fixture this moves doc 0 from `articleLarge` (600px) to
      `horizontalMediumAt2X` (2316px); ties keep the earlier crop, so the choice is stable.
      Covered by: two new cases in `src/core/sources/adapters/adapters.test.ts` (crops out of
      size order → widest wins; a wider crop with a null url is skipped), the existing
      CDN-resolution test now asserting against the widest crop, and
      `e2e/sources.spec.ts` "picks the widest legacy crop through the proxy hop", which replays
      the real capture through the browser and asserts the result is not index 0's URL.
      Status: done. Branch: `feat/nyt-image-always-takes-the-first-multime`.

## Loop log

One line per iteration, appended by the loop. Do not edit by hand.

iteration 1 — [1] App shell + design system — needs human review — static:pass review:pass e2e:blocked acceptance:pass
iteration 1 — [carry-forward-1] Unused nav locale keys (nav.feed / nav.menu.open / nav.menu.close) — done — static:pass review:pass e2e:pass acceptance:pass
iteration 1 — [2] Domain core: Article, NewsSource, aggregator — done — static:pass review:pass e2e:pass acceptance:pass
iteration 1 — [3] Four live adapters + two stubs — needs human review — static:pass review:pass e2e:pass acceptance:fail — requeued for another pass
iteration 3 — [3] Four live adapters + two stubs — done — static:pass review:pass e2e:pass acceptance:pass
iteration 2 — [carry-forward-2] NewsAPI/Guardian/NYT/BBC descriptions can legitimately render as empty strings downstream — needs human review — static:pass review:pass e2e:blocked acceptance:pass — requeued for another pass
iteration 4 — [carry-forward-1] NewsAPI/Guardian/NYT/BBC descriptions can legitimately render as empty strings downstream — done — static:pass review:pass e2e:pass acceptance:pass
iteration 5 — [carry-forward] NYT image() always takes the first multimedia crop, not the largest — done — static:pass review:pass e2e:pass acceptance:pass

---

# Item specs

### 1 — App shell + design system

Router, layout and the `App*` wrapper layer. Everything downstream depends on this.

- `src/routes/router.tsx` using `createBrowserRouter`; feature routes composed in via spread. `src/App.tsx` is the provider stack only: TanStack `QueryClientProvider` → `TooltipProvider` → `ToastProvider` → `RouterProvider`.
- `src/components/layout/{AppLayout,Header,Footer,Navigation,LanguageSelect,ThemeToggle}.tsx`. Header/main/footer use the `.app-shell` class already in `src/styles/base.css` (88rem max, `clamp(1rem,3vw,2rem)` inline padding) — those metrics are ported from the UAE blueprint deliberately, keep them.
- `src/components/common/design-system/` — `AppButton`, `AppInput`, `AppSelect`, `AppModal`, `AppCheckbox`, `AppToggle`, `AppTooltip`, `AppCard`, `AppIconButton`, plus `index.ts` barrel and a `README.md` stating the convention: features import `App*`, never Radix directly, so the primitives stay swappable. `AppButton` maps _our_ vocabulary (`primary | secondary | ghost | danger`) onto Radix/Tailwind — app variant names must not be library variant names.
- Dark mode: `dark` class on `<html>`, persisted to `localStorage` under `appTheme.storageKeys.theme`, **defaulting to `prefers-color-scheme`** when nothing is stored (the blueprint got this wrong — it hardcoded light).
- i18n: `src/i18n/index.ts` + `locales/{en,ar}.json`, language persisted, `lang`/`dir` set on `document.documentElement`. Logical CSS properties only.
- Port `src/hooks/useDebounce.ts` from the blueprint as-is.

Acceptance: app boots, both routes render inside the layout, language toggle flips to Arabic and RTL, theme toggle persists across reload and honours system default on first visit.

### 1b — Playwright e2e harness

Every later item owes a Playwright spec, so the harness has to exist first.

- `npm i -D @playwright/test` and `npx playwright install chromium`.
- `playwright.config.ts`: `testDir: 'e2e'`, `baseURL: 'http://localhost:3100'`, `webServer` that runs
  `npm run dev -- --port 3100 --strictPort` and reuses an already-running server locally, `reporter: 'list'`,
  and projects for the three viewports the responsive item cares about: 375×812, 768×1024, 1280×800.
- Script `"test:e2e": "playwright test"`. Add `playwright-report/` and `test-results/` to `.gitignore`
  (already done).
- `e2e/shell.spec.ts` covering item 1's acceptance criteria, since those were never verified by a
  spec: app boots and renders the layout; switching language to Arabic sets `dir="rtl"` on `<html>`
  and shows Arabic copy; the theme toggle flips `<html class="dark">`, writes `ina-theme`, and
  survives a reload; on a fresh context with no stored theme the app honours `prefers-color-scheme`.
- Do **not** put unit-test-shaped assertions here. Specs drive the UI as a user: navigate, click, type,
  assert what is on screen.

Acceptance: `npm run test:e2e` runs and passes with at least the shell spec, and fails loudly if the
dev server is not reachable rather than reporting a green empty run.

### 1c — German (de) locale

innoscripta is a Munich company, so German is the third language alongside English and Arabic.

- `src/i18n/locales/de.json` with **every** key present in `en.json` — no gaps, no English fallbacks
  left in place. Translate the UI chrome properly; do not machine-translate placeholders.
- Register `de` in `src/i18n/index.ts` resources, and add it to the `LanguageSelect` options.
- German is LTR — make sure the RTL handling keys off `ar` specifically and not "is not English".
  That assumption is easy to bake in when there are only two languages and breaks the moment a third
  LTR locale exists; check `document.documentElement.dir` is `ltr` for `de`.
- Add a `de` case to the shell spec from item 1b.
- From here on, **every** new key goes into all three locale files in the same commit.

Acceptance: switching to Deutsch translates the chrome, keeps `dir="ltr"`, and persists across
reload; the three locale files have identical key sets.

### 2 — Domain core: Article, NewsSource, aggregator

The architectural centrepiece. **Build this before any adapter.**

- `src/core/sources/types.ts`: canonical `Article` (`id, title, description, url, imageUrl?, publishedAt (ISO), sourceId, sourceLabel, author?, category?`), `ArticleQuery` (`q?, from?, to?, categories?, sources?, authors?, page, pageSize`), `SourceCapabilities` (`query, dateRange, category, author, pagination` — all boolean), and the `NewsSource` interface: `id, label, capabilities, available, unavailableReason?, fetch(query, signal), normalize(raw)`.
- `src/core/sources/registry.ts`: `SOURCES: NewsSource[]`. The only file that changes when a source is added.
- `src/core/sources/aggregator.ts`: fan out to selected available sources with **`Promise.allSettled`** (never `all` — one dead provider must not blank the feed), normalize each, then dedupe and merge-sort by `publishedAt` desc. Returns `{ articles, failures: {sourceId, reason}[] }` so the UI can show a partial-failure banner naming what failed.
- Dedupe by normalized URL first, then by normalized title — the same wire story appears across all four providers. Reuse `normalizeSearchText` (port the NFD + Arabic-normalization helper from the blueprint's `filterServices.ts`).
- **Capability degradation**: the aggregator applies any filter a source declares it cannot do, client-side after normalization. This is what keeps BBC (no query, no date, no pagination) honest without special-casing it anywhere.
- Unit tests: allSettled partial failure, dedupe across sources, merge-sort ordering, client-side degradation for a capability-poor source.

Acceptance: tests pass; no provider field name appears anywhere in this folder except inside an adapter.

### 3 — Four live adapters + two stubs

`src/core/sources/adapters/`. One file per provider; `normalize` is the only place its field names exist.

- `newsapi.ts` — `/api/newsapi/everything`. Caps at 100 results. Full capabilities.
- `guardian.ts` — `/api/guardian/search`, `show-fields=trailText,thumbnail,byline`. `page` + `page-size`.
- `nyt.ts` — `/api/nyt/articlesearch.json`. `docs[]` is the least similar shape of the four — budget the most effort here. Slow (~1–2s).
- `bbc-rss.ts` — `/api/bbc/news/rss.xml` and the per-category feeds. **XML**, parse with `DOMParser`. Declares `{query:false, dateRange:false, category:true, author:false, pagination:false}`; category is served by picking the right feed URL. Fields available: title, description, link, guid, pubDate, media:thumbnail. No author.
- `opennews.unavailable.ts` and `newscred.unavailable.ts` — registered with `available:false` and a `unavailableReason` explaining why (OpenNews is a journalism-tech nonprofit with no article API; NewsCred is now Optimizely CMP, enterprise-only). They must appear in the UI as disabled options, not be hidden.
  **Mapping correctness is the whole point of this item — test it properly.**

Capture one **real** response per provider (a single live call, saved verbatim) into
`src/core/sources/adapters/__fixtures__/<source>.json`. Fixtures, not live calls, in the test run —
free tiers are rate-limited and a test that hits the network is flaky by construction.

For each of the four live adapters, a test that asserts **every canonical field**:

- `title`, `description`, `url` are non-empty strings for every article in the fixture — no `undefined`
  leaking through where the provider clearly supplied a value, and no `"[Removed]"` placeholders
  (NewsAPI emits those) surviving into the feed.
- `publishedAt` is a valid ISO-8601 string for every article. Each provider formats dates
  differently — NYT `pub_date`, Guardian `webPublicationDate`, NewsAPI `publishedAt`, BBC RSS
  `pubDate` in RFC-822. All four must come out identical in shape and parse with `Date.parse`.
- `sourceId` and `sourceLabel` are set on every article and match the adapter that produced it.
- `imageUrl` is either a usable URL or `undefined` — never an empty string, never a placeholder path.
- `author` is populated where the provider supplies it (Guardian `byline`, NYT `byline.original`,
  NewsAPI `author`) and `undefined` for BBC, which has no author field. Assert both cases.
- `id` is stable and unique across a fixture — re-normalizing the same fixture twice yields the
  same ids, otherwise React keys and dedupe both break.
- A malformed/partial entry (missing `webUrl`, null `description`, absent thumbnail) is dropped or
  defaulted deliberately, not allowed to produce a half-built `Article`. Add a hand-mutated fixture
  case for this per adapter.

**The single-interface guarantee**: one test asserts that normalizing all four fixtures and merging
them yields a homogeneous array — every element has exactly the canonical `Article` keys, so nothing
downstream can tell which provider an article came from except by reading `sourceId`. That is the
property the whole adapter layer exists to provide, so it gets its own explicit test.

Acceptance: `registry.ts` lists six sources, four `available:true`; every adapter's mapping test
passes against a real captured fixture; the homogeneity test passes; adding a hypothetical seventh
source would touch exactly two files.

### 4 — nginx proxy + env wiring

Keys must never reach the bundle, in dev or in the container.

- `docker/nginx.conf.template` with a `location` block per source, `proxy_pass` upstream, key injected from env via `envsubst` at container start. Mirrors the dev proxies already in `vite.config.ts` so adapters call identical `/api/*` paths in both environments.
- `docker/entrypoint.sh` running `envsubst` then `nginx -g 'daemon off;'`.
- Document required vars in `.env.example` (already present).

Acceptance: `npm run build && grep -rE 'VITE_|NEWSAPI_KEY|GUARDIAN_KEY|NYT_KEY' dist/` returns nothing.

### 5 — Article list: search, filters, sort, pagination

`src/features/Articles/`. The brief's requirement #1.

- Four-layer hook stack, ported from the blueprint: `useArticlesDirectory` composes TanStack Query + `useArticlesState` (URL/localStorage query state) + `useArticleList` (pure derive) + `useArticleActions`.
- `useArticlesState`: resolution order **URL params → localStorage snapshot → defaults**; writes back to both on change with `{replace:true}`; **omits defaults from the URL** (no `page=1`, no empty `q`); allow-list validates every param against known values so junk is dropped, not trusted. Debounced search at `appTheme.debounceDelay` (300ms) — raw term drives the input, debounced term drives the query.
- Filters: keyword, date range (from/to), category, source, author. Sort: newest / oldest / relevance. Page size `appTheme.pageSize` (9) → 3-up desktop, 2-up tablet, 1-up mobile.
- Components: `ArticleCard`, `ArticleGrid`, `ArticlesToolbar`, `ArticlesFilters`, `SortSelect`, `FilterChips`.
- **The source label on the card is required, not decorative.** Every `ArticleCard` shows which
  provider the article came from — the readable `sourceLabel` ("The Guardian", "BBC News"), not the
  id — as a badge tinted with that source's `--color-source-*` token. With four newsrooms merged
  into one grid this is the only way a reader can tell origin at a glance, and it is the visible
  proof that the aggregation is real rather than a single feed. It must survive every filter, sort
  and page change, and be present in the a11y tree as text, not colour alone.
- **An empty `description` is a real case, not a defect.** All four adapters deliberately default a
  missing provider description to `''` (item 3: null Guardian `trailText`, null NYT
  `abstract`/`snippet`/`lead_paragraph`, absent BBC RSS `<description>`). `ArticleCard` must not
  render that as a blank gap — show a translated placeholder (`articles.noDescription`, in all three
  locales) in muted text, and keep the card's height stable so the grid does not go ragged. Same
  rule on the details page (item 6). Cover it in the unit tests and in `e2e/articles.spec.ts`.
- Port `Pagination.tsx` from the blueprint near-verbatim — it already has the `1 … 4 5 6 … 20` window, RTL-aware carets and full a11y.
- Partial-failure banner naming any source that failed this query.

**Filtering must be tested, not assumed.** Unit tests over a fixed multi-source article set:

- keyword matches title AND description, is case- and diacritic-insensitive, and returns nothing for
  a term present in neither;
- date range is inclusive of both bounds, and `from` later than `to` yields empty rather than throwing;
- source filter returns only the selected providers — assert with a mixed set that a deselected
  source genuinely disappears;
- category and author behave the same way;
- combined filters AND together, and clearing one restores exactly the articles it had removed;
- a source that declares `capabilities.query === false` still gets keyword-filtered client-side —
  this is the BBC case and the reason the capability system exists, so it needs its own test.

**Playwright spec** (`e2e/articles.spec.ts`), driving the real UI:

- type a keyword → the grid narrows and every visible card matches it;
- deselect a source → no card from that source remains anywhere in the grid;
- apply a filter, copy the URL, open it in a fresh context → the same filtered result renders;
- sort newest→oldest → the first card's date is not older than the last's;
- paginate → page 2 shows different articles, and the source badges are still rendered;
- block one provider's requests → the other three still render plus a banner naming the blocked one.

Acceptance: search+filter+sort+page all reflected in a shareable URL; reload restores state; every
card carries its source label; a blocked provider degrades to a banner, not an empty page; the unit
tests and the Playwright spec above both pass.

### 6 — Article details page

`/articles/:articleId`. Full text where the provider gives it, image, source badge, author, published date, link out to the original, bookmark toggle, back to the list **preserving the list's query state**.

Note the blueprint's mistake to avoid: its details page refetched the entire collection and re-flashed a skeleton. Read from the TanStack Query cache first, fetch only on a cold load.

An empty `description` renders as the `articles.noDescription` placeholder here too, same as the card in item 5 — never a blank line under the headline. See the item 5 bullet for why `''` is a legitimate value.

### 7 — Preferences (sources / categories / authors)

The brief's requirement #2, first half. `src/features/Preferences/`.

- Select preferred sources (the six from the registry, two shown disabled with their reason as a tooltip), categories, and authors.
- Persisted to `localStorage` under `appTheme.storageKeys.preferences`.
- Yup schema in `preferences.schema.ts` via a `createPreferencesSchema(t)` factory so messages are translation keys; validate with `{abortEarly:false}` and map `err.inner` to a field→message record.
- Modal form built on `AppModal`.

### 8 — Personalized feed

The brief's requirement #2, second half. `/feed`. Consumes preferences from item 7 and queries only the preferred sources/categories/authors. Empty state when no preferences are set yet, with a direct link to set them. Must reuse `ArticleGrid`/`ArticleCard` — a second card implementation is a review finding.

### 9 — Bookmarks + reading lists (CRUD)

Save an article; organise saved articles into named reading lists. Create / rename / delete a list, add / remove articles, `/bookmarks` route. Persisted to localStorage. Confirm dialog on destructive actions, toast on every mutation. This is the direct analogue of the blueprint's Favorites feature — port the hook shape.

### 10 — Saved search presets (CRUD)

Save the current filter set under a name; apply, rename, delete. This is where the blueprint's create/edit/delete/modal-form surface maps honestly — you cannot edit a remote news article, but you can fully CRUD a saved search. Applying a preset restores the full URL state from item 5.

### 11 — UI states + offline cache

- `SkeletonCard` shaped to `ArticleCard`, `EmptyState`, `ErrorState` with retry, `ToastProvider` + `toastContext`, `ConfirmDialog`. Port from the blueprint — all are domain-agnostic there.
- Cache the last successful feed to localStorage; on a failed cold load, render it with a clear "showing cached results from <time>" notice rather than an empty page.
- Apply `motion-*` classes from `src/styles/animations.css` (already ported, already has the `prefers-reduced-motion` block).

### 12 — Responsive pass

The brief's requirement #3. Every screen at 375 / 768 / 1280: no horizontal scroll (`scrollWidth <= clientWidth`), no truncated critical text, tap targets ≥ 44×44px, toolbars wrap, grids reflow, filter panel becomes a drawer on mobile. Desktop regression is a blocker. Covers **every** screen — list, details, preferences, feed, bookmarks, presets, and every modal — not just the list.

### 13 — Docker + CI

- Multi-stage `Dockerfile`: node build → nginx serve, using the config from item 4.
- `docker-compose.yml` mapping the port and passing the three key env vars.
- `.dockerignore`.
- `.github/workflows/ci.yml`: typecheck, lint, test, build, docker build.

Acceptance: `docker compose up --build` serves the working app; the key-leak grep from item 4 still returns nothing.

### 14 — README + SETUP

Split the way the blueprint does it: **README = what and why, no commands. SETUP = how to run, nothing but commands.**

README sections: What Was Built · Challenge Requirements Covered · Enhancements Added · Data Sources (including the honest table of the three unreachable ones and why) · Architecture And The Adapter Layer · Search, Filters, And URL State · UI States · Internationalization · Validation · Testing · Docker · Project Structure · Author.

SETUP sections: Requirements · Install · Development · Environment Variables · Build · Preview · Docker · Tests · Lint · Format · Available Scripts · Notes.

Acceptance: a fresh clone followed literally through SETUP.md produces a running app. If it doesn't, SETUP.md is wrong.

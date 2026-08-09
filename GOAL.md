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
| 4   | nginx proxy + env wiring                        | done        | feat/nginx-proxy-env-wiring                   |                                                                                                                                                                                                                             |
| 5   | Article list: search, filters, sort, pagination | done        | feat/article-list-search-filters-sort-paginat |                                                                                                                                                                                                                             |
| 6   | Article details page                            | done        | feat/article-details-page                     |                                                                                                                                                                                                                             |
| 7   | Preferences (sources / categories / authors)    | done        | feat/preferences-sources-categories-authors   |                                                                                                                                                                                                                             |
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
- [x] (minor) Author filter facet is limited to the current page's 9 articles: src/features/Articles/pages/ArticlesPage.tsx (authors useMemo) and src/features/Articles/components/ArticlesFilters.tsx: the author dropdown is built only from list.articles (the current fetched page), plus the already-selected author if any. With no dedicated authors endpoint, picking any author immediately collapses the dropdown to a near-single-entry list for that query, and other bylines that exist on later pages or under other filters are never discoverable. Not required by the item-5 acceptance criteria and not a regression, but worth a note for a future iteration (e.g. deriving authors from a wider sample, or documenting the limitation). — found in 5
      Status: done. Branch: `feat/author-filter-facet-is-limited-to-the-cu`.
- [x] (minor) Partial-failure banner uses role="status" (polite) rather than role="alert": src/features/Articles/pages/ArticlesPage.tsx PartialFailureBanner: a provider outage is arguably assertive/important information and could use role="alert" so screen reader users are interrupted rather than only informed on next idle. Current choice is defensible (it is not blocking the page) but inconsistent with how urgently the message reads; flag for a future a11y pass, not a defect in this item. — found in 5
      Status: done. Branch: `feat/partial-failure-banner-uses-role-status-`.
- [x] (minor) AppInput's dark-mode error tokens (danger-300) are undefined in theme.css: src/components/common/design-system/AppInput.tsx references dark:border-danger-300 and dark:text-danger-300, but src/styles/theme.css only defines --color-danger-700 and --color-danger-600 (no danger-300). This is pre-existing (AppInput.tsx is untouched by this diff) so it is out of scope for item 5, but the date-range AppInput fields added here (ArticlesFilters.tsx) would inherit an unstyled/undefined error state in dark mode if ever given an error prop. Carry-forward for whoever touches AppInput or theme.css next. — found in 5
      Status: done. Branch: `feat/appinput-s-dark-mode-error-tokens-danger`.
- [ ] (minor) Direct/shared links to /articles/:id can 404 a real article once it falls off the default first page: When there's no cached page for the id (cold load with no matching query params, e.g. a bare permalink or a bookmark opened later after the list's default sort/filter has moved the story off page 1), useArticleDetails fetches only the default/URL-derived first-page query and gives up if the id isn't in it — there's no per-id fetch capability in any adapter. This is an inherent constraint of the providers (documented in the code's own comments), not a regression in this diff, but it means a bookmarked article's permalink is not guaranteed to resolve later. Worth accounting for when item 9 (bookmarks/reading lists) builds on this: a saved article's link may need to carry enough query state to keep it reachable, or the missing-article state may need softer messaging for that path. — found in 6
      Status: done. Branch: `feat/direct-shared-links-to-articles-id-can-4`.
- [x] (minor) Guardian adapter never requests full body text, so the details page can never show "full text where the provider gives it": src/features/Articles/pages/ArticleDetailsPage.tsx renders `article.description` as "the whole text there is" (comment at line ~132-135), justified by a comment in src/features/Articles/utils/findCachedArticle.ts / ArticleDetailsPage claiming "Providers give a summary, never a body." That's not quite true: The Guardian Content API supports `show-fields=body` (full article HTML), but src/core/sources/adapters/guardian.ts only requests `show-fields: 'trailText,thumbnail,byline'` (line 65) and the shared `Article` type (src/core/sources/types.ts) has no field to carry it even if requested. This is pre-existing adapter/type code from item 3, untouched by this diff, so it's out of scope for item 6 — but it means the item 6 acceptance criterion "Full text where the provider gives it" is unmet for the one provider that could supply it. Fix belongs in the adapter layer (item 3) plus an `Article.content?` field, not in this diff. — found in 6
      Status: done. Branch: `feat/guardian-adapter-never-requests-full-bod`.
- [x] (minor) No test coverage for the details page's own cold-load fetch failure: e2e/article-details.spec.ts and the unit tests cover the cached path, the cold-load path, the missing-article path and the bookmark toggle, but nothing exercises useArticleDetails when the cold fetch itself fails (query.isError branch in src/features/Articles/pages/ArticleDetailsPage.tsx lines 70-89). The list page (ArticlesPage) has equivalent isError coverage from item 5; the details page's mirror-image error state currently ships untested. — found in 6
      Status: done. Branch: `feat/no-test-coverage-for-the-details-page-s-`.
- [x] (minor) Bookmark snapshot never refreshes once saved: src/features/Articles/utils/bookmarks.ts / useArticleDetails.ts: the snapshot captured at save time is permanent — there is no mechanism to refresh it against a later/corrected version of the same article when the list is cold and the story is no longer cache-resolvable. A reader can end up permanently viewing a stale copy of a bookmarked story with no staleness indicator. Likely an accepted tradeoff (permalink stability over freshness) but not called out anywhere in code comments or tests, and worth deciding explicitly when item 9 (reading lists) builds a real bookmarks store on top of this. — found in carry-forward-6
      Status: done. Branch: `feat/bookmark-snapshot-never-refreshes-once-s`.
- [x] (minor) Two independent localStorage reads of bookmarks (useArticleDetails.readBookmarks() and useBookmark's useState(readBookmarks)) are not synchronized in-session: useArticleDetails calls readBookmarks() directly inside a useMemo (deps [cached, articleId]) to resolve `known`, while useBookmark keeps its own separate readBookmarks()-seeded state and is the sole writer via writeBookmarks(). They never share state or react to each other's changes; it happens to work today only because the bookmark button is unmounted before `known` would need to reflect a fresh write. If a future caller reads the same list from two places within one page lifecycle (e.g. item 9's shared store) this split will surface as stale data. Worth collapsing to one source of truth when item 9 lands, per the file's own comments anticipating that work. — found in carry-forward-6
      Status: done. Branch: `feat/two-independent-localstorage-reads-of-bo`.
- [x] (minor) ArticlesPage's own isError branch has no unit coverage and may be unreachable via any provider-level mock: This diff's e2e comment and its new unit test both establish that aggregate() is allSettled-based, so no combination of 500s/aborts on provider routes can make the outer query promise reject — only a bug that throws before/outside the Promise.allSettled call (or a mocked fetchArticles) can. The backlog item's premise that ArticlesPage already has 'equivalent isError coverage from item 5' does not hold: there is no unit test file for ArticlesPage/useArticlesState exercising isError, and e2e/articles.spec.ts has no error-path test either — meaning that branch (src/features/Articles/pages/ArticlesPage.tsx isError block) is likely just as untested and just as hard to provoke as the details-page one was before this diff. Worth a follow-up item to add the same vi.mock-based unit test for ArticlesPage, or to confirm/document the branch is defensive-only dead code. — found in carry-forward-8
      Status: done. Branch: `feat/articlespage-s-own-iserror-branch-has-no`.
- [x] (minor) Preferences feature index.ts deviates from the stated feature-folder contract: patterns.md says "the feature's index.ts exports its routes and nothing else"; src/features/Preferences/index.ts exports PreferencesButton and usePreferences instead, since the feature has no route. This is the first non-route feature in the codebase, so the rule as literally written doesn't fit it, but nothing documents the exception at the rule level (only in the feature's own comment). Worth a one-line addendum to patterns.md once item 8 (which will import usePreferences) lands, so the exception isn't just tribal knowledge in one file. — found in 7
      Status: done. Branch: `feat/preferences-feature-index-ts-deviates-fr`.

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
iteration 6 — [4] nginx proxy + env wiring — done — static:pass review:pass e2e:pass acceptance:pass
iteration 7 — [5] Article list: search, filters, sort, pagination — done — static:pass review:pass e2e:pass acceptance:pass
iteration 8 — [carry-forward-3] Author filter facet is limited to the current page's 9 articles — done — static:pass review:pass e2e:pass acceptance:pass
iteration 1 — [carry-forward-4] Partial-failure banner uses role="status" (polite) rather than role="alert" — done — static:pass review:pass e2e:pass acceptance:pass
iteration 2 — [carry-forward-5] AppInput's dark-mode error tokens (danger-300) are undefined in theme.css — done — static:pass review:pass e2e:pass acceptance:pass
iteration 3 — [6] Article details page — done — static:pass review:pass e2e:pass acceptance:pass
iteration 4 — [carry-forward-6] Direct/shared links to /articles/:id can 404 a real article once it falls off the default first page — done — static:pass review:pass e2e:pass acceptance:pass
iteration 5 — [carry-forward-7] Guardian adapter never requests full body text, so the details page can never show "full text where the provider gives it" — done — static:pass review:pass e2e:pass acceptance:pass
iteration 6 — [carry-forward-8] No test coverage for the details page's own cold-load fetch failure — done — static:pass review:pass e2e:pass acceptance:pass
iteration 7 — [carry-forward-6 (bookmark snapshot refresh)] Bookmark snapshot never refreshes once saved — done — static:pass review:pass e2e:pass acceptance:pass
iteration 9 — [carry-forward-10] ArticlesPage's own isError branch has no unit coverage and may be unreachable via any provider-level mock — done — static:pass review:pass e2e:pass acceptance:pass
iteration 10 — [carry-forward-9] Two independent localStorage reads of bookmarks are not synchronized in-session — done — static:pass review:pass e2e:pass acceptance:pass
iteration 11 — [7] Preferences (sources / categories / authors) — done — static:pass review:pass e2e:pass acceptance:pass
iteration 12 — [carry-forward-11] Preferences feature index.ts deviates from the stated feature-folder contract — done — static:pass review:pass e2e:pass acceptance:pass

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

This item ships the nginx config and the rendering script, not a runnable container: the
`Dockerfile` that copies `dist/` into an nginx image and wires `entrypoint.sh` as its `ENTRYPOINT`
belongs to item 13, which consumes these two files. Until item 13 lands, "in the container" is a
contract these files satisfy rather than an image you can run — `entrypoint.sh render-only` is what
exercises them here.

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

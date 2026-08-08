---
paths:
  - 'src/**/*.{ts,tsx}'
---

# Project patterns — the musts

- **Feature folders.** `src/features/<Feature>/{components,hooks,services,utils,types,pages,routes.tsx,index.ts}`. The feature's `index.ts` exports its routes and nothing else; `src/routes/router.tsx` spreads them.
- **Hook layering.** `use<X>Directory` composes four hooks, each with one job: TanStack Query (fetch) + `use<X>State` (URL/localStorage query state) + `use<X>List` (pure filter → sort → paginate) + `use<X>Actions` (mutations, busy flags, toasts). Do not merge them.
- **Sources are adapters.** Anything that knows a provider's field names lives in `src/core/sources/adapters/`. Features import `Article` and the aggregator — never a provider shape. Adding a source = one adapter file + one line in `registry.ts`.
- **Never call a provider directly from a component.** All traffic goes through `/api/<source>/*` so the key stays in the Vite proxy (dev) or nginx (prod). A `VITE_*` key in client code is a blocker.
- **UI comes from `src/components/common/design-system/` (`App*`).** Those wrap Radix + Tailwind. Features use `App*`, never Radix directly, so the primitives stay swappable.
- **Tokens, not hex.** Colours come from `src/styles/theme.css` `@theme` vars (`text-ink-700`, `bg-paper-50`, `text-accent-600`). No raw hex in components.
- **Tailwind v4, CSS-first.** No `tailwind.config.js` — it is dead in v4 and its presence misleads. Dark mode is the `dark:` variant, never a `[data-theme]` descendant override.
- **i18n flat keys in ALL THREE locales — `en.json`, `ar.json`, `de.json`.** A key in one and not the others is a bug. RTL uses logical properties (`ps-*`/`pe-*`/`ms-*`/`me-*`), never `left`/`right`. Gate RTL on `ar` specifically, never on "not English" — German is LTR.
- **Tests ship with the feature.** Unit tests for pure logic, a Playwright spec under `e2e/` for user-visible behaviour. A suite that runs zero specs is a failure, not a pass.
- **Yup schemas in their own `*.schema.ts` file**, built by a `create*Schema(t)` factory so messages are translation keys. Validate with `{ abortEarly: false }` and map `err.inner` to a field→message record.
- **Path alias `@/`.** No `../../../` imports.
- **Gates:** `npm run typecheck && npm run lint && npm run test` must pass before anything is called done.

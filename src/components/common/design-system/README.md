# Design system (`App*`)

**Features import `App*` from this folder. Features never import Radix, and never re-style a
Radix primitive in place.** That is the whole rule. It exists so a primitive can be swapped —
Radix for Headless UI, or Radix for a hand-rolled element — by editing one file here instead of
every call site.

## The primitives

| Component       | Built on                         |
| --------------- | -------------------------------- |
| `AppButton`     | `<button>` + Tailwind            |
| `AppIconButton` | `<button>` + Tailwind            |
| `AppInput`      | `<input>` + Tailwind             |
| `AppCard`       | `<div>`/`<article>` + Tailwind   |
| `AppSelect`     | `@radix-ui/react-select`         |
| `AppModal`      | `@radix-ui/react-dialog`         |
| `AppCheckbox`   | `@radix-ui/react-checkbox`       |
| `AppTooltip`    | `@radix-ui/react-tooltip`        |
| `ToastProvider` | `<div role="status">` + Tailwind |

`TooltipProvider` is re-exported here too, so `App.tsx` mounts it without importing Radix either.

`ToastProvider` owns the app's single live region; features announce a mutation with `useToast()`
(from `toastContext.ts`) rather than rolling their own `role="status"` paragraph.

## Conventions

- **App vocabulary, not library vocabulary.** `AppButton` takes `primary | secondary | ghost |
danger`. Those names are ours. If a future library calls its variants `solid`/`subtle`, the
  mapping changes inside `AppButton.tsx` and nothing else moves.
- **Tokens, not hex.** Colours come from `src/styles/theme.css` (`ink-*`, `paper-*`, `accent-*`).
- **Logical properties for direction-sensitive spacing** (`ps-*`/`pe-*`/`ms-*`/`me-*`), so RTL is
  free.
- **Tap targets ≥ 44px** — `min-h-11` on interactive primitives, `size-11` on icon buttons.
- Every primitive forwards `className` last so a call site can extend without a wrapper div.

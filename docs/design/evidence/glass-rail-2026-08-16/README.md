# Glass nav rail — founder visual gate evidence (2026-08-16)

Chrome: the v4 floating glass nav rail (EC-10/EC-20 **amendment A-4**), on the
founder's 2026-08-16 directive *"build the glass rail"*.

**Creative owner:** the VitalCV UI/UX developer lane for this PR (one owner, one
public surface). No other lane held the chrome files while this was built.

Everything here was captured from a **local production build** (`next build` →
`next start -p 3077`, `PUBLIC_HOME_VARIANT=easy`, ephemeral `RECEIPT_PRIVATE_KEY_JWK`
so `/trust` and `/status` render their real paths) on top of amendment F
(`3885e7fb3`) — so the before/after pair differs **only** in the chrome, not the
page under it.

Regenerate with `node apps/web/scripts/glass-rail-evidence.mjs` against such a server.

## Before / after (same v4 homepage, chrome swapped)

| | Before — A-2/A-3 eyebrow | After — the glass rail |
|---|---|---|
| 1440 | `before-1440-rest.png` | `after-1440-rest.png` |
| 768 | `before-768-rest.png` | `after-768-rest.png` |
| 390 | `before-390-rest.png` | `after-390-rest.png` |
| longest action (`/verify`) | `before-1440-verify-longest-action.png` | `after-1440-verify-longest-action.png` |

## The rail

- `after-1440-rest.png` / `after-1440-scrolled.png` — at rest and scrolled. The bar
  does not move; content passes beneath the glass.
- `after-1728-rest.png` — above the 1400 cap: the bar stops growing and centres.
- `after-1440-employers.png` — off-home, action suppressed on its own destination.
- `after-1024-verify-longest-action.png` / `after-390-verify-longest-action.png` —
  the longest contextual action ("Request organization access") inside the bar.

## Over the dark mega-menu

- `after-1440-menu-open.png` — the rail stays live over the ink takeover, inverted
  to paper instruments, glyph morphed ≡ → ×, with the visible ✕ CLOSE (audit #56).
- `after-1440-menu-focus-trap.png` — focus trapped inside the header while open.
- `after-390-menu-open.png` — the takeover on mobile.

## Accessibility

- `after-1440-focus-*.png` — focus-visible ring on **every** rail control:
  wordmark, nav link, sign-in, verify, action, menu.
- `after-1440-reduced-motion.png` — reduced-motion composition.
- `after-720-zoom200-reflow.png` — 200% zoom reflow; measured **0px** horizontal
  overflow.
- `contrast.json` — WCAG ratios computed from **real painted pixels** (screenshots
  decoded and sampled), not `getComputedStyle`, so the frost's actual composite is
  what is measured. Minimum measured pair: **6.07:1**.

## Recordings (open → focus trap → Escape close)

- `menu-open-close-desktop.webm`
- `menu-open-close-mobile.webm`
- `menu-open-close-reduced-motion.webm`

## What is NOT recorded here

No founder visual decision. This set exists so one can be made; the rendered rail
still owes a `FOUNDER VISUAL DECISION` on its PR per `docs/ops/FOUNDER_VISUAL_GATE.md`.

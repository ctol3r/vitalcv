# COMPETE-2 spike — verification evidence

**Captured:** 2026-07-21 · **Route:** `/dev/compete-film` (dev-gated, `noindex`)
**Branch:** `wave/compete-0-mandate` off `origin/main@47d94070a`
**Contract:** [`homepage-composition-ownership.md`](./homepage-composition-ownership.md) §3 (fallback ladder)

Measurements below come from a Playwright capture pass against the dev server
plus a raw `curl` of the server HTML. Every value is observed, not asserted.

## Fallback ladder — measured

| Tier | Condition | `data-film-mode` | `data-film-tier` | Canvas | Poster rects | Result |
| --- | --- | --- | --- | --- | --- | --- |
| 1 Film | 1440×900, fine pointer | `film` | `webgpu` | yes | 65 | Horizontal travel |
| 2 Canvas 2D | `?sceneTier=canvas2d` | `film` | `canvas2d` | yes | 65 | Identical composition |
| 3 Static | `?sceneTier=static` | `vertical` | `static` | **no** | 65 | Poster only, no loop |
| 4 Vertical | 390×844, touch | `vertical` | `webgpu` | yes | 65 | Ordinary document |
| 5 Reduced motion | `reducedMotion: reduce` | `vertical` | `static` | **no** | 65 | Still |
| 6 No JS | raw `curl` | `vertical` | — | **no** | 65 | Fully readable |

## Film travel — desktop 1440×900

Track transform, sampled across the runway (2700 px = 300 vh):

| Progress | 0 | 25% | 50% | 75% | 100% |
| --- | --- | --- | --- | --- | --- |
| `translateX` | 0 | −354 px | −714 px | −1074 px | −1434 px |

Monotonic and leftward, ending at one full viewport of travel for the
two-scene film. Pinned via `position: sticky` inside a tall spacer, so the
browser keeps ownership of scrolling.

**Axis not hijacked (measured):** after reaching the end of the film, a further
`mouse.wheel(0, 400)` increases `window.scrollY`. The page keeps scrolling
normally; nothing traps the user.

## No-JS — raw server HTML (`curl`, no browser)

```
mode: vertical            scenesInOrder: [arrival, recognition]
posterRects: 65           hasCanvas: false
trackHasInlineTransform: false
"Get hired faster."  ✓    "Your record is already out there."  ✓
NPI label ✓               "does not look anything up" disclosure ✓
```

The film is a transform applied to a linear document, never a different
document. With no JS the composition is complete and readable.

## Accessibility

- **First tab stop is `#film-npi-input`** — the scene's only primary action.
- Focus ring measured: `outline-width: 2px`, `outline-style: solid`.
- Kinetic type keeps the full phrase as one `sr-only` text node; the animated
  word spans are `aria-hidden`, so the sentence survives the treatment.
- Each scene is a labelled region (`aria-label`), which a screen reader needs
  to navigate a pinned composition. Scene names never render as visible headers.

## Truth checks

- `pnpm check:claims` → **PASS** (23 phrases checked).
- No percentage, counter, `Dr.`, `MD`, or `RN` in visible text.
- No `Find the opportunity` / `VitalCV recognizes` (R7).
- NPI field reports only `n/10 digits` or `Checksum looks right.` — it performs
  no lookup, and says so on the surface.

## No-graph discipline (R1)

- No `line`, `path`, `lineTo`, `moveTo`, or `stroke` in the atmosphere — guarded
  by a source-level test that fails if any is introduced.
- No `[draggable="true"]`; no "drag to" or "constellation" in visible text.
- Fragments never connect to each other; the one radial core is unlabeled,
  uncounted, and connected to nothing.

## Honest gaps

- **WebGPU is NOT verified.** The probe reports `navigator.gpu` present but
  `requestAdapter()` returns null in headless Chromium — there is no GPU
  adapter on this runner. `resolveTier` returns `'webgpu'` merely because the
  API exists, and `EvidenceAtmosphere` has no WebGPU path, so that tier
  currently renders via Canvas 2D. That fallthrough is deliberate and is what
  the capture actually exercised. **A real WebGPU renderer, and proof it draws
  non-zero pixels, is COMPETE-2 production work** — see
  [[webgpu_hero_field_blank_in_prod]] for why "it shipped" is not "it drew".
- Only 2 of the 6 scenes exist. The dispatch asked for one transition; the
  remaining four are COMPETE-1.
- `FeedbackButton` and `VCommandBar` still render (they are on every ops-surface
  route). The promo rail, navbar, and footer are suppressed.

## Bugs found and fixed during verification

| Bug | Cause | Fix |
| --- | --- | --- |
| Film mode could never activate | The runway only became 300 vh in film mode, but film mode was gated on `pinned`, which required the tall runway — circular | Layout follows `eligible` (a pure device question); `pinned` describes state and never gates layout |
| Headline rendered `Gethiredfaster.` | `display: inline-block` collapses each word span's trailing space | `white-space: pre-wrap` on the word span |
| Copy blanked entirely | A `z-index: -1` scrim pseudo-element inside `.film-track`, which `will-change: transform` makes a stacking context, painted behind the whole scene | Scrim moved to the element's own background in normal paint order |
| Scrim read as a card edge | Flat rectangle of paper over the field | Gradient fading on both sides, bleeding off the left viewport edge |

## Test coverage added

- `apps/web/__tests__/compete-film-spike.test.tsx` — 26 tests: model determinism, fragment bounds, no-graph source guard, single-listener/single-rAF guard, no-hijack guard, scene spans, copy ceiling, SSR linear fallback, truth contract, style isolation.
- `apps/web/tests/e2e/compete-film.spec.ts` — 10 tests: film travel monotonicity, axis not hijacked, mobile vertical + no overflow, reduced motion, static tier, canvas2d tier, keyboard, no fabricated state, no graph.
- `apps/web/__tests__/page-density-system.test.tsx` — route-count tripwire 138 → 139.

Full suite at time of writing: **2,939 passed, 0 failed** (326 files, 1 skipped).
`pnpm turbo run build --filter @vitalcv/web` → clean; `/dev/compete-film` = 4.33 kB.

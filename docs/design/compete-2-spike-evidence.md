# COMPETE-1 / COMPETE-2 film — verification evidence

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

Six scenes → a 600 vh runway (5,400 px) with 4,500 px of travel. At each of the
six scene boundaries the active scene's measured `left` is **exactly 0** and its
width is **exactly 1440** — one viewport of travel per transition, no drift:

| Boundary | arrival | recognition | momentum | opportunity | start | choice |
| --- | --- | --- | --- | --- | --- | --- |
| scene `left` | 0 | 0 | 0 | 0 | 0 | 0 |
| overflow below stage | −229 px | −278 px | −289 px | −124 px | −124 px | −282 px |

Negative overflow = content ends *above* the stage bottom. A pinned stage cannot
scroll, so anything below the fold would be lost; both facts are now pinned by
e2e tests.

Pinned via `position: sticky` inside a tall spacer, so the browser keeps
ownership of scrolling.

**Axis not hijacked (measured):** an ordinary `mouse.wheel(0, 400)` moves the
document, `mouse.wheel(0, -400)` reverses it, and `scrollY` reaches the document
maximum at the end of the film. Nothing captures or traps the wheel.

## No-JS — raw server HTML (`curl`, no browser)

```
mode: vertical
scenes: [arrival, recognition, momentum, opportunity, start, choice]
posterRects: 65        hasCanvas: false      trackInlineTransform: false
all six scene phrases present        ✓
TruthBoundary ("not a completed credentialing…")  ✓
ProofPacketInspector ("Proof packet…")            ✓
no 01–06 step numbers anywhere                    ✓
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
- No `01`–`06` step numbering anywhere in the rendered document (R4).
- Before submit, Recognition renders the standing disclosure — *"Nothing
  personal is shown until a real lookup returns"* — and no result surface
  exists in the DOM at all.
- The NPI field validates locally (checksum) and **enables submit only for a
  valid NPI**; a full-length number failing the CMS check digit stays disabled.
- **Lookup failure is honest.** With no reachable registry locally,
  `LiveNpiResult` renders *"We couldn't reach the registry — this is a system
  state, not a finding about NPI …"* rather than an empty or implied-negative
  result.

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
- **`/` is not switched.** The six-scene film is production code, but it is
  mounted only at the dev-gated preview route. Flipping `apps/web/app/page.tsx`
  to render `HorizontalCareerFilm` is a one-line change held for founder review:
  COMPETE-1's own acceptance test ("at 1440px the page *feels* like a
  continuous left-to-right environment") is a judgement call, and today's `/`
  carries working product surfaces that a premature swap would regress.
- The Choice scene leaves the right half of the frame empty. "CTAs only" is what
  the mandate specifies, so this is a composition weakness rather than a
  contract violation — worth a design pass before `/` switches.
- `SourceCoverageRibbon` and the `CareerEvidenceField` hero panel are not yet
  recomposed into the film; the atmosphere currently stands in for both.
- `FeedbackButton` and `VCommandBar` still render (they are on every ops-surface
  route). The promo rail, navbar, and footer are suppressed.

## Bugs found and fixed during verification

| Bug | Cause | Fix |
| --- | --- | --- |
| Film mode could never activate | The runway only became 300 vh in film mode, but film mode was gated on `pinned`, which required the tall runway — circular | Layout follows `eligible` (a pure device question); `pinned` describes state and never gates layout |
| Headline rendered `Gethiredfaster.` | `display: inline-block` collapses each word span's trailing space | `white-space: pre-wrap` on the word span |
| Copy blanked entirely | A `z-index: -1` scrim pseudo-element inside `.film-track`, which `will-change: transform` makes a stacking context, painted behind the whole scene | Scrim moved to the element's own background in normal paint order |
| Scrim read as a card edge | Flat rectangle of paper over the field | Gradient fading on both sides, bleeding off the left viewport edge |
| Atmosphere painted **over** the copy | `.film-atmosphere-canvas` has `z-index: 1`; `.film-track` is a stacking context via `will-change: transform` but sat at `z-index: auto` (level 0), so fragments drew across the headline | `.film-track` given `position: relative; z-index: 3`. **Now guarded** by an `elementFromPoint` hit test — 38 prior tests missed it because the DOM reports the text as visible |
| Two competing headlines in the Start scene | `HomeProofMoment` is a page SECTION: it brings a numbered eyebrow ("04 Why this is credible" — R4 + R6) and its own display H2 | Mount `ProofPacketInspector` (the artifact) instead of its section wrapper. Same reason `DualAudienceCta` (a two-card grid, R3, linking to a non-existent `/#npi`) was replaced with plain in-scene CTAs |
| Scenes appeared ~74px misaligned | The app sets `html { scroll-behavior: smooth }`, so the capture sampled a frame mid-animation | Measurement bug, not a product bug — `behavior: 'instant'` in the harness and the e2e `scrubTo`. Every scene lands at exactly `left: 0` |

## Test coverage added

- `apps/web/__tests__/compete-film-spike.test.tsx` — 26 tests: model determinism, fragment bounds, no-graph source guard, single-listener/single-rAF guard, no-hijack guard, scene spans, copy ceiling, SSR linear fallback, truth contract, style isolation.
- `apps/web/tests/e2e/compete-film.spec.ts` — 13 tests: film travel monotonicity, **exact scene alignment at every boundary**, **no scene overflows the stage**, **the atmosphere never paints over the copy** (`elementFromPoint`), axis not hijacked in both directions, mobile vertical + no horizontal overflow, reduced motion, static tier, canvas2d tier, keyboard, no fabricated state, NPI validation, no graph.
- `apps/web/__tests__/page-density-system.test.tsx` — route-count tripwire 138 → 139.

Full suite at time of writing: **2,939 passed, 0 failed** (326 files, 1 skipped).
`pnpm turbo run build --filter @vitalcv/web` → clean; `/dev/compete-film` = 5.15 kB
(238 kB first load, which carries the real proof inspector and NPI result).

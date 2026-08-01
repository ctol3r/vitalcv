# Home Evidence Experience v2 — implementation contract

**Status:** locked at Wave 0.
**Baseline commit:** `8ea5e6c6f7422be5221ab7ab1ec2b4d52a3a0003` (`feat(home): add cinematic evidence journey (#988)`), which is `origin/main` HEAD at the time of writing.
**Program branch series:** `feat/home-evidence-v2-foundation` → `-input` → `-live-result` → `-journey` → `chore/home-evidence-v2-release`.

This document freezes *who owns what* before any production UI changes. It is the
reference the later waves are measured against; where this document and a wave
prompt disagree, this document is the record of what was actually true in the
codebase on the baseline commit.

---

## 1. Product sequence

The homepage is **an act, followed by one operable explanation**. It is not a
feature tour.

1. **Act** — a clinician enters a 10-digit NPI in the hero and submits.
2. **Resolve** — the hero resolves the lookup *in place* (no route change),
   narrating which sources are being read.
3. **Evidence** — the result names what each source returned, what needs
   attention, what is gated behind access the platform does not have, and one
   next-best action.
4. **Explain** — a reader who does not type gets the same argument as four
   moments: NPI → source responses → permission → human review.
5. **Bound** — `TruthBoundary` states the limit of the whole page.

## 2. Component ownership

One owner per behavior. Nothing in this program may create a second
implementation of a row in this table.

| Behavior | Owner | Notes |
| --- | --- | --- |
| Page composition, metadata, JSON-LD | `apps/web/app/page.tsx` | Mounts exactly `CinematicEvidenceField` + `AskHome`. `revalidate = 300`. |
| NPI action, validation, submit, storage, analytics | `components/home/ask/AskHome.tsx` | Owns `raw`/`submitted`/`error` state and the `sessionStorage`/`localStorage` writes. |
| NPI validation rules | `lib/vital/npi.ts` (`checkNpi`, `npiDigits`, `isValidNpiChecksum`) | CMS `80840` + Luhn check digit. **The only** validator. |
| Live lookup + result rendering | `components/home/LiveNpiResult.tsx` | Owns both fetches and all result presentation. |
| Resolving narration | `components/readiness/sourceCheckNarration.tsx` (`CHECK_SEQUENCE`, `SourceCheckNarration`, `useSourceCheckSequence`) | Shared with other readiness surfaces. |
| Registry-identity guard | `registryIdentity()` in `LiveNpiResult.tsx` | Exported for test. Blocks self-entered names under registry framing. |
| Source lane truth (lifecycle, cadence, labels) | `lib/trust/sourceLanes.ts` (`SOURCE_LANE_OPS`) | **Single source of lane truth.** Never re-typed. |
| Four-moment journey shell | `components/home/spine/SpineTabs.tsx` | Progressive-enhancement tabs, WAI-ARIA pattern. |
| Journey content | `HomeSpine()` inside `AskHome.tsx` | Supplies the four `SpineStep`s. |
| Decorative atmosphere | `components/home/cinematic/CinematicEvidenceField.tsx` | `aria-hidden`, no live data, no personal data. |
| Page-level truth limit | `components/home/TruthBoundary.tsx` | Must remain mounted and reachable. |
| Shared NPI control (other routes) | `components/vital/NpiInput.tsx` | **Not** used by the homepage today — see §11. |

### Existing primitives found during Wave 0 recon

- **`components/vital/NpiInput.tsx` already exists** — a ten-cell shared NPI
  control used by onboarding/lookup surfaces. The homepage deliberately does
  **not** use it: `AskHome` renders its own single `<input class="ask-input">`.
  Wave 2 must not fork a third NPI control; see §11 for the ruling.
- **There is no `components/Icon.tsx`.** `check-design-lint.ts` LINT-02 exempts
  that path, but the file does not exist on the baseline commit. The available
  icon abstraction is **`components/vital/TrustGlyph.tsx`**, which maps an
  `EvidenceState` to a glyph and *always* renders a label (never icon-only).
- **There is no generic `FormError` primitive.** `NpiInput` inlines a
  `role="alert"` span; `AskHome` inlines an `.ask-error` span inside an
  `aria-live="polite"` paragraph.
- **There is no floating-label primitive.** `AskHome` uses a real, visible
  `<label>` (`Step 1 · Start with your NPI`) plus a dot placeholder.

## 3. Source-truth boundaries

These are hard invariants, enforced by `pnpm check:claims`, `pnpm check:design`
and the homepage test suite.

- No status label may be the bare word **Verified**. `check-public-claims.ts`
  detects both `>Verified<` (JSX text) and `'Verified'` (quoted literal).
- 23 prohibited phrases are enforced verbatim, including `automatically
  verified`, `guaranteed verification`, `complete credentialing`, `legally
  accepted`, `HIPAA compliant`, `all 50 states`. Negation immediately before a
  phrase is allowed (`does not complete credentialing`).
- **Cadence, never a blanket "live".** `sourceLanes.ts` separates `lifecycle`
  (does the lane return real data) from `readCadence` (how fresh it is). NPPES
  is `per_request` / "read live"; OIG is `monthly_snapshot`; PECOS is
  `quarterly_snapshot`; state licensure is `not_read`.
- The identity header may render **only** registry-derived values. A payload
  without `identitySource` *and* with `alreadyRegistered: true` is the legacy
  shape and must fall back to the neutral header.
- Decorative artifacts must not use live-result vocabulary. The cinematic field
  is asserted to contain none of: `verified`, `available`, `source-backed`,
  `clear result`, `live result`, `ready score`.
- Illustrative drawings carry a visible `Illustrative — not a live result` note
  via `SpineStep.illustrative`.
- No fabricated readiness score, percentage, clinician name, or timestamp.
  `homepage-truth-contract.test.tsx` asserts the absence of a readiness score.

## 4. Semantic surface tones

New in Wave 1. A **scoped** tone contract, not a global theme.

Tones: `paper` · `mist` · `trust` · `ink`, applied via `data-home-tone`.
Each tone defines `--home-surface`, `--home-surface-raised`, `--home-text`,
`--home-text-muted`, `--home-border`, `--home-accent`, `--home-focus`,
`--home-error`. **Every value resolves through an existing `--vt-*` token** —
no new raw palette.

Underlying tokens available on the baseline commit (from `styles/themes/index.css`):

| Concept | Token | Light value |
| --- | --- | --- |
| paper | `--vt-bg` | `#F0EEE9` |
| raised paper | `--vt-surface` | `#F7F5F1` |
| subtle fill | `--vt-surface-subtle` | `#EFECE6` |
| dim fill | `--vt-surface-dim` | `#E7E4DD` |
| border | `--vt-border` | `#D6D2C8` |
| subtle border | `--vt-border-subtle` | `#E3DFD6` |
| ink | `--vt-text-primary` | `#1A1815` |
| secondary ink | `--vt-text-secondary` | `#57534A` |
| muted ink | `--vt-text-muted` | `#676257` |
| editorial accent | `--vt-accent-editorial` | `#4338CA` |
| focus | `--vt-focus-ring` | `#4338CA` |
| source returned a match | `--vt-state-source-confirmed` | `#047857` |
| needs attention | `--vt-state-pending` | `#92400E` |
| access required | `--vt-state-access` | `#4338CA` |
| blocked | `--vt-state-blocked` | `#B91C1C` |

**CD-3/4 constraint:** ink/paper/rule tokens must be warm (hue 30–110) and the
accent must be indigo (hue 255–310) and never a state hue. `check-design-lint`
rule `CD-3/4` enforces this numerically on `apps/web/styles/**`.

## 5. Motion ownership

- `@keyframes` live in **`apps/web/styles/motion.css` only** (LINT-03).
  Baseline contents: `film-record-settle`, `ask-art-appear`, `ask-art-draw`,
  `ask-art-trace`, `ask-art-glass-in`.
- Baseline homepage motion audit:
  - `ask-home.css` — 0 animations, 3 transitions, 1 reduced-motion guard.
  - `cinematic-home.css` — 3 animations (all inside
    `@media (prefers-reduced-motion: no-preference)`), 4 transitions, both guards.
  - `spine-tabs.css` — 1 animation inside a `no-preference` guard.
  - **Zero `infinite` animations. Zero `scroll-snap-type`.**
- Motion is *enhancement only*: the static markup is the final composition.
  `ask-home-diagrams.test.tsx` asserts no play class exists before JS runs, and
  that the stylesheet animates only under `prefers-reduced-motion: no-preference`.
- `AskHome` owns exactly one `IntersectionObserver`, which adds `.ask-art-play`
  once per figure and then `unobserve`s it. There is no page-level scroll or
  wheel listener; `check-design-lint` rule R8 forbids adding one to `page.tsx`.
- **Product easing:** this program introduces one home-scoped easing token
  `--home-ease-product: cubic-bezier(0.2, 0, 0, 1)`. It does **not** redefine
  `--vt-ease-system` (`cubic-bezier(0.2, 0.8, 0.2, 1)`), which governs the rest
  of the application.

## 6. Responsive behavior

Design widths: **<360 · 390 · 768 · 1080 · 1440+**.

- Narrow: ordinary vertical flow. Input and result stay fully operable.
  Decorative source labels may simplify. No overflow, no fixed-height clipping.
- `SpineTabs` degrades to a stacked composition whenever `data-enhanced` is
  absent; that is also the server render.
- Input font-size stays **≥16px** so iOS Safari does not zoom on focus.

## 7. State model

**Input states** (Wave 2, exposed as `data-evidence-input-state` /
`data-evidence-input-validity`): `idle` · `focused-empty` · `editing` ·
`valid` · `invalid` · `submitting` · `disabled`.

**Result states** (owned by `LiveNpiResult`, never by the input):
`resolving` · `resolved` · `system-error`.

**Hero phase** (Wave 4, `data-home-phase` on the AskHome root):
`idle` · `active` · `resolving` · `resolved` · `system-error`.

## 8. No-JS behavior

- All content is server-rendered and visible. There is no page-level
  `opacity: 0` trap, no font-load gate, no full-screen loader.
- `SpineTabs` renders all four panels stacked, each under its own heading, and
  hides the tablist by CSS (a tab list nothing can drive is a lie).
- The NPI form renders with a real `<label>`; without JS the submit does not
  resolve in place, but the page remains readable and every link works.

## 9. Reduced-motion behavior

Every motion path has a static equivalent. Reduced motion resolves to the final
state immediately — it never hides content and never changes meaning or order.
`cinematic-home.css` already ships `animation: none !important` under
`@media (prefers-reduced-motion: reduce)`.

## 10. Planned files

Created by this program:

| File | Wave | Purpose |
| --- | --- | --- |
| `docs/design/home-evidence-experience-v2.md` | 0 | This contract. |
| `docs/design/home-evidence-v2-acceptance.md` | 0 | Acceptance checklist. |
| `apps/web/styles/home-surfaces.css` | 1 | Tone contract + product motion tokens. |
| `apps/web/__tests__/home-evidence-foundation.test.ts` | 1 | Foundation guards. |
| `apps/web/components/home/ask/EvidenceInput.tsx` | 2 | Stateful evidence input. |
| `apps/web/components/home/ask/evidenceInputState.ts` | 2 | Input state derivation. |
| `apps/web/styles/evidence-input.css` | 2 | Capsule proportions. |
| `apps/web/components/home/evidence/EvidenceCapsule.tsx` | 3 | Resolved result. |
| `apps/web/styles/evidence-capsule.css` | 3 | Capsule styling. |

Modified: `page.tsx`, `AskHome.tsx`, `LiveNpiResult.tsx`,
`CinematicEvidenceField.tsx`, `ask-home.css`, `cinematic-home.css`,
`spine-tabs.css`, `motion.css`.

## 11. Rulings taken at Wave 0

**R0-1 — Do not reuse `components/vital/NpiInput.tsx` on the homepage.**
It renders ten decorative cells behind a transparent input with
`caret-transparent` and `text-transparent`. That is a different product object
from the hero field this program specifies (persistent floating label, visible
digits, stable typography, capsule proportions). Reusing it would force a
breaking change on onboarding, employer setup, public lookup, reviewer request
and search — all of which are out of scope. The homepage keeps its own
presentation, and **`EvidenceInput` extracts the presentation only**: validation
stays in `lib/vital/npi.ts`, which both controls already share. This is the
"do not duplicate validation logic" rule honoured at the layer that matters.

**R0-2 — Icon governance uses `TrustGlyph`, not a nonexistent `Icon`.**
LINT-02 is a *ratchet* at 316. New homepage components must not add raw
`lucide-react` imports. `LiveNpiResult`'s existing import is inside the
baseline; refactors must not increase the count.

**R0-3 — New CSS must be token-only.** LINT-01 (raw colour, baseline 237),
LINT-05 (literal z-index, 28), LINT-06 (raw box-shadow, 61) and LINT-09
(font-family literal, 8) are ratchets scoped to `apps/web/styles/**`. Any new
stylesheet in that directory that uses a raw colour, a literal z-index, a raw
`box-shadow`, or a literal font stack **fails the gate**. Baselines may not be
raised (hard stop condition 3).

## 12. Rollback path

- **Rollback target: `8ea5e6c6f7422be5221ab7ab1ec2b4d52a3a0003`.**
- Each PR is squash-merged, so any single PR reverts with
  `git revert -m 1 <merge-sha>`.
- The program is additive at the file level: reverting PR A–D restores
  `page.tsx` to mounting `CinematicEvidenceField` + `AskHome` unchanged.
- No database migration, no public API change, no auth boundary change is in
  scope. Rollback is therefore code-only and requires no data repair.

## 13. Non-goals

- No new runtime dependency.
- No GSAP, ScrollTrigger, Lenis, WebGL, or custom scroll framework.
- No carousel, scroll-snap, wheel/touchmove interception, or page-level scroll
  progress listener.
- No infinite animation anywhere on the homepage.
- No global application re-theme — the tone contract is homepage-scoped.
- No change to `/api/identity/bootstrap/{npi}` or `/api/trust-state/{npi}`.
- No refactor of unrelated application routes.
- No change to `components/vital/NpiInput.tsx` or its consumers.

## 14. Wave 0 baseline record

Measured on `8ea5e6c6f` in a clean worktree, pnpm 10.6.1, Node 24.10.0, macOS.

| Gate | Result | Duration | Notes |
| --- | --- | --- | --- |
| `pnpm install --frozen-lockfile` | PASS | 57.6s | — |
| `pnpm check:design` | PASS | <5s | All ratchets at baseline, all error rules zero. |
| `pnpm check:claims` | PASS | <5s | 23 phrases checked. |
| `pnpm check:routes` | PASS | <5s | — |
| `pnpm check:canonical-source-adapters` | PASS | <5s | — |
| `pnpm check:workflow-contract` | PASS | <5s | — |
| `pnpm --filter @vitalcv/web lint` | PASS | 66s | 1 pre-existing warning (below). |
| `pnpm --filter @vitalcv/web test` | PASS | 53.1s | 3373 passed / 3 skipped, 370 files. |
| `pnpm build:web:direct` | PASS | 6m13s | Exit 0. |

**Pre-existing lint warning (not introduced by this program):**
`components/page-stack/EntityLink.tsx:75` —
`aria-description is not supported by the role link` (`jsx-a11y/role-supports-aria-props`).

**Workspace-build precondition.** `pnpm --filter @vitalcv/web test` fails in a
fresh worktree with a *misleading* "no dist output" error until workspace
packages are built. Run `pnpm turbo build --filter='!@vitalcv/web'` first.
This is the `require-workspace-build.ts` guard, not a red baseline.

**Bundle baseline.** `First Load JS shared by all` = **102 kB**
(`chunks/31491` 46.2 kB + `chunks/de796e0f` 53.3 kB + 2.13 kB other).
Middleware 86.7 kB. The per-route `/` row was lost to `tail` truncation in the
Wave 0 capture and is re-measured at the Wave 1 gate.

### Baseline defects observed in the visual matrix

These are **pre-existing on `8ea5e6c6f`** and are the concrete targets for the
later waves — not regressions introduced here.

1. **The NPI field does not read as the primary object.** It is a bottom-rule
   underline with ten faint dot placeholders. At rest it has less visual weight
   than the headline, and the disabled CTA is a pale grey slab. (Wave 2 target.)
2. **"Confirmed today" over-claims its own contents.** In the resolved capsule
   the OIG row sits under a `Confirmed today` heading while the row detail
   correctly reads *"No match in the current LEIE file (monthly snapshot)"*. The
   row is honest; the group heading is not. (Wave 3E target — this is the exact
   grouping the directive calls out.)
3. **The atmosphere competes with the content.** `CinematicEvidenceField` renders
   `YOUR RECORD` and its seal *behind and through* the hero text, and at 768px
   the source labels (`identity`, `exclusions`, `enrollment`, `licensure`) are
   clipped by the viewport edges. (Wave 4B target.)
4. **The decorative caption collides with the employer CTA** at tablet widths.
5. **The resolved capsule has no provenance footer** — no
   `SOURCE · CADENCE · LIMITATION` line. (Wave 3E target.)
6. **Large dead vertical space** between the promise paragraph and the cadence
   sentence at ≥768px.

### Locked interaction contracts discovered in the e2e suite

`tests/e2e/ask-home.spec.ts` and `ask-npi-response.spec.ts` pin behavior that
later waves **must** preserve:

- `#npi-input` is the input id; `#ask-hint` renders `N/10 digits`.
- A CSS rule containing both `:focus-within` and `ask-field` must exist and set
  `border-bottom-color`, `outline` or `box-shadow`.
- The input's computed `font-size` must be **greater than** `#ask-title`'s —
  "the field remains the hero". (This also satisfies the ≥16px iOS rule.)
- `#ask-title` and `.ask-go` are horizontally centred within ±2px.
- The employer CTA's font-size is ≤ the primary CTA's.
- `[data-home-primary-cta]` is disabled until `checkNpi` returns valid.
- Under reduced motion, `document.getAnimations()` must report **zero** running
  animations and layout must not shift.
- No horizontal overflow at 360/390/768/1440/1920.
- Without JS: tablist is `display: none`, four panels, none `hidden`.
- The result must land **on screen** in the same frame, with `window.scrollY < 120`.
- Reset returns an empty field to the viewport.

**Known conflict — resolved in Wave 2.** `ask-npi-response.spec.ts` locates the
field by accessible name `/start with your npi/i`. Wave 2C specifies a floating
label reading `Enter your 10-digit NPI` (idle) / `NPI number` (active). The
accessible name therefore changes by design. The spec locators are updated in
the same commit as the copy change and the supersession is recorded in the PR —
this is an intentional contract change, not a masked failure.

## 15. Inspiration provenance

High-level interaction principles were studied from the Zoox design system and
**translated**, not copied. What was taken is limited to general, widely-used
patterns that carry no authorship:

- semantic surface tones driven by a data attribute rather than variant classes;
- disciplined typographic hierarchy with a restrained type scale;
- inputs treated as stateful product objects rather than ruled text fields;
- clip-path reveals and short, finite entrance motion;
- a single decisive easing curve applied system-wide;
- structured responsive grids;
- explicit, tokenised focus states.

**Not copied, and asserted absent:** Zoox source code, CSS class names, custom
property names, font files or font URLs, brand assets, colour values, copy, and
any proprietary implementation detail. Wave 1 adds a test that fails if a Zoox
class-name fragment or font reference appears in homepage code. All colour in
this program resolves to pre-existing `--vt-*` tokens, and all type resolves to
`--vt-font-body` / `--vt-font-display` / `--font-mono`.

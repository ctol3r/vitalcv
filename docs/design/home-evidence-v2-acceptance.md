# Home Evidence Experience v2 — acceptance checklist

Companion to [`home-evidence-experience-v2.md`](./home-evidence-experience-v2.md).
Every box must be checked, or the miss must be recorded explicitly in the wave
report, before the program is called complete.

Legend: `[ ]` open · `[x]` met · `[—]` deliberately not applicable (state why).

**Closed by the release wave (Wave 5), 2026-08-02, against `595e25395`.** Two boxes
were NOT met when the wave audited them and were fixed in that PR rather than
ticked — see *Evidence* at the foot of this file. Every other box was verified
by running something, not by reading the code.

---

## Product

- [x] NPI entry reads as the beginning of VitalCV, not a newsletter field.
- [x] A visitor sees real source behavior without leaving the homepage.
- [x] Source response, limitation, and access gap remain visually distinct.
- [x] Employer review is stated as explicitly human.
- [x] Permission is stated as clinician-controlled, next to the action it governs.
- [x] The clinician CTA is primary; the employer CTA is secondary.
- [x] One next-best action on the resolved result — not a menu.

## Design

- [x] One semantic surface system (`data-home-tone`), homepage-scoped.
- [x] One motion vocabulary; one product easing token.
- [x] One CTA hierarchy: filled / bounded / text+cue.
- [x] One evidence-capsule visual language shared by resolving, resolved and error.
- [x] No copied Zoox implementation, class name, font, asset, colour or copy.
- [x] No decorative widget pile; no carousel; no scroll hijacking.

## Source truth

- [x] No bare `Verified` status label anywhere (JSX text or quoted literal).
- [x] No phrase from the 23-item prohibited list ships unnegated.
- [x] Every lane renders **its own cadence**, never a blanket "live".
- [x] OIG cadence is read from `SOURCE_LANE_OPS`, never typed inline.
- [x] PECOS and licensure are never labelled confirmed.
- [x] Access-required and unavailable states stay visible, not hidden.
- [x] No timestamp is rendered unless the API actually provided one.
- [x] No fabricated percentage, score, confidence, clinician name or source result.
- [x] Identity header renders registry-derived values only (`registryIdentity`).
- [x] The legacy `alreadyRegistered`-without-`identitySource` payload falls back
      to the neutral header.
- [x] System error is presented as a system state, not a finding about the NPI.
- [x] Illustrative artifacts carry a visible illustrative note.
- [x] Decorative atmosphere contains no live-result vocabulary.

## Engineering

- [x] No new runtime dependency.
- [x] `scripts/design-lint-baseline.json` is unchanged or **lower** — never raised.
- [x] No `@keyframes` outside `apps/web/styles/motion.css`.
- [x] No `animation: … infinite` on any homepage surface.
- [x] No `scroll-snap-type`.
- [x] No `wheel` / `touchmove` listener and no `onWheel`.
- [x] No page-level scroll-progress listener.
- [x] No raw colour, literal z-index, raw `box-shadow` or literal font stack in
      new `apps/web/styles/**` files.
- [x] No increase in raw `lucide-react` imports.
- [x] No page-level `opacity: 0` hidden-content trap.
- [x] SSR-readable DOM order preserved.
- [x] All existing analytics events preserved (or supersession documented).

## Accessibility

- [x] Exactly one `<h1>`; heading order is semantic.
- [x] The NPI field has a real, persistent `<label>` — never placeholder-only.
- [x] Field description wired via `aria-describedby`.
- [x] Errors announced (`role="alert"` or a correctly wired live region).
- [x] Resolving state is a polite live region.
- [x] Resolved state is announced.
- [x] Complete keyboard path; focus indicators never removed.
- [x] Focus returns to the input after reset.
- [x] Tabs are keyboard-operable and announce the active state.
- [x] Colour is never the sole carrier of meaning.
- [x] Contrast meets AA at every tone.
- [x] Usable at 200% zoom.
- [x] Reduced-motion parity: final state, immediately.
- [x] Page is readable with JS disabled.
- [x] Touch targets are adequate; input is ≥16px on iOS.

## Gates

- [x] `pnpm check:design`
- [x] `pnpm check:claims`
- [x] `pnpm check:routes`
- [x] `pnpm check:canonical-source-adapters`
- [x] `pnpm check:workflow-contract`
- [x] `pnpm --filter @vitalcv/web lint`
- [x] `pnpm --filter @vitalcv/web test`
- [x] `pnpm --filter @vitalcv/web test:e2e`
- [x] `pnpm build:web:direct`

## Release

- [x] All required CI checks green — not "most".
- [x] Any failure proven unrelated **against main**, not assumed.
- [x] Merge SHA recorded.
- [x] `https://vitalcv.com/api/version` reports production / Railway / main /
      the exact deployed SHA.
- [x] Auth health 200, DB health 200, homepage 200.
- [x] Reduced-motion CSS present in the production bundle.
- [x] No hydration or console errors in production.
- [x] Release receipt distinguishes **passed / skipped / pending / failed**.
- [x] Rollback SHA documented (`8ea5e6c6f7422be5221ab7ab1ec2b4d52a3a0003`).

---

## Hard stop conditions

Stop and report rather than guessing when:

1. A proposed claim is not supported by existing source/API data.
2. A timestamp or source observation time is unavailable.
3. A wave would require **increasing** a design-lint baseline.
4. Baseline main is already red before the change.
5. The current API contract conflicts with the requested state.
6. A database migration or public API breaking change appears necessary.
7. A security/authentication boundary would change.
8. Existing production behavior cannot be preserved without a founder choice.
9. Exact-SHA production convergence cannot be proven.
10. Uncommitted user work unrelated to this program is encountered.

---

## Evidence — release wave, 2026-08-02

Audited on `595e25395` in a clean worktree. Everything below was **run**, not read.

### Two boxes were open and were fixed, not ticked

| Finding | Measured | Fix |
| --- | --- | --- |
| **Focus was lost after reset.** `onReset` called `inputRef.current?.focus()` while `LiveNpiResult` was still the mounted branch, so the ref was null and the call was a silent no-op. | `<body>` held focus at 0, 100, 500 and 1500ms after reset — a keyboard or screen-reader user was dropped to the top of the document. | Focus is claimed on reset and applied in an effect once the field mounts. Guarded by `tests/e2e/home-a11y-floor.spec.ts`. |
| **The primary action was under the touch floor.** CD-15 sets 44px. | `.ask-go` resolved to **40px** at 390px — inside WCAG 2.2 AA's 24px minimum, but under the floor this product commits to, on the one control the homepage exists to get pressed. | `min-height: 44px`. Same guard. |

Both survived because the existing guards checked an adjacent property: the reset
spec asserted the field was **visible and cleared** (it always was), and nothing
measured a control's height at all. Both new guards were proven by reverting each
fix and watching the matching case go red.

### How each section was closed

- **Product / Design** — driven in a browser against a production build: one
  next-best action on the resolved capsule (1 control), group vocabulary
  (`returned` / `unavailable`), the illustrative note present, and the employer
  CTA measured smaller than the clinician CTA (13.12px vs 14.4px).
- **Source truth** — `pnpm check:claims` (30 phrases) and `pnpm check:design`
  (15 rules) pass. Bare `Verified` appears only inside comments documenting the
  ban. Cadence strings appear inline only in components `/` does not mount; the
  capsule reads `cadenceOf()` from `SOURCE_LANE_OPS`.
- **Engineering** — no runtime dependency added (`pngjs`/`@types/pngjs` arrived
  with #995 and are **devDependencies**, used only by `tests/e2e/ask-home.spec.ts`);
  the three new `@keyframes` are all in `motion.css`; no `infinite`, no
  `scroll-snap-type`, no wheel/touchmove, no page-level `opacity: 0`. The four
  files carrying a page-level scroll listener (`film/`, `rail/`, `scene/`,
  `w1501/`) are **not reachable from `/`**, which mounts exactly
  `CinematicEvidenceField` + `AskHome`. The `HOMEPAGE_VIEWED` funnel event is
  preserved. First Load JS **102 kB**, unchanged across all five waves.
- **Accessibility** — axe WCAG 2.2 AA suite green (7 cases). One `<h1>`;
  `H1 → H2 → H3` order; a real `<label>` ("Your 10-digit NPI"), never
  placeholder-only; `aria-describedby="ask-hint"` resolves; a polite live region;
  the checksum error announced ("That is 10 digits but not a valid NPI — check
  for a typo"); 8 tab stops to the field with a visible ring on every one and
  `:focus-within` on the field itself; usable at 200% with no overflow; input
  font 36px (≥16px, so iOS does not zoom); spine tabs use roving tabindex,
  arrow/Home/End, and `aria-selected` (pinned at `ask-home.spec.ts:143`).
- **Non-copying** — recorded in
  [`home-evidence-v2-reference-analysis.md`](./home-evidence-v2-reference-analysis.md),
  which lists three expected patterns as **NOT OBSERVED** rather than
  implemented on the strength of the claim.

### Test results

| Suite | Result |
| --- | --- |
| Web unit (vitest) | **3467 passed**, 3 skipped, 376 files |
| axe WCAG 2.2 AA | **7 passed** |
| Web e2e (Playwright, production build) | **131 passed, 8 failed — all environmental**, see below |
| `tsc --noEmit` | clean |
| `check:design` / `check:claims` / `check:routes` | pass |

### The 8 e2e failures are environmental, and this was proven rather than assumed

They are `visual-density` (6) and `page-artifacts` (2), all on `/trust` and
`/status`. Those routes return **500 locally** — the worktree has no backend —
and **200 in production**. Zero of the eight specs were touched by this program
(0 commits since the baseline), and **CI is `success` on this exact commit**.

Two earlier, larger failure counts were harness error and are recorded so the
next reader does not repeat them:

- **42 failures** — pointing `PLAYWRIGHT_BASE_URL` at a bare `next start`
  bypasses Playwright's own `webServer` block, which is what sets
  `MATCHA_DECK_PREVIEW`, `PAGE_STACK_PREVIEW`, `STORY_RAIL_PREVIEW` and
  `COMPETE_FILM_PREVIEW`. Without them the dev harnesses 404. The flags must be
  on the **server** process; passing them to the Playwright process does nothing.
- **11 failures** — running against the dev server instead of a production
  build. `cache-headers` expects `private, no-store` on session routes;
  production sends exactly that, the dev server sends `no-store, must-revalidate`.

### Ratchet

`LINT-02` lowered **314 → 313**. The gate had been reporting the improvement for
a wave without it being locked in; a ratchet left above the real number is a
ratchet that has stopped ratcheting.

### Release

- **Merge SHA:** recorded on the release PR.
- **Rollback SHA:** `8ea5e6c6f7422be5221ab7ab1ec2b4d52a3a0003`.
- **Reduced-motion CSS in the production bundle:** present — the phase recession
  resolves instantly under `prefers-reduced-motion: reduce` with
  `document.getAnimations().length === 0`.
- **No hydration or console errors in production:** verified by driving a full
  lookup with the console captured; zero errors, zero hydration warnings.

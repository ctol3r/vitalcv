# UX-V1 — VitalCV.com Production Experience Cutover (2026-08-08)

> **DESIGN-ONLY BOUNDARY**
> This wave may change UI, UX, visual design, interaction design, responsive behavior, animation,
> information hierarchy, customer-facing copy, navigation presentation, and brand expression.
> It may not change application truth, authentication, authorization, consent semantics, data
> models, APIs, readiness calculations, agent policy, source behavior, employer decisions,
> business logic, or pricing behavior.
> If the proposed experience requires one of those changes, record it as a product dependency and
> stop. Do not solve it inside the design PR.

**Founder directive (2026-08-08):** stop treating design governance as the
deliverable. Ship the visible reset: make the production homepage unmistakably
represent the new VitalCV — *Enter your NPI. VitalCV does the rest.* —
optimized for the sentence "Holy shit, VitalCV.com is different," while
preserving every truth/security/product contract underneath.

**Binding design authority:** UX-01 verdict — **Direction B GO, WITH
AMENDMENTS** (`design-lab/homepage-reset/DECISION.md`). Applied here:

- Product-forward: the hero is the product working, not claims about it.
- Dark warm-graphite is the homepage **register**, not a sitewide mandate;
  the employer band and every other route stay light.
- No blocking hero: the ~10.5s work-surface timeline plays BESIDE the copy and
  the real NPI entry; first meaning lands inside ~5s; the server frame is the
  completed story, so nothing ever waits on motion.
- The prototype (`design-lab/homepage-reset/direction-b/index.html`) was
  thesis reference, not implementation canon — this is a fresh implementation.
- Truth, consent, accessibility, and reduced-motion contracts unchanged.

## What shipped

1. **Eyebrow** — `components/layout/Eyebrow.tsx` + `styles/eyebrow.css`:
   64px full-width architectural instrument (56px mobile), 32px gutters,
   identity left, mono product-state ticker center (narrates the work
   surface's beats; sparse mono nav elsewhere), quiet Sign in + one dominant
   action + boxed menu glyph right, full-takeover index menu, dark/light
   inversion via the existing `data-header-theme` scene contract, geometry
   constant across scroll and inversion.
2. **Homepage** — `components/home/easy/EasyHome.tsx` + `WorkSurface.tsx` +
   `styles/easy-home.css` (island `.ezh`): Easy Button hero with the REAL
   NPI entry (the same `useCareerLoop` flow — bootstrap, trust-state, MATCHA,
   onboarding handoff — reskinned, not changed), 5-beat no-NPI illustrated
   explainer, ownership panels, outcome band, subordinate light employer
   doorway, final action + footer composition, true mobile recomposition
   (the surface becomes a task stream), reduced-motion annotated static frame.
3. **Chrome wiring** — `RootChrome` mounts `Eyebrow`; the shared Footer is
   suppressed on `/` only (the page composes its own ending).
4. **Variant registry** — `easy` (default) · `career-loop` (rollback) ·
   `film` (fallback for unknown values). One env var restores either
   predecessor without a code change.

## Removed from the homepage primary story (founder list, asserted in `home-easy-cutover.test.tsx`)

`Your Number → Sources → Permission → Review` (journey rail) ·
`Provider Career Evidence Network` (including the JSON-LD organization
description) · `A number becomes a career` · `Work that fits more than a
résumé` · `The packet` · `Their decision` · source-lane cadence as marketing
(the derived cadence sentence survives as a quiet footer truth line —
`data-home-source-cadence` — because it is a disclosure, not a pitch) ·
the `Load an illustrative example` fixture dependency (the labelled
illustration replaces it) · large empty viewport chapters · film-era
storytelling.

## Contracts deliberately carried

- `data-home-primary-cta`, `data-home-employer-cta` (after the primary, on a
  real `/employers` anchor), `data-home-hero`, `data-home-truth-boundary`
  ("nothing has been sent", institution review), `data-home-source-cadence`,
  `0/10 digits`, one `<h1>`, `Free for clinicians`, no bare "Verified", the
  banned-strings list, no invented readiness percentages, no 10-digit NPI
  anywhere in the illustration.
- Funnel events unchanged: `HOMEPAGE_VIEWED`, `NPI_INPUT_STARTED`,
  `NPI_SUBMITTED`, `NPI_RESOLVED`, `NPI_RESOLUTION_FAILED`,
  `MATCH_FEED_VIEWED`, `MATCH_DEFAULTED`, `EMPLOYER_ENTRY_CLICKED`.
- Backend contracts untouched: no API, auth, consent, data-model, source, or
  pricing changes. The only non-UI files touched are test/config/docs.

## Coverage moves

- New: `__tests__/home-easy-cutover.test.tsx`, `__tests__/eyebrow-chrome.test.tsx`,
  `tests/e2e/home-easy.spec.ts`, `tests/e2e/eyebrow.spec.ts`.
- Retired with the chrome they pinned: `tests/e2e/header-journey.spec.ts`,
  `tests/e2e/liquid-menu.spec.ts`, `tests/e2e/film-journey-rail.spec.ts`.
- Re-pinned: `header-journey-system` / `header-chrome` (the `/` register is
  dark), `home-career-loop.spec.ts` now runs in its own
  `E2E_HOME_VARIANT=career-loop` pass, exactly the film mechanism.
- Design lint: `components/home/easy/` added to `HOMEPAGE_ROOTS` — the live
  composition is governed by R1/R2/R7/R8, which the career-loop era never was.

## Cleanup debt recorded for UX-F (foundation lane — do NOT block on these)

1. Parked chrome (`Navbar`, `HeaderMenu`, `LiquidMenu`, `JourneyRail`,
   `AnnouncementRail`, `styles/header.css`) removal once rollback confidence
   expires; their unit suites retire with them.
2. `styles/career-loop-home.css` + `styles/home.css` leave the `/` bundle
   when their variants are retired from the registry.
3. Token consolidation: `--ezh-*` / `--eb-*` island values should fold into
   the UX-02 three-tier token system when it lands (the census's 993-custom-
   property collapse); the two islands intentionally share the same palette
   values today.
4. `scripts/check-design-lint.ts` `LEGACY_HOME_ROOTS` still names the deleted
   `HomePageClient.tsx`; drop it with the R4-legacy ratchet when the loop era
   is removed.
5. The `#npi` / `#how-it-works` anchors and the `scroll-margin-top: 80px`
   rule should derive from one shared eyebrow-height token.

## Founder gate

**FOUNDER UX-V1 PRODUCTION CUTOVER REVIEW** — this wave stops at the review
deploy. No merge before founder visual GO. On GO: merge the exact reviewed
SHA → deploy → verify the exact production SHA → capture VitalCV.com itself.

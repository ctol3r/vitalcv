# WO-15 employer exact-packet review — visual evidence

Date: 2026-08-14

Creative owner: Codex, implementing the founder-selected human+tactile
extension of Direction D. Shared public chrome is unchanged.

## What changed

The previous `/employers` page opened as a narrow text column followed by an
abstract hospital drawing and six compact workflow blocks. The new composition
opens with the locked promise, `Review the exact packet. Keep the decision
yours.`, beside a tactile consent-to-review desk. It then moves through an
anonymous clinical-operations scene, three review truths, an interactive
six-moment review rail, the real source-lane posture, audience boundaries, and
one governed access action.

The rail is one native horizontal list, not a parallel carousel engine. Every
stage is in the server HTML and remains swipeable without JavaScript. Hydration
adds 48px arrow controls, arrow-key navigation, active narration, and calm
smooth scrolling; reduced motion changes control movement to immediate.

## Evidence index

| Requirement | Artifact |
|---|---|
| 390px before / after | `before/390.png`, `after/390.png` |
| Initial 390px viewport | `after/390-viewport.png` |
| 768px before / after | `before/768.png`, `after/768.png` |
| 1440px before / after | `before/1440.png`, `after/1440.png` |
| 1728px before / after | `before/1728.png`, `after/1728.png` |
| Reduced motion | `after/reduced-motion-1440.png` |
| No JavaScript | `after/no-js-1440.png` |
| Real interaction recording | `motion/review-rail.webm` |
| Typography, contrast, geometry, payload, performance | `visual-measurements.json` |
| Generation, rights, and truth disclosure | `asset-provenance.md` |
| Duplicate-intent and benchmark translation | `duplicate-intent.md` |

VitalCV is explicitly pinned to one supported product theme, light, in
`apps/web/app/providers.tsx`. The evidence measures that supported theme rather
than manufacturing an unsupported dark frame.

## Truth and product review

- The tactile scene is labelled illustration and stops before any decision,
  credentialing action, hire, or start.
- The clinical scene is labelled art-directed synthetic media. It is not a
  clinician, employer, patient, customer, credential, or outcome claim and
  contains no readable screen or PHI.
- The submitted version and current evidence remain separate. Clarification is
  a visible next step, and acceptance remains a head start rather than
  credentialing or privileging.
- NPPES identity remains separate from organization authority. The page links
  to governed access instead of using claim language.
- Source cadence is rendered from the existing `SOURCE_LANE_OPS` contract.
  Missing, access-gated, demo-only, and unintegrated lanes remain explicit.
- No fictional employer, reviewer, clinician, readiness percentage, outcome,
  start-time promise, source response, or customer metric was added.

## Measured acceptance

- Horizontal overflow is 0px at 390, 768, 1440, and 1728 widths.
- All six review moments remain in the DOM at every required width.
- H1 is computed Fraunces, weight 500, at 25.6px mobile and 33.6px desktop.
- Contrast is 15.28:1 for primary ink, 6.61:1 for secondary ink, 6.82:1 for
  editorial indigo, and 7.90:1 for white on the primary action.
- Review controls are 48px square; the primary access action is 44px high and
  spans the available 358px mobile content width.
- Shipped images total 67,982 bytes. The LCP scene is 36,984 bytes, below the
  250KB target. Shipped motion is 0 bytes, and no canvas, WebGL, or new
  animation engine is required. The 719,415-byte WebM is review evidence only.
- Three controlled optimized-build runs recorded maximum LCP 96ms, CLS 0, and
  maximum INP 48ms on the local headless Chromium profile.

## Verification receipt

- Focused employer, accessibility, pricing, authority, workflow, and scene
  coverage: 9 files / 64 tests.
- Focused production-build Playwright: 30/30, including the WO-15 route at all
  required widths, native rail controls and keyboard input, reduced motion,
  no JavaScript, scene contracts, and marketing-frame density.
- Copy, public claims, design lint, route guards, and design-markdown gates
  pass. The copy change lowers the standing vocabulary count by three.
- Full monorepo typecheck passes 50/50 and build passes 35/35. The aggregate
  web suite passes 467 files / 4,527 tests. The migration-backed PostgreSQL
  backend census passes 343 suites / 2,761 tests when serialized to prevent
  unrelated suites from sharing mutable rows.
- React review: the route stays a server component; the only client island is
  the rail, with static maps hoisted, one passive scroll listener, no fetching,
  and no serialized server payload.

Exact-head CI, `CLEAN`, Railway exact-SHA, and changed-flow production
verification remain release gates.

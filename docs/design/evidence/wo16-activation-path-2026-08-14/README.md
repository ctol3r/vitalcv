# WO-16 NPI-to-opportunity activation path — visual evidence

Date: 2026-08-14

Creative owner: Codex, implementing the founder-selected human+tactile
extension of Direction D. Shared public chrome is unchanged.

## What changed

`/pilot` previously opened with an abstract timeline, an internal simulation
KPI, and dense proof cards. `/onboarding` paired the real NPI action with a
generic benefits list. Neither surface made the promised NPI → CV Wallet →
opportunity movement visible.

The new composition gives both routes one shared, server-visible activation
path and one proprietary tactile scene. `/onboarding` keeps the NPI action
first and then shows the source-state, Wallet, and opportunity path. `/pilot`
extends that same path through a human employer response and measures six
distinct transaction moments instead of displaying a simulated result.

## Evidence index

| Requirement | Artifact |
|---|---|
| 390px pilot before / after | `before/pilot-390.png`, `after/pilot-390.png` |
| Initial 390px pilot viewport | `after/pilot-390-viewport.png` |
| 768px pilot before / after | `before/pilot-768.png`, `after/pilot-768.png` |
| 1440px pilot before / after | `before/pilot-1440.png`, `after/pilot-1440.png` |
| 1728px pilot before / after | `before/pilot-1728.png`, `after/pilot-1728.png` |
| 390px onboarding before / after | `before/onboarding-390.png`, `after/onboarding-390.png` |
| Initial 390px onboarding viewport | `after/onboarding-390-viewport.png` |
| 768px onboarding before / after | `before/onboarding-768.png`, `after/onboarding-768.png` |
| 1440px onboarding before / after | `before/onboarding-1440.png`, `after/onboarding-1440.png` |
| 1728px onboarding before / after | `before/onboarding-1728.png`, `after/onboarding-1728.png` |
| Reduced motion | `after/reduced-motion-pilot-1440.png`, `after/reduced-motion-onboarding-1440.png` |
| No JavaScript | `after/no-js-pilot-1440.png`, `after/no-js-onboarding-1440.png` |
| Real route recordings | `motion/pilot-journey.webm`, `motion/onboarding-journey.webm` |
| Typography, contrast, geometry, payload, performance | `visual-measurements.json` |
| Generation, rights, and truth disclosure | `asset-provenance.md` |
| Duplicate-intent and benchmark translation | `duplicate-intent.md` |

VitalCV is explicitly pinned to one supported product theme, light, in
`apps/web/app/providers.tsx`. The evidence measures that supported theme.

## Truth and product review

- NPPES remains a public registry identity read, not identity possession,
  licensure, readiness, or eligibility.
- Source states remain distinct. Access-gated and unavailable results are not
  upgraded by the composition.
- The clinician controls whether to save the record and which evidence is ever
  presented to an employer.
- The scene stops before application, employer review, decision,
  credentialing, hire, or start and is labelled as illustration.
- `/pilot` labels its response target as a target, not a published result. Its
  real-cohort report must carry cohort, baseline, period, sample size, and data
  lineage.
- Packet submission, packet open, clarification, employer response,
  credentialing start, intended start, and actual start remain distinct.
- No fictional clinician, employer, source response, readiness percentage,
  speed promise, customer metric, or production credential was added.

## Measured acceptance

- Horizontal overflow is 0px at 390, 768, 1440, and 1728 on both routes.
- The H1 is computed Fraunces at 33.6px with 37.632px line height on the
  controlled 1440px profile; primary ink contrast is 16.74:1.
- The pilot primary action is 44px high and the onboarding primary action is
  50px high.
- The AVIF scene is 102,220 bytes, below the 250KB LCP target. Shipped motion
  is 0 bytes; the two WebM files are review evidence only. No canvas, WebGL, or
  new animation engine is required.
- The controlled optimized-build profile records pilot LCP 80ms, CLS 0, and
  INP 16ms; onboarding records LCP 88ms, CLS 0.0597, and INP 40ms.

## Verification receipt

- Focused component, route, claim-parity, and scene coverage: 7 files / 66
  tests.
- Focused production-build Playwright: 10/10 across both routes and every
  required width, plus reduced motion and no JavaScript.
- Full monorepo typecheck passes 50/50 and the optimized web build passes.
- The aggregate web suite passes 468 files / 4,532 tests, with the repository's
  7 files / 45 tests explicitly skipped by its existing configuration.
- The migration-backed PostgreSQL backend census passes 343 suites / 2,761
  tests in the exact CI mode (`--ci --forceExit`) documented by the backend
  workflow for its known teardown-hygiene handle.
- Copy, claims, design, route, and design-markdown gates pass. The copy ratchet
  improves from 100 to 90 standing violations and the design ratchet improves
  LINT-02 from 280 to 279.
- React review: `/pilot` remains a server component; the shared activation path
  is a static server component; `/onboarding` adds no fetch, effect, state,
  listener, or parallel client island beyond its existing gate.

Exact-head CI, `CLEAN`, Railway exact-SHA, and changed-flow production
verification remain release gates until the final receipt is appended.

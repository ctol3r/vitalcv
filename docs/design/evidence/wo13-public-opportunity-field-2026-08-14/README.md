# WO-13 public opportunity field — visual evidence

Date: 2026-08-14
Creative owner: Codex, implementing the founder-selected human+tactile extension
of Direction D. Shared public chrome is unchanged.

## Scope and duplicate-intent check

- Checked open and recently merged pull requests, remote branches, and current
  `origin/main` before editing.
- Merged PR #1005 (`wave/explore-search`) is LANDED search groundwork, not a
  competing composition. No open PR or remote branch duplicates WO-13's
  source-labelled editorial field, five-facet register, documentary scene, or
  application-mode boundary.
- The before frames are the live `/explore` route at production baseline
  `85eed22b00ed2e5564999a4c3f739f4460937e39`. The after frames are the optimized
  production build from this branch, populated by the anonymous production
  opportunity API. They are not customer or outcome claims.

## Evidence index

| Requirement | Artifact |
|---|---|
| 390px before / after | `before-390x844.png`, `after-390x844.png` |
| 768px before / after | `before-768x1024.png`, `after-768x1024.png` |
| 1440px before / after | `before-1440x900.png`, `after-1440x900.png` |
| 1728px before / after | `before-1728x1117.png`, `after-1728x1117.png` |
| Full editorial field | `after-1440-full.png` |
| Reduced motion | `after-1440-reduced-motion.png` |
| No JavaScript | `after-1440-nojs.png` |
| Interaction / scroll recording | `after-motion.webm` |
| Typography, contrast, overflow, assets | `visual-measurements.json` |
| Controlled performance profile | `performance.json` |

The application currently enforces one supported public theme: light. The
evidence therefore measures the supported theme rather than manufacturing an
unsupported dark state.

## Visual and truth review

- The first viewport now carries a human clinical setting, an editorial career
  promise, and the exact public boundary: no account requirement, no public
  eligibility verdict, and external roles return to their source.
- Exactly five browse facets remain: specialty, profession, location, schedule,
  and employment type. Mobile and no-JavaScript users receive a native open
  disclosure, not a JavaScript-only filter drawer.
- Each row exposes source label and URL, observation time, availability
  confidence, compensation source, and an application-mode-specific action.
  External rows never show `Apply with VitalCV`; integrated rows may.
- Missing compensation, unavailable observation time, stale or unavailable
  sources, and closed status remain words in the DOM. No readiness percentage,
  hidden ranking, automatic eligibility, unsupported source, or speed claim was
  added.
- The scene is generated art direction depicting an anonymous clinician from
  behind. It is not a real clinician, patient, employer, credential, result, or
  customer; it contains no visible badge, patient identifier, or PHI. Its
  production provenance and disclosure live in the validated `VisualScene`
  manifest.

## Measured acceptance

- Horizontal overflow: 0px at 390, 768, 1440, and 1728 widths.
- H1: Fraunces, weight 400, with computed sizes recorded per viewport.
- Contrast: headline 17.31:1, lede 6.54:1, eyebrow 5.86:1, source link 6.33:1.
- Primary row action: 48px minimum height; keyboard and 200% layout are covered
  by production-build Playwright.
- Hero poster: 167,602 bytes. Shipped motion: 0 bytes. Required WebGL: none.
- Controlled Chromium profile: LCP 700ms, CLS 0, INP 16ms.
- Reduced-motion and no-JavaScript frames preserve the full source-labelled
  record. The recording uses real server-rendered rows and scroll interaction;
  deterministic query behavior is tested separately so no fixture is presented
  as production evidence.

## Verification receipt

- Focused frontend: 2 files / 19 tests.
- Focused production-build Playwright: 4 / 4.
- Focused real-PostgreSQL opportunity and ingestion suites: 3 suites / 52 tests.
- Full aggregate: 465 web files / 4,510 tests, plus 343 backend suites / 2,756
  tests against ephemeral PostgreSQL 16. The web aggregate's seven
  database-gated files / 45 tests remain covered by the refreshed CI database
  step.
- EC-9 vocabulary, glass, sitemap freshness, copy, claims, design, route,
  zero-warning lint, typecheck, and build gates pass. Refreshed-head CI and
  production exact-SHA verification remain mandatory release gates; the handoff
  ledger and PR receipt record their final state.

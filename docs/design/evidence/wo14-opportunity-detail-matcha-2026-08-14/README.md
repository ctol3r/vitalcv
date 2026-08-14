# WO-14 opportunity detail and signed-in MATCHA — visual evidence

Date: 2026-08-14
Creative owner: Codex, implementing the founder-selected human+tactile extension
of Direction D. Shared public chrome is unchanged.

## Scope and duplicate-intent check

- Checked open and recently merged pull requests, remote branches, and current
  `origin/main` before editing.
- Historical PR #477 (`feat/opportunity-detail`) is LANDED groundwork, not a
  competing composition. No open PR or remote branch duplicates WO-14's
  source-preserving public detail, external-versus-integrated action boundary,
  closed-role receipt, or signed-in explanation continuity.
- The before frames are the live public detail route at production baseline
  `5aae3fa635e8080d3937ca8d5a445af6164b27de`. The after frames are the optimized
  production build from this branch, populated by the same anonymous production
  opportunity API. They are not customer, fit, eligibility, or outcome claims.

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
| Interaction / scroll recording | `motion/detail-scroll.webm` |
| Typography, contrast, overflow, and assets | `visual-measurements.json` |
| Controlled performance profile | `performance.json` |

The application currently enforces one supported public theme: light. The
evidence therefore measures the supported theme rather than manufacturing an
unsupported dark state.

## Visual and truth review

- The old dense detail page becomes one editorial role record: documentary
  clinical context, an opportunity-owned headline and lede, ruled role facts,
  a tactile source ticket, the supplied description, and a source receipt.
- The first mobile viewport preserves the role, state, and original-source
  action before the documentary crop. Existing fixed public controls no longer
  overlap the headline or action; shared chrome itself was not changed.
- External roles expose one `View original listing` action and no VitalCV apply
  action. Only integrated records may continue into the existing disclosure
  composer. Closed or source-unavailable records retain their readable receipt
  and expose no application action.
- Missing compensation, description, observation time, source page, or
  explanation elements remain explicit. The public route adds no readiness
  score, fit verdict, automatic eligibility decision, hidden employer ranking,
  inferred sensitive fact, invented requirement, or employer endorsement.
- The documentary poster is the same generated, provenance-disclosed WO-13 art
  direction. It is not a real clinician, patient, employer, credential, result,
  or customer; it contains no visible identifier or PHI.

## Signed-in continuity boundary

- The authenticated route preserves the same canonical opportunity record and
  adds `Why this may fit`, evidence gaps, uncertainty, and clinician-controlled
  next steps. It uses the existing application preview, disclosure, consent,
  and sealed-packet flow rather than a parallel apply path.
- Local Clerk end-to-end credentials are not present. The signed route was not
  weakened with an auth bypass or forged identity to manufacture a screenshot.
  Its source-derived explanation and action boundaries are covered by component
  tests; controlled authenticated production verification remains part of the
  post-deploy receipt when an authorized session is available.

## Measured acceptance

- Horizontal overflow: 0px at 390, 768, 1440, and 1728 widths.
- H1: Fraunces, weight 400, with computed sizes recorded per viewport.
- Contrast: headline 17.31:1, lede 6.54:1, eyebrow 5.86:1, primary action
  18.71:1.
- Primary action: 52px height. At 390px it ends at 586.75px; fixed public
  controls begin at 782px, so the action is not obscured.
- Hero poster: 167,602 bytes. Shipped motion: 0 bytes. Required WebGL: none.
- Three controlled Chromium runs: maximum LCP 196ms, CLS 0, maximum INP 56ms.
- Reduced-motion and no-JavaScript frames preserve the full source-labelled
  record and original-source action.

## Verification receipt

- Focused frontend: 2 files / 11 tests, including the actual signed-in detail
  component for external and integrated application modes.
- Focused backend opportunity truth and service: 2 suites / 20 tests.
- Canonical opportunity contract: 4 files / 246 tests.
- Copy, claims, design, route, design-markdown, typecheck, and optimized web
  build gates pass.
- Full aggregate: 467 web files / 4,522 tests. The seven database-gated web
  files also pass 45/45 against ephemeral PostgreSQL 16. The backend passes 343
  suites / 2,759 tests against the same migration-backed database harness.
- Zero-warning lint, copy, claims, design, route, design-markdown, typecheck,
  and full monorepo build gates pass. Refreshed-head CI and production exact-SHA
  verification remain mandatory release gates; the ledger and pull-request
  receipt record their final state.

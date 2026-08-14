# WO-13B opportunity discovery controls — visual evidence

Date: 2026-08-14
Creative owner: Codex, implementing the founder's HiringCafe-class functionality
directive inside the founder-locked human+tactile `/explore` register. Shared
public chrome is unchanged.

## Scope and duplicate-intent check

- Checked open and recently merged pull requests, remote branches, and current
  `origin/main` before editing. Merged #1374 and #1375 are the landed board and
  detail foundations; no open implementation duplicates this lens rail or
  expanded discovery contract.
- HiringCafe was inspected as a functional benchmark: quick discovery facets,
  grouped advanced filters, search state, and richer listing exploration. The
  result is not a visual clone and does not copy its opaque ranking or account
  agent behavior.
- Before frames are live `vitalcv.com/explore` at baseline
  `c95e01b7a38e458008bf6022caceeef82d7f9463`. After frames are the optimized
  production build from this branch.

## Evidence index

| Requirement | Artifact |
|---|---|
| 390px before / after | `before-390x844.png`, `after-390x844.png` |
| 768px before / after | `before-768x1024.png`, `after-768x1024.png` |
| 1440px before / after | `before-1440x900.png`, `after-1440x900.png` |
| 1728px before / after | `before-1728x1117.png`, `after-1728x1117.png` |
| Reduced motion | `after-1440-reduced-motion.png` |
| No JavaScript | `after-1440-nojs.png` |
| Carousel-control recording | `after-motion.webm` |
| Geometry, typography, contrast, payload | `visual-measurements.json` |

The application enforces one supported public theme, light. Evidence measures
that supported theme rather than manufacturing a dark state.

## Visual and interaction review

- The new rail is one editorial instrument between the documentary promise and
  the advanced field. Five tactile folios are visible on desktop; a sixth and
  subsequent content remain discoverable through native horizontal overflow
  and supplementary arrow controls.
- Mobile presents one large lens at a time with a visible next card edge. It
  preserves the search and native `Filter roles` disclosure immediately below.
- Every lens is an ordinary `/explore?...` link, so the quick path works without
  JavaScript. JavaScript adds smooth arrow movement, active state, and live
  advanced-filter updates. Reduced motion changes movement to immediate.
- The local optimized build intentionally had no live backend session. After
  frames therefore document the lens and advanced discovery composition only;
  no synthetic role, employer, compensation, or source record was inserted to
  make the screenshots look fuller. Canonical listing truth remains covered by
  the live before frame, source tests, and production post-deploy receipt.

## Truth and ranking review

- `Fresh from source` uses the stored availability observation time; an absent
  observation does not match. `Pay in view` means compensation was supplied by
  the source, not that VitalCV inferred a range. Benefits can remain explicitly
  limited or not listed.
- External roles remain `View original listing`; only integrated roles can use
  `Apply with VitalCV`.
- Recent update, title A-Z, and organization A-Z are browse order only. No lens
  or sort implies fit, quality, readiness, eligibility, or employer preference.
- Natural-language intent, personal explanation, and evidence gaps remain in
  signed-in MATCHA. Nothing here auto-applies, auto-rejects, or exposes a hidden
  clinician ranking.

## Measured acceptance

- Horizontal overflow: 0px at 390, 768, 1440, and 1728 widths.
- Lens count: 6 selectable DOM links at every required width.
- Lens title: Fraunces, 25.6px / 25.6px line-height.
- Contrast against the white paper endpoint: ink 18.71:1, source green 6.33:1,
  muted copy 6.83:1.
- Arrow targets: 48px square; native horizontal overflow remains user-owned;
  hover movement is 3px over 180ms and disabled by the route's reduced-motion
  rule.
- Shipped asset additions: 0 image bytes, 0 motion bytes, no video, canvas,
  WebGL, or new animation engine. The WebM is review evidence only.

## Verification receipt

- Focused web component and URL truth: 1 file / 5 tests.
- Focused backend truth and list service: 2 suites / 22 tests through ephemeral
  PostgreSQL 16 and the deployed migration chain.
- Production-build Playwright: 5/5, covering the lens rail, advanced URL state,
  source and application boundaries, no-JavaScript disclosure, reduced motion,
  keyboard order, 200% zoom, and all required widths.
- Zero-warning lint, copy, claims, design, route, design-markdown, typecheck, and
  the optimized production build pass. The aggregate web suite passes 467
  files / 4,524 tests; the real-PostgreSQL backend harness passes 343 suites /
  2,761 tests. Exact-head CI and Railway exact-SHA verification remain release
  requirements.

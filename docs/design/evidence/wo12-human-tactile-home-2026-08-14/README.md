# WO-12 human+tactile homepage release evidence

**Creative owner:** Codex, implementing the founder-locked Direction D.1 dated
2026-08-13. This is an implementation inside the selected documentary-clinical
plus tactile-object register; it does not select a new visual era or alter shared
public chrome.

## Baseline and claim-check

- Before: `https://vitalcv.com/` at Railway `main` SHA `feffb0a`.
- After: local production build from `codex/wo12-human-tactile-home`, cut from
  full SHA `feffb0adbd85cf9e4c0d4b5a0d2b2960c2543a74`.
- The open and merged PR lists and remote branches were searched for homepage,
  human+tactile, career-mobility, opportunity-horizon, and WO-12 intent before
  implementation. No open duplicate was present. Merged #1371 is the Direction
  D baseline this work deliberately extends.
- Shared header geometry and the mobile public-chrome control cluster are
  unchanged.

## What the captures prove

The paired `before-*` and `after-*` frames cover 390×844, 768×1024, 1440×900,
and 1728×1117. Full-page desktop captures prove the composition continues as
one story rather than ending at the hero. `after-1440-reduced-motion.png` and
`after-1440-nojs.png` prove a complete static reading order without motion or
JavaScript. `after-motion.webm` records the production-build hero, live
opportunity horizon, and tactile career-mobility sequence at 1440×900.

The opportunity rows in the after captures are not fixtures. The local
production build's request was intercepted read-only and fulfilled with the
current anonymous response from
`https://vitalcv.com/api/opportunities?limit=3`. The component retains explicit
loading, unavailable, and empty states; no source response is converted into a
success state.

The hero image is a generated, anonymous adult clinician from behind in a quiet
hospital transition space. It is an owned art-directed asset, not evidence of a
real clinician, employer, role, result, or customer. It contains no patient,
badge text, logo, patient identifier, or PHI. Its repository manifest carries
that provenance and the page places a visible `Art-directed scene` disclosure
beside it.

## Measured release contract

- `visual-measurements.json`: zero horizontal overflow at all four required
  widths; Fraunces headline computation; contrast ratios of 17.31:1 headline,
  6.54:1 lede, 5.86:1 eyebrow, and 18.71:1 primary action; 52px primary-action
  height; no canvas or required WebGL.
- The hero poster is 201,854 bytes. The shipped motion asset is 0 bytes: motion
  is CSS/DOM assembly, while the evidence recording is not served to users.
- `performance.json`: controlled Chromium production-build profile with 4× CPU,
  40ms RTT, 10Mbps down, and 5Mbps up measured LCP 816ms, CLS 0, INP 24ms, FCP
  556ms, and load 931ms.
- The application intentionally forces its supported light paper theme in
  `apps/web/app/providers.tsx`. The capture therefore tests the declared theme
  contract rather than presenting an unsupported dark variant as coverage.

## Browser and truth checks

The production build passed 17 Playwright checks covering exact hero copy and
actions, the real opportunity/application boundary, responsive overflow at all
four widths, keyboard access, reduced motion, and no-JavaScript completeness.
Focused Vitest coverage passed 71 tests across the cutover, composition,
opportunity, process-story, and visual-scene contracts. Copy, claims, design,
route, typecheck, zero-warning lint, and build gates passed. The canonical root
gate then passed 464 web files / 4,506 tests and the real-PostgreSQL backend at
343 suites / 2,751 tests. The seven web database suites separately passed
45/45 against an ephemeral PostgreSQL 16 database. Refreshed-head CI is
recorded on the pull request.

No invented clinician, employer, logo, readiness percentage, result, speed
promise, or unsupported source is shown. External roles say `View original
listing`; only integrated opportunities may say `Apply with VitalCV`.

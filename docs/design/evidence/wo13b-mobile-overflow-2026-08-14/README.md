# WO-13B mobile source-title containment

Production follow-up evidence for the 390px overflow found while exercising the
merged opportunity field against its real source records.

## Defect

- Production baseline: `095ed9c9067dd7e809cfd5ebf8c09f52f332cdb9`
- Viewport: 390 × 844
- Exact source-supplied title: `NY Center Advanced Practice Provider (Nurse Practitioner/Physician Assistant)`
- Before: the title's right edge reached 393.83px, 3.83px beyond the 390px
  viewport. The page shell clipped the excess rather than making the text fit.
- Root cause: the mobile role-heading grid retained its implicit min-content
  track and the nested title wrapper did not opt into shrinking.

## Correction

The existing opportunity card now uses a `minmax(0, 1fr)` mobile grid track,
allows the title wrapper to shrink, and wraps unusually long source strings.
No content, source fact, action, breakpoint, component, or animation system was
removed or replaced.

## Evidence

- `before-live-390x844.png`: exact production record before the correction.
- `after-optimized-390x844.png`: the same record and viewport against the
  optimized local production build after the correction.
- After: the title's right edge is 358px and the document remains 390px wide.
- Production-build Playwright adds the exact title as a regression fixture and
  asserts both the title edge and document overflow.

## Verification

- Production-build Playwright: 6/6 passed.
- Required-width, reduced-motion, no-JavaScript, keyboard, and 200% zoom
  coverage remains in `explore-opportunity-field.spec.ts` and passed unchanged.
- The aggregate typecheck, build, web tests, and serialized migration-backed
  PostgreSQL backend suite were rerun before commit.

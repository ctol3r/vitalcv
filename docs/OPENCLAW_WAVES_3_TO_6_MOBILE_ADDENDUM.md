# OpenClaw Waves 3–6 Mobile Addendum

Status: baked
Applies to: `docs/OPENCLAW_WAVES_3_TO_6_BUNDLE.md` and every future wave/task bundle

## Rule

Every wave in the Waves 3–6 bundle must explicitly include mobile implications.

This is not optional.

## Per-wave requirement
For every wave, OpenClaw must include in its output:
1. web/desktop impact
2. mobile impact
3. responsive behavior implications
4. whether the result is:
   - responsive web only
   - PWA-capable
   - native-app-relevant
   - all three over time
5. whether any new shared component or shell is mobile-safe

## Product principle

If a cleanup, shell, primitive, or route-classification decision creates a worse mobile experience, the work is incomplete.

If a feature or flow cannot be clearly expressed on mobile, it is not yet fully designed.

## Immediate application to Waves 4–6

### Wave 4
- page-header standardization must account for mobile header density
- status pill/badge consistency must account for mobile truncation and tap targets
- route classification decisions must note mobile discoverability and navigation implications

### Wave 5
- verifier/internal shell normalization must include mobile shell behavior
- any shared verifier wrapper must define mobile spacing, stacking, and action-zone behavior
- no shell extraction is complete without mobile-safe layout behavior

### Wave 6
- canonical ownership docs must explicitly call out mobile-safe primitives and shell expectations
- tiny consistency hardening should prioritize high-traffic mobile surfaces where applicable

## Instruction to OpenClaw

When running the Waves 3–6 bundle, do not report a wave as complete unless mobile implications were considered and documented.

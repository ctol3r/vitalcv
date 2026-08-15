# WO-18 explore documentary media pause

Date: 2026-08-14

Creative owner: Codex, implementing the founder-directed removal of the
rejected `/explore` documentary image inside the existing Opportunity Field
register. Shared public chrome is unchanged.

## Intent and duplicate check

Open and recently merged pull requests plus remote branch names were checked
before implementation. PRs #1374 and #1379 established earlier Opportunity
Field work; no current open pull request duplicates this media-removal intent.

## Change and truth boundary

The `journey_film` scene is removed from the rendered `/explore` hero and the
existing text composition expands into the vacated space. This wave authorizes
no replacement image. Future imagery must be dynamic, close, human-centered,
optimistic, bright, and vibrant while remaining source- and privacy-safe.

No opportunity source, listing, application behavior, API, schema, migration,
authorization, immutable packet, employer decision, Recognition, or durable
state behavior changes. Browser evidence is composition evidence only; it does
not imply authenticated or production data behavior.

## Evidence index

| File | Purpose |
| --- | --- |
| `before-1440x900.png` | Production desktop before state at baseline `a8db973` |
| `before-390x844.png` | Production mobile before state at baseline `a8db973` |
| `after-1440x900.png` | Optimized-build desktop after state |
| `after-1728x1117.png` | Optimized-build wide desktop after state |
| `after-768x1024.png` | Optimized-build tablet after state |
| `after-390x844.png` | Optimized-build mobile after state |
| `after-1440-reduced-motion.png` | Reduced-motion after state |
| `after-1440-zoom-200.png` | 200% zoom after state |
| `after-390-nojs.png` | No-JavaScript mobile after state |

No motion recording is included because this change removes a static image and
introduces no motion or scroll-controlled behavior.

## Measured verification

- `.opf-hero-media` is absent.
- The hero contains no image.
- Document scroll width equals viewport client width at the tested breakpoints.
- The inspected optimized-build page emitted zero console warnings or errors.
- The source-labelled opportunity story remains present in the server-visible
  document.
- No replacement media asset was added.
- Optimized-build Chromium coverage passes 6/6 tests for the focused route.
- The configured non-backend Turbo sweep passes 468 files / 4,532 tests; its
  45 environment-gated skips are the existing repository baseline, not new or
  required coverage hidden by this change.
- The configured real-PostgreSQL backend sweep passes 343 suites / 2,761 tests.

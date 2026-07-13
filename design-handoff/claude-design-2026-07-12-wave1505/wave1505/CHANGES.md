# Wave 1505 · CHANGES.md

Closing wave: system pages, quality gates, governance. Consumes wave1500 tokens + 1501–1504 kit. **Zero new colors, zero new fonts, zero new radii.**

## New tokens (structural only)
- `--vt-z-*` z-index scale: `base 0 · raised 10 · nav 40 · banner 45 · widget 50 · overlay 60 · skip 100` (w1505.css). Promoted as canonical; literal z-index is now lint-illegal (LINT-05). Rationale: DG-12.5 required "z-index from the token scale" and none existed.

## New components (promotion candidates → promoted in DESIGN_SYSTEM.md §8)
- `EmptyState` — glyph frame + Fraunces line + why + ONE action. Solid rule frame (dashed stays reserved for degraded).
- `OfflineBanner` — sticky dashed banner under nav at `--vt-z-banner`; `role="status"`; never a toast.
- `SkeletonStack` — sunken bars + shimmer (allowed infinite exception; static under reduced motion).
- `FeedbackWidget` — right-edge vertical tab at 50vh; geometrically cannot overlap CTAs at 360px; Esc closes, focus returns to tab.
- `ProtoBar` — design-review chrome for chrome-less full-page states (not a product component).
- Auth `ck-*` classes — the designed anatomy Clerk's appearance API maps onto (spec at `#/auth`).
- `.skip-link` — added to every shell; first focusable, lands on `#main`.

## Reused without modification
- Form kit, ErrorSummary, SuccessCard, HonestyPanel (1502) · EvidenceRow, RecognitionRow (1503) · CopyBtn, TokenRow (1504) · all wave1500 primitives.

## Documents
- `DESIGN_SYSTEM.md` — canonical, supersedes wave1500 copy (kept in place for history).
- `REGRESSION_MATRIX.md` — 10 routes × 3 viewports Playwright spec.
- `DESIGN_LINT.md` — 10 CI-blocking rules.

## Decisions recorded
- 404 headline: "This page isn't part of the record." Error doctrine: "Nothing was recorded as successful." — fail-closed, reused verbatim in repo copy.
- Pricing shows ONE illustrative number, always with HonestyLabel; clinician tier is $0 with no asterisk.
- Legal = one template, four docs; DPA states plainly that no BAA is offered because no PHI is processed.
- Unknown routes in this prototype genuinely route to the designed 404 (acceptance: no unstyled flash anywhere).

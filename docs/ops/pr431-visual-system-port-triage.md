# PR #431 Visual System Port Triage

Timestamp: 2026-05-30 16:32 PDT (America/Los_Angeles)

PR: #431 `feat(web): D57 visual system port - 8 routes + chat22 ship-blocker fixes`

## Recommendation

Do not merge PR #431 as-is.

Recommended action: close as superseded after extracting any still-useful pieces into smaller targeted PRs.

## Changed files

PR #431 touches 32 files:

- `apps/web/__tests__/home-npi-role-doors.test.tsx`
- `apps/web/__tests__/passport-truth-state-banner.test.tsx`
- `apps/web/app/HomePageClient.tsx`
- `apps/web/app/contact/page.tsx`
- `apps/web/app/layout.tsx`
- `apps/web/app/passport/page.tsx`
- `apps/web/app/sign-in/RoleSegment.tsx`
- `apps/web/app/sign-in/[[...sign-in]]/page.tsx`
- `apps/web/app/sign-up/[[...sign-up]]/page.tsx`
- `apps/web/app/status/page.tsx`
- `apps/web/app/trust/attribution/page.tsx`
- `apps/web/app/trust/page.tsx`
- `apps/web/components/layout/RootChrome.tsx`
- `apps/web/components/layout/publicSurfaceRoutes.ts`
- `apps/web/components/passport/PassportTruthStateBanner.tsx`
- `apps/web/components/visual/AuditTimeline.tsx`
- `apps/web/components/visual/AuthShell.tsx`
- `apps/web/components/visual/CompactConnectorMatrix.tsx`
- `apps/web/components/visual/Doors.tsx`
- `apps/web/components/visual/EvidencePacketPreview.tsx`
- `apps/web/components/visual/Footer.tsx`
- `apps/web/components/visual/Nav.tsx`
- `apps/web/components/visual/ProofRail.tsx`
- `apps/web/components/visual/Receipt.tsx`
- `apps/web/components/visual/ReceiptDrawer.tsx`
- `apps/web/components/visual/Shell.tsx`
- `apps/web/components/visual/TruthChip.tsx`
- `apps/web/components/visual/index.ts`
- `apps/web/components/visual/primitives.tsx`
- `apps/web/components/visual/types.ts`
- `apps/web/styles/visual-system.css`
- `pnpm-lock.yaml`

## Overlap with merged visual PRs

PR #431 overlaps the already-merged focused visual route PRs:

- #429 Passport calm degradation: overlaps `apps/web/app/passport/page.tsx`, deletes `apps/web/components/passport/PassportTruthStateBanner.tsx`, and deletes `apps/web/__tests__/passport-truth-state-banner.test.tsx`.
- #430 Homepage NPI-first role doors: overlaps `apps/web/app/HomePageClient.tsx` and deletes `apps/web/__tests__/home-npi-role-doors.test.tsx`.
- #434 Auth calm disclosure: overlaps `apps/web/app/sign-in/[[...sign-in]]/page.tsx` and `apps/web/app/sign-up/[[...sign-up]]/page.tsx`.
- #435 Status and attribution receipt registers: overlaps `apps/web/app/status/page.tsx` and `apps/web/app/trust/attribution/page.tsx`.

The overlap is not just additive. PR #431 would replace several route implementations that have already been merged, audited, tested, and recorded on the completion board.

## Unique useful changes

Potentially useful pieces that may deserve smaller follow-up PRs:

- `apps/web/app/contact/page.tsx` visual treatment.
- `apps/web/app/trust/page.tsx` visual treatment.
- `apps/web/components/layout/publicSurfaceRoutes.ts` if it cleanly supports route chrome without weakening existing layout behavior.
- Selected visual primitives from `apps/web/components/visual/*`, especially `ReceiptDrawer`, `EvidencePacketPreview`, `ProofRail`, `AuditTimeline`, and `CompactConnectorMatrix`, if they can be integrated behind focused route changes and tested.
- `apps/web/styles/visual-system.css` only if the style layer can be reconciled with the current design-system/tokens approach without creating a parallel styling regime.

## Stale or conflicting changes

High-risk stale/conflicting parts:

- Deletes already-merged focused regression tests for passport and homepage.
- Deletes `PassportTruthStateBanner`, which is the merged #429 path for calm degraded passport truth states.
- Rewrites the same live routes already stabilized by #429, #430, #434, and #435.
- Touches `pnpm-lock.yaml` with deletions in a visual route PR, which is out of scope for a cherry-pickable visual cleanup.
- Adds a broad parallel visual component/style layer instead of landing one route or primitive at a time.

## Risk

Risk level: high.

Reason: PR #431 is broad, stale relative to current `main`, and overlaps multiple focused PRs already merged through local audit. A monolithic rebase would be expensive and likely reintroduce visual/test churn that the focused PR cascade already resolved.

## Next action

Close PR #431 as superseded unless a reviewer identifies a specific ship-blocker fix that is not already on `main`.

If useful pieces remain, create smaller PRs in this order:

1. `ReceiptDrawer` / `EvidencePacketPreview` as isolated components with tests.
2. `/contact` visual cleanup only.
3. `/trust` visual cleanup only.
4. Public route chrome refinement only if it does not alter auth/session behavior.

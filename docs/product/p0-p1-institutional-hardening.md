# P0/P1 Institutional Hardening

Binding repair record for the highest-risk institutional overclaims
identified on origin/main. The wave targets six specific surfaces
where positive-form certainty, fake continuous-monitoring claims,
proceed-by-default behavior, or unsupported recognition semantics
were rendered to operators.

Cut date: 2026-05-21.

## P0 (decision-grade copy that conflated substrate with institutional decision)

### P0-1 · ClearToStartBanner

**Before**: `All mandatory requirements verified and continuously monitored.`

**After**: `Federal-source lanes were source-confirmed at the last read. Institution review is still required before any final decision; this surface does not perform continuous monitoring.`

**Why**: the original copy conflated (a) substrate-side lane confirmation with (b) continuous monitoring (none is performed) and with (c) institutional decision-grade clearance (only the institution clears).

### P0-2 · ConsoleWrapper proceed semantics

**Before**:
- `Credentials verified. Clear to proceed.` (decision-grade)
- `Primary identity verified. Additional sources pending — proceed with head start or wait.` (proceed-at-access_required)
- `Source data is being checked. You can proceed with a head start.` (proceed-by-default)
- `Adverse finding detected. Manual review required before proceeding.` (vague review owner)

**After**:
- `Lane evidence completed. Institution review still required before a final decision; this surface does not grant clearance.`
- `Identity lane source-confirmed. Additional sources require institutional access — institution review still required before any decision.`
- `Source data is being checked. Institution review still required; this surface does not grant clearance.`
- `Adverse finding detected. Institution review required before any decision; do not proceed without institutional sign-off.`

**Why**: every posture now ends with an explicit institution-review requirement. No proceed-by-default copy. No implicit green-light at `access_required`. Review owner named.

## P1 (monitoring overclaims, recognition / decay overclaims)

### P1-1 · MonitoringStatusBadge

**Before**:
- Label: `Continuously Monitored` / `Monitoring Inactive`
- Tooltip: `Verification is automatically monitored for changes.`

**After**:
- Label: `Re-checked on request` / `Per-request re-checks disabled`
- Tooltip: `Lanes are resolved per request against the published federal sources on the institution's own freshness budget. No continuous monitoring is performed.`

**Why**: VitalCV does NOT continuously monitor. Lanes are resolved per-request. The new copy names the per-request posture honestly.

### P1-2 · ApplyBundleView monitoring labels

**Before**: `Continuously monitored` / `Partially monitored` / `Monitoring inactive`

**After**: `Re-checked on request` / `Partial source coverage` / `Per-request re-checks disabled`

### P1-3 · TrustStateCard window labels

**Before**: `Continuously Monitored` / `Monitoring Window Expiring Soon` / `Stale (Monitoring Expired)` / `Verification Not Yet Valid`

**After**: `Within institution freshness budget` / `Freshness budget expiring soon` / `Stale — re-fetch required` / `Evidence not yet effective`

**Why**: "Monitoring" is the wrong frame; the budget is the institution's freshness window, not a VitalCV monitoring window.

### P1-4 · verifier-types.ts recognition + decay copy

**Before**:
- `Subject has PSV-backed recognition and employer acceptance on record. Start remains gated by explicit attestation timing.`
- `Trust integrity compromised. Verification signals have aged beyond the acceptable threshold, triggering automatic decay.`
- `PSV-backed recognition is present, but this employer has not recorded acceptance for this scope.`
- `score below the safety threshold`

**After**:
- `Source-confirmed lane evidence is on record and the employer has recorded an acceptance for this scope. Institution attestation timing still gates the start.`
- `Source-confirmed lane evidence has aged beyond the institution's freshness budget. Re-fetch on the institution's own credential to renew.`
- `Source-confirmed lane evidence is on record, but this employer has not recorded acceptance for this scope.`
- `sit below the institution's own review threshold. Institution review required.`

**Why**: "PSV-backed recognition" implies VitalCV grants recognition. The substrate carries lane evidence; institutions recognize. "Automatic decay" implies a non-existent automated process; lanes go stale against an institutional freshness budget. "Safety threshold" implies a VitalCV-owned safety bar; the threshold is the institution's own.

### P1-5 · DisclosureScopePanel cryptographic / decay copy

**Before**: `Access to these credential facts is cryptographically scoped to the stated verification purposes. The evidence artifacts will automatically decay from the verifier's perimeter in N days.`

**After**: `Access to these credential facts is signature-scoped to the stated review purposes. The evidence artifacts expire from the verifier's perimeter in N days and must be re-presented by the holder for any subsequent review.`

**Why**: "cryptographically scoped" overclaims the substrate; "signature-scoped" is the accurate operational form. "Automatically decay" implies background activity; "expire and must be re-presented" is the honest operational frame.

## Degraded-state visibility (binding)

A verification / readiness surface MUST expose:

- `access_required` (the lane requires institutional credentials)
- `source_unavailable` (registry returned error / 5xx)
- `timeout` (registry exceeded freshness budget)
- `incomplete_evidence` (one or more lanes have not completed)

A surface that hides any of these in a generic "pending" state is a
regression. The doctrine forbids collapsing degraded states into a
"good enough" aggregate.

## What this wave does NOT do

- Does NOT remove the `verified` TypeScript literal-type members
  used internally (e.g. `status: 'verified' | 'degraded'` unions).
  Those are data model values; the user-facing labels they map to
  are normalized.
- Does NOT touch API route source code.
- Does NOT touch fixture string constants used for backward
  compatibility.
- Does NOT add any new feature or protocol surface.

## Verifier behavior

`scripts/verify-p0-p1-institutional-hardening.ts` scans
`apps/web/{app,components}` for the six P0/P1 phrases this wave
eliminated. Three sub-modes:

- `enforce` (default) — exits non-zero on any FAIL
- `report` — scan + summary; never exits non-zero
- `degraded-states-only` — checks legitimate exposure of the four
  degraded states (NOTE-level)

Post-repair: **0 FAIL hits**.

## Governance

A new visible verification / monitoring / recognition surface MUST:

1. Avoid every banned phrase named in this doc
2. Use evidence-bounded language (lane state + institution review + freshness budget) for any monitoring or recognition claim
3. Expose degraded states; never collapse them into a generic "pending"
4. Pass `pnpm verify:p0-p1-institutional-hardening` with zero FAILs

PRs that violate any of the four are rejected at Codex audit.

# Deterministic Confidence Enforcement

Binding rule: a positive review posture MUST derive ONLY from
deterministic evidence completion. The manifest tier value is
intentionally NOT consulted when computing posture; the substrate
cannot grant clearance. The wave eliminates the
manifest-tier-priority bypass on `/review/[entityId]`, adds a
required-lane completeness guard, and ships a verifier that
prevents regressions.

Cut date: 2026-05-21.

## The bypass that was removed

**Before** (`apps/web/app/review/[entityId]/ConsoleWrapper.tsx:49`):

```ts
const posture = (manifest?.tier === 'decision_grade' ? 'decision_grade'
  : lanes.some(l => l.status === 'adverse') ? 'blocked'
  : lanes.some(l => l.status === 'verified') ? 'partial'
  : 'needs_data') as ReadinessPosture;
```

This branch read `manifest.tier === 'decision_grade'` as a
short-circuit for the posture — if the manifest claimed
decision-grade tier, the lane-evidence checks were skipped entirely.
That allowed a manifest carrying `tier: 'decision_grade'` to
override `access_required`, `unavailable`, `stale`, `not_checked`,
or `in_progress` lane states. **This is the manifest-tier-priority
bypass.**

**After**: a pure deterministic `derivePosture(lanes)` function that
consults lane evidence only:

1. Any `adverse` lane → `blocked`
2. Every required lane is `verified` (source-confirmed) →
   `decision_grade`
3. Any lane is `verified` but the required set is incomplete →
   `partial`
4. Otherwise → `needs_data`

The manifest.tier value is no longer used to compute posture.

## Required-lane completeness rule (binding)

`decision_grade` posture is only reachable when EVERY lane in
`REQUIRED_LANES_FOR_DECISION_GRADE` is affirmatively `verified`.
The closed set today:

| Lane id | Source |
|---|---|
| `nppes_identity` | CMS NPPES |
| `oig_exclusions` | OIG LEIE |
| `state_license` | State Medical Board |
| `employment_history` | The Work Number |

If any required lane is `access_required`, `unavailable`, `stale`,
`not_checked`, `in_progress`, or absent from the manifest, posture
cannot reach `decision_grade`. The verifier enforces this list.

A future wave that adds a required lane MUST update both the
constant in `ConsoleWrapper.tsx` AND this doctrine doc in the same
PR. The test suite enforces the synchronization.

## Bounded progression states (binding)

The `EmployerDecisionConsole` decision-state map now uses
evidence-bounded labels instead of decision-grade labels:

| State key | Before | After |
|---|---|---|
| `ready` | `READY TO PROCEED` | `LANE EVIDENCE COMPLETED · INSTITUTION REVIEW REQUIRED` |
| `proceed_with_review` | `PROCEED WITH REVIEW` | `ADDITIONAL EVIDENCE REQUIRED` |
| `blocked` | `BLOCKED` | `BLOCKED · INSTITUTION REVIEW REQUIRED` |
| `needs_data` | `NEEDS MORE DATA` | `REVIEW INCOMPLETE` |

No state label suggests a proceed-by-default behavior. Every
positive-posture label explicitly names the institution-review
requirement.

## Next-action copy (binding)

`deriveNextAction(posture, blockers)` now produces deterministic,
blocker-specific copy:

| Condition | Copy |
|---|---|
| Adverse lane | `Adverse finding detected. Institution review required before any decision; do not proceed without institutional sign-off.` |
| Required lanes complete | `Lane evidence completed. Institution review still required before a final decision; this surface does not grant clearance.` |
| Top blocker is `access_required` | `Additional evidence required: ${displayName} requires institutional access. Institution review still required.` |
| Top blocker is `unavailable` | `Source unavailable: ${displayName} did not respond within the freshness budget. Institution review still required.` |
| Top blocker is `stale` | `Stale evidence: ${displayName} is past the freshness budget. Re-fetch on the institution's own credential.` |
| Top blocker is `not_checked` | `Review incomplete: ${displayName} has not been checked. Institution review still required.` |
| Default fallback | `Review incomplete: source data is being checked. Institution review still required; this surface does not grant clearance.` |

No copy says "Clear to proceed" or "Credentials verified" or
"proceed with a head start". Every line ends with an
institution-review requirement.

## Degraded-state visibility (binding)

A surface that renders a review posture MUST expose:

- `access_required` — explicit message naming the required institutional access
- `unavailable` — explicit message naming the source and the freshness-budget failure
- `stale` — explicit message naming the lane and the required re-fetch
- `not_checked` — explicit message naming the un-checked lane

The doctrine forbids collapsing these into a generic "pending" or
"needs more data" without naming the specific lane.

## What this wave does NOT do

- Does NOT remove `manifest.tier` from data models. The field is
  still carried; it is simply not consulted when computing posture.
- Does NOT touch API route source code.
- Does NOT add new features or new lane types.
- Does NOT remove the `ReadinessPosture` type-union members. The
  same four postures (`blocked` / `decision_grade` / `partial` /
  `needs_data`) remain; only the derivation rule changed.

## Verifier behavior

`scripts/verify-deterministic-confidence.ts` checks that:

1. `ConsoleWrapper.tsx` does NOT contain `manifest?.tier === 'decision_grade'` or `manifest.tier === 'decision_grade'`
2. `ConsoleWrapper.tsx` declares the `REQUIRED_LANES_FOR_DECISION_GRADE` constant
3. `EmployerDecisionConsole.tsx` uses the four bounded labels (no `READY TO PROCEED`, no `PROCEED WITH REVIEW`, no bare `BLOCKED`, no `NEEDS MORE DATA`)
4. `ConsoleWrapper.tsx` does NOT contain `Clear to proceed` or `Credentials verified` or `proceed with a head start`
5. The deterministic-confidence doctrine doc exists and enumerates the required-lane list

Three sub-modes:

- `enforce` (default) — exits non-zero on any FAIL
- `report` — scan + summary; never exits non-zero
- `required-lanes-only` — checks the required-lane constant is declared and listed in the doctrine doc

## Governance

A new review / readiness posture surface MUST:

1. Derive posture from lane evidence ONLY; never consult
   `manifest.tier` or any single aggregate field as a short-circuit
2. Use the required-lane completeness guard for any positive
   posture
3. Expose degraded states explicitly (no generic "pending")
4. Pass `pnpm verify:deterministic-confidence` with zero FAILs

PRs that violate any of the four are rejected at Codex audit.

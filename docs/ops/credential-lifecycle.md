# Credential Artifact Lifecycle Management — W2-PR44A

**Status:** Operational primitives — pure transforms, no DB writes from the
service layer. Wired into CI via `.github/workflows/lifecycle-gate.yml`.

**Module path:** `apps/api/backend/src/services/credentialLifecycle/`

## What this is

A deterministic, replay-safe lifecycle layer for credential artifacts. The
existing infrastructure (`credentialStatusEngine.ts`,
`expirationForecastEngine.ts`, `continuousMonitor.ts`,
`utils/lifecycleState.ts`) computed point-in-time state and forecast risk
tiers but did not cohere across uploads, expirations, renewals, supersession,
and archival. This module adds the missing graph layer plus the integrity
gates that prevent silent lineage loss.

## Components

| File | Responsibility |
|------|----------------|
| `types.ts` | Authoritative shapes (events, nodes, graph, reports) |
| `lifecycleGraph.ts` | Append-only event log → deterministic graph |
| `supersessionLineage.ts` | Ancestor/descendant reconstruction; cycle detection |
| `renewalSemantics.ts` | Ambiguity-preserving renewal interpretation |
| `expirationDrift.ts` | Forecast vs. observed expiration drift, operator-visible |
| `artifactContinuity.ts` | Structural invariants per artifact |
| `lifecycleReplay.ts` | Replay-safe state reconstruction at any `asOf` |
| `integrityGates.ts` | Aggregated CI-gating report |
| `__tests__/` | Unit tests + `lifecycleChaos.test.ts` |

## Invariants

The system enforces these rules. Each one has a named identifier in
`artifactContinuity.ts:INVARIANTS` and a corresponding test.

1. **Append-only events.** An event MUST NOT be mutated in place.
   Corrections are issued as new events that reference the prior `eventId`
   via `correctsEventId`.
2. **Deterministic graph.** Same input event log → identical graph,
   identical fingerprint, identical replay frame hashes.
3. **Lineage edges are deterministic.** Each supersession edge has a stable
   `deterministicKey` (sha256 over `(from, to, occurredAt, type)`) and is
   deduplicated on insert.
4. **Renewal ambiguity is preserved.** A renewal is interpreted as both a
   continuation AND a fresh issue with independent confidences. The
   `ambiguityPreserved: true` literal is required; flattening is detected
   and surfaced via `detectFlattenedAmbiguity`.
5. **Expiration drift is operator-visible.** `ExpirationDriftReport`
   carries the literal `operatorVisible: true` so type narrowing at
   consumers cannot silently accept a hidden report.
6. **Archival lineage is reconstructable.** Archived artifacts that
   participated in any renewal/supersession event MUST have a reachable
   predecessor chain. Broken chains are flagged via
   `LifecycleIntegrityReport.archivalLineageBroken`.
7. **Replay is hermetic.** Frames at `asOf = T` only fold events with
   `occurredAt <= T`. Future events do not leak into past frames.
8. **Cycles are surfaced, not silently traversed.** Any cycle in the
   supersession graph is reported via `SupersessionLineage.cycleDetected`.

## Drift detection

`detectExpirationDrift(artifactId, forecastedExpiresAt, observedExpiresAt)`
returns one of four directions:

- `earlier` — observed before forecast (something pulled the expiration in)
- `on_time` — forecast and observed match exactly
- `later` — observed after forecast (extension or correction)
- `unknown` — at least one side is null

The CI gate does not currently fail on drift alone — drift is informational
and surfaced for operator triage. A future wave may add drift thresholds.

## Renewal semantics

`interpretRenewal({ predecessor, successor, renewalEvent })` produces a
`RenewalInterpretation` with two independent branches:

- **`asContinuation`** — plausible when artifact type matches, issuer/org
  matches, and the gap is short (or negative).
- **`asFreshIssue`** — plausible when type changed, issuer changed, gap
  exceeds 90 days, or the cause string indicates a fresh issue.

Confidences are clamped to `[0, 1]` but the two branches do **not** sum to 1.
Both can be high (genuinely ambiguous) or both can be low (insufficient
signal — a floor of 0.3 is applied so the system never produces 0/0).

## Replay

`replayLifecycle({ graph, asOf })` returns one `LifecycleReplayFrame` per
artifact that existed at `asOf`. Each frame carries:

- `state` at `asOf`
- `effectiveExpiresAt` (most recent event metadata wins, falls back to node)
- `predecessorIds` / `successorIds` as of the cutoff
- `eventsObservedAtFrame` (event IDs in order)
- `hash` — sha256 over the canonical frame payload

`verifyReplayDeterminism` runs the replay twice and asserts every frame
hash matches. Drift indicates a non-deterministic input crept into the graph
(usually unsorted events or in-place mutation).

## Integrity gate

`runLifecycleIntegrityGate({ graph, renewalInterpretations, asOf })` runs
every check and returns `LifecycleIntegrityReport` with `passed: boolean`.
The CI workflow `.github/workflows/lifecycle-gate.yml` runs the unit tests
and chaos simulations on every PR that touches the lifecycle module or its
upstream dependencies.

To run locally:

```bash
cd apps/api/backend
pnpm exec jest --testPathPattern 'src/services/credentialLifecycle/__tests__'
```

## What this module does NOT do

- **No DB writes.** All transforms are pure. Persistence belongs to a
  separate service (out of scope for W2-PR44A).
- **No automatic flattening of ambiguity.** Downstream code that needs a
  single answer must make that policy decision explicitly and own the
  consequences.
- **No truth claims.** The lifecycle graph reflects the events recorded;
  it does not promote any artifact to "verified" or "trusted." Truth
  contract per `apps/web/lib/issuer-verification/` remains authoritative.

## Banned strings reminder

Any user-facing copy derived from this module must not contain the banned
strings listed in `CLAUDE.md` (e.g. `automatically verified`, `instant
credentialing`, `legally accepted`). The integrity gate does not enforce
copy — that's the existing copy lint's job — but document authors must
remain aware.

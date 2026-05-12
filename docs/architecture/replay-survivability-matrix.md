# Replay Survivability Matrix

> Audit-chain survivability properties of the canonical replay identity scheme
> introduced in Wave 10 (`apps/api/backend/src/services/replay/replayIdentity.ts`)
> and pinned by the simulation suite in Wave 14
> (`apps/api/backend/src/services/replay/__tests__/replaySurvivability.test.ts`).

Both identifiers — `lineageKey` (subject identity) and `runId` (snapshot identity)
— are pure functions over inputs that are already persisted in the existing
schema: `entityId`, `lastCheckedAt`, and the verification-artifact ids that
contributed to the snapshot. Survivability is therefore a structural property
of the algorithm, not a runtime concern.

## Survivability matrix

| Runtime event | `lineageKey` | `runId` | Why |
|---|---|---|---|
| HTTP refresh | unchanged | unchanged | pure function; identical inputs → identical outputs |
| Backend process restart | unchanged | unchanged | reads from DB, not memory |
| Frontend reload | unchanged | unchanged | identifier is server-rendered into the API response |
| Deploy (same algorithm `v1`) | unchanged | unchanged | scheme version embedded in the prefix; same inputs guaranteed to produce same outputs |
| Deploy (future `v2`) | **changes** | **changes** | bumping the scheme version is the explicit migration path for any input-set change; prefix lets clients gate behavior |
| Partial persistence outage (subset of artifacts available) | **unchanged** | **changes** | same subject, different snapshot; verifier sees a new runId on same lineageKey |
| Degraded ingest (no artifacts produced) | unchanged | **changes** to a distinct deterministic id (NOT a random fallback) | verifier can compare ids to tell partial from complete |
| Stale data (old `lastCheckedAt` recovered from cold storage) | unchanged | unchanged from the day the snapshot was originally written | runId is for the snapshot, not freshness; freshness is signaled separately |
| Tampering with any input (`entityId`, `lastCheckedAt`, checksums, channel) | varies | **always changes** | hash output diverges immediately; ids cannot be forged from different evidence |
| Artifact order changes in DB (sort drift) | unchanged | unchanged | input normalization sorts checksums before hashing |
| Cosmetic input drift (whitespace, case) | unchanged | unchanged | input trimming + lowercasing inside the generator |

## Audit-chain integrity properties

These properties are asserted by the test suite as load-bearing invariants:

1. **Chronological lineage continuity.** Three snapshots taken three months apart
   for the same subject share one `lineageKey`. Their `runId`s are pairwise
   distinct.

2. **Gap tolerance.** If a snapshot in the middle of a chain is lost
   (e.g. partial persistence outage on that day), the surviving snapshots
   still share `lineageKey`. The gap is rendered as a separate signal by
   `<ReplayLineage>` and is never silently encoded into the id space.

3. **Cross-subject collision impossibility.** Two snapshots whose subjects
   differ cannot share a `runId`. The hash space is 64-bit (16 hex chars);
   the birthday-paradox collision probability is negligible at any realistic
   audit-archive size. The test fixture additionally pins specific
   distinct-input pairs to non-equal outputs.

4. **Anti-forgery.** Tampering with any element of the input set —
   `entityId`, `lastCheckedAt`, artifact checksums, channel — produces a
   different `runId` deterministically. A verifier in possession of the
   inputs can recompute the id and detect any mutation.

5. **Degraded distinguishability.** A run that produced no artifacts gets a
   stable, recognizable id that is *not* equal to any complete run's id for
   the same subject. A verifier can therefore tell a degraded snapshot from
   a complete one without out-of-band signaling.

6. **Wall-clock independence.** Recomputing a snapshot's `runId` six months
   after it was originally written yields the same value. Audit replay does
   not depend on the verifier's local clock.

## Runtime-turbulence simulation results

| Scenario | Behavior | Test |
|---|---|---|
| Deploy replacement (new code path, same `v1`) | byte-identical ids | `scenario 1 — deploy replacement` |
| Replay corruption attempt (tampered inputs) | id diverges; cannot be forged | `scenario 2 — corruption attempt` |
| Degraded receipt restoration | distinct deterministic id, lineageKey preserved | `scenario 3 — degraded restoration` |
| Runtime restart | byte-identical ids over 50-iteration loop | `scenario 4 — runtime restart` |
| Partial persistence outage | lineageKey preserved, runId changes | `scenario 5 — partial persistence outage` |
| Stale replay recovery | byte-identical to original | `scenario 6 — stale replay recovery` |

## Survivability verdict

**Confirmed by construction + pinned by 20 simulation tests.** The audit chain
cannot silently break under any of the six runtime-turbulence scenarios named
in the brief, because the ids are deterministic over persisted inputs and the
algorithm version is recognizable on every id.

## Out-of-scope (known follow-ups)

These survivability concerns are real but not solved by the identity layer
alone; they belong to other waves:

- **`prior-check` enumeration from DB** — the `<ReplayLineage>` primitive can
  render gaps, but the backend doesn't yet query historical runs for a
  given lineageKey. Wave 6 / Wave 11.
- **Persistence of `runId` itself** — currently re-derived on every response.
  Persisting the computed id alongside the run record is an optimization
  + audit-trail belt-and-suspenders. Wave 10b (future).
- **Issuer continuity** (kid rotation, DID resolution): handled by
  `IssuerAttribution` primitive but requires the `/api/receipt/[id]`
  endpoint to surface meaningfully. Wave 13.
- **`.well-known/jwks.json` mounting** for independent verifier validation:
  Wave 9.

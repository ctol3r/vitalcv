# Runtime Durability Continuity — W2-PR10B Track C

**Wave:** W2-PR10B — Operator Survivability Explainability
**Date:** 2026-05-08
**Status:** Review-only synthesis. No code changes, no merges.
**Risk class:** SAFE (read-only inventory).
**Companion to:** [survivability-explainability](survivability-explainability.md), [forensic-durability-understanding](forensic-durability-understanding.md), [trust-fabric-durability-cohesion](trust-fabric-durability-cohesion.md).
**Builds on:** [trust-fabric-continuity](trust-fabric-continuity.md), [w2-pr9b-degraded-trust-state-continuity](w2-pr9b-degraded-trust-state-continuity.md), [runtime-query-explainability](runtime-query-explainability.md).

---

## What this track answers

Treat **runtime durability**, **audit durability**, **export durability**, and **replay durability** as four named contracts. PR8B Track C asked whether they form one fabric on the happy path. PR9B Track B asked whether they stay cohered under degradation. **This track asks whether they remain operationally survivable as four distinct durability axes — i.e., whether each axis has a coherent answer to "is this property held, and how would an operator know?"**

The risk vector is collapse: an operator confusing two of the four axes produces the inflation patterns documented in [forensic-durability-understanding.md](forensic-durability-understanding.md). The check is whether each axis stays explainable on its own terms, with its own determinism / async / observability / persistence properties intact.

## Definitions

- **Runtime durability:** whether a runtime mutation produces a deterministic, fingerprinted, attributed metadata record at the moment of action.
- **Audit durability:** whether the audit row corresponding to that mutation lands in durable storage, and whether that landing is observable.
- **Export durability:** whether an exported bundle reflects a stable, complete-as-claimed snapshot of the audit state at export time.
- **Replay durability:** whether replaying a capsule today produces the same answer as replaying it at decision time, modulo recorded-vs-reconstructed labeling.
- **Operationally survivable:** the property holds and the surface (UI, log, schema field) makes that property legible without source-code knowledge.

## Four-axis durability scoreboard

| Axis | Contract holds? | Surface explains? | Honest under async? | Honest under retry? | Honest under loss? |
|---|---|---|---|---|---|
| **Runtime durability** | ✅ deterministic fingerprint, deterministic payload hash, taxonomy-bound | ❌ no surface reads `mutationFingerprint` or `correlationId` | ✅ unaffected — runtime metadata is built synchronously | ⚠️ retries collapse to one fingerprint; surface reads three | ⚠️ `'unknown'` actor recorded faithfully; surface silent |
| **Audit durability** | ⚠️ `pending_not_written` is the default `eventState` | ❌ no surface reads `eventState` | ⚠️ async lag is exactly the durability gap | ⚠️ N retries → N rows, no idempotency contract | ⚠️ row eventually lands; `pending_not_written` invisible |
| **Export durability** | ⚠️ best-effort, internally hashed | ⚠️ schema implies completeness | ⚠️ no streaming; one slow capsule blocks export | ⚠️ re-export = new unlinked bundle | 🔴 dropped capsules invisible in bundle |
| **Replay durability** | ✅ deterministic same-input same-output | ⚠️ envelope mixes recorded with computed | ✅ replay is on-demand; lag does not change determinism | ⚠️ N replays = N envelopes, all outer R-CAT-6 | ⚠️ partial-artifact replay reads as `'UNKNOWN'` ambiguously |

**Tally:** 3 ✅, 11 ⚠️, 1 🔴, 5 ❌. **Four contracts, three of four hold; one is best-effort with a known gap. Surface explainability holds for none of the four without bundle-JSON or source-code access.**

## Axis 1 — Runtime durability

### What runtime durability actually is

`buildRuntimeMutationMetadata` ([runtimeTrustCohesion.ts:143-190](../../apps/api/backend/src/services/runtimeTrustCohesion.ts)) emits a `RuntimeTrustMetadata` block synchronously at the moment the route handler decides to write. The block is:

- `correlationId` — UUID per call
- `mutationFingerprint` — deterministic over `action + actorId + entityId + payloadHash`
- `payloadHash` — deterministic over redacted payload
- `mutationClassification` — one of 8 self-describing nouns
- `replayCategory` — one of 6 R-CAT codes
- `actor` — `actorId / actorType / attributionSource`
- `outcome` — `'allowed' | 'denied' | 'replayed'`
- `readonly` — `attemptedByReadonly` boolean + source

### Where the runtime durability contract holds

- **Deterministic.** Same inputs → same fingerprint, every call. Verified by `runtimeTrustCohesion.test.ts`.
- **In-memory before audit.** The metadata exists before the audit-row write attempt; runtime durability is therefore *upstream* of audit durability, not dependent on it.
- **Honest about unknown actors.** `actorId: 'unknown'` is faithfully recorded; no inflation.
- **Carried into the capsule.** `runtimeTrust` is written into capsule metadata at capsule write time, providing the C-1 ↔ T0 reconciliation path ([replayEngine.runtimeCohesion.test.ts](../../apps/api/backend/src/services/audit/__tests__/replayEngine.runtimeCohesion.test.ts) verifies this).

### Where it fails operator explanation

- **No surface reads it.** Operators have no `runtimeTrust` viewer, no fingerprint group-by, no read-only-flag readout.
- **Retry-as-many-events.** The fingerprint detects retries; the surface treats correlation-keyed events as distinct.
- **Header in attribution.** `attributionSource: 'x-clerk-user-id'` exports HTTP transport into a forensic record (a leaky abstraction; [runtime-query-explainability.md](runtime-query-explainability.md) failure #6).

**Axis 1 score: 🟢 contract / 🟠 surface.** Runtime durability is the load-bearing cohesion gain of W2 ([trust-fabric-continuity.md](trust-fabric-continuity.md)) and the most operator-invisible of the four axes.

## Axis 2 — Audit durability

### What audit durability actually is

The `AuditEvent` schema carries `eventState` literals (`pending_not_written`, `demo_not_persisted`, `defer_until_contract_aligned`). The reference writer never claims `persisted`. The transition `pending_not_written → persisted` is the moment an `AuditEvent` row's row-image lands in durable storage. Today that transition is asynchronous to the side effect.

### Where the audit durability contract holds

- **Literal-level honesty.** `eventState` distinguishes pending, demo, deferred, and persisted states.
- **Demo-vs-real clean.** `recordedBy: 'demo'` and `demo_not_persisted` are explicit; the strongest single anti-trust-inflation gate.
- **Default-deny on persistence claim.** `defer_until_contract_aligned` is the audit-persistence default; the system does not claim persistence it cannot guarantee.

### Where it fails operator explanation

- **`eventState` has no surface.** Code-side flag only. No timeline column, no API field, no bundle field.
- **No idempotency contract.** Three retries → three rows. Fingerprint detects; row count does not.
- **Async lag is the durability gap.** The wall-clock window where the side effect is real and the audit row is not is exactly the period when an operator-facing claim of "audited" would be inflation.
- **No way to ask "is row X durable yet?"** The literal exists; no query reads it.

**Axis 2 score: 🟡 contract / 🔴 surface.** Audit durability is the most consequential of the four axes for trust-honesty (the audit table is the primary evidence surface) and the one most likely to be misread under degradation.

## Axis 3 — Export durability

### What export durability actually is

`buildAuditBundle` ([replayEngine.ts:550-607](../../apps/api/backend/src/services/audit/replayEngine.ts)) is the canonical export path for a forensic consumer. Properties:

- **Synchronous serial loop** over up to 50 capsules.
- **Per-capsule replay errors caught + logged + dropped silently** ([replayEngine.ts:568-573](../../apps/api/backend/src/services/audit/replayEngine.ts)).
- `capsuleCount` reflects survived count, not requested.
- `bundleHash` SHA-256 over `JSON.stringify({ bundleId, exportedAt, replays })`.
- `verificationInstructions.how`: "verify integrity.hashMatch === true" — true for survived capsules.
- `custodyLog`: two events (`BUNDLE_CREATED`, `HASH_COMPUTED`).

### Where the export durability contract holds

- **Internally consistent.** Hash recomputes deterministically over the included replays.
- **Self-describing schema.** `schema: 'https://vitalcv.com/audit-bundle/v1'`.
- **Includes the verification path.** `verifyEndpoint`, `replayEndpoint`.
- **Demo paths surface.** `recordedBy: 'demo'` propagates into bundle replays; demo bundles are visibly demo.

### Where it fails operator explanation

- **No requested-vs-delivered manifest.** Bundle has no `requestedCount`, no `droppedIds`, no `partialExport: true` flag.
- **No streaming.** One slow capsule blocks the whole bundle.
- **No inter-bundle linking.** Re-export of the same NPI produces a fresh `bundleId` with no `parentBundleId` or `previousBundleId`.
- **No signature.** `bundleHash` detects in-transit tampering; it does not bind the bundle to VitalCV cryptographically.
- **`custodyLog` reads as complete chain-of-custody.** It is a two-event self-emitted log, not a multi-actor signed chain.

**Axis 3 score: 🟠 contract / 🔴 surface.** Export durability is structurally weaker than runtime, audit, or replay durability; the schema shape implies completeness the contract does not deliver. This is the highest-impact false-forensic-assumption surface in the codebase ([forensic-durability-understanding.md](forensic-durability-understanding.md) FA-1).

## Axis 4 — Replay durability

### What replay durability actually is

`replayDecision` ([replayEngine.ts:267-546](../../apps/api/backend/src/services/audit/replayEngine.ts)) is invocation-on-demand, computed from recorded inputs. The contract: same capsule, same replay output, every time. Determinism is an explicit design constraint ([replayEngine.ts:14-15](../../apps/api/backend/src/services/audit/replayEngine.ts)).

### Where the replay durability contract holds

- **Deterministic.** Verified end-to-end.
- **Hash-checked.** `IntegrityCheck.hashMatch` against `recomputedHash`.
- **Authority-chained.** Clinician → credential → issuer → verifier → decision.
- **Carries runtimeTrust.** [replayEngine.runtimeCohesion.test.ts](../../apps/api/backend/src/services/audit/__tests__/replayEngine.runtimeCohesion.test.ts) verifies `correlationId / payloadHash / mutationFingerprint` flow through.
- **Tamper-evidence literal honest.** Three distinct messages ([replayEngine.ts:376-383](../../apps/api/backend/src/services/audit/replayEngine.ts)) for hash mismatch, evidence-spine mismatch, generic replay failure.

### Where it fails operator explanation

- **Outer R-CAT-6 masks inner action.** Every replay reads `replayCategory: 'R-CAT-6'`. SIEM aggregates wrong.
- **Recorded-vs-computed mixed in one envelope.** No marker.
- **`'UNKNOWN'` trust state is dual-cause.** Recorded fact vs replay-time artifact loss; `capturedAt: null` discriminates but is not visually distinct.
- **Replay invocation is not durable.** No audit row says "a replay happened." Investigator cannot ask "who replayed during the incident?"
- **Replay-as-verb-without-noun.** Defensible (no audit feedback loop) and operator-blind ([trust-fabric-continuity.md](trust-fabric-continuity.md) "channels intentionally decoupled").

**Axis 4 score: 🟢 contract / 🟠 surface.** Replay durability is the most forensically robust of the four axes per-capsule and the most projection-fragile when the envelope leaves a single-capsule context.

## Cross-axis coherence under degradation

The four axes interact at four named seams. Each seam is where an operator might collapse two axes into one and read a stronger property than the contract holds.

### Seam 1 — Runtime ↔ Audit

**Property pair:** the metadata exists in memory; the row may not yet be in durable storage.
**Operator confusion vector:** "The mutation fingerprint exists, so the audit row is durable."
**Reality:** runtime durability is upstream of audit durability; runtime metadata can exist before the row lands.
**Severity:** 🟠 — under high-throughput async lag, the runtime ↔ audit gap can be measurable.

### Seam 2 — Audit ↔ Replay

**Property pair:** replay reads from `DecisionCapsule + verificationArtifact`; if rows are `pending_not_written`, replay is missing them.
**Operator confusion vector:** "I replayed at T+5s, so I see everything that happened up to T."
**Reality:** replay sees only durable rows. Pending rows are not in the bundle.
**Severity:** 🟠 — under async lag, replay-during-incident may be incomplete.

### Seam 3 — Replay ↔ Export

**Property pair:** export wraps replay output; per-capsule replay errors are dropped silently.
**Operator confusion vector:** "The bundle has 49 replays; that's 49 capsules' worth of forensic record."
**Reality:** the bundle has 49 of N requested. The dropped capsule(s) — typically the most degraded — are invisible.
**Severity:** 🔴 — this is the canonical export-durability inflation.

### Seam 4 — Audit ↔ Export

**Property pair:** export reads audit-via-replay; `eventState` does not propagate into the bundle.
**Operator confusion vector:** "The bundle includes everything in the audit table at export time."
**Reality:** the bundle includes durable capsules. Pending audit rows for non-capsule events do not appear in capsule-shaped exports at all.
**Severity:** 🟡 — defensible because non-capsule events (denials, refusals, monitoring) have their own paths; misleading because the bundle reads as comprehensive.

## Operationally survivable, axis by axis

For each axis, can an operator without source-code knowledge correctly read the durability state from the surface alone?

| Axis | Operator can read durability state from surface? |
|---|---|
| Runtime durability | ❌ no surface |
| Audit durability | ❌ no surface; `eventState` invisible |
| Export durability | ⚠️ partial — bundle exists, completeness implied not declared |
| Replay durability | ⚠️ partial — `tamperEvidence` is readable; recorded-vs-computed is not |

**Two ❌ axes, two ⚠️ axes, zero ✅ axes.** No durability axis is end-to-end operationally survivable at the surface today.

## What an operator running an incident sees

A 30-minute degradation: issuer slow, source-coverage flapping, three capsule writes deferred, two refusals fired, one bundle export request in flight.

| Operator question | Axis | Can they answer? |
|---|---|---|
| "Did this mutation happen runtime-wise?" | runtime | ✅ via HTTP response or runtimeTrust block in JSON |
| "Did the audit row land?" | audit | ❌ no surface |
| "Did the bundle export include everything I asked for?" | export | ❌ schema does not say |
| "Did the replay reflect decision-time state or current artifact state?" | replay | ⚠️ envelope does not separate |
| "Were any audit rows dropped because of the degradation?" | audit ↔ export | ❌ no field |
| "Was this event durable when I observed it?" | runtime ↔ audit | ❌ no surface |
| "Was an issuer-side refusal recorded for this entity during the window?" | audit | ❌ no row at all |

**Score: 1 ✅, 1 ⚠️, 5 ❌.** Six of seven incident-shape questions about durability cross the seams between two axes; six of seven cannot be answered from the surface.

## Channels intentionally decoupled (re-affirmed)

Per prior waves, three decouplings remain right calls and continue to be honored:

- **Lane health is not a trust-state input.** Operational availability does not become provenance. Honest decoupling.
- **Replay does not write a "replay happened" row.** Avoids audit feedback loops. Defensible decouple at the cost of replay-event queryability.
- **Demo paths produce demo literals.** `recordedBy: 'demo'`, `demo_not_persisted`. Strongest anti-inflation gate; effective under all four durability axes.

## Where coherence holds best

**The runtime ↔ replay continuity is the strongest cross-axis coherence in the codebase.** `runtimeTrust` written at capsule write flows into the replay envelope unchanged ([replayEngine.runtimeCohesion.test.ts](../../apps/api/backend/src/services/audit/__tests__/replayEngine.runtimeCohesion.test.ts)). `correlationId / payloadHash / mutationFingerprint` survive the round-trip verbatim. This is the load-bearing axis-pair that makes per-capsule forensic reconstruction honest.

The wave's named cohesion gain ([trust-fabric-continuity.md](trust-fabric-continuity.md) "load-bearing continuity gain") is at this seam — the runtime-to-replay handshake.

## Where coherence holds worst

**The audit ↔ export continuity is the weakest.** `eventState` does not propagate into the bundle. Dropped capsules vanish silently. `pending_not_written` is invisible at the audit-row surface and absent from the export schema entirely.

A reader handed an audit bundle has no way to ask "was the audit complete at export time?" because the bundle does not encode durability-of-source-rows.

## Verdict

**Four durability axes, three with honest contracts and one best-effort. Surface explanation absent at all four. Cross-axis coherence robust at runtime↔replay and weakest at audit↔export.**

Runtime durability is the cohesion gain of the wave: deterministic, fingerprinted, taxonomy-bound. Audit durability is honest in its `eventState` literals and silent at every operator-facing channel. Export durability is structurally inflated — the bundle's schema implies completeness that the synchronous best-effort loop does not deliver. Replay durability is deterministic per-capsule and projection-fragile across capsules.

The cross-axis pattern is consistent with the wave's deliberate ordering. The four contracts hold or are honestly best-effort. The four surfaces are absent. The two seams that concentrate inflation risk under degradation are runtime ↔ audit (durability gap invisible) and audit ↔ export (completeness implied not declared).

**Strongest durability-cohesion gain:** the `runtimeTrust` round-trip from `buildRuntimeMutationMetadata` through capsule metadata into `replayDecision`, verified by [replayEngine.runtimeCohesion.test.ts](../../apps/api/backend/src/services/audit/__tests__/replayEngine.runtimeCohesion.test.ts). The ledger-to-replay handshake is the load-bearing continuity in the wave.

**Weakest cohesion seam:** audit ↔ export. `eventState` does not propagate into the bundle. The bundle that leaves the perimeter cannot, today, be read as a true durable snapshot.

**Track C score: 🟡 PARTIAL.** Four axes, four contracts mostly intact, surface explainability uniformly absent. **Runtime durability continuity is high at the contract layer, partial at the cross-axis layer, and silent at the operator layer — exactly the ordering that makes the contract honest and the operator dependent on JSON parsers.**

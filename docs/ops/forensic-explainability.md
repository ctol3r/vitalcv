# Forensic Explainability — W2-PR8B Track B

**Wave:** W2-PR8B — Operational Trust Fabric Explainability
**Date:** 2026-05-08
**Status:** Review-only synthesis. No code changes, no merges.
**Risk class:** SAFE (read-only inventory).
**Companion to:** [operator-query-understanding](operator-query-understanding.md), [trust-fabric-continuity](trust-fabric-continuity.md), [runtime-query-explainability](runtime-query-explainability.md).
**Builds on:** [w2-pr7b-operational-trust-continuity](w2-pr7b-operational-trust-continuity.md), [w2-pr7b-operator-model-integrity](w2-pr7b-operator-model-integrity.md).

---

## What this track answers

If a forensic investigator (auditor, regulator, opposing counsel, postmortem reviewer) sat down with VitalCV today, could they reconstruct **what happened, who did it, and why** for any specific decision, without losing the chain at any seam?

PR7B audited internal continuity (do surfaces agree?). **This track audits external continuity — does the explanation remain intact when the system is read by an outsider with no context?**

## Definitions

- **Lineage continuity:** the chain from raw input → recorded action → audit row → replay envelope is unbroken and consistent.
- **Replay continuity:** a replay performed today returns the same answer as a replay performed at decision time, modulo recorded-vs-reconstructed labeling.
- **Denial continuity:** a denied request can be reconstructed end-to-end, including who refused, what gate fired, and why.
- **Export continuity:** an exported bundle (audit bundle, packet, wallet credential) carries enough information to be re-verified by a third party.
- **Forensic ambiguity:** any place a reasonable outside reader could draw two contradictory conclusions from the same recorded data.

## Continuity scoreboard

| Dimension | Hold? | Where it holds | Where it breaks |
|---|---|---|---|
| **Lineage continuity** | ✅ | Receipt candidate → policy review → decision capsule → replay envelope is one literal chain ([w2-pr7b-runtime-semantics-cohesion.md](w2-pr7b-runtime-semantics-cohesion.md)) | Lineage from raw issuer response to receipt candidate is structural, not in the audit row |
| **Replay continuity** | ✅ | `correlationId` / `payloadHash` / `mutationFingerprint` preserved across replay ([replayEngine.runtimeCohesion.test.ts](../../apps/api/backend/src/services/audit/__tests__/replayEngine.runtimeCohesion.test.ts)) | Outer envelope `replayCategory` is unconditionally `R-CAT-6`; inner action carries true category |
| **Denial continuity** | ⚠️ | Denied mutations write `EMPLOYER_REVIEW_MUTATION_DENIED` with `denial_reason` payload + runtimeTrust metadata | Three reasons collapse to one event type; issuer-side `refusalGate` does not flow into the audit row at all |
| **Export continuity** | ⚠️ | Audit bundle is self-describing, self-verifying, includes hash + verification instructions ([replayEngine.ts:139-174](../../apps/api/backend/src/services/audit/replayEngine.ts)) | No third-party verifier tooling shipped; no signed bundle (only hash); no re-verifiable trust chain across orgs |
| **Actor continuity** | ⚠️ | `actor.actorId` + `attributionSource` written into every mutation row | `actorType: 'unknown'` falls back to `'unknown'` silently; no operator surface attributes ambiguously-attributed actions |
| **Cross-system continuity** | ❌ | n/a | Issuer-verification and employer-review run as parallel state machines; no audit-row bridge between them |
| **Demo-vs-real continuity** | ✅ | `recordedBy: 'demo'` everywhere, `defer_until_contract_aligned` is the audit default ([w2-pr7b-operational-trust-continuity.md](w2-pr7b-operational-trust-continuity.md)) | Will need explicit copy when both demo and real persist side-by-side |
| **Time continuity** | ✅ | `decisionTimestamp`, `verifiedAt`, `replayedAt`, `consultedAt` are typed and present | No clock-skew detection; no tamper-evidence on timestamps beyond hash |
| **Hash continuity** | ✅ | Stored hash vs recomputed hash is checked; `tamperEvidence` field is a first-class output ([replayEngine.ts:77-85](../../apps/api/backend/src/services/audit/replayEngine.ts)) | Hash methodology is `SHA-256`, recorded; no signature; tamper signal is detection, not prevention |

**Tally:** 4 hold, 3 partial, 1 fails. The chain is forensically continuous **inside a single capsule's lifecycle** and **inside the runtime trust cohesion taxonomy**. It is forensically discontinuous **across the issuer ↔ employer seam** and **across the boundary that makes a bundle externally verifiable**.

## Forensic ambiguity register

These are points where two reasonable outside readers can extract two different conclusions from the same record, with no error or warning to disambiguate.

### 1. Outer-vs-inner replay category

Every replay envelope carries `replayMetadata.replayCategory: 'R-CAT-6'` and `mutationClassification: 'DOSSIER_REPLAY'`. Inside the replayed action's recorded `runtimeTrust` metadata, the original action's R-CAT-1…5 lives. A consumer reading the envelope's outer category as the original action class will **mis-classify every replayed action as a dossier replay**.

- **Severity:** medium — the data is there, the consumer must know to drill in.
- **Evidence:** [runtimeTrustCohesion.ts:56-63](../../apps/api/backend/src/services/runtimeTrustCohesion.ts) (envelope schema) vs [runtimeTrustCohesion.ts:43-54](../../apps/api/backend/src/services/runtimeTrustCohesion.ts) (recorded mutation schema).
- **Pre-existing finding:** [w2-pr7b-operational-trust-continuity.md](w2-pr7b-operational-trust-continuity.md) flagged this as continuity hotspot #2.

### 2. Two refusal vocabularies, no bridge

`refusalGate` (issuer side, 6 values) and `denial_reason` (employer side, 3 values base, 6 with NPI variants) describe the same operational shape with no shared namespace.

- **Severity:** medium — a forensic question shaped "all refusals for this clinician across all surfaces" returns two non-comparable result sets.
- **Evidence:** [policyReview.ts:67-122](../../apps/web/lib/issuer-verification/policyReview.ts) vs [employerActions.ts](../../apps/api/backend/src/routes/employerActions.ts).
- **Compounds with:** issuer-side `refusalGate` is not bound to any UI ([w2-pr4d-operator-understanding.md](w2-pr4d-operator-understanding.md)). The forensic record exists in tests; the operator-visible record does not.

### 3. `unable_to_verify` is two distinct concepts

As `IssuerResponseStatus` it is what the issuer said. As `ReceiptCandidateReviewState` it is a terminal candidate state. Code distinguishes via literal types; copy and audit row payloads sometimes blur them.

- **Severity:** low-to-medium — typed code distinguishes; an outside reader reading the audit payload alone may not.
- **Pre-existing finding:** [w2-pr7b-operational-trust-continuity.md](w2-pr7b-operational-trust-continuity.md) hidden ambiguity #3.

### 4. `pending_not_written` vs `demo_not_persisted`

Both render as "not durable" to a reader. Different causes (no writer attempted vs writer ran in demo mode). Today neither is operator-visible; when audit-write status is surfaced, copy must distinguish.

- **Severity:** low for now (no UI), high once UI lands without explicit copy.
- **Evidence:** [auditPersistence.ts](../../apps/api/backend/src/services/audit/auditPersistence.ts) and [w2-pr7b-runtime-semantics-cohesion.md](w2-pr7b-runtime-semantics-cohesion.md).

### 5. `conflict_review_required` has dual provenance

Same string reachable from issuer-`corrected` and reviewer-`mark_conflict_review`. Provenance is in the audit row but not in the candidate object itself.

- **Severity:** low — a forensic reader chasing root cause must follow two different rows back.
- **Pre-existing finding:** [w2-pr7b-operational-trust-continuity.md](w2-pr7b-operational-trust-continuity.md) hidden ambiguity #1.

### 6. Replay envelope mixes recorded with computed

`DecisionReplay` contains fields recorded at decision time and fields reconstructed at replay time, with no marker on the envelope distinguishing them.

- **Severity:** medium for forensic readers — every reader must know which fields are which.
- **Evidence:** [replayEngine.ts:87-139](../../apps/api/backend/src/services/audit/replayEngine.ts).
- **Pre-existing finding:** [w2-pr7b-operational-trust-continuity.md](w2-pr7b-operational-trust-continuity.md) continuity hotspot #2.

### 7. Composed readiness color on an edge

`BLOCKED` status with high score yields yellow on the passport surface ([passport/page.tsx:673-677](../../apps/web/app/passport/[id]/page.tsx)).

- **Severity:** medium for the operator surface, low for the audit record (literal `readinessLevel` is unambiguous).
- **Pre-existing finding:** [w2-pr7b-runtime-semantics-cohesion.md](w2-pr7b-runtime-semantics-cohesion.md) ambiguity vector #1.

### 8. `actorId === 'unknown'` is a silent fallback

[runtimeTrustCohesion.ts:154](../../apps/api/backend/src/services/runtimeTrustCohesion.ts) replaces missing actor ID with literal `'unknown'`, with `actorType: 'unknown'` and `attributionSource: 'unknown'`. A forensic reader sees a recorded actor; the recorded actor is "unknown."

- **Severity:** medium — a forensic record is worse than nothing if it pretends to know who acted.
- **Mitigation:** the schema does carry `attributionSource: 'unknown'` so a careful reader can detect this; an inattentive reader cannot.

## Forensic continuity by surface

### Replay continuity ✅ (with caveats)

A capsule replay returns:
- `correlationId` / `payloadHash` / `mutationFingerprint` preserved verbatim from the recorded mutation.
- `IntegrityCheck.hashMatch` is a first-class boolean.
- `tamperEvidence` is null when clean, populated when not.
- Authority chain is reconstructed from the same source data each time.

This is **deterministic**: same capsule, same replay, every time ([replayEngine.ts:14-15](../../apps/api/backend/src/services/audit/replayEngine.ts) explicit design constraint).

**Caveats:** outer-vs-inner R-CAT confusion (ambiguity #1), recorded-vs-computed mixing in the envelope (ambiguity #6).

### Denial continuity ⚠️ partial

A denied mutation produces:
- `EMPLOYER_REVIEW_MUTATION_DENIED` audit event (employer side only).
- `runtimeTrust.outcome: 'denied'` with optional `denialReason` string in metadata.
- `replayCategory: 'R-CAT-5'`, `mutationClassification: 'DENIED_MUTATION'`.
- Actor + correlation + fingerprint.

**Holds:** within the employer-review surface, a denial is fully replayable.
**Breaks:** issuer-side `refusalGate` does not write a paired `ISSUER_REVIEW_REFUSED` audit row; refusal lives in the policy-review return value, in tests, and (when persisted) inside the receipt-candidate object — not as a discrete audit row keyed by `event.type`.
**Reporting bias:** `event.type` group-by reads "all denials are one kind" because the three reasons collapse into the type ([w2-pr7b-operational-trust-continuity.md](w2-pr7b-operational-trust-continuity.md) hotspot #4). An aggregator that groups by reason field tells a real story; an aggregator that groups by event type does not.

### Export continuity ⚠️ partial

The audit bundle:
- Carries `bundleHash` (SHA-256) of all content.
- Has `verificationInstructions` (algorithm, replay endpoint, verify endpoint).
- Self-describes via `schema: 'https://vitalcv.com/audit-bundle/v1'`.
- Supports JSON and NDJSON formats.

**Holds:** as a self-describing artifact, the bundle is a coherent forensic export.
**Breaks:**
1. **No signature.** Hash detects in-transit tamper but does not bind the bundle to VitalCV. A forensic reader has no cryptographic proof the bundle came from VitalCV vs an attacker who recomputed the hash.
2. **No third-party verifier tooling.** `verifyEndpoint` exists; no shipped client, no published spec for offline verification.
3. **No SIEM connector.** No syslog, no Splunk forwarder, no native CSV. A SOC team integrating VitalCV writes a custom JSON parser.
4. **Cross-org chain not externally re-verifiable.** Authority chain links span clinician → credential → issuer → verifier → decision; chain integrity rests on VitalCV-internal IDs.

### Actor continuity ⚠️ partial

Every mutation records actor identity:
- `actorId` (Clerk user id when present, `'unknown'` when not)
- `actorType` (`human` / `system` / `unknown`)
- `attributionSource` (`x-clerk-user-id` / `system` / `unknown`)

**Holds:** when the request carries a Clerk header, attribution is honest.
**Breaks:**
1. Silent `'unknown'` fallback (ambiguity #8).
2. No operator surface for actor-keyed queries (Track A 🔴).
3. No `actorType: 'AI_AGENT'` in the runtime taxonomy, although `VerifierIdentity.type` does include `'AI_AGENT'` ([replayEngine.ts:58](../../apps/api/backend/src/services/audit/replayEngine.ts)) — this is a vocabulary mismatch between mutation-side and replay-side actor models.

### Cross-system continuity ❌

The two state machines (issuer-verification and employer-review) share the passport object but not the audit row. A forensic reader asking "show me the full chain for clinician C" must:

1. Pull issuer-side state from receipt-candidate / policy-review / receipt rows.
2. Pull employer-side state from `AuditEvent` rows for `EMPLOYER_REVIEW_*`.
3. Manually reconcile timestamps and entity IDs.
4. Notice that the issuer-side `refusalGate` doesn't have a row at all.

**This is a fragmentation, not a break.** The data is there; the forensic burden is on the reader. Per [w2-pr7b-operational-trust-continuity.md](w2-pr7b-operational-trust-continuity.md), the path forward is explicit dual-display, not collapsing the two state machines.

## What an outside auditor sees today

Imagine a HIPAA-trained compliance auditor with a copy of the audit bundle and a copy of [w2-pr7b-operational-trust-continuity.md](w2-pr7b-operational-trust-continuity.md). They open the bundle for a single decision capsule.

| Question | Can the auditor answer it? | How |
|---|---|---|
| What was decided? | ✅ | `decision.action`, `decision.outcome` |
| When? | ✅ | `decisionTimestamp` |
| By whom? | ⚠️ | `verifierIdentity` is in the bundle; if `actorId` was unknown at write, "unknown" with an attribution source of "unknown" |
| Based on what evidence? | ✅ | `evidenceSnapshot.evidenceRecords` |
| From which sources? | ✅ | `evidenceSnapshot.sourcesConsulted` |
| Has it been tampered with? | ✅ | `integrity.hashMatch`, `integrity.tamperEvidence` |
| What would have happened if a different decision was made? | ❌ | counterfactual replay not exposed |
| Is this bundle from VitalCV or forged? | ⚠️ | hash present, no signature; trust depends on transport |
| What other decisions exist for this NPI? | ✅ | `relatedDecisions` array |
| Was anything denied for this clinician? | ⚠️ | not in the capsule bundle; requires separate audit-event query |
| Why was a denial denied? | ⚠️ | requires reading raw audit row payload, not in bundle |
| Did anyone replay this capsule before? | ❌ | replay is invocation-on-demand, no replay row written |

**Score: 6 ✅, 4 ⚠️, 2 ❌.** The auditor can reconstruct *what happened in this capsule* with high fidelity. The auditor cannot easily reconstruct *the broader behavior of the system around this capsule* — denials, refusals, replays, cross-application context — without going outside the bundle.

## Verdict

**Forensic explainability is high-fidelity per-capsule, fragmented per-system.**

The single-capsule replay is one of the strongest forensic surfaces in the codebase: deterministic, hash-checked, authority-chained, runtime-cohered. Per [replayEngine.runtimeCohesion.test.ts](../../apps/api/backend/src/services/audit/__tests__/replayEngine.runtimeCohesion.test.ts), the contract is tested. An outside reader given a capsule bundle gets a coherent story.

The cross-capsule, cross-system, cross-vocabulary forensic surface is not equally strong. Two refusal vocabularies, an unwritten replay event, no signed bundle, no SIEM connector, no third-party verifier client. None of these are bugs — every one is a deliberate choice. The pattern is:

- **What the system records: tight.**
- **What the system surfaces: tight.**
- **What an outside system can interrogate: limited.**

This is the right ordering for the wave. The forensic-readiness floor is high. The forensic-readiness ceiling — third-party verifiability, cross-system reconstructibility — is the next-wave backlog.

**Track B score: 🟡 PARTIAL.** Strongest surface: per-capsule replay determinism. Weakest surface: cross-system refusal continuity. Biggest forensic ambiguity: outer-vs-inner R-CAT confusion in the replay envelope. **Forensic explainability holds at the contract layer and within a capsule; it thins at the seam between issuer-verification and employer-review.**

# Forensic Durability Understanding — W2-PR10B Track B

**Wave:** W2-PR10B — Operator Survivability Explainability
**Date:** 2026-05-08
**Status:** Review-only synthesis. No code changes, no merges.
**Risk class:** SAFE (read-only inventory).
**Companion to:** [survivability-explainability](survivability-explainability.md), [runtime-durability-continuity](runtime-durability-continuity.md), [trust-fabric-durability-cohesion](trust-fabric-durability-cohesion.md).
**Builds on:** [forensic-explainability](forensic-explainability.md), [w2-pr9b-forensic-survivability](w2-pr9b-forensic-survivability.md).

---

## What this track answers

PR8B Track B and PR9B Track C asked whether an investigator could **reconstruct what happened**. This track asks the harder question: **would an investigator misread what the system records?** Specifically:

- Where would they assume durability the contract does not hold?
- Where would they assume continuity across an async seam that is not continuous?
- Where would they assume completeness from an export that is best-effort?
- Where would they read a literal the same way two different surfaces produce it?

A reconstruction that is technically correct can still produce a confidently wrong forensic conclusion. The risk is not that the data is missing; the risk is that the data is read with a stronger property than it carries.

## Definitions

- **False forensic assumption:** a conclusion an investigator would reach from the recorded artifact that the recorded artifact does not actually support.
- **Hidden ambiguity:** a literal whose two meanings cannot be distinguished from the literal alone.
- **Survivability confusion:** an investigator misreading a survivability artifact as either stronger (more durable) or weaker (less durable) than the system claims.
- **Trust inflation vector:** any structural property of the recorded shape that reads as a stronger trust property than the contract layer actually holds.
- **Async discontinuity:** a seam between an event and its forensic record that requires a wall-clock gap of >0 ms to close.

## Forensic durability scoreboard

| Forensic question | Recorded answer | Property of the answer | Score |
|---|---|---|---|
| Did this decision happen? | `DecisionCapsule` row + `EMPLOYER_REVIEW_ACCEPTED` audit row | durable + transactional | 🟢 CLEAR |
| What was decided? | capsule + replay envelope | durable | 🟢 CLEAR |
| When was it decided? | `decisionTimestamp` | durable | 🟢 CLEAR |
| What evidence supported it? | `evidenceSnapshot.evidenceRecords` | recorded references; reconstructed at replay | 🟡 PARTIAL |
| Who decided it? | `verifierIdentity` + `runtimeTrust.actor` | durable when known; silent fallback to `'unknown'` | 🟠 CONFUSING |
| Was the bundle complete? | `bundleHash` + `capsuleCount` | hash over **survived**, count of **survived** | 🔴 MISLEADING |
| Was a denial recorded? | `EMPLOYER_REVIEW_MUTATION_DENIED` | durable; type collapses three reasons | 🟠 CONFUSING |
| Was a refusal recorded? | (no event type for issuer-side `refusalGate`) | not durable as an event row | 🔴 MISLEADING (by absence) |
| Was a replay performed during the incident? | (no audit row for replay invocation) | observable in HTTP logs only | 🔴 MISLEADING (by absence) |
| Was a retry one logical action or many? | three correlation IDs, one fingerprint, three rows | recorded both ways; surface reads three | 🟠 CONFUSING |
| Was the action transactional with the audit row? | side effect transactional; audit row is `pending_not_written` then persisted | recorded with timestamps; gap invisible | 🟠 CONFUSING |
| Was the trust state at decision time genuinely unknown? | `trustStateAtDecision: 'UNKNOWN'` | recorded *or* computed-fallback; envelope cannot distinguish | 🟠 CONFUSING |
| Was the bundle signed by VitalCV? | `bundle.issuer: 'VitalCV'` + `bundleHash` | hash only; transport-trusted | 🟡 PARTIAL |
| Did this audit row land durably? | (no field on the row exposes `eventState`) | code-side flag only | 🟠 CONFUSING |
| Was an AI agent involved? | `verifierIdentity.type: 'AI_AGENT'` exists; `actor.actorType: 'AI_AGENT'` does not | mixed taxonomy | 🟠 CONFUSING |

**Tally:** 3 🟢, 2 🟡, 7 🟠, 3 🔴.

## False forensic assumption register

Each entry below is a conclusion an investigator would draw from the recorded shape that is wrong.

### FA-1 — "The bundle is complete because the hash verifies." 🔴

**Where it forms:** `verificationInstructions.how` = "verify integrity.hashMatch === true." Each replay's `integrity.hashMatch` is true. `bundleHash` recomputes over the included replays.

**Why it's wrong:** the hash is internally consistent over **what survived** the synchronous best-effort export loop. Capsules whose replay threw are dropped silently ([replayEngine.ts:568-573](../../apps/api/backend/src/services/audit/replayEngine.ts)). The bundle has no field for `requestedCount` or a manifest of dropped IDs.

**Mitigation in code:** the `obs/logger` records dropped capsule IDs, but the log is not bound to the bundle.

**Investigator-impact:** highest in the inventory. The artifact most likely to leave VitalCV's perimeter is the artifact that most strongly implies completeness while delivering best-effort survival.

### FA-2 — "An action by `actorId: 'unknown'` was anonymous." 🟠

**Where it forms:** the recorded `actor.actorId: 'unknown'`, `actorType: 'unknown'`, `attributionSource: 'unknown'`.

**Why it's wrong:** `'unknown'` is a *fallback*, not an identity. The action was real and produced a side effect. The actor is unattributed at write time. A reader treating `'unknown'` as a stable identity (e.g., to count actions per actor) is mixing real anonymous actions with attribution-loss actions with system actions that should have been typed `'system'`.

**Pre-existing finding:** [forensic-explainability.md](forensic-explainability.md) ambiguity #8.

### FA-3 — "No issuer-side refusals occurred during the window because there are no refusal rows." 🔴

**Where it forms:** `gh search` or audit-row query for the window returns zero `refusalGate`-typed rows.

**Why it's wrong:** issuer-side `refusalGate` is a return value of [`policyReview.ts`](../../apps/web/lib/issuer-verification/policyReview.ts) helpers and does not produce an audit row at all ([w2-pr9b-forensic-survivability.md](w2-pr9b-forensic-survivability.md) blind spot #1). Six refusal gates can fire across the window with zero rows.

**Investigator-impact:** for any cross-system reconstruction, "no row" reads as "no refusal." The forensic floor on issuer-side refusals is zero — not "ambiguous," but "absent."

### FA-4 — "The replay envelope is the system's record of decision time." 🟡

**Where it forms:** `DecisionReplay` envelope returned by `replayDecision`.

**Why it's wrong:** the envelope mixes recorded fields (decision, evidence references, authority chain) with **fields computed at replay time** (`integrity.recomputedHash`, `replayedAt`, `replayMetadata`, `evidenceSnapshot.sourcesConsulted` re-derived from current artifact rows). No marker on the envelope distinguishes them.

**Pre-existing finding:** [w2-pr7b-operational-trust-continuity.md](w2-pr7b-operational-trust-continuity.md) hotspot #2; [survivability-explainability.md](survivability-explainability.md) replay-fragile path #3.

### FA-5 — "100% of these replays were dossier replays because `replayCategory: 'R-CAT-6'`." 🔴

**Where it forms:** SIEM aggregation, log analytics, or any flat projection on `replayMetadata.replayCategory`.

**Why it's wrong:** every replay envelope's outer category is unconditionally `R-CAT-6`. The original action's R-CAT-1…5 lives inside `meta.runtimeTrust` — the inner mutation row, not the outer envelope.

**Pre-existing finding:** [forensic-explainability.md](forensic-explainability.md) ambiguity #1, [runtime-query-explainability.md](runtime-query-explainability.md) failure #2.

### FA-6 — "All these denials were the same kind of denial because they share an event type." 🟠

**Where it forms:** group-by on `event.type` in the audit table, or any aggregate that reads `EMPLOYER_REVIEW_MUTATION_DENIED` count.

**Why it's wrong:** three reasons (`already_accepted`, `passport_unavailable`, `acceptance_blocked`, plus NPI variants) collapse to one event type. Reason lives in the payload.

**Pre-existing finding:** [operator-query-understanding.md](operator-query-understanding.md) 🔴; [w2-pr9b-forensic-survivability.md](w2-pr9b-forensic-survivability.md) blind spot #5 indirectly.

### FA-7 — "Trust state at decision was unknown because `trustStateAtDecision: 'UNKNOWN'`." 🟠

**Where it forms:** replay-envelope read.

**Why it's wrong:** the same literal `'UNKNOWN'` is reachable from two structurally distinct causes — the trust state was genuinely unknown then, or the `TRUST_STATE_ENGINE` artifact has aged out of retention by replay time. The envelope's `trustStateAtDecision.capturedAt: null` is the discriminator; an inattentive reader does not see it.

### FA-8 — "Three retry rows mean three different events." 🟠

**Where it forms:** any timeline group-by on `correlationId` or any flat enumeration that doesn't dedupe.

**Why it's wrong:** retries by the same actor on the same entity collapse to one `mutationFingerprint`. No surface group-bys fingerprint, so the recorded data permits both the right reading (one event) and the wrong reading (three events) without any explicit signal.

**Pre-existing finding:** [w2-pr9b-degraded-trust-state-continuity.md](w2-pr9b-degraded-trust-state-continuity.md) retry continuity 🟠.

### FA-9 — "The audit row was written when the action happened." 🟠

**Where it forms:** any reader who reads only the audit row's `createdAt` timestamp.

**Why it's wrong:** `eventState: 'pending_not_written'` is the default. The transition from `pending_not_written` → `persisted` is a wall-clock gap during which the side effect has landed and the row has not. Forensically, the timestamp survives; the gap invisibly violates "audit was synchronous with action."

**Pre-existing finding:** [w2-pr9b-degraded-trust-state-continuity.md](w2-pr9b-degraded-trust-state-continuity.md) audit-state lifecycle ⚠️.

### FA-10 — "The bundle is from VitalCV because `issuer: 'VitalCV'`." 🟡

**Where it forms:** bundle field read.

**Why it's wrong:** the field is a literal string in the bundle. There is no signature binding the bundle's content to a VitalCV-controlled key. A motivated attacker could generate a bundle with the same hash methodology and the same literal. Trust depends on the transport (TLS to `api.vitalcv.com`), not on the artifact.

## Hidden ambiguity register (delta from prior waves)

These are literals or shapes whose ambiguity is *amplified* under degraded survivability conditions, beyond what prior waves catalogued.

### HA-1 — `'UNKNOWN'` trust band: read-time vs. decision-time

Already in PR9B forensic survivability zone 3. **Amplification under degradation:** as retention policies age out artifacts, the rate of false-`UNKNOWN` from replay-time fallback rises. The literal stays the same; the meaning drifts.

### HA-2 — `verifierIdentity.userId: null` vs. `actor.actorId: 'unknown'`

Both indicate "no human attributed." `verifierIdentity.userId` is `null` when `meta.clerkUserId` is missing; `actor.actorId` is `'unknown'` when the runtime mutation arrived without a Clerk header. The two fallbacks are independent and can disagree on the same record.

### HA-3 — `verifierIdentity.type: 'SYSTEM'` vs. `'AI_AGENT'` not in `actor.actorType`

`VerifierIdentity.type` includes `'AI_AGENT'` ([replayEngine.ts:58](../../apps/api/backend/src/services/audit/replayEngine.ts)); `RuntimeTrustActor.actorType` does not. An AI-driven mutation is recorded as `'human'` in the runtime row and could be `'AI_AGENT'` in the verifier identity if the metadata captured it. **Two taxonomies disagree on the same forensic question.**

### HA-4 — `pending_not_written` vs. `defer_until_contract_aligned`

Both reduce to "not in the durable audit table." Different causes (queued for write vs. policy decision to not write). Today both are silent at the surface; when surface lands, copy must distinguish.

## Async discontinuity register

Each entry is a wall-clock gap between an event and its forensic record.

| Discontinuity | Gap source | Forensic consequence |
|---|---|---|
| Mutation → audit row | `pending_not_written` default | row lands later; timestamps survive; "row was written when action happened" is false during gap |
| Replay invocation → durable record | replay is computed-on-demand, no event row | no record exists; investigator has only HTTP logs |
| Bundle export request → bundle delivered | synchronous serial loop | one slow capsule blocks export; no progress signal |
| Authority chain construction → recorded chain | chain built every replay from artifacts | chain at replay time may differ from chain at decision time if artifacts changed |
| Issuer-side refusal → forensic record | (no record at all) | discontinuity is ∞ ms |
| `runtimeTrust` metadata → capsule persistence | written together at capsule write time | converges only when capsule write succeeds |
| Trust-state derivation → recorded snapshot | recorded only when capsule writes | lane-health flips between capsule writes are not in any single capsule's recorded snapshot |

**The async discontinuity that concentrates the highest forensic risk is the audit-write gap** (`pending_not_written` → `persisted`) **because it is the only one with a non-zero finite gap that is invisible to every operator surface and every export.**

## Trust inflation vector register

Each entry is a structural property of the recorded shape that reads as stronger than the contract holds.

### TIV-1 — `bundleHash` + `verificationInstructions` imply completeness

**Inflation:** "bundle is complete and verifiable." **Reality:** internally consistent over what survived. Already documented in FA-1.

### TIV-2 — `eventState` has no surface, so silence implies persistence

**Inflation:** "everything you see in the audit table is durably persisted." **Reality:** `pending_not_written` is the default; the durable subset is invisible.

### TIV-3 — `'unknown'` recorded without highlighting reads as identity

**Inflation:** "this person/system is named 'unknown' and acted." **Reality:** `'unknown'` is a fallback; the recorded shape does not distinguish unattributed from anonymous from system-with-no-header.

### TIV-4 — Outer R-CAT-6 implies the inner action was a replay

**Inflation:** "this was a dossier replay." **Reality:** every replay envelope reads R-CAT-6 regardless of original action.

### TIV-5 — `verifierIdentity.type: 'SYSTEM'` reads as fully attributed system action

**Inflation:** "VitalCV's automated system did this." **Reality:** `'SYSTEM'` is the default when no `verifierOrgId` and no `confirmedBy` is present in metadata; it is correct in steady state and can mask cases where attribution metadata simply wasn't captured.

### TIV-6 — Bundle `issuer: 'VitalCV'` reads as cryptographic provenance

Already documented in FA-10. The literal field carries the brand without binding it cryptographically.

**Tally:** six structural inflation vectors, none of which are copy-side banned-string violations against [CLAUDE.md](../../CLAUDE.md). The doctrine-level anti-inflation gates hold; the structural-shape gates are the next layer down and have gaps.

## What an outside investigator concludes today

Imagine a regulator with the audit bundle for a 30-minute degraded window. They read the bundle alone, with no source-code access. They form conclusions. Which would be wrong?

| Conclusion | Right or wrong? | Why |
|---|---|---|
| "Decisions in the bundle are forensically reconstructible." | ✅ right | per-capsule replay + hash + chain |
| "This is the complete audit record for the window." | ❌ wrong | best-effort export drops capsules silently |
| "All mutations during the window are attributable." | ❌ wrong | `'unknown'` rows look like real `'unknown'` actors |
| "No refusals happened during the window." | ❌ wrong | issuer-side refusals never produce rows |
| "All denials were the same kind." | ❌ wrong | three reasons under one event type |
| "The audit table was synchronous with the actions." | ❌ wrong | `pending_not_written` gap invisible |
| "These replays were all dossier replays." | ❌ wrong | outer `R-CAT-6` masks inner action |
| "Trust band was unknown at this decision." | ⚠️ ambiguous | could be recorded fact or replay-time fallback |
| "VitalCV cryptographically signed this bundle." | ❌ wrong | hash only, no signature |

**Score: 1 right, 7 wrong, 1 ambiguous.** A motivated investigator with the bundle alone reaches a confidently wrong conclusion on most of the durability-shaped questions.

## Verdict

**Forensic durability understanding is high inside a single capsule's recorded fields and structurally inflated everywhere else.**

The recorded shape is honest at the literal level: `'unknown'` is recorded, `R-CAT-6` is recorded, `'UNKNOWN'` trust band is recorded, hashes are recorded. Each individual literal is what it claims to be. The inflation is at the **structural-shape level**: the bundle's schema implies completeness it does not deliver; the audit row's silence on `eventState` implies persistence; `'unknown'` recorded without highlight implies identity; `R-CAT-6` outer implies replay-as-original-action; `bundleHash` implies cryptographic provenance.

These are not banned-string violations. They are **shape-level** trust inflation. They do not appear in copy review; they do not appear in literal review. They appear only when an investigator without source-code knowledge reads the recorded artifact end-to-end.

The cross-cutting pattern: **the system records honestly and the recorded shape reads optimistically.** Every false forensic assumption in the register above flows from a reader trusting the shape of the artifact more than the contract layer warrants.

**Strongest forensic clarity surface:** per-capsule replay determinism + `tamperEvidence` literal — the only forensic surface in the codebase that is robust to the full degradation spectrum.
**Biggest forensic misunderstanding risk:** `bundleHash` + `verificationInstructions` reading as completeness when the export is best-effort. This single shape concentrates the highest-stakes inflation in the wave because it is the artifact most likely to leave the perimeter.

**Track B score: 🟠 CONFUSING.** Three 🟢, two 🟡, seven 🟠, three 🔴. **Forensic durability understanding is honest at the literal layer and structurally inflated at the shape layer — an investigator gets the right facts and forms wrong conclusions about durability properties the recorded shape implies.**

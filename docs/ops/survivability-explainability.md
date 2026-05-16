# Survivability Explainability — W2-PR10B Track A

**Wave:** W2-PR10B — Operator Survivability Explainability
**Date:** 2026-05-08
**Status:** Review-only synthesis. No code changes, no merges.
**Risk class:** SAFE (read-only inventory).
**Companion to:** [forensic-durability-understanding](forensic-durability-understanding.md), [runtime-durability-continuity](runtime-durability-continuity.md), [trust-fabric-durability-cohesion](trust-fabric-durability-cohesion.md).
**Builds on:** [w2-pr9b-operator-failure-understanding](w2-pr9b-operator-failure-understanding.md), [w2-pr9b-degraded-trust-state-continuity](w2-pr9b-degraded-trust-state-continuity.md), [forensic-explainability](forensic-explainability.md).

---

## What this track answers

PR9B Track A asked whether an operator could *see* a degradation. **This track asks whether the operator, looking at any state the system shows them, would correctly classify it as `observable`, `durable`, or `transactional` — and whether they would correctly read the lineage chain that produced it.**

The single most consequential operator-confusion vector in the codebase is collapsing those three properties:

- `observable`: appears in memory, in an HTTP response, in a log line.
- `durable`: persisted in the audit table, retrievable by replay.
- `transactional`: durable atomically with the side effect it records.

VitalCV's runtime is honest about each property at the contract layer and silent about the difference at the surface layer. Where the silence lets an operator assume a stronger property than the system actually holds, survivability explainability fails.

## Definitions

- **C-1 lineage:** the lineage chain anchored at the most recent **durable checkpoint** — `DecisionCapsule` + `runtimeTrust` metadata persisted to the database. Reconstructible deterministically by `replayDecision`.
- **T0 lineage:** the lineage anchored at the **originating mutation event** — request → route handler → `buildRuntimeMutationMetadata`. Carries `correlationId`, `mutationFingerprint`, `payloadHash` from the moment the mutation began.
- **Degraded lineage:** the C-1 + T0 lineage as it appears when one or more durability seams is in transition — `pending_not_written` audit, `'unknown'` actor, dropped bundle entry, missing source artifact.
- **Replay-fragile path:** a path where replay technically succeeds but produces ambiguous output (e.g., `trustBand: 'UNKNOWN'` from missing artifacts, outer `R-CAT-6` masking inner `R-CAT-1…5`, computed-vs-recorded mixed in one envelope).
- **Export-delayed path:** the gap between an action and the export that represents it; bundle reflects what survived to export time, not what existed at action time.
- **Survivability literal:** any state value whose meaning under degradation differs from its meaning on the happy path (e.g., `'UNKNOWN'`, `pending_not_written`, `actorId: 'unknown'`).

## Survivability surface scoreboard

| Surface | What it shows | Operator reads it as | Actual property | Score |
|---|---|---|---|---|
| Passport `LaneHealthBadge` | source-coverage health | observable + durable + decoupled from trust | observable + durable + decoupled from trust | 🟢 CLEAR |
| Passport readiness pill | derived readiness | durable | computed at read time, derivation not durable | 🟡 PARTIAL |
| Audit timeline | recorded mutations | durable + transactional with side effect | durable when written; **`pending_not_written` is the default** | 🟠 CONFUSING |
| Replay envelope (decision + evidence) | what was decided + on what | durable + replay-faithful | recorded fields durable; **integrity, replayedAt, replay metadata are computed at replay time** | 🟡 PARTIAL |
| Replay envelope (`replayCategory: 'R-CAT-6'`) | this is a replay | unconditionally `R-CAT-6` masks the inner action | every replay reads `R-CAT-6` regardless of inner | 🔴 MISLEADING |
| Replay `tamperEvidence` | tamper detection | tamper-proof signal | detection-only; covers "evidence spine digest mismatch" too | 🟢 CLEAR |
| Audit bundle `bundleHash` | bundle integrity | bundle is complete and verified | hash over **what survived**, not what was requested | 🔴 MISLEADING |
| Audit bundle `capsuleCount` | bundle is N capsules | N as requested | N as **survived** ([replayEngine.ts:568-573](../../apps/api/backend/src/services/audit/replayEngine.ts)) | 🔴 MISLEADING |
| Bundle `verificationInstructions` | how to verify | offline re-verifiable | hash-only; no signature; no third-party verifier client | 🟡 PARTIAL |
| `runtimeTrust.actor.actorId: 'unknown'` | actor at write time | "no one acted" / "system acted" | actor was unattributed; the row was still written | 🟠 CONFUSING |
| `verifierIdentity.userId: null` | no human user | "no human acted" | `meta.clerkUserId` was missing; could be system, AI, or attribution loss | 🟠 CONFUSING |
| `evidenceSnapshot.trustStateAtDecision: 'UNKNOWN'` | trust band was unknown | trust band was unknown at decision time | could be: (a) genuinely unknown then, (b) artifacts unavailable at replay | 🟠 CONFUSING |
| `EMPLOYER_REVIEW_MUTATION_DENIED` event type | this denial happened | a denial happened | a denial happened **for one of three reasons** ([w2-pr9b-forensic-survivability.md](w2-pr9b-forensic-survivability.md)) | 🟠 CONFUSING |
| Issuer-side `refusalGate` | this refusal happened | (no surface — never reaches the operator) | exists only as a return value; no audit row, no UI | 🔴 MISLEADING (by absence) |
| `eventState: pending_not_written` | (no surface) | "everything written is durable" | code-side flag that no surface reads | 🟠 CONFUSING (by absence) |

**Tally:** 2 🟢, 4 🟡, 5 🟠, 4 🔴.

## C-1 lineage explainability

C-1 lineage is the lineage chain anchored at the most recent durable checkpoint. The checkpoint pair is `DecisionCapsule + runtimeTrust` metadata: a row in `DecisionCapsule` plus the `runtimeTrust` block in its `metadata` JSON, written together at the same point in the mutation pipeline.

| Property | Hold? | Where it holds | Where it thins |
|---|---|---|---|
| Deterministic | ✅ | [replayEngine.ts:14-15](../../apps/api/backend/src/services/audit/replayEngine.ts) explicit | none |
| Hash-checked | ✅ | `IntegrityCheck.hashMatch` against `recomputedHash` | none |
| Authority-chained | ✅ | clinician → credential → issuer → verifier → decision built every replay | issuers inferred from sources when `issuerIds` empty ([replayEngine.ts:441-456](../../apps/api/backend/src/services/audit/replayEngine.ts)) |
| Carries actor identity | ⚠️ | `verifierIdentity.userId` from `meta.clerkUserId` | falls back to `null` silently when absent |
| Self-describing | ⚠️ | bundle includes schema URL, hash algorithm, verification endpoints | **no marker on envelope distinguishing recorded fields from replay-time fields** |

**Operator reading: 🟡 PARTIAL.** The C-1 chain is forensically robust per-capsule. It reads as "the recorded truth at decision time" — which is *correct for the recorded fields* and *misleading for the replay-time fields the same envelope carries.*

## T0 lineage explainability

T0 lineage is the chain anchored at the originating mutation event. It originates in `buildRuntimeMutationMetadata` ([runtimeTrustCohesion.ts:143-190](../../apps/api/backend/src/services/runtimeTrustCohesion.ts)) and carries:

- `correlationId` — UUID per call (random when caller omits)
- `mutationFingerprint` — deterministic over `action + actorId + entityId + payloadHash`
- `payloadHash` — deterministic over the redacted payload
- `actor` — `actorId / actorType / attributionSource`

| Property | Hold? | Where it holds | Where it thins |
|---|---|---|---|
| Deterministic fingerprint | ✅ | identical inputs → identical fingerprint, every call | not surfaced; never queried |
| Distinguishes retries from distinct mutations | ✅ | fingerprint stable across retries | **no surface group-bys fingerprint** ([w2-pr9b-degraded-trust-state-continuity.md](w2-pr9b-degraded-trust-state-continuity.md) retry continuity 🟠) |
| Honest under unknown actor | ⚠️ | `'unknown'` literal recorded faithfully | silent fallback; no surface highlights it |
| Honest under read-only attempt | ✅ | `readonly.attemptedByReadonly` boolean + source | flag exists, no surface reads it ([w2-pr8b operator-query-understanding.md](operator-query-understanding.md)) |
| Carried into C-1 checkpoint | ✅ | runtimeTrust block written into capsule metadata | required for C-1 ↔ T0 reconciliation |
| Survives degraded write | ⚠️ | T0 metadata is in-memory until persistence resolves | `pending_not_written` is the gap |

**Operator reading: 🟠 CONFUSING.** The T0 chain is durable in code and invisible at the surface. Operators have no way to ask "show me one logical mutation across its retries" because no surface speaks `mutationFingerprint`.

## Degraded lineage explainability

Degraded lineage is C-1 + T0 lineage as it reads when the system is mid-transition on at least one durability seam. The four seams:

1. **`pending_not_written`** — audit row queued, not yet durable. Side effect has landed; audit has not.
2. **`actorId: 'unknown'`** — mutation accepted with no Clerk header. Action is real; identity is dark.
3. **Bundle drop** — `buildAuditBundle` caught a per-capsule replay throw and continued. Capsule ran; bundle does not show it.
4. **Missing artifact** — replay reaches a capsule whose `verificationArtifact` rows are missing or stale. Replay output is partial; envelope says nothing.

| Seam | What an operator sees | What is actually true | Confusion vector |
|---|---|---|---|
| `pending_not_written` | timeline shows nothing | side effect has landed | "no audit row" reads as "no action" |
| `actorId: 'unknown'` | actor reads `'unknown'` (only in JSON) | action happened, identity unattributed | recorded actor reads as a real "user named unknown" |
| Bundle drop | bundle has 49 of 50; hash is valid | 50th capsule replay threw; logged only | bundle-as-complete reads as "this is the full record" |
| Missing artifact | replay envelope reads `trustBand: 'UNKNOWN'` | derivation inputs not present at replay time | "trust band was unknown" reads as a fact about decision time |

**Operator reading: 🔴 MISLEADING in three of four seams.** The codebase records each degraded state honestly; the surface either does not render it or renders it indistinguishably from a happy-path equivalent.

## Replay-fragile paths

Three paths where replay succeeds at the contract level and admits two readings at the operator level. All three carry over from prior waves; this track measures their explainability cost specifically under operator-mental-model load.

### Path 1 — Outer R-CAT-6 over inner R-CAT-1…5

Every replay envelope reads `replayMetadata.replayCategory: 'R-CAT-6'`, `mutationClassification: 'DOSSIER_REPLAY'`. The inner action's original category lives inside `meta.runtimeTrust`. A SIEM analyst, a regulator, or any flat-projection consumer reads 100% of replays as dossier replays.

- **Severity:** 🔴 high.
- **Defended by:** the inner action carries the original category; a careful reader can drill in.
- **Pre-existing finding:** [forensic-explainability.md](forensic-explainability.md) ambiguity #1, [runtime-query-explainability.md](runtime-query-explainability.md) failure #2.

### Path 2 — Computed `'UNKNOWN'` trust state vs recorded unknown trust state

`trustStateAtDecision: 'UNKNOWN'` can mean:
- The trust state was genuinely `UNKNOWN` at decision time (recorded fact).
- The artifacts to derive it were missing at replay time (computed fallback).

The replay envelope carries no marker distinguishing the two.

- **Severity:** 🟠 medium — most consequential when retention has aged out artifacts after the decision.
- **Defended by:** `evidenceSnapshot.trustStateAtDecision.capturedAt` is `null` when no `TRUST_STATE_ENGINE` artifact was found; an attentive reader can detect.
- **Pre-existing finding:** [w2-pr9b-forensic-survivability.md](w2-pr9b-forensic-survivability.md) zone 3.

### Path 3 — Recorded fields and computed fields share one envelope

`DecisionReplay` mixes:
- Recorded at decision time: `decision`, `evidenceSnapshot.evidenceRecords`, `authorityChain` (built from recorded inputs), `verifierIdentity` (from recorded metadata).
- Computed at replay time: `integrity.recomputedHash`, `replayedAt`, `replayMetadata`, `evidenceSnapshot.sourcesConsulted` (re-derived from artifacts).

No envelope marker distinguishes them.

- **Severity:** 🟡 medium today, 🔴 the moment a replay UI ships without explicit visual separation.
- **Pre-existing finding:** [w2-pr7b-operational-trust-continuity.md](w2-pr7b-operational-trust-continuity.md) hotspot #2.

## Export-delayed paths

`buildAuditBundle` ([replayEngine.ts:550-607](../../apps/api/backend/src/services/audit/replayEngine.ts)) is synchronous, serial, best-effort. The export-delayed shape:

| Property | Behavior | Operator reading |
|---|---|---|
| Capsule iteration | `for (...) { try { replays.push(await replayDecision(id)); } catch { log(); } }` | "complete export" |
| Failure handling | per-capsule throws caught + logged + dropped | bundle has no field for "dropped" |
| `capsuleCount` | reflects survived count | reads as "all of them" |
| `bundleHash` | computed over `JSON.stringify({ bundleId, exportedAt, replays })` | hash is internally consistent over what's included |
| Streaming / progress | none | no signal of partial completion |
| Inter-bundle linking | none | re-export = new unlinked bundle |
| `requested` count | not in schema | impossible to detect requested-vs-delivered gap from bundle alone |

**Operator reading: 🔴 MISLEADING.** The export-delayed path concentrates the most consequential survivability-explainability gap in the wave: the artifact most likely to leave VitalCV (a bundle handed to a regulator, an auditor, opposing counsel) is the artifact that least clearly distinguishes what survived from what was asked for.

## Where survivability copy is silently inflated

Surfaces where the platform's literal copy or schema reads as a stronger durability claim than the contract holds.

| Surface | Reads as | Actually | Inflation? |
|---|---|---|---|
| `verificationInstructions.how` | "verify integrity.hashMatch === true" | hashMatch verifies internal consistency, not requested-vs-delivered | yes — implies completeness |
| `bundle.issuer: 'VitalCV'` | bundle is from VitalCV | hash present; no signature; transport-trusted | yes — implies provenance binding |
| `eventState` (default) | (silent default) | `pending_not_written` is the default | by absence — implies persistence |
| `'recordedBy: 'demo'` | (only in audit row payload) | demo path explicit | no — this is the doctrine-level anti-inflation gate, working as designed |
| `decisionGrade: false` | (only in record) | literal `false` everywhere except real PSV receipt | no — load-bearing anti-inflation gate |
| `verifierIdentity.systemId: 'vitalcv-engine-v1'` | system identity | always written | no — honest |

**Two genuine inflation vectors:** completeness implied by `bundleHash + verificationInstructions`, and persistence implied by silent `eventState` defaults. Neither is a copy violation against the [CLAUDE.md](../../CLAUDE.md) banned-strings list. Both are **structural inflations** — the schema shape implies a property the contract does not hold.

## Verdict

**Survivability explainability holds where the literal renders, fails where the literal is absent.**

C-1 lineage is forensically strong per-capsule and partially explained at the envelope (recorded-vs-computed boundary unmarked). T0 lineage is durable in code and invisible at every surface (no fingerprint group-by, no read-only flag readout). Degraded lineage reads indistinguishably from happy-path lineage at three of four seams. Replay-fragile paths are robust at the contract layer and misleading at the projection layer (R-CAT-6 outer envelope is the canonical case). Export-delayed paths concentrate the highest-stakes inflation: the bundle that leaves VitalCV does not surface what survived versus what was requested.

The cross-cutting pattern: **the system is honest in code about which property it holds (observable / durable / transactional) and silent at every operator surface about the distinction.** An operator reading the surface without source-code knowledge is durably likely to read `observable` as `durable`, and `durable` as `transactional`.

This is not a contract failure. It is a **rendering failure** at the surface layer, and a **schema-shape inflation** at the export layer. Both are the structural shape of the wave's deliberate ordering: contract over surface, recorded over rendered.

**Strongest survivability explanation surface:** `LaneHealthBadge` — the only surface that renders an availability state in a way the operator can't confuse with a provenance state.
**Weakest operator-understanding surface:** `buildAuditBundle` — `capsuleCount` reads as requested when it is survived; the most consequential single misread in the codebase.

**Track A score: 🟠 CONFUSING.** Two 🟢, four 🟡, five 🟠, four 🔴. **Survivability explainability is honest about the literal at the contract layer and silent about the distinction at the rendering layer — the operator's mental model gets a strictly weaker signal than the system actually records.**

# Operator Failure Understanding — W2-PR9B Track A

**Wave:** W2-PR9B — Degraded Runtime Explainability
**Date:** 2026-05-08
**Status:** Review-only synthesis. No code changes, no merges.
**Risk class:** SAFE (read-only inventory).
**Companion to:** [w2-pr9b-degraded-trust-state-continuity](w2-pr9b-degraded-trust-state-continuity.md), [w2-pr9b-forensic-survivability](w2-pr9b-forensic-survivability.md), [w2-pr9b-operational-trust-resilience](w2-pr9b-operational-trust-resilience.md).
**Builds on:** [operator-query-understanding](operator-query-understanding.md), [w2-pr7b-operator-model-integrity](w2-pr7b-operator-model-integrity.md), [w2-pr4d-operator-understanding](w2-pr4d-operator-understanding.md).

---

## What this track answers

PR8B Track A measured whether an operator can ask a forensic question on the **happy path**. This track asks the harder question: **when the platform is degraded — when retries pile up, when the issuer is slow, when an export stalls, when a row never persists, when attribution drops to `'unknown'` — does the operator understand what they are looking at, or does the surface read like the system is healthy?**

The answer is the line between an operator who calmly diagnoses a real problem and an operator who fires a false postmortem.

## Definitions

- **Degraded runtime:** any state where a write, read, retry, replay, lineage link, or export does not complete on its happy path.
- **Operator survivability:** the operator's ability to form a correct mental model of the system from what the surface shows them, when the surface shows them less than the happy path would.
- **Silent degradation:** a degradation that does not produce a visible signal at any operator-facing surface.
- **Misleading degradation:** a degradation that produces a signal that points the operator at the wrong cause.
- **Confusing degradation:** a degradation visible somewhere but where the surface, the literal, or the vocabulary leaves the cause ambiguous.

## Degradation modes inventory

These are the runtime degradation modes that exist in the codebase today, mapped to whether the operator could understand them.

| Degradation mode | Is the failure visible? | Where it surfaces | Score |
|---|---|---|---|
| **Audit write deferred** (`eventState: 'pending_not_written'`) | ❌ no | code-side flag in `auditPersistence`; no UI, no dashboard, no API | 🟠 CONFUSING |
| **Audit write demo-only** (`recordedBy: 'demo'`, `demo_not_persisted`) | ⚠️ partial | demo paths are explicit in code, the audit row carries the literal; no operator surface labels demo data | 🟡 PARTIAL |
| **Replay invoked on a partial-artifact capsule** | ⚠️ partial | replay returns `'UNKNOWN'` in `trustBand`/`readinessStatus`/`trustScore=0` ([replayEngine.ts:354-358](../../apps/api/backend/src/services/audit/replayEngine.ts)); no warning marker on the envelope | 🟠 CONFUSING |
| **Replay hash mismatch** | ✅ yes | `integrity.hashMatch === false`, `tamperEvidence` populated with one of three messages ([replayEngine.ts:376-383](../../apps/api/backend/src/services/audit/replayEngine.ts)) | 🟢 UNDERSTANDABLE |
| **Replay envelope outer category masks inner action** | ❌ no | every replay reads `replayCategory: 'R-CAT-6'`, regardless of inner action; carried over from PR8B Track B ambiguity #1 | 🔴 MISLEADING |
| **Bundle export with per-capsule failure** | ❌ no | [replayEngine.ts:568-573](../../apps/api/backend/src/services/audit/replayEngine.ts) catches per-capsule replay errors, logs to `obs/logger`, and silently drops the capsule from `replays[]`; bundle reports the survived count as `capsuleCount`, not the requested count | 🔴 MISLEADING |
| **Bundle export lag** | ❌ no | `buildAuditBundle` is synchronous, processes up to 50 capsules in a serial `for` loop; no progress signal, no streaming endpoint, no SLA marker | 🟠 CONFUSING |
| **Issuer-side refusal (`refusalGate`)** | ❌ no | issuer-verification helpers return `refusalGate` in code; no audit row, no UI, no operator query path; PR8B Track A 🟠 | 🟠 CONFUSING |
| **Employer denial collapsed under one event type** | ⚠️ partial | `EMPLOYER_REVIEW_MUTATION_DENIED` is one type for ≥3 reasons; reason in payload only; PR8B Track A 🔴 | 🔴 MISLEADING |
| **Retry of a mutation (no idempotency contract)** | ❌ no | each call gets a fresh `correlationId` (random UUID when caller omits it; [runtimeTrustCohesion.ts:155](../../apps/api/backend/src/services/runtimeTrustCohesion.ts)); two retries become two different rows with two different correlation IDs and identical fingerprints | 🟠 CONFUSING |
| **Retry storm** (many retries from one client) | ❌ no | `RATE_LIMIT_HIT` event type exists in the canonical union; route-level rate limits exist; no operator dashboard for storm signal | 🟠 CONFUSING |
| **Actor attribution silently `'unknown'`** | ⚠️ partial | written into `runtimeTrust.actor.actorType: 'unknown'`, `attributionSource: 'unknown'`; PR8B forensic ambiguity #8; no operator surface highlights it | 🟠 CONFUSING |
| **Async issuer lag** (issuer not yet responded) | ⚠️ partial | candidate lifecycle has `not_yet_evaluated`/`ready_for_policy_review`/etc.; visible in code, surfaces only on issuer review console | 🟡 PARTIAL |
| **Source coverage drop mid-flight** (lane health flips) | ✅ yes | `LaneHealthBadge` renders status; `MONITORING_STATUS_CHANGE` audit event fires | 🟢 UNDERSTANDABLE |
| **Confidence drop on a specific source** | ⚠️ partial | `SourceConsulted.confidence` is `'LOW'` for non-VERIFIED status ([replayEngine.ts:217](../../apps/api/backend/src/services/audit/replayEngine.ts)); not pre-aggregated, not surfaced as a metric | 🟡 PARTIAL |
| **Readiness regression** (`DECISION_GRADE` → `BLOCKED`/`PARTIAL`) | ✅ yes | passport surface re-renders status; `TRUST_STATE_CHECK` audit row fires | 🟢 UNDERSTANDABLE |
| **Lineage break: refusal → no row** | ❌ no | this is a pre-existing PR8B Track B finding (denial continuity ⚠️); under degradation, this is the surface that goes from "rare" to "noisy" without an operator-visible signal | 🔴 MISLEADING |

**Tally:** 3 🟢, 4 🟡, 6 🟠, 4 🔴.

## How the degradation surfaces look to an operator

### Scenario 1 — Issuer is slow and the operator hits "request refresh" three times

**What happens in the codebase:**
- Each click writes an `EMPLOYER_REVIEW_REFRESH_REQUESTED` audit row.
- Each row gets a *different* `correlationId` (a fresh UUID per call when the caller does not supply one — [runtimeTrustCohesion.ts:155](../../apps/api/backend/src/services/runtimeTrustCohesion.ts)).
- Each row gets the *same* `mutationFingerprint` (action + actor + entity + payloadHash; identical inputs collapse to the same fingerprint — [runtimeTrustCohesion.ts:163-169](../../apps/api/backend/src/services/runtimeTrustCohesion.ts)).
- No idempotency dedup; the issuer eventually responds once.

**What the operator sees:**
- Three rows, three different correlation IDs, identical fingerprint.
- The audit timeline shows three refreshes; in fact one logical refresh happened.

**Score:** 🟠 CONFUSING. The data to detect the duplicate is there (fingerprint), but no surface or query returns "fingerprint group-by." An operator reading the timeline reads three actions.

### Scenario 2 — A bundle export fails on capsule #7 of 50

**What happens in the codebase:**
- `buildAuditBundle` ([replayEngine.ts:550-607](../../apps/api/backend/src/services/audit/replayEngine.ts)) catches the throw, logs to `obs/logger`, continues.
- The returned bundle has 49 replays, `capsuleCount: 49`, `bundleHash` over those 49.
- No field on the bundle says "X capsules requested, Y returned, Z failed."

**What the operator sees:**
- A clean-looking bundle with 49 replays.
- `verificationInstructions.how` says "verify integrity.hashMatch === true" — and every replay in the bundle does.
- The forensic statement implied by the bundle is "this is the complete record." It is not.

**Score:** 🔴 MISLEADING. The dropped capsule is the most consequential — usually the one whose data is most degraded, hence most worth investigating.

### Scenario 3 — A clinician's underlying state board lane goes red mid-day

**What happens in the codebase:**
- `MONITORING_STATUS_CHANGE` audit row fires.
- `LaneHealthBadge` updates on `/passport/[id]`.
- `TRUST_STATE_CHECK` may re-fire on next read.
- Trust band may or may not change (lane health is intentionally not a trust-state input — PR8B Track C "channels intentionally decoupled").

**What the operator sees:**
- A red lane on the passport.
- Trust band unchanged.
- An audit row.

**Score:** 🟢 UNDERSTANDABLE. This is the cleanest degradation surface in the codebase. The decoupling between availability and provenance is honest, and the operator can read the screen.

### Scenario 4 — A mutation by an unauthenticated caller (no Clerk header)

**What happens in the codebase:**
- `actorId?.trim() || 'unknown'` → literal `'unknown'` ([runtimeTrustCohesion.ts:154](../../apps/api/backend/src/services/runtimeTrustCohesion.ts)).
- `actorType: 'unknown'`, `attributionSource: 'unknown'`.
- The mutation completes; the audit row is recorded with `actor.actorId: 'unknown'`.

**What the operator sees:**
- The timeline shows a mutation by "unknown" — only if the operator is reading the bundle JSON or `runtimeTrust.actor` payload directly.
- No operator surface today calls out "this mutation has unknown attribution" as a different visual state from "this mutation has known attribution."

**Score:** 🟠 CONFUSING. PR8B Track B forensic ambiguity #8. The fallback is forensically honest in the row but operationally invisible at the surface.

### Scenario 5 — Replay invoked at the moment a capsule's underlying artifacts are still being written

**What happens in the codebase:**
- `replayDecision` reads `verificationArtifact` rows ([replayEngine.ts:282-306](../../apps/api/backend/src/services/audit/replayEngine.ts)).
- If artifacts are missing or incomplete, `evidenceRecords` is shorter than expected; `trustState` falls back to `'UNKNOWN'`/`0` ([replayEngine.ts:354-358](../../apps/api/backend/src/services/audit/replayEngine.ts)).
- `integrity.hashMatch` may still be `true` if the capsule's stored hash matches the recomputed hash from what the engine could read — but the recomputed hash was computed over a partial artifact set.

**What the operator sees:**
- A "valid" replay (hashMatch true) with `trustBand: 'UNKNOWN'`.
- No marker that the replay reconstructed a partial state.

**Score:** 🟠 CONFUSING. Hash-honest, evidence-incomplete; the operator must read the trust state literal to know.

### Scenario 6 — A `pending_not_written` row for a real mutation

**What happens in the codebase:**
- The mutation completes (the database has the side effect).
- The audit row is queued/deferred per the persistence default.
- Operationally, the audit doesn't yet say the action happened.

**What the operator sees:**
- The timeline says nothing happened.
- The action did happen.

**Score:** 🟠 CONFUSING. PR8B Track C seam #4. This is the degradation mode most likely to corrode operator trust in the audit surface itself.

## Degradation vocabulary the operator must know

To diagnose any of the above, the operator must hold these literals in their head:

| Literal | Meaning | Where surfaced |
|---|---|---|
| `pending_not_written` | audit row deferred, not yet durable | code only |
| `demo_not_persisted` | demo path, never intended to persist | code only |
| `defer_until_contract_aligned` | persistence is paused pending contract | code only |
| `'unknown'` actor | no Clerk header at write time | bundle JSON only |
| `'R-CAT-6'` outer envelope | this is a replay (regardless of inner) | replay envelope JSON |
| `tamperEvidence` populated | hash mismatch detected | replay envelope JSON |
| `denial_reason` (in payload) | which of three reasons fired | audit row payload |
| `refusalGate` (issuer-side) | which of six gates fired | code return value only |
| `evidenceSnapshot.anomaliesDetected` | metadata-flagged anomaly | replay envelope JSON |

**None of these have an operator-facing surface today.** The operator is the JSON parser. The system speaks the degradation language; the operator has no terminal that renders it.

## Where degradation explainability concentrates risk

Three areas concentrate the operator-facing risk under degraded conditions.

### Risk 1 — The bundle hides per-capsule failures 🔴

`buildAuditBundle` swallows per-capsule replay throws ([replayEngine.ts:568-573](../../apps/api/backend/src/services/audit/replayEngine.ts)). The returned bundle states `capsuleCount: <survived>`. Nothing in the schema says "X were requested, Y survived." This is a structural integrity claim the bundle quietly weakens under degradation.

The shape "complete export" is implied by the schema. The shape "best-effort export" is the actual behavior. An auditor or a regulator cannot tell from the bundle alone that this is a best-effort export.

### Risk 2 — The R-CAT-6 outer envelope masks every degraded inner action 🔴

PR8B Track B / Track D both flagged this. Under degradation, this is *worse*: the more replays an operator does to investigate (denials, refusals, retries), the more `R-CAT-6` rows accumulate, and the more the outer envelope becomes the dominant signal. **The forensic vocabulary the operator queries first sees the entire investigation as one shape.**

### Risk 3 — Retry vs. duplicate vs. distinct mutation is structurally indistinguishable 🟠

The `mutationFingerprint` is deterministic and would let an operator *detect* duplicates. The `correlationId` is random per call, which means two retries look like two events to anything that group-bys correlation. Today no surface group-bys fingerprint. An operator looking at the timeline of a retry storm reads "many actions" rather than "one action repeatedly retried."

## Verdict

**An operator can read the happy path. They cannot read most of the degradation modes.**

Of 17 degradation modes inventoried:
- 3 are 🟢 (lane health, hash mismatch, readiness regression — the three with mature surface bindings)
- 4 are 🟡 (the data is in the row, the surface partially reads it)
- 6 are 🟠 (the data is in the row, no surface reads it)
- 4 are 🔴 (the surface reads the wrong thing)

The 🔴 set is concentrated and consequential:
1. R-CAT-6 outer envelope masking inner action
2. Bundle export silently dropping failed capsules
3. Employer denial collapsing three reasons under one event type
4. Lineage break for issuer-side refusals (no audit row)

Each is independently a moderate risk. Together, they describe a pattern: **the surface assumes the system is in its happy path, and reports as if it were even when it is not.**

This is not a contract failure. The contract layer is honest — the literals exist, the fields exist, the data is recorded. This is a **surface failure** under degraded conditions: every degradation mode produces a recorded fact and a missing rendering of that fact.

The fix shape is consistent across all 🟠 and 🔴 entries: an operator-facing surface that reads the literals already in the row. Per the constraint of this wave, that is next-wave work.

**Track A score: 🟠 CONFUSING.** The platform is honest about degradation in the audit row and silent about degradation at the operator surface. **Operator failure understanding is high in code and low at the screen — the screen reads like the happy path even when the system is not.**

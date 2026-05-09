# W2-PR6A — Mutation Lineage Integrity (Track B)

**Wave:** Wave 2, PR 6A — operational audit spine, mutation lineage · **Date:** 2026-05-08 · **Status:** certification only; **NO product code, NO runtime modification, NO merge** · **Authority:** subordinate to `w2-pr6a-audit-spine-certification.md`, `TRUST_GUARANTEE_LEXICON.md`

This doc certifies **mutation lineage integrity** — the chain that ties a single logical operation across mutation rows, audit rows, outbox events, and downstream side effects. It analyzes payloadHash propagation, mutation-fingerprint continuity, and action classification continuity.

---

## 1. The lineage primitives

A logical operation produces several persistent artifacts. The lineage is the chain that ties them together.

| Primitive | Where stored | Continuity mechanism |
|---|---|---|
| **Mutation row** | e.g., `EmployerAcceptance.id`, `StartAttestation.id` | DB primary key |
| **Audit row** | `AuditEvent.id` + `referenceId` (string match to mutation `id`) | Cross-row join via `referenceId` (no FK) |
| **Outbox event** | Outbox table | Joined via `metadata.requestId` or similar |
| **`metadata.traceId`** | `AuditEvent.metadata` JSON | Per-logical-operation primitive (existing) |
| **`metadata.correlationId`** | `AuditEvent.metadata` JSON (post-Lock-v2) | Per-attempt primitive |
| **`metadata.payloadHash`** | `AuditEvent.metadata` JSON | Content fingerprint (post-Lock-v2 mandate) |
| **`AuditEvent.hash`** | DB column | Tamper-evidence over canonical content |
| **Mutation row's `id`** | DB column | Referenced by audit's `referenceId` |
| **`acceptanceId` on StartAttestation** | DB column | Cross-row chain (no FK; semantic match) |

---

## 2. Mutation lineage consistency

A successful `accept → confirm-start` flow produces this lineage:

```
EmployerAcceptance(id=A1)
  ↓ referenced by
AuditEvent(referenceId=A1, type=EMPLOYER_REVIEW_ACCEPTED, metadata.requestId=R1)
  ↓ logical-operation chain (recognition → acceptance → start)
StartAttestation(acceptanceId=A1, id=S1)
  ↓ referenced by
AuditEvent(referenceId=S1, type=START_ATTESTED, metadata.acceptanceId=A1)
```

### 2.1 Per-link consistency

| Link | Consistency mechanism | Survival |
|---|---|---|
| Mutation row id → audit referenceId | String match | 🟡 PARTIAL — works in steady state; FK would harden |
| Audit referenceId → metadata.requestId | Same row's metadata | 🟢 CERTIFIED — single row's atomic write |
| AcceptanceId → StartAttestation.acceptanceId | String match | 🟡 PARTIAL — works; FK would harden |
| AcceptanceId → AuditEvent(START_ATTESTED).metadata.acceptanceId | Stored in metadata | 🟡 PARTIAL — JSON-path query |

**Track B finding ML-1:** the audit spine's lineage uses **string-match joins** rather than FKs. This is operationally adequate but means GC of one side without the other silently breaks lineage reconstruction. Recommendation: audit retention SLA must respect the longest forward-reference chain (acceptance row alive → start attestation alive → both audit rows alive).

---

## 3. payloadHash propagation

### 3.1 Pre-Lock-v2

The audit-row's `metadata.payloadHash` field is **partially populated** today:

| Handler | payloadHash today |
|---|---|
| `accept` | NOT explicitly populated by `recordEmployerReviewAcceptance`; metadata structure includes the request body context, but no SHA-256 of canonical body |
| `confirm-start` | The inline `attestationHash` (line 850) IS a SHA-256 of canonical content (attestationId, acceptanceId, entityId, etc.) — but this is the audit row's `hash` column, NOT `metadata.payloadHash` |
| `request-refresh` | Not explicitly populated |
| `route-to-review` | Not explicitly populated |
| `share-packet` | `shareTokenHash` IS populated (SHA-256 of token); functions AS the payload hash |
| `packet` | `manifestHash` IS populated (SHA-256 of manifest); functions AS the payload hash |

**Track B finding ML-2:** payloadHash is **inconsistently populated** today. `share-packet` and `packet` populate equivalent-but-named-differently fields (`shareTokenHash`, `manifestHash`). `confirm-start` populates a `hash` column but not `metadata.payloadHash`. Three handlers don't populate at all.

### 3.2 Post-Lock-v2 mandate

Per `w2-pr3b-replay-governance.md` RG-Rec-2 + `w2-pr5a-audit-certification.md`: **mandate `metadata.payloadHash` on EVERY audit row (permitted + denied)**.

This unifies the field name and ensures capture-replay forensic detection per `w2-pr5a-replay-certification.md` Track B finding RC-2.

**Track B finding ML-3:** Lock v2 currently mandates payloadHash for permitted-path audit rows. Recommendation extends to denied-path. The implementation PR must verify both paths emit `metadata.payloadHash` consistently.

---

## 4. Mutation fingerprint continuity

The "mutation fingerprint" is the canonical-form hash that uniquely identifies a logical operation's CONTENT (not its ID).

### 4.1 Components of a fingerprint

For an `accept` mutation:

```
fingerprint = SHA-256(canonical({
  type: 'employer_review.accept',
  actorId: <userId>,
  subjectId: <entityId>,
  body: <redacted-body>,
  decidedAt: <timestamp>
}))
```

### 4.2 Continuity properties

| Property | Status |
|---|---|
| Same content → same fingerprint | YES (canonical-form hashing) |
| Different content → different fingerprint | YES (collision-resistant SHA-256) |
| Fingerprint propagates to audit row | PARTIAL — see ML-2 |
| Fingerprint queryable across rows | PARTIAL — JSON-path on `metadata.payloadHash` |
| Fingerprint survives audit retention | DEPENDS on retention SLA |
| Fingerprint independent of timing | YES (content-only) |

**Track B finding ML-4:** the fingerprint is a content-hash, not a time-hash. This is correct for capture-replay forensic detection (a captured request replayed later has the SAME fingerprint, allowing detection). It is INSUFFICIENT for replay PREVENTION (the fingerprint alone doesn't tell you which request is the original vs. the replay).

---

## 5. Action classification continuity

Audit-row event types (`AuditEvent.type`) and action literals (`metadata.action`) classify what happened. This classification must survive across consumers.

### 5.1 Existing event types

Per `packages/audit/AuditEvent.ts:5–28` (frozen YC MVP):

```
NPI_INGESTED, NPI_VALIDATION_FAILED, FILE_INGESTED, INGEST_PARSE_SUMMARY,
INGEST_CONFLICT_DETECTED, INGEST_ERROR, VERIFICATION_REQUESTED,
VERIFICATION_COMPLETED, VERIFICATION_FAILED, EMPLOYER_ACCEPTANCE_REJECTED,
START_REJECTED, PSV_RECEIPT, RECOGNITION, ACCEPTANCE, EMPLOYER_ACCEPTANCE,
START, START_ATTESTED, COMMITTEE, TRUST_STATE_CHECK, TRUST_STATE_DECAY,
IDEMPOTENT_REPLAY, CONCURRENCY_GUARD_TRIGGERED
```

Plus the in-flight types used by employer-review:

```
EMPLOYER_REVIEW_ACCEPTED, EMPLOYER_REVIEW_REFRESH_REQUESTED,
EMPLOYER_REVIEW_ROUTED_TO_REVIEW, EMPLOYER_PACKET_SHARED,
ARTIFACT_EXPORTED
```

### 5.2 Lock v2 additions

Lock v2 §8 introduces denied-path action literals as `metadata.action` reason suffixes:

```
<base>.role_denied
<base>.no_org_context
<base>.entity_not_found
<base>.acceptance_blocked
<base>.already_accepted
<base>.no_prior_acceptance
<base>.duplicate_request
<base>.malformed_resource_id
```

### 5.3 Classification consistency

| Property | Status |
|---|---|
| Event types are enum-validated | YES — `AUDIT_EVENT_TYPES` constant |
| Action literals follow `<domain>.<verb>` pattern | YES per `TRUST_GUARANTEE_LEXICON.md` §4 |
| Denied-path suffixes follow `<base>.<reason>` pattern | YES per Lock v2 §8 |
| New types require schema review | YES (frozen YC MVP file requires scope approval) |
| Forbidden tokens (`signed_*`, `verified_*`, `non_repudiable_*`) banned | YES per lexicon |

**Track B finding ML-5:** action classification is well-disciplined. The frozen `AUDIT_EVENT_TYPES` enum acts as schema guard. Lock v2 + lexicon extend the discipline to action literals + reason suffixes.

---

## 6. Audit metadata survivability

Audit metadata is a JSON column. Schema evolution risks:

| Risk | Effect |
|---|---|
| Field rename (e.g., `employerId` → `actorId`) | Forensic queries that used the old name silently miss data |
| Field deletion | Same |
| Field type change (e.g., string → number) | JSON-path queries break |
| Field added | New consumers can use it; old can't |
| Nested object reshape | All consumers must update |

The wave's planned additions (`actorId`, `correlationId`, `payloadHash`) are ADDITIVE — they don't break existing consumers. The deprecation of `employerId` (per Lock v2 §8 recommendation; `actorId` becomes canonical) IS a breaking change for forensic queries.

**Track B finding ML-6:** the wave should explicitly NOT delete `employerId` immediately. Carry both fields for one wave; mark `employerId` as deprecated; remove only after consumer audit. Recommendation: `audit-row-schema.md` documents the deprecation timeline.

---

## 7. Lineage ambiguity risks

A SOC analyst querying audit rows can reach the WRONG lineage conclusion in these cases:

| Ambiguity | Cause |
|---|---|
| **LM-AMB-1** | Audit row's `referenceId` matches a mutation row's `id` — but is it THIS audit row's mutation, or another that happened to share the id? | UUIDs collide negligibly; for non-UUID ids (clinicianNpi as referenceId for some types), collision is more likely |
| **LM-AMB-2** | StartAttestation references an acceptance via `acceptanceId` — but the acceptance was deleted (e.g., GDPR right-to-erasure) | Lineage breaks; chain reconstruction silently fails |
| **LM-AMB-3** | Two audit rows for the same `(actor, correlationId)` but different `payloadHash` | Replay attempt with different body — capture-modify-replay scenario |
| **LM-AMB-4** | Audit row has `metadata.traceId = T1`; mutation row has no traceId column | Cross-row join must use `referenceId`; cannot use traceId |
| **LM-AMB-5** | Outbox event lacks correlationId | Downstream worker can't correlate to original request |

**Track B finding ML-7:** LM-AMB-2 and LM-AMB-4 are the dominant lineage-ambiguity risks. Mitigations require either (a) FKs on cross-row references (schema migration; deferred) OR (b) audit-retention discipline that prevents one-side GC.

---

## 8. Mutation lineage classifications

### 8.1 Per-property

| Property | Today | Post-Lock-v2 + recommendations |
|---|---|---|
| Mutation row exists with stable id | 🟢 CERTIFIED | 🟢 CERTIFIED |
| Audit row exists with `referenceId` matching mutation id | 🟢 CERTIFIED for C-1 transactional | 🟢 CERTIFIED + denied-path |
| Cross-row join via `referenceId` | 🟡 PARTIAL — string match, no FK | 🟡 UNCHANGED |
| `metadata.traceId` propagates to audit | 🟢 CERTIFIED via `auditService.ts` | 🟢 CERTIFIED |
| `metadata.correlationId` per-attempt | 🔴 NOT YET | 🟢 CERTIFIED-IN-CONTRACT |
| `metadata.payloadHash` on every row | 🟡 PARTIAL — inconsistent | 🟢 CERTIFIED if RG-Rec-2 + ML-3 enforced |
| Action classification follows pattern | 🟢 CERTIFIED | 🟢 CERTIFIED + denied-path suffix |
| Audit metadata field rename is deprecation-safe | 🟡 PARTIAL — `employerId → actorId` recommendation per ML-6 | 🟡 PARTIAL — needs explicit deprecation timeline |
| Lineage survives audit retention | 🟠 UNVERIFIED | 🟠 UNVERIFIED until SLA formalized |

### 8.2 Aggregate

**Mutation lineage:** 🟡 **PARTIAL — strong primitives; weakened by missing FKs + undocumented retention SLA + payloadHash inconsistency.** Lock v2 + recommendations close the payloadHash gap. FK addition is deferred to schema-migration wave.

---

## 9. Recommendations

| # | Recommendation | Priority |
|---|---|---|
| **ML-Rec-1** | Mandate `metadata.payloadHash` on EVERY audit row (extends RG-Rec-2 to denied path) | HIGH |
| **ML-Rec-2** | Document `actorId` vs `employerId` deprecation timeline in `audit-row-schema.md` | MEDIUM |
| **ML-Rec-3** | Document the `referenceId` cross-row join semantics (no FK; string match) | MEDIUM |
| **ML-Rec-4** | Document audit-retention SLA respecting longest forward-reference chain | HIGH |
| **ML-Rec-5** | Add `metadata.traceId` to OUTBOX events to support downstream worker correlation | LOW |
| **ML-Rec-6** | Define lineage-reconstruction query templates in `audit-row-schema.md` | MEDIUM |

---

## 10. Track B determination

| Question | Answer |
|---|---|
| Is mutation lineage consistent within-row? | YES — 🟢 CERTIFIED |
| Is mutation lineage consistent cross-row (joins)? | PARTIAL — 🟡 string-match; no FK |
| Are mutation classifications survivable? | YES — 🟢 CERTIFIED via enum + lexicon |
| Are audit metadata fields drift-safe? | PARTIAL — 🟡 needs deprecation timeline doc |
| Is payloadHash propagated everywhere? | NO TODAY — 🟡 mandated post-Lock-v2 |
| Are lineage ambiguity risks bounded? | PARTIAL — 🟡 5 risks enumerated |

**Track B classification:** 🟡 **PARTIAL** — strong within-row; weakened by missing FKs + deprecation discipline + payloadHash inconsistency.

---

## 11. Closing principle (Track B)

Mutation lineage is the chain that ties one logical operation together across rows, types, and consumers. The audit spine's primitives are mature; the wave's contribution (correlationId + payloadHash mandate + denied-path) extends the lineage richness.

**Mutation lineage is CERTIFIABLE-IN-CONTRACT post-Lock-v2 + recommendations; CERTIFIED requires schema-migration FKs (deferred) + retention SLA (gate G7) + audit-row-schema doc (TS-Rec-1).** Closing these advances lineage from PARTIAL to CERTIFIED.

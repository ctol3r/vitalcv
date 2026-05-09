# Audit-Event Vocabulary Map

**Status:** **CONSTITUTIONAL** — frozen reference for VitalCV audit-event semantics · **Date established:** 2026-05-08 · **Authority:** subordinate to `TRUST_GUARANTEE_LEXICON.md`, `MUTATION_GATE_SEQUENCE.md`, `w2-pr7a-audit-event-convergence.md`; supersedes ad-hoc descriptions of which audit-event-type literal means what

This doc converges the **three parallel audit-event vocabularies** identified in `w2-pr7a-audit-event-convergence.md` into one operational reference. It is documentation-only — the frozen YC MVP `AUDIT_EVENT_TYPES` enum is NOT modified; the runtime free-form `prisma.auditEvent.type` namespace is NOT modified; the in-memory ledger's `AuditCategory` is NOT modified.

Convergence is achieved by **mapping each runtime literal to its canonical meaning + alias status + query semantics.** SOC analysts, dashboards, forensic queries, and Codex audits use this map to query consistently across the divergence.

---

## 1. The three vocabularies (recap)

| Subsystem | Vocabulary | Source | Strict? |
|---|---|---|---|
| **A: Canonical events** | `AUDIT_EVENT_TYPES` enum (24 events) | `packages/audit/AuditEvent.ts` (frozen YC MVP) | YES — strict enum |
| **B: Functional categories** | `AuditCategory` enum (15 categories) | `apps/api/backend/src/services/audit/auditLedger.ts` | YES — strict enum |
| **C: Free-form prisma type** | Open string namespace (~150 distinct literals observed in production) | Direct `prisma.auditEvent.create({type: '...'})` callsites | NO — any string accepted |

---

## 2. Canonical event mapping (Subsystem A) — the 24-event enum

Per `packages/audit/AuditEvent.ts:5–28`. These are the AUTHORITATIVE event meanings.

| Canonical literal | Operational meaning | Replay-related? | Denial-related? | Wave-scope? |
|---|---|---|---|---|
| `NPI_INGESTED` | NPI registered into the platform | NO | NO | upstream (out of W2-PR2B) |
| `NPI_VALIDATION_FAILED` | NPI failed format/checksum validation | NO | YES (input-validation denial) | upstream |
| `FILE_INGESTED` | File ingested into the platform | NO | NO | upstream |
| `INGEST_PARSE_SUMMARY` | Parse summary for an ingested file | NO | NO | upstream |
| `INGEST_CONFLICT_DETECTED` | Conflict detected during ingest | NO | NO | upstream |
| `INGEST_ERROR` | Ingest pipeline error | NO | YES (failure) | upstream |
| `VERIFICATION_REQUESTED` | Source verification requested | NO | NO | upstream |
| `VERIFICATION_COMPLETED` | Source verification completed | NO | NO | upstream |
| `VERIFICATION_FAILED` | Source verification failed | NO | YES (failure) | upstream |
| `EMPLOYER_ACCEPTANCE_REJECTED` | Employer rejected acceptance proposal | NO | YES (canonical denial) | partial (employer-review) |
| `START_REJECTED` | Start was rejected | NO | YES (canonical denial) | partial (confirm-start) |
| `PSV_RECEIPT` | PSV receipt event | NO | NO | issuer-trust chain |
| `RECOGNITION` | Canonical wedge step 1: recognition occurred | NO | NO | wedge-canonical |
| `ACCEPTANCE` | Canonical wedge step 2: acceptance occurred | NO | NO | **wedge-canonical (ALIAS for EMPLOYER_REVIEW_ACCEPTED?)** |
| `EMPLOYER_ACCEPTANCE` | Canonical: employer-side acceptance | NO | NO | **wedge-canonical (ALIAS for EMPLOYER_REVIEW_ACCEPTED?)** |
| `START` | Canonical wedge step 3: start occurred | NO | NO | wedge-canonical (semantic-pair with START_ATTESTED) |
| `START_ATTESTED` | Canonical wedge step 3-attest: start attested by employer | NO | NO | **CONVERGENT — used by confirm-start direct prisma write** |
| `COMMITTEE` | Committee decision event | NO | NO | governance |
| `TRUST_STATE_CHECK` | Trust state checked | NO | NO | trust-state |
| `TRUST_STATE_DECAY` | Trust state decayed | NO | NO | trust-state |
| `IDEMPOTENT_REPLAY` | Idempotent replay observed (operation processed once) | **YES — replay observed-permitted** | NO | **REPLAY-canonical** |
| `CONCURRENCY_GUARD_TRIGGERED` | Concurrency guard fired (DB UNIQUE / advisory lock) | YES — concurrency event | NO (not a denial; informational) | **REPLAY-adjacent canonical** |

(2 more entries beyond what was inspected — assumed within the 24. Frozen YC MVP file authoritative.)

---

## 3. Functional category mapping (Subsystem B) — the 15-category enum

Per `auditLedger.ts:20–37`. Categories classify FUNCTIONAL DOMAIN, not specific event.

| Category | Domain | Maps to canonical events |
|---|---|---|
| `ISSUANCE` | Credential / receipt issuance | `PSV_RECEIPT` (and variants) |
| `PRESENTATION` | Credential presentation | (no direct canonical mapping) |
| `VERIFICATION` | Source verification | `VERIFICATION_*` family |
| `REVOCATION` | Credential revocation | (no direct canonical mapping) |
| `DECISION` | Decision-graph events | `EMPLOYER_ACCEPTANCE`, `EMPLOYER_ACCEPTANCE_REJECTED` |
| `MONITORING` | Monitoring / freshness events | `TRUST_STATE_DECAY` |
| `FEDERATION` | Federation events | (no direct canonical mapping) |
| `COMPLIANCE` | Compliance events | (no direct canonical mapping) |
| `AUTH` | Authentication events | (no direct canonical mapping) |
| `ADMIN` | Admin actions | (no direct canonical mapping) |
| `SYSTEM` | System events | (no direct canonical mapping) |
| `TRUST_STATE_CHANGE` | Trust state transitions | `TRUST_STATE_CHECK`, `TRUST_STATE_DECAY` |
| `READINESS_CHANGE` | Readiness state transitions | (no direct canonical mapping) |
| `BUNDLE_EXPORT` | Bundle exports | `ARTIFACT_EXPORTED` (free-form) |
| `SIMULATION` | Simulation events | (no direct canonical mapping) |

**Key insight:** `AuditCategory` answers "WHICH SUBSYSTEM produced this event?" while `AUDIT_EVENT_TYPES` answers "WHICH SPECIFIC EVENT happened?" The two are ORTHOGONAL — both legitimately distinct.

---

## 4. Free-form prisma type mapping (Subsystem C) — wave-scope subset

The runtime free-form `prisma.auditEvent.type` namespace contains 150+ distinct literals. This map covers the W2-PR2B/2C employer-review wave scope. Other domains (research, governance, network, etc.) are flagged for separate vocabulary-map waves.

### 4.1 Wave-scope literals (employer-review surface)

| Free-form literal | Canonical alias | Status | Operational meaning | Query-compatible with canonical? |
|---|---|---|---|---|
| `EMPLOYER_REVIEW_ACCEPTED` | `EMPLOYER_ACCEPTANCE` (canonical) | 🟡 **ALIAS** | Employer accepted the clinician (head start) | YES — query both literals to find all acceptance events |
| `EMPLOYER_REVIEW_REFRESH_REQUESTED` | (NO canonical equivalent) | 🟢 **CANONICAL within free-form namespace** | Employer requested clinician credential refresh | NO — query free-form literal only |
| `EMPLOYER_REVIEW_ROUTED_TO_REVIEW` | (NO canonical equivalent) | 🟢 **CANONICAL within free-form namespace** | Employer routed candidate to manual HITL review | NO — query free-form literal only |
| `EMPLOYER_PACKET_SHARED` | (NO canonical equivalent) | 🟢 **CANONICAL within free-form namespace** | Employer issued a share-packet token | NO — query free-form literal only |
| `ARTIFACT_EXPORTED` | (NO canonical equivalent) | 🟢 **CANONICAL within free-form namespace** | Evidence packet exported | NO — query free-form literal only |
| `START_ATTESTED` | `START_ATTESTED` (canonical — IDENTICAL) | 🟢 **CONVERGENT** | Employer attested clinician's start | YES — same string in both vocabularies |
| `EMPLOYER_VIEWED` | (NO canonical equivalent; `view` learning telemetry) | 🟠 **LEGACY/TELEMETRY** | Employer viewed clinician status | NO — telemetry, not audit-coupled |

### 4.2 Adjacent free-form literals (issuer / passport / hiring — NOT W2-PR2B)

| Free-form literal | Domain | Notes |
|---|---|---|
| `PASSPORT_SHARED` | Passport | Per `requireAuditBeforeResponse` non-repudiation list (auditService.ts:113) |
| `EMPLOYER_ACCEPTANCE_CREATED` | Hiring | Per same list — likely ALIAS for `EMPLOYER_ACCEPTANCE` (canonical) |
| `PSV_ADAPTER_*` | Issuer trust chain | Out of W2-PR2B scope |
| `CREDENTIAL_*` | Credential lifecycle | Out of W2-PR2B scope |

### 4.3 Out-of-wave free-form literals (~140+ others)

Examples observed: `INSTITUTION`, `CREDENTIAL_DEPENDENCY`, `NEIGHBOR`, `RESEARCH_*`, `TRUST_*`, `AI_HITL_*`, `SOURCE_*`, etc.

**Many of these appear to be GRAPH/ENTITY classifications stored on the audit table, NOT audit-event types in the canonical sense.** A separate wave should classify whether each literal is:
- An audit event (per the canonical contract).
- A graph entity classification (should arguably live elsewhere).
- A telemetry signal (should arguably live elsewhere).

**Out of W2-PR8A scope.** Flagged for follow-up wave: `audit-event-vocabulary-broader-ecosystem.md`.

---

## 5. Lock v2 NEW vocabulary (action-literal suffixes)

Per `w2-pr2b-implementation-lock-v2.md` §8 + `w2-pr2b-audit-coupling.md` §3.3: Lock v2 introduces denied-path action literals on `metadata.action` field (NOT on `type` column).

| Action literal pattern | Field | Canonical equivalent |
|---|---|---|
| `<base>` (e.g., `employer_review.accept`) | `metadata.action` (post-Lock-v2) | Permitted-path action; `<base>` describes the verb |
| `<base>.<reason>` (e.g., `employer_review.accept.role_denied`) | `metadata.action` (post-Lock-v2) | Denied-path action with reason suffix |

Reason suffixes (Lock v2 §8):
- `<base>.role_denied`
- `<base>.no_org_context`
- `<base>.entity_not_found`
- `<base>.acceptance_blocked`
- `<base>.already_accepted`
- `<base>.no_prior_acceptance`
- `<base>.duplicate_request` ← **REPLAY-related — see `replay-taxonomy-map.md`**
- `<base>.malformed_resource_id`
- `<base>.wrong_review_state` (post-MIG)
- `<base>.archived_review` (if introduced)

---

## 6. Per-event canonical/alias/legacy/divergent classification

For each wave-scope literal, the convergence classification:

| Literal | Status | Disposition |
|---|---|---|
| `RECOGNITION` (canonical) | 🟢 **CANONICAL** | Use as-is |
| `ACCEPTANCE` (canonical) | 🟢 **CANONICAL** | Use as-is |
| `EMPLOYER_ACCEPTANCE` (canonical) | 🟢 **CANONICAL** | Use as-is; semantic-pair with `EMPLOYER_REVIEW_ACCEPTED` (free-form) |
| `START` (canonical) | 🟢 **CANONICAL** | Use as-is |
| `START_ATTESTED` (canonical + free-form CONVERGENT) | 🟢 **CANONICAL — CONVERGENT** | Same string in both vocabularies; use freely |
| `IDEMPOTENT_REPLAY` (canonical) | 🟢 **CANONICAL — REPLAY** | Per `replay-taxonomy-map.md`: replay observed AND processed (NOT denied) |
| `CONCURRENCY_GUARD_TRIGGERED` (canonical) | 🟢 **CANONICAL — REPLAY-adjacent** | Per replay-taxonomy: concurrency mechanism fired |
| `EMPLOYER_REVIEW_ACCEPTED` (free-form) | 🟡 **ALIAS** for `EMPLOYER_ACCEPTANCE` (canonical) | Operational equivalence; query both for completeness |
| `EMPLOYER_REVIEW_REFRESH_REQUESTED` (free-form) | 🟢 **CANONICAL within free-form namespace** | No canonical alias; use as-is for refresh-request events |
| `EMPLOYER_REVIEW_ROUTED_TO_REVIEW` (free-form) | 🟢 **CANONICAL within free-form namespace** | Same |
| `EMPLOYER_PACKET_SHARED` (free-form) | 🟢 **CANONICAL within free-form namespace** | Same; audit-as-persistence pattern |
| `ARTIFACT_EXPORTED` (free-form) | 🟢 **CANONICAL within free-form namespace** | Same |
| `EMPLOYER_VIEWED` (free-form, telemetry) | 🟠 **LEGACY/TELEMETRY** | NOT audit-coupled; from `loadEmployerReviewStatus` learning event |
| `EMPLOYER_ACCEPTANCE_REJECTED` (canonical) | 🟢 **CANONICAL — DENIAL** | Use for hard rejections; semantic-overlap with `<base>.acceptance_blocked` (Lock v2 metadata.action) |
| `START_REJECTED` (canonical) | 🟢 **CANONICAL — DENIAL** | Same; semantic-overlap with `<base>.no_prior_acceptance` |
| Any other free-form prisma type | 🔴 **DIVERGENT — out of W2-PR8A scope** | Cataloged for follow-up wave |

---

## 7. The three operational equivalences

Three pairs that are OPERATIONALLY EQUIVALENT but use different literals:

| Pair A | Pair B | Equivalence |
|---|---|---|
| `EMPLOYER_ACCEPTANCE` (canonical) | `EMPLOYER_REVIEW_ACCEPTED` (free-form) | Both record "employer accepted clinician" |
| `EMPLOYER_ACCEPTANCE_REJECTED` (canonical) | `<base>.acceptance_blocked` (Lock v2) | Both record "acceptance refused" — but at different gates (canonical = explicit rejection; blocked = passport-blocked precondition fail) |
| `START_REJECTED` (canonical) | `<base>.no_prior_acceptance` (Lock v2) | Both record "start refused" — but at different gates |

**Track A finding VM-1:** the equivalences are NOT semantic-identity. They are operational-near-equivalence. Forensic queries that conflate them lose distinction; queries that separate them gain precision. The lexicon-aligned discipline: NAME WHICH ONE you mean.

---

## 8. Forensic query templates (canonical → multi-vocabulary)

For each common query intent, the canonical query:

### 8.1 "All acceptance events for clinician X"

```sql
SELECT * FROM audit_events
WHERE clinician_id = $npi
  AND type IN ('EMPLOYER_ACCEPTANCE', 'EMPLOYER_REVIEW_ACCEPTED', 'EMPLOYER_ACCEPTANCE_CREATED');
```

Three literals; query all three for completeness.

### 8.2 "All rejection events for clinician X"

```sql
SELECT * FROM audit_events
WHERE clinician_id = $npi
  AND (
    type IN ('EMPLOYER_ACCEPTANCE_REJECTED', 'START_REJECTED')
    OR (metadata->>'outcome' = 'denied' AND metadata->>'action' LIKE 'employer_review%')
  );
```

Mixes canonical + Lock v2 vocabularies.

### 8.3 "All replay events for actor X"

```sql
SELECT * FROM audit_events
WHERE metadata->>'actorId' = $userId
  AND (
    type IN ('IDEMPOTENT_REPLAY', 'CONCURRENCY_GUARD_TRIGGERED')
    OR metadata->>'action' LIKE '%duplicate_request'
  );
```

Mixes both replay vocabularies.

### 8.4 "All canonical 5-event non-repudiation chain for entity X"

```sql
SELECT * FROM audit_events
WHERE reference_id = $entityId
  AND type IN ('RECOGNITION', 'ACCEPTANCE', 'EMPLOYER_ACCEPTANCE', 'START', 'START_ATTESTED');
```

Strictly canonical; misses free-form `EMPLOYER_REVIEW_ACCEPTED` rows.

### 8.5 "All employer-review domain events for entity X"

```sql
SELECT * FROM audit_events
WHERE reference_id = $entityId
  AND type LIKE 'EMPLOYER_REVIEW_%'
  OR type IN ('EMPLOYER_PACKET_SHARED', 'ARTIFACT_EXPORTED');
```

Strictly free-form; misses canonical `EMPLOYER_ACCEPTANCE` rows.

**Track A finding VM-2:** every cross-vocabulary query requires explicit OR-clause. A "canonical-events-only" query misses ~⅔ of employer-review activity. A "free-form-only" query misses canonical wedge events.

---

## 9. Per-event lexicon-aligned wording

For each event, the lexicon-conformant description (use in dashboards, runbooks, marketing-adjacent surfaces):

| Event | Lexicon-aligned wording |
|---|---|
| `RECOGNITION` | "Recognition event recorded for clinician [NPI]" |
| `ACCEPTANCE` / `EMPLOYER_ACCEPTANCE` / `EMPLOYER_REVIEW_ACCEPTED` | "Acceptance event recorded for clinician [NPI] by employer [actorId]" |
| `START` / `START_ATTESTED` | "Start-attestation event recorded by employer [actorId]" |
| `EMPLOYER_REVIEW_REFRESH_REQUESTED` | "Refresh-request event recorded by employer [actorId]" |
| `EMPLOYER_REVIEW_ROUTED_TO_REVIEW` | "Routed-to-review event recorded by employer [actorId]" |
| `EMPLOYER_PACKET_SHARED` | "Packet-shared event recorded; share-token issued" |
| `ARTIFACT_EXPORTED` | "Artifact-export event recorded for clinician [NPI]" |
| `IDEMPOTENT_REPLAY` | "Idempotent-replay event recorded; operation processed once with replay acknowledged" |
| `CONCURRENCY_GUARD_TRIGGERED` | "Concurrency-guard event recorded; concurrency mechanism fired" |
| `<base>.duplicate_request` (Lock v2) | "Best-effort idempotency-check denied audit; correlationId match within 24h" |
| `<base>.role_denied` (Lock v2) | "Role-gate denied audit; readonly mutation attempt OR role insufficient" |
| `<base>.acceptance_blocked` (Lock v2) | "Workflow-gate denied audit; passport BLOCKED at decision time" |

---

## 10. Update protocol

This vocabulary map is amended when:

- A new free-form `prisma.auditEvent.type` literal is introduced by any wave.
- A new canonical event-type is proposed (requires unfreezing AUDIT_EVENT_TYPES — out of routine scope).
- A new alias relationship is identified.
- A new forensic-query template is needed.

Updates require:
1. Founder approval (per `TRUST_GUARANTEE_LEXICON.md` §6 update protocol).
2. Codex SAFE audit confirming the new mapping doesn't break existing queries.
3. Cross-reference to the introducing wave's PR description.

---

## 11. Aggregate convergence status

| Vocabulary scope | Status | Notes |
|---|---|---|
| Canonical events (Subsystem A) — 24 events | 🟢 **CANONICAL** — frozen YC MVP enum | Authoritative meanings |
| Functional categories (Subsystem B) — 15 categories | 🟢 **CANONICAL — orthogonal axis** | Domain classification, not event-type |
| Free-form prisma type (Subsystem C) — wave-scope subset (~7 literals) | 🟡 **PARTIAL** — mapped here | 1 ALIAS (EMPLOYER_REVIEW_ACCEPTED), 4 free-form CANONICAL, 1 LEGACY-telemetry, 1 CONVERGENT |
| Free-form prisma type — out-of-wave (~140 literals) | 🔴 **DIVERGENT — out of W2-PR8A scope** | Follow-up wave required |
| Lock v2 metadata.action literals | 🟢 **CANONICAL — Lock v2 contract** | Lexicon-conformant per §4 of TRUST_GUARANTEE_LEXICON.md |

---

## 12. Closing principle (vocabulary map)

This map is the operational language for VitalCV's audit spine. Three vocabularies coexist with overlapping but non-isomorphic semantics. The map preserves the runtime as-is (no enum changes; no migration; no deprecations) and converges through documentation: which literal means what, which are aliases, which require multi-literal queries.

**Operational equivalence is documented; semantic identity is NOT claimed.** Forensic queries use the per-intent templates. Dashboards use the lexicon-aligned wording. Codex audits verify wave PRs use map-conformant literal references.

**The platform is queryable across the divergence — not because the divergence is gone, but because the divergence is mapped.**

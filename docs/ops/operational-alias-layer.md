# Operational Alias Layer

**Status:** **OPERATIONAL** — frozen reference for VitalCV audit-event aliases · **Date established:** 2026-05-08 · **Authority:** subordinate to `audit-event-vocabulary-map.md`, `replay-taxonomy-map.md`, `export-query-cohesion.md`, `TRUST_GUARANTEE_LEXICON.md`

This doc is the **documentation-only alias layer.** It allows operators and SOC analysts to query by **canonical meaning** instead of by **runtime literal fragmentation**. The runtime is unchanged; the alias layer is purely a query/reasoning convenience.

The contract: **alias equivalence is OPERATIONAL EQUIVALENCE, NOT semantic identity** (per Track D non-negotiable rule #2). Two literals can be operationally-equivalent (record the same kind of platform event) without being semantically-identical (they may differ in detection layer, gate context, or denial reason). This doc names which equivalences are operational + bounded.

---

## 1. The alias layer's purpose

A SOC analyst asking "did this clinician get accepted?" should NOT have to learn that the answer might be in:

- `type = 'EMPLOYER_ACCEPTANCE'` (canonical wedge enum)
- `type = 'EMPLOYER_REVIEW_ACCEPTED'` (free-form, employer-review handler post-Lock-v2)
- `type = 'EMPLOYER_ACCEPTANCE_CREATED'` (free-form, hiring handler per requireAuditBeforeResponse)
- `type = 'ACCEPTANCE'` (canonical, single-step naming)

The alias layer collapses these into **one canonical operational concept**: "ACCEPTANCE_OCCURRED." The analyst queries the alias; the implementation expands to the multi-literal OR-clause.

The runtime literals remain unchanged. The alias is doc + query-template.

---

## 2. Canonical operational concepts (the alias namespace)

Each canonical concept names ONE operational meaning. Multiple runtime literals MAY map to it (operational equivalence). Each concept is named in `UPPER_SNAKE_CASE` with a `CONCEPT_` prefix to distinguish from runtime literals.

### 2.1 Mutation event aliases

| Canonical concept | Operational meaning | Runtime literals (any/all) |
|---|---|---|
| `CONCEPT_RECOGNITION_OCCURRED` | A clinician was recognized (canonical wedge step 1) | `RECOGNITION` (canonical only — no free-form alias observed) |
| `CONCEPT_ACCEPTANCE_OCCURRED` | An acceptance was recorded (any wedge variant) | `ACCEPTANCE`, `EMPLOYER_ACCEPTANCE`, `EMPLOYER_ACCEPTANCE_CREATED`, `EMPLOYER_REVIEW_ACCEPTED` |
| `CONCEPT_START_OCCURRED` | A start was recorded | `START` |
| `CONCEPT_START_ATTESTED` | A start was attested by employer | `START_ATTESTED` (canonical — convergent across both vocabularies) |
| `CONCEPT_REFRESH_REQUESTED` | A credential refresh was requested | `EMPLOYER_REVIEW_REFRESH_REQUESTED` (free-form only — no canonical) |
| `CONCEPT_ROUTED_TO_REVIEW` | An entity was routed to manual review | `EMPLOYER_REVIEW_ROUTED_TO_REVIEW` (free-form only) |
| `CONCEPT_PACKET_SHARED` | An evidence-packet share-token was issued | `EMPLOYER_PACKET_SHARED` (free-form only) |
| `CONCEPT_ARTIFACT_EXPORTED` | An evidence artifact was exported | `ARTIFACT_EXPORTED` (free-form only) |
| `CONCEPT_PASSPORT_SHARED` | A passport was shared | `PASSPORT_SHARED` (free-form only — per requireAuditBeforeResponse non-repudiation list) |

### 2.2 Denial event aliases

| Canonical concept | Operational meaning | Runtime sources |
|---|---|---|
| `CONCEPT_ACCEPTANCE_DENIED` | An acceptance attempt was rejected | `EMPLOYER_ACCEPTANCE_REJECTED` (canonical) OR `metadata.action='employer_review.accept.acceptance_blocked'` OR `metadata.action='employer_review.accept.already_accepted'` (Lock v2) |
| `CONCEPT_START_DENIED` | A start-attestation attempt was rejected | `START_REJECTED` (canonical) OR `metadata.action='employer_review.confirm_start.no_prior_acceptance'` (Lock v2) |
| `CONCEPT_ROLE_DENIED` | A mutation was denied because role was insufficient (post-Lock-v2) | `metadata.action LIKE '%.role_denied'` (Lock v2) |
| `CONCEPT_DUPLICATE_DENIED` | A mutation was denied because of correlationId-dedup (post-Lock-v2) | `metadata.action LIKE '%.duplicate_request'` (Lock v2) |
| `CONCEPT_NOT_FOUND_DENIED` | A mutation was denied because resource not found | `metadata.action LIKE '%.entity_not_found'` (Lock v2) |
| `CONCEPT_NO_CONTEXT_DENIED` | A mutation was denied because JWT lacked org_id (post-Lock-v2) | `metadata.action LIKE '%.no_org_context'` (Lock v2) |
| `CONCEPT_VALIDATION_FAILED` | Input validation failed | `NPI_VALIDATION_FAILED` (canonical) OR `metadata.action LIKE '%.malformed_resource_id'` (Lock v2) OR various per-handler 400 paths |
| `CONCEPT_SOURCE_VERIFICATION_FAILED` | Source verification step failed | `VERIFICATION_FAILED` (canonical) |

### 2.3 Replay event aliases

Per `replay-taxonomy-map.md` §2:

| Canonical concept | Operational meaning | Runtime sources |
|---|---|---|
| `CONCEPT_REPLAY_OBSERVED` | Replay was observed AND processed (R-OBSERVED state) | `IDEMPOTENT_REPLAY` (canonical) |
| `CONCEPT_REPLAY_DENIED` | Replay was rejected at the dedup gate (R-DENIED state) | `metadata.action LIKE '%.duplicate_request'` (Lock v2) OR `metadata.action LIKE '%.already_accepted'` (Lock v2 / existing handler) |
| `CONCEPT_REPLAY_COLLAPSED` | Concurrency mechanism prevented duplicate (R-COLLAPSED state) | `CONCURRENCY_GUARD_TRIGGERED` (canonical) |

NOTE: there is NO canonical concept for R-ACCEPTED (replay processed as if new) because no marker on the audit row indicates it. R-ACCEPTED detection requires forensic clustering by `(actorId, payloadHash)` — not a queryable concept directly. R-AMBIGUOUS is similar.

### 2.4 Trust-state event aliases

| Canonical concept | Operational meaning | Runtime sources |
|---|---|---|
| `CONCEPT_TRUST_STATE_CHECKED` | Trust state was checked | `TRUST_STATE_CHECK` (canonical) |
| `CONCEPT_TRUST_STATE_DECAYED` | Trust state decayed (e.g., source went stale) | `TRUST_STATE_DECAY` (canonical) |
| `CONCEPT_PSV_RECEIPT_EMITTED` | A PSV receipt event was emitted | `PSV_RECEIPT` (canonical) |

### 2.5 Ingest event aliases

| Canonical concept | Operational meaning | Runtime sources |
|---|---|---|
| `CONCEPT_NPI_INGESTED` | NPI was ingested | `NPI_INGESTED` (canonical) |
| `CONCEPT_INGEST_CONFLICT` | Conflict detected during ingest | `INGEST_CONFLICT_DETECTED` (canonical) |
| `CONCEPT_INGEST_FAILED` | Ingest pipeline failure | `INGEST_ERROR` (canonical) OR `NPI_VALIDATION_FAILED` (canonical) |

---

## 3. Per-concept query template

For each canonical concept, the operational query that returns ALL matching rows across all aliases:

### 3.1 `CONCEPT_ACCEPTANCE_OCCURRED`

```sql
SELECT * FROM audit_events
WHERE clinician_id = $npi
  AND type IN (
    'ACCEPTANCE',
    'EMPLOYER_ACCEPTANCE',
    'EMPLOYER_ACCEPTANCE_CREATED',
    'EMPLOYER_REVIEW_ACCEPTED'
  );
```

### 3.2 `CONCEPT_ACCEPTANCE_DENIED`

```sql
SELECT * FROM audit_events
WHERE clinician_id = $npi
  AND (
    type = 'EMPLOYER_ACCEPTANCE_REJECTED'
    OR (
      metadata->>'outcome' = 'denied'
      AND metadata->>'action' SIMILAR TO 'employer_review\.accept\.[a-z_]+'
    )
  );
```

### 3.3 `CONCEPT_REPLAY_DENIED`

```sql
SELECT * FROM audit_events
WHERE metadata->>'outcome' = 'denied'
  AND (
    metadata->>'action' LIKE '%.duplicate_request'
    OR metadata->>'action' LIKE '%.already_accepted'
  );
```

### 3.4 `CONCEPT_REPLAY_OBSERVED`

```sql
SELECT * FROM audit_events
WHERE type = 'IDEMPOTENT_REPLAY';
```

### 3.5 `CONCEPT_REPLAY_COLLAPSED`

```sql
SELECT * FROM audit_events
WHERE type = 'CONCURRENCY_GUARD_TRIGGERED';
```

### 3.6 `CONCEPT_VALIDATION_FAILED`

```sql
SELECT * FROM audit_events
WHERE type = 'NPI_VALIDATION_FAILED'
   OR (metadata->>'outcome' = 'denied' AND metadata->>'action' LIKE '%.malformed_resource_id');
```

### 3.7 `CONCEPT_ROLE_DENIED`

```sql
SELECT * FROM audit_events
WHERE metadata->>'outcome' = 'denied'
  AND metadata->>'action' LIKE '%.role_denied';
```

### 3.8 `CONCEPT_NOT_FOUND_DENIED`

```sql
SELECT * FROM audit_events
WHERE metadata->>'outcome' = 'denied'
  AND metadata->>'action' LIKE '%.entity_not_found';
```

### 3.9 `CONCEPT_ALL_DENIED` (super-alias for any denial)

```sql
SELECT * FROM audit_events
WHERE metadata->>'outcome' = 'denied'
   OR type IN (
     'EMPLOYER_ACCEPTANCE_REJECTED',
     'START_REJECTED',
     'NPI_VALIDATION_FAILED',
     'VERIFICATION_FAILED',
     'INGEST_ERROR'
   );
```

---

## 4. Equivalence semantics — the bounded form

Each alias declares its equivalence class. The bounds are explicit: equivalence is OPERATIONAL (records the same kind of event) but NOT IDENTITY (may differ in detection layer / gate / detection mechanism).

### 4.1 `CONCEPT_ACCEPTANCE_OCCURRED` — equivalence bounds

| Literal | Detection layer | Gate context | Differentiation |
|---|---|---|---|
| `ACCEPTANCE` (canonical) | Wedge state machine | Per-clinician wedge step 2 | Most abstract; may pre-date employer-specific tracking |
| `EMPLOYER_ACCEPTANCE` (canonical) | Same | Same | Canonical employer-specific naming |
| `EMPLOYER_ACCEPTANCE_CREATED` (free-form) | Per `requireAuditBeforeResponse` non-repudiation list | Hiring path | Likely from `apps/api/backend/src/routes/hiring.ts` |
| `EMPLOYER_REVIEW_ACCEPTED` (free-form) | Service function `recordEmployerReviewAcceptance` | Employer-review path | Per-actor scope; (employerId, clinicianNpi) |

**Equivalence claim:** all 4 record an acceptance. Differentiation: the SCOPE / HANDLER / DETECTION-LAYER varies. A query that needs "all acceptances regardless of scope" uses `CONCEPT_ACCEPTANCE_OCCURRED`. A query that needs "only employer-review-handler acceptances" uses `EMPLOYER_REVIEW_ACCEPTED` directly.

### 4.2 `CONCEPT_REPLAY_DENIED` — equivalence bounds

| Literal | Detection layer | Gate context | Differentiation |
|---|---|---|---|
| `<base>.duplicate_request` (Lock v2) | Application-layer correlationId dedup | (actor, correlationId, 24h) match | TOCTOU race exists |
| `<base>.already_accepted` (Lock v2) | `accept` handler's existing duplicate-check | (employerId, clinicianNpi, status='ACCEPTED') match | Per-actor scope; existing pre-Lock-v2 path now audit-emitting |

**Equivalence claim:** both record a denied-replay. Differentiation: `duplicate_request` is correlation-based (per-attempt); `already_accepted` is content-based (per-acceptance).

---

## 5. Lexicon-aligned wording per concept

For dashboards, runbooks, and human-readable surfaces, the lexicon-aligned phrasing per concept:

| Concept | Lexicon-aligned wording |
|---|---|
| `CONCEPT_ACCEPTANCE_OCCURRED` | "Acceptance event recorded for [npi] by [actorId] at [timestamp]" |
| `CONCEPT_ACCEPTANCE_DENIED` | "Acceptance attempt denied for [npi] by [actorId] at [timestamp] (reason: [reason])" |
| `CONCEPT_REPLAY_OBSERVED` | "Idempotent-replay event recorded; operation processed once and replay acknowledged" |
| `CONCEPT_REPLAY_DENIED` | "Best-effort idempotency-check denied audit; correlationId or content-match within 24h" |
| `CONCEPT_REPLAY_COLLAPSED` | "Concurrency-guard event recorded; concurrency mechanism prevented duplicate state" |
| `CONCEPT_ROLE_DENIED` | "Role-gate denied audit; readonly mutation attempt OR role insufficient for verb" |
| `CONCEPT_VALIDATION_FAILED` | "Input-validation denied audit" |
| `CONCEPT_NOT_FOUND_DENIED` | "Entity-not-found denied audit; resource lookup returned no row" |

---

## 6. Anti-aliases (what NOT to alias)

Some literals SOUND aliasable but should NOT be:

| Pair A | Pair B | Why NOT aliased |
|---|---|---|
| `IDEMPOTENT_REPLAY` (R-OBSERVED) | `<base>.duplicate_request` (R-DENIED) | OPPOSITE outcomes — observed-and-processed vs denied. Aliasing would conflate. |
| `CONCURRENCY_GUARD_TRIGGERED` (R-COLLAPSED) | `<base>.duplicate_request` (R-DENIED) | Different mechanisms — DB UNIQUE vs application-layer dedup. |
| `EMPLOYER_ACCEPTANCE_REJECTED` (canonical denial) | `<base>.acceptance_blocked` (Lock v2) | Different gate — explicit user rejection vs passport-blocked precondition. |
| `START_REJECTED` (canonical denial) | `<base>.no_prior_acceptance` (Lock v2) | Different gate — explicit start rejection vs missing-prerequisite. |

**Track D finding OA-1:** anti-aliases are as important as aliases. Conflating them loses operational truth. The lexicon enforces precise wording per concept.

---

## 7. Adding new aliases — update protocol

A new alias is added when:

- A new free-form `prisma.auditEvent.type` literal is introduced AND it operationally-equivalent to an existing concept.
- A new canonical event type is proposed (requires unfreezing AUDIT_EVENT_TYPES — out of routine scope).
- A new Lock v2 metadata.action literal is introduced.

Adding requires:

1. Founder approval per `TRUST_GUARANTEE_LEXICON.md` §6.
2. Codex SAFE audit confirming the equivalence class is bounded (operational, not identity).
3. Update to query templates in §3.
4. Update to lexicon-aligned wording in §5.
5. Cross-reference to introducing wave's PR description.

---

## 8. Dashboard / SOC integration recommendations

| Recommendation | Owner |
|---|---|
| Dashboard widgets query by CONCEPT_*, not by runtime literal | Dashboard owner |
| SOC playbooks reference concepts in headers; literals only in query templates | SOC team |
| New audit-emitting wave PRs include "Adds alias mapping for concept X" in PR description if introducing literals | Wave authors |
| Codex audit prompt verifies wave PR's audit-row literals appear in either canonical enum OR alias map | Codex SAFE |

---

## 9. Adoption checklist

For a downstream consumer to adopt the alias layer:

- [ ] Read `audit-event-vocabulary-map.md`, `replay-taxonomy-map.md`, `export-query-cohesion.md`, this doc.
- [ ] Identify which CONCEPT_* applies to the consumer's intent.
- [ ] Use the §3 query template (or its variant per export path per `export-query-cohesion.md` §6).
- [ ] Use lexicon-aligned wording per §5 in any human-facing surface.
- [ ] Avoid anti-aliases per §6.
- [ ] Document per-consumer which CONCEPT_* it relies on.

---

## 10. Closing principle (operational alias layer)

The alias layer is the documentation discipline that makes 3 parallel runtime vocabularies queryable as ONE operational language — without modifying the runtime, without inflating guarantees, and without claiming semantic identity where only operational equivalence holds.

**Operators query CONCEPT_*; queries expand to multi-literal OR-clauses; lexicon-aligned wording surfaces in dashboards.** The runtime is unchanged; the operator's mental model is unified.

**The platform's audit log is not canonically-vocabularied. It is canonically-aliased — and that is sufficient for canonical operational queryability.**

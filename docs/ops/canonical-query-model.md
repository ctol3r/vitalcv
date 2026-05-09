# Canonical Query Model

**Status:** **OPERATIONAL** — frozen reference for VitalCV canonical operational query semantics · **Date established:** 2026-05-08 · **Authority:** subordinate to `audit-event-vocabulary-map.md`, `replay-taxonomy-map.md`, `export-query-cohesion.md`, `operational-alias-layer.md`, `TRUST_GUARANTEE_LEXICON.md`

This doc defines the **canonical operational query semantics** for VitalCV's audit spine — one operational language despite frozen runtime vocabulary fragmentation. It consolidates the per-intent query templates from prior W2-PR8A docs into a unified query model with consistent semantics across replay, denial, attribution, and export queries.

The contract: **canonical queryability is achieved through documentation discipline, NOT through runtime convergence.** The frozen YC MVP `AUDIT_EVENT_TYPES` enum, the `AuditCategory` enum in `auditLedger.ts`, and the free-form `prisma.auditEvent.type` namespace remain unchanged. The query model maps each operational concept to a multi-vocabulary query template.

---

## 1. The query model — five semantic layers

A canonical query operates at one of 5 semantic layers. Each layer answers a distinct operator question.

| Layer | Question | Primary primitive |
|---|---|---|
| **L-OP: Operational events** | "What kind of platform event happened?" | `CONCEPT_*` aliases (per `operational-alias-layer.md`) |
| **L-RP: Replay state** | "What replay state does this event represent?" | R-OBSERVED / R-DENIED / R-ACCEPTED / R-COLLAPSED / R-AMBIGUOUS (per `replay-taxonomy-map.md`) |
| **L-DN: Denial outcome** | "Was this attempt denied? Why?" | `metadata.outcome = 'denied'` + `metadata.action` reason suffix |
| **L-AT: Attribution** | "Who acted? Who is the subject?" | `metadata.actorId` (actor) vs `clinician_id` (subject) |
| **L-EX: Export path** | "Which export source returns the most coherent result?" | EX-1 / EX-2 / EX-3 / EX-4 (per `export-query-cohesion.md`) |

A complete query specifies all 5 layers explicitly.

---

## 2. The canonical query shape

Every query in the model has this conceptual shape:

```
CANONICAL_QUERY:
  CONCEPT: <CONCEPT_*>
  REPLAY_STATE: <R-state> (optional; for replay-aware queries)
  DENIAL_OUTCOME: <permitted | denied | both> (default: both)
  ATTRIBUTION:
    actor: <userId> (optional)
    subject: <npi or entityId> (optional)
  EXPORT_PATH: <EX-1 | EX-2 | EX-3 | EX-4> (default: EX-3)
  TIME_BOUND: <interval> (default: last 7 days)
```

The corresponding SQL is derived per the query templates in `operational-alias-layer.md` §3 + `export-query-cohesion.md` §6.

---

## 3. Per-layer query semantics

### 3.1 L-OP — Operational events

Per `operational-alias-layer.md`, the canonical concepts:

- `CONCEPT_RECOGNITION_OCCURRED`
- `CONCEPT_ACCEPTANCE_OCCURRED`
- `CONCEPT_START_OCCURRED`
- `CONCEPT_START_ATTESTED`
- `CONCEPT_REFRESH_REQUESTED`
- `CONCEPT_ROUTED_TO_REVIEW`
- `CONCEPT_PACKET_SHARED`
- `CONCEPT_ARTIFACT_EXPORTED`
- `CONCEPT_PASSPORT_SHARED`
- (denial concepts: `CONCEPT_ACCEPTANCE_DENIED`, `CONCEPT_START_DENIED`, etc.)
- (replay concepts: `CONCEPT_REPLAY_OBSERVED`, `CONCEPT_REPLAY_DENIED`, `CONCEPT_REPLAY_COLLAPSED`)

**Query semantics:** L-OP-conformant queries reference CONCEPT_* in their declared intent + expand to multi-literal SQL OR-clause via the alias map.

### 3.2 L-RP — Replay state

Per `replay-taxonomy-map.md`, the 5 states:

- **R-OBSERVED** — `type = 'IDEMPOTENT_REPLAY'`
- **R-DENIED** — `metadata.action LIKE '%duplicate_request' OR '%already_accepted'`
- **R-ACCEPTED** — no marker; forensic detection via `(actorId, payloadHash)` clustering
- **R-COLLAPSED** — `type = 'CONCURRENCY_GUARD_TRIGGERED'`
- **R-AMBIGUOUS** — multi-row scenarios; SOC disambiguation per `replay-taxonomy-map.md` §6

**Query semantics:** L-RP-conformant queries CLASSIFY each row's replay state in a SQL CASE expression (per `replay-taxonomy-map.md` §7.3 template).

### 3.3 L-DN — Denial outcome

Lock v2 introduces `metadata.outcome` (`'permitted' | 'denied'`) + `metadata.action` reason suffixes.

**Query semantics:** L-DN-conformant queries:
- Filter on `metadata.outcome` for permitted/denied separation.
- Filter on `metadata.action LIKE '%<reason>'` for reason classification.
- Join to canonical denial event types (`EMPLOYER_ACCEPTANCE_REJECTED`, `START_REJECTED`, `NPI_VALIDATION_FAILED`, `VERIFICATION_FAILED`, `INGEST_ERROR`) for cross-vocabulary completeness.

### 3.4 L-AT — Attribution

Distinct fields per concern:

| Concern | Field | Source |
|---|---|---|
| Actor (who performed) | `metadata.actorId` (Lock v2 canonical) OR `metadata.employerId` (existing) | Clerk userId from `requireClerkUserId(req)` |
| Subject (who is being acted-on) | `clinician_id` (top-level column) OR `metadata.clinicianNpi` | The clinician NPI |
| Resource (what is being acted-on) | `reference_id` (top-level column) | Entity ID, acceptance ID, etc. |
| Tenant org (post-MIG-C) | `organization_id` (top-level column; NULL today) OR `metadata.tenantOrgId` | Per-org tenancy |

**Query semantics:** L-AT-conformant queries explicitly distinguish actor / subject / resource / tenant. Conflating "clinician_id" (subject) with "actor" (principal) is forbidden per `operational-alias-layer.md` anti-aliases.

### 3.5 L-EX — Export path

Per `export-query-cohesion.md` §4:

- **EX-1 SIEM cursor** — streaming; T0/T1 only; misses T2 writers.
- **EX-2 SIEM time-bounded** — same.
- **EX-3 Postgres direct** — full coverage; canonical for forensics.
- **EX-4 Scrapbook** — UNVERIFIED coverage.

**Query semantics:** L-EX-conformant queries declare which export path they execute against. Defaults to EX-3 for forensic queries; EX-1 for streaming.

---

## 4. Composed canonical queries — examples

### 4.1 Q-CANON-1: "All acceptances for clinician X in last 7 days"

```yaml
CONCEPT: CONCEPT_ACCEPTANCE_OCCURRED
DENIAL_OUTCOME: permitted
ATTRIBUTION:
  subject: $npi
EXPORT_PATH: EX-3
TIME_BOUND: 7 days
```

Expands to:

```sql
SELECT *
FROM audit_events
WHERE clinician_id = $npi
  AND type IN ('ACCEPTANCE', 'EMPLOYER_ACCEPTANCE', 'EMPLOYER_ACCEPTANCE_CREATED', 'EMPLOYER_REVIEW_ACCEPTED')
  AND (metadata->>'outcome' = 'permitted' OR metadata->>'outcome' IS NULL)
  AND created_at > now() - interval '7 days'
ORDER BY created_at;
```

(NULL handling: pre-Lock-v2 rows lack `metadata.outcome`; treat as permitted — that was the only emitted state.)

### 4.2 Q-CANON-2: "All denied acceptances for actor X in last hour"

```yaml
CONCEPT: CONCEPT_ACCEPTANCE_DENIED
DENIAL_OUTCOME: denied
ATTRIBUTION:
  actor: $userId
EXPORT_PATH: EX-3
TIME_BOUND: 1 hour
```

Expands to:

```sql
SELECT *
FROM audit_events
WHERE metadata->>'actorId' = $userId
  AND created_at > now() - interval '1 hour'
  AND (
    type = 'EMPLOYER_ACCEPTANCE_REJECTED'
    OR (metadata->>'outcome' = 'denied' AND metadata->>'action' SIMILAR TO 'employer_review\.accept\.[a-z_]+')
  )
ORDER BY created_at;
```

### 4.3 Q-CANON-3: "Replay-state classification for actor X in last day"

```yaml
CONCEPT: CONCEPT_REPLAY_OBSERVED + CONCEPT_REPLAY_DENIED + CONCEPT_REPLAY_COLLAPSED
REPLAY_STATE: ALL
DENIAL_OUTCOME: both
ATTRIBUTION:
  actor: $userId
EXPORT_PATH: EX-3
TIME_BOUND: 1 day
```

Expands to:

```sql
SELECT
  id,
  type,
  created_at,
  CASE
    WHEN type = 'IDEMPOTENT_REPLAY' THEN 'R-OBSERVED'
    WHEN type = 'CONCURRENCY_GUARD_TRIGGERED' THEN 'R-COLLAPSED'
    WHEN metadata->>'action' LIKE '%duplicate_request' THEN 'R-DENIED'
    WHEN metadata->>'action' LIKE '%already_accepted' THEN 'R-DENIED'
    ELSE 'R-NORMAL'
  END AS replay_state,
  metadata->>'correlationId' AS correlation_id
FROM audit_events
WHERE metadata->>'actorId' = $userId
  AND created_at > now() - interval '1 day'
ORDER BY created_at;
```

### 4.4 Q-CANON-4: "Capture-replay forensic detection for actor X"

```yaml
CONCEPT: CONCEPT_REPLAY_DENIED + R-ACCEPTED detection
REPLAY_STATE: R-ACCEPTED (forensic)
DENIAL_OUTCOME: permitted
ATTRIBUTION:
  actor: $userId
EXPORT_PATH: EX-3
TIME_BOUND: 7 days
```

Expands to (requires `metadata.payloadHash` mandate post-ML-Rec-1):

```sql
SELECT
  metadata->>'actorId' AS actor_id,
  metadata->>'payloadHash' AS payload_hash,
  COUNT(*) AS occurrences,
  MIN(created_at) AS first_seen,
  MAX(created_at) AS last_seen,
  array_agg(metadata->>'correlationId') AS correlation_ids
FROM audit_events
WHERE metadata->>'actorId' = $userId
  AND metadata->>'outcome' = 'permitted'
  AND created_at > now() - interval '7 days'
GROUP BY actor_id, payload_hash
HAVING COUNT(*) > 1
   AND COUNT(DISTINCT metadata->>'correlationId') > 1
ORDER BY occurrences DESC;
```

### 4.5 Q-CANON-5: "All Step-2+ denials in employer-review surface"

```yaml
CONCEPT: CONCEPT_ALL_DENIED (filtered to employer-review)
DENIAL_OUTCOME: denied
ATTRIBUTION: any
EXPORT_PATH: EX-3
TIME_BOUND: 1 hour
```

Expands to:

```sql
SELECT *
FROM audit_events
WHERE metadata->>'outcome' = 'denied'
  AND metadata->>'action' SIMILAR TO 'employer_review\.[a-z_]+\.[a-z_]+'
  AND created_at > now() - interval '1 hour'
ORDER BY created_at DESC;
```

### 4.6 Q-CANON-6: "Trace-id-based logical-operation reconstruction"

```yaml
CONCEPT: ALL events for the trace
REPLAY_STATE: any
DENIAL_OUTCOME: any
ATTRIBUTION:
  trace: $traceId
EXPORT_PATH: EX-3 (preferred); EX-1 (if in-memory ledger has the entries)
TIME_BOUND: any
```

Expands to:

```sql
SELECT *
FROM audit_events
WHERE metadata->>'traceId' = $traceId
ORDER BY created_at;
```

### 4.7 Q-CANON-7: "Per-actor mutation rate (denied + permitted) for dashboard"

```yaml
CONCEPT: ALL mutating events
REPLAY_STATE: any
DENIAL_OUTCOME: BOTH (separated)
ATTRIBUTION:
  actor: $userId
EXPORT_PATH: EX-3
TIME_BOUND: 7 days
```

Expands to:

```sql
SELECT
  date_trunc('hour', created_at) AS hour,
  COUNT(*) FILTER (WHERE metadata->>'outcome' = 'permitted') AS permitted,
  COUNT(*) FILTER (WHERE metadata->>'outcome' = 'denied') AS denied,
  COUNT(*) FILTER (WHERE metadata->>'action' LIKE '%duplicate_request') AS replay_denied,
  COUNT(*) FILTER (WHERE metadata->>'action' LIKE '%role_denied') AS role_denied,
  COUNT(*) FILTER (WHERE metadata->>'action' LIKE '%entity_not_found') AS not_found
FROM audit_events
WHERE metadata->>'actorId' = $userId
  AND metadata->>'action' SIMILAR TO 'employer_review\.[a-z_]+(\.[a-z_]+)?'
  AND created_at > now() - interval '7 days'
GROUP BY hour
ORDER BY hour;
```

### 4.8 Q-CANON-8: "Canonical 5-event non-repudiation chain for entity X (with aliases)"

```yaml
CONCEPT: CONCEPT_RECOGNITION_OCCURRED + CONCEPT_ACCEPTANCE_OCCURRED + CONCEPT_START_OCCURRED + CONCEPT_START_ATTESTED
DENIAL_OUTCOME: permitted
ATTRIBUTION:
  resource: $entityId
EXPORT_PATH: EX-3
TIME_BOUND: any (chain may span months)
```

Expands to:

```sql
SELECT *
FROM audit_events
WHERE reference_id = $entityId
  AND type IN (
    'RECOGNITION',
    'ACCEPTANCE', 'EMPLOYER_ACCEPTANCE', 'EMPLOYER_ACCEPTANCE_CREATED', 'EMPLOYER_REVIEW_ACCEPTED',
    'START', 'START_ATTESTED'
  )
  AND (metadata->>'outcome' = 'permitted' OR metadata->>'outcome' IS NULL)
ORDER BY created_at;
```

---

## 5. Query coherence properties

A canonical query MUST satisfy these coherence properties:

### 5.1 P1: Cross-vocabulary completeness

When a CONCEPT_* maps to multiple runtime literals, the SQL MUST include all aliased literals via OR-clause OR IN-list.

**Anti-example (incoherent):**
```sql
WHERE type = 'EMPLOYER_ACCEPTANCE'  -- misses EMPLOYER_REVIEW_ACCEPTED rows
```

**Conformant:**
```sql
WHERE type IN ('ACCEPTANCE', 'EMPLOYER_ACCEPTANCE', 'EMPLOYER_REVIEW_ACCEPTED', ...)
```

### 5.2 P2: Outcome explicitness

Queries MUST filter `metadata.outcome` explicitly (or treat NULL as permitted for pre-Lock-v2 rows).

**Anti-example:**
```sql
WHERE type = 'EMPLOYER_REVIEW_ACCEPTED'  -- includes Lock v2 denied rows accidentally
```

**Conformant:**
```sql
WHERE type = 'EMPLOYER_REVIEW_ACCEPTED'
  AND (metadata->>'outcome' = 'permitted' OR metadata->>'outcome' IS NULL)
```

### 5.3 P3: Actor/subject distinction

Queries MUST distinguish `metadata.actorId` (principal) from `clinician_id` (subject). Conflating them is forbidden.

**Anti-example:**
```sql
WHERE clinician_id = $userId  -- treats Clerk userId as NPI
```

**Conformant:**
```sql
WHERE metadata->>'actorId' = $userId  -- principal
   OR clinician_id = $npi             -- subject
```

### 5.4 P4: Export-path declaration

Queries MUST declare which export path they execute against. Default EX-3 for forensics; EX-1 for streaming. NEVER assume "audit log" without specifying which surface.

### 5.5 P5: Time-bound discipline

Queries MUST include a time bound (default 7 days for forensics) UNLESS the query is intentionally unbounded (chain reconstruction). Unbounded queries on Postgres direct are operationally expensive AND risk drift past audit retention.

### 5.6 P6: Lexicon-aligned naming

Result set columns + dashboard labels MUST use lexicon-aligned wording per `operational-alias-layer.md` §5. Avoid renaming columns to forbidden phrases.

**Anti-example:**
```sql
SELECT type AS replay_protected_event FROM audit_events;
```

**Conformant:**
```sql
SELECT type, metadata->>'action' AS action_with_reason FROM audit_events;
```

---

## 6. Query model — the operational vocabulary glossary

For human authors of dashboards, runbooks, and SOC playbooks:

| When you mean... | Use this concept | Use this query template |
|---|---|---|
| "Did this clinician get accepted?" | `CONCEPT_ACCEPTANCE_OCCURRED` | Q-CANON-1 |
| "Are this actor's mutations being denied?" | `CONCEPT_ALL_DENIED` (or specific denial concepts) | Q-CANON-2 |
| "What replay state is this audit row in?" | `R-OBSERVED / R-DENIED / R-ACCEPTED / R-COLLAPSED / R-AMBIGUOUS` | Q-CANON-3 |
| "Is there capture-replay activity?" | R-ACCEPTED forensic detection | Q-CANON-4 |
| "Show me all denials in our wave's surface" | `CONCEPT_ALL_DENIED` (filtered) | Q-CANON-5 |
| "Reconstruct one logical operation's full audit chain" | trace-id-bound | Q-CANON-6 |
| "Per-actor activity dashboard" | Per-actor mutation rate | Q-CANON-7 |
| "Compliance audit of canonical wedge" | 5-event non-repudiation chain | Q-CANON-8 |
| "All acceptance events including aliases" | `CONCEPT_ACCEPTANCE_OCCURRED` (Q-CANON-1) | Q-CANON-1 |
| "All replay-related events for a SOC review" | `CONCEPT_REPLAY_*` (3 concepts) | Combine Q-CANON-3 |

---

## 7. Query model anti-patterns

These query patterns are FORBIDDEN by the canonical model:

| Anti-pattern | Why forbidden |
|---|---|
| Using a single literal where the concept has aliases | Misses aliased rows (P1 violation) |
| Ignoring `metadata.outcome` | Conflates permitted + denied (P2 violation) |
| Using `clinician_id` for actor lookups | Conflates subject + principal (P3 violation) |
| Implicit export-path assumption | Coverage ambiguity (P4 violation) |
| Unbounded queries without justification | Performance + retention concerns (P5 violation) |
| Renaming result columns to forbidden lexicon phrases | Inflates wording (P6 violation) |
| Assuming canonical-events-only completeness | Misses free-form alias rows |
| Using `type` for actor lookups | Type is event-class, not principal |

---

## 8. Adoption checklist

For a downstream consumer (dashboard / SOC playbook / forensic tool / Codex audit):

- [ ] Read `audit-event-vocabulary-map.md`, `replay-taxonomy-map.md`, `export-query-cohesion.md`, `operational-alias-layer.md`, this doc.
- [ ] Identify the operational concept(s) the consumer needs.
- [ ] Use the corresponding query template (§4 of this doc OR §3 of `operational-alias-layer.md`).
- [ ] Verify P1–P6 coherence properties.
- [ ] Use lexicon-aligned wording per `TRUST_GUARANTEE_LEXICON.md` §2 + `operational-alias-layer.md` §5.
- [ ] Document the consumer's CONCEPT_* dependency.

---

## 9. Update protocol

The canonical query model is amended when:

- A new CONCEPT_* alias is added to `operational-alias-layer.md`.
- A new replay state is added to `replay-taxonomy-map.md`.
- A new denial reason suffix is added to Lock v2.
- A new export path is added (post-Mit-2 SIEM source change).
- A new coherence property (P7+) is identified.

Updates require:

1. Founder approval per `TRUST_GUARANTEE_LEXICON.md` §6.
2. Codex SAFE audit confirming new concept doesn't conflict.
3. Update to query templates in §4.
4. Cross-reference to introducing wave's PR description.

---

## 10. Closing principle (canonical query model)

The canonical query model is the discipline of speaking ONE operational language despite frozen runtime vocabulary fragmentation. Every operator question maps to a concept; every concept maps to a multi-vocabulary query template; every template respects the 6 coherence properties.

**Operators get one operational language. Forensics get cross-vocabulary completeness. Dashboards get lexicon-aligned wording. Codex audits verify wave PRs use concept-conformant queries.**

The runtime is unchanged — three audit-event vocabularies + replay-taxonomy parallelism + 4 export paths remain. The query model converges them through documentation, not through code.

**The platform is canonically queryable. The fragmentation is honest. The convergence is doc-level. The lexicon prevents inflation. The query templates prevent silent under-coverage.**

This is the operational truth for VitalCV's audit spine — bounded by what the runtime delivers, queryable by what the documentation maps.

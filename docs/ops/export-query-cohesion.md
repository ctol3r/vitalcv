# Export Query Cohesion

**Status:** **OPERATIONAL** — frozen reference for VitalCV audit-export query coherence · **Date established:** 2026-05-08 · **Authority:** subordinate to `audit-event-vocabulary-map.md`, `replay-taxonomy-map.md`, `w2-pr7a-audit-event-convergence.md`

This doc determines whether **SIEM queries, Postgres queries, operational dashboards, and forensic exports** would return COHERENT operational truth or FRAGMENTED lineage truth — and provides the disambiguation discipline.

The central thesis: **export query cohesion is FRAGMENTED across 4 export paths (SIEM cursor, in-memory ledger, Postgres direct, scrapbook bundle).** Each has different coverage of the audit-event vocabulary AND different coverage of denied audit rows. Coherence is achieved not by unifying the export paths but by **explicitly declaring which path answers which query.**

---

## 1. The 4 export paths

| Path | Source | Wave-coverage | Primary consumer |
|---|---|---|---|
| **EX-1: SIEM cursor-based** | In-memory ledger via `exportAuditPage` (`auditLedger.ts:162`) | Streams entries written via `appendAuditEvent` ONLY | SIEM platforms (Splunk, etc.) |
| **EX-2: SIEM time-bounded** | In-memory ledger via `exportSinceTime` (`auditLedger.ts:191`) | Same as EX-1 | SIEM platforms (one-shot queries) |
| **EX-3: Postgres direct query** | Direct SQL on `prisma.auditEvent` table | All audit rows (in-memory dual-writes + direct prisma writes + canonical events) | DBA / operator / forensic analyst |
| **EX-4: Scrapbook bundle** | `AuditScrapbook` reading audit events (source UNVERIFIED) | UNVERIFIED — likely Postgres but scrapbook switches on canonical event types only | Downstream bundle consumers |

---

## 2. Per-path coverage matrix

| Vocabulary class | EX-1 SIEM cursor | EX-2 SIEM time | EX-3 Postgres direct | EX-4 Scrapbook |
|---|---|---|---|---|
| Canonical `AUDIT_EVENT_TYPES` events written via `requireAuditBeforeResponse` (T1) | YES (dual-write goes to in-memory) | YES | YES | YES (scrapbook switches on canonical types) |
| Canonical events written via `prisma.$transaction` (T2) | **NO** — T2 bypasses in-memory ledger | **NO** | YES | LIKELY YES (if scrapbook reads Postgres) |
| Free-form `prisma.auditEvent.type` events written via direct prisma | **NO** — bypass in-memory | **NO** | YES | UNVERIFIED — scrapbook may not switch on free-form types |
| Comma-joined `AuditCategory` events written via `createAuditEvent` (T0) | YES (in-memory + dual-write) | YES | YES | UNVERIFIED |
| Lock v2 denied-path audit rows (T2 direct) | **NO** | **NO** | YES | UNVERIFIED |

**Track C finding XQ-1:** **SIEM paths (EX-1, EX-2) have ~50% audit-row coverage** because direct prisma writers (the wave's 6 in-scope handlers post-Lock-v2) bypass the in-memory ledger. **Only Postgres direct (EX-3) has full coverage.**

---

## 3. The SIEM coverage gap

### 3.1 Symptom

A SOC analyst monitoring SIEM for denial trends queries:

```
type=audit_event metadata.outcome=denied | stats count by metadata.action
```

Expected result: all post-Lock-v2 denied audit rows.

Actual result: ZERO rows from the wave's 6 in-scope handlers (T2 writers); only rows from `createAuditEvent` (T0/dual-write) path.

### 3.2 Cause

`auditService.ts:60` (`createAuditEvent`) calls `appendAuditEvent` (in-memory) THEN dual-writes to Postgres. Both surfaces have the entry.

`apps/api/backend/src/services/entity/employerReviewActions.ts:738` (and similar) call `prisma.$transaction((tx) => tx.auditEvent.create(...))` directly. Postgres has the entry; in-memory ledger does NOT.

`exportAuditPage` paginates the in-memory ledger. SIEM stream misses the direct-write rows.

### 3.3 Mitigations

| Mitigation | Cost | Effect |
|---|---|---|
| **Mit-1:** T2 writers also call `appendAuditEvent` for in-memory dual-path | Code change in service functions; tx-aware to avoid double-counting | Closes EX-1/EX-2 gap; risks duplicate rows |
| **Mit-2:** SIEM source extended to query Postgres directly (replace EX-1/EX-2 with EX-3-derived stream) | New SIEM source connector | Closes the gap structurally; preferred long-term |
| **Mit-3:** Document the gap explicitly; SOC uses EX-3 for denial forensics | Doc-only | Lowest cost; preserves the gap; relies on SOC discipline |

This wave's recommendation: **Mit-3 (documentation) AS INTERIM; Mit-2 (SIEM source change) AS LONG-TERM.** Mit-1 introduces dual-counting risk + couples the in-memory ledger to every prisma writer.

---

## 4. Per-query intent — recommended path

For each common SOC / dashboard query intent, which export path returns the most coherent truth:

| Query intent | Best path | Why |
|---|---|---|
| "Real-time stream of all audit events" | EX-1 SIEM cursor | Streaming-friendly; misses direct prisma writers (acknowledged limitation) |
| "All denied audit rows in last hour" | **EX-3 Postgres direct** | EX-1/EX-2 miss T2-writer denials |
| "All canonical wedge events for clinician X" | EX-3 Postgres direct | Cross-vocabulary query (`type IN (canonical-list, free-form-list)`) needs full coverage |
| "Replay rate metrics for dashboard" | EX-3 Postgres direct | Same |
| "Audit chain reconstruction for trace T" | EX-3 Postgres direct | Cross-row traversal via `metadata.traceId` |
| "Ad-hoc operational forensic query" | EX-3 Postgres direct | General-purpose |
| "Long-term archival audit-trail bundle" | EX-4 Scrapbook (when source verified) | Bundle-shape preserves canonical event types |
| "External SIEM-platform alerting" | EX-1 SIEM cursor | Streaming-required; tolerate the coverage gap |

**Track C finding XQ-2:** **EX-3 Postgres direct is the canonical query path for the wave's denial + multi-vocabulary forensic intents.** EX-1/EX-2 remain useful for streaming + ops-event monitoring (T0 path) but are NOT reliable for denial forensics.

---

## 5. Vocabulary divergence in queries

A SOC analyst querying "all acceptance events for clinician X" must use multi-vocabulary OR-clause:

```sql
SELECT * FROM audit_events
WHERE clinician_id = $npi
  AND type IN (
    'EMPLOYER_ACCEPTANCE',           -- canonical (Subsystem A)
    'EMPLOYER_REVIEW_ACCEPTED',      -- free-form (Subsystem C, employer-review)
    'EMPLOYER_ACCEPTANCE_CREATED'    -- free-form (per requireAuditBeforeResponse non-repudiation list)
  );
```

A query that uses only the canonical literal:

```sql
SELECT * FROM audit_events
WHERE clinician_id = $npi
  AND type = 'EMPLOYER_ACCEPTANCE';
```

**...returns ZERO rows from the employer-review wave's 6 in-scope handlers** because they write `EMPLOYER_REVIEW_ACCEPTED`, not `EMPLOYER_ACCEPTANCE`. Cross-vocabulary completeness requires explicit OR-listing.

**Track C finding XQ-3:** every cross-vocabulary query requires explicit OR-clause per the alias relationships in `audit-event-vocabulary-map.md` §7. Single-literal queries return PARTIAL truth.

---

## 6. Query templates by intent (reference library)

For each intent, the canonical query template:

### 6.1 Q-INTENT-1: "All acceptance events for entity X (cross-vocabulary)"

```sql
SELECT *
FROM audit_events
WHERE reference_id = $entityId
  AND type IN (
    'ACCEPTANCE',
    'EMPLOYER_ACCEPTANCE',
    'EMPLOYER_ACCEPTANCE_CREATED',
    'EMPLOYER_REVIEW_ACCEPTED'
  )
ORDER BY created_at;
```

**Path:** EX-3.

### 6.2 Q-INTENT-2: "All denied audit rows for actor X (post-Lock-v2)"

```sql
SELECT *
FROM audit_events
WHERE metadata->>'actorId' = $userId
  AND metadata->>'outcome' = 'denied'
  AND created_at > now() - interval '1 day'
ORDER BY created_at;
```

**Path:** EX-3 (REQUIRED — EX-1/EX-2 miss T2 writers).

### 6.3 Q-INTENT-3: "All replay events for clinician X (multi-state)"

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
  metadata->>'correlationId' AS correlation_id,
  metadata->>'payloadHash' AS payload_hash
FROM audit_events
WHERE clinician_id = $npi
  AND created_at > now() - interval '7 days'
ORDER BY created_at;
```

**Path:** EX-3.

### 6.4 Q-INTENT-4: "Forensic detection of capture-replay (post-ML-Rec-1)"

```sql
SELECT
  metadata->>'actorId' AS actor_id,
  metadata->>'payloadHash' AS payload_hash,
  COUNT(*) AS occurrences,
  MIN(created_at) AS first_seen,
  MAX(created_at) AS last_seen,
  array_agg(metadata->>'correlationId') AS correlation_ids
FROM audit_events
WHERE metadata->>'outcome' = 'permitted'
  AND created_at > now() - interval '7 days'
GROUP BY actor_id, payload_hash
HAVING COUNT(*) > 1
   AND COUNT(DISTINCT metadata->>'correlationId') > 1
ORDER BY occurrences DESC;
```

**Path:** EX-3.

### 6.5 Q-INTENT-5: "Trace-id-based logical-operation reconstruction"

```sql
SELECT *
FROM audit_events
WHERE metadata->>'traceId' = $traceId
ORDER BY created_at;
```

**Path:** EX-3 (EX-1 from in-memory ledger CAN return AuditEntry objects with `traceId` as top-level field but coverage is partial).

### 6.6 Q-INTENT-6: "Real-time SIEM stream of T0/T1 events"

Use `exportAuditPage(cursor)` from in-memory ledger (EX-1).

**Path:** EX-1; **acknowledge T2-writer gap.**

### 6.7 Q-INTENT-7: "All Step-2+ denials in the wave's surface"

```sql
SELECT *
FROM audit_events
WHERE metadata->>'action' SIMILAR TO 'employer_review\.(accept|confirm_start|request_refresh|route_to_review|share_packet)\.[a-z_]+'
  AND metadata->>'outcome' = 'denied'
ORDER BY created_at DESC
LIMIT 100;
```

**Path:** EX-3.

### 6.8 Q-INTENT-8: "All canonical 5-event non-repudiation chain for entity X"

```sql
SELECT *
FROM audit_events
WHERE reference_id = $entityId
  AND type IN ('RECOGNITION', 'ACCEPTANCE', 'EMPLOYER_ACCEPTANCE', 'START', 'START_ATTESTED')
ORDER BY created_at;
```

**Path:** EX-3 (or EX-4 scrapbook if available). **Caveat:** misses `EMPLOYER_REVIEW_ACCEPTED` rows (free-form alias).

### 6.9 Q-INTENT-9: "All acceptance-related audit rows including aliases"

```sql
SELECT *
FROM audit_events
WHERE reference_id = $entityId
  AND (
    type IN ('ACCEPTANCE', 'EMPLOYER_ACCEPTANCE', 'EMPLOYER_REVIEW_ACCEPTED', 'EMPLOYER_ACCEPTANCE_CREATED')
    OR (metadata->>'action' SIMILAR TO 'employer_review\.accept\.[a-z_]+' AND metadata->>'outcome' = 'denied')
  )
ORDER BY created_at;
```

**Path:** EX-3. Includes BOTH permitted and denied paths across BOTH vocabularies.

---

## 7. Dashboard cohesion

Operational dashboards must declare WHICH export path they read from. Recommended dashboard discipline:

| Dashboard widget | Path | Rationale |
|---|---|---|
| Real-time event stream | EX-1 | Streaming; tolerate T2 gap |
| Denial-rate counter | EX-3 | Avoid T2 gap |
| Replay-rate counter | EX-3 | Multi-state classification |
| Per-actor activity | EX-3 | Cross-vocabulary completeness |
| Long-term archival metrics | EX-4 (when verified) OR EX-3 | Bundle-shape preserved |
| Per-clinician audit-chain timeline | EX-3 | Cross-row traversal |

**Track C finding XQ-4:** dashboards mixing EX-1 (SIEM) and EX-3 (Postgres) data sources will show DIFFERENT counts for "denied audit events." Operators must be trained that EX-3 is authoritative for denials post-Lock-v2.

---

## 8. Forensic export discipline

Forensic exports (legal hold, compliance audit, incident response) require COMPLETE coverage. Recommended discipline:

1. **Default to EX-3 Postgres direct** for any forensic export.
2. **Cross-reference EX-1 stream history** for time-bounded SIEM-archived rows IF audit retention is shorter than SIEM retention (UNVERIFIED today).
3. **Use multi-vocabulary OR-clauses** per `audit-event-vocabulary-map.md` §8 templates.
4. **Document the export's coverage scope** (which paths queried, which time window, which vocabulary set).
5. **Include `metadata.payloadHash`-based capture-replay detection** as part of forensic baseline.

---

## 9. Lineage-query drift

Query results can drift over time due to:

| Drift cause | Effect | Mitigation |
|---|---|---|
| Audit retention SLA shortens | Old queries return fewer rows | Document SLA; warn on retention-bounded queries |
| Schema rename (e.g., `metadata.employerId` → `metadata.actorId`) | Old queries miss new rows | Carry both fields during transition; document deprecation timeline |
| New free-form prisma type introduced (e.g., a future wave) | Old vocabulary-aware queries miss new rows | Update `audit-event-vocabulary-map.md` for every new literal |
| Lock v2 denied-path emission lands | Pre-Lock-v2 queries (no `metadata.outcome` filter) over-count or under-count | Update queries to explicitly filter on `outcome` |
| MIG-A DB UNIQUE constraints land | Replay denial rate increases (DB-enforced replaces best-effort); R-COLLAPSED rises | Update dashboards |
| MIG-C per-org tenancy lands | `metadata.organizationId` becomes populated; queries can join by org | Update query templates |

**Track C finding XQ-5:** every constitutional change to the audit table affects query results. The lineage-query drift register (proposed) tracks which queries need updating per change.

---

## 10. Per-path certification

| Path | Coverage | Coherence | Aggregate |
|---|---|---|---|
| EX-1 SIEM cursor | PARTIAL (T0/T1 only) | COHERENT within scope | 🟡 PARTIAL — known gap |
| EX-2 SIEM time-bounded | Same as EX-1 | Same | 🟡 PARTIAL — known gap |
| EX-3 Postgres direct | COMPLETE (all rows) | COHERENT — authoritative | 🟢 CANONICAL |
| EX-4 Scrapbook bundle | UNVERIFIED — likely PARTIAL on free-form types | UNVERIFIED | 🟠 FRAGMENTED — inspection deferred |

**Aggregate export query cohesion:** 🟡 **PARTIAL — coherent IF the analyst chooses the right path per intent. Single-source assumptions (e.g., "SIEM has everything") produce incomplete forensic results.**

---

## 11. Recommendations

| # | Recommendation | Priority |
|---|---|---|
| **XQ-Rec-1** | Adopt this doc + `audit-event-vocabulary-map.md` + `replay-taxonomy-map.md` as the canonical SOC query reference | HIGH |
| **XQ-Rec-2** | Train SOC analysts on EX-3 (Postgres direct) as the canonical denial-forensics path | HIGH |
| **XQ-Rec-3** | Document the SIEM coverage gap (DL-8 from `w2-pr6a-denial-path-certification.md`) explicitly in the operational runbook | HIGH |
| **XQ-Rec-4** | Update dashboards: declare which export path each widget reads from; alert on cross-source count mismatches | MEDIUM |
| **XQ-Rec-5** | Verify scrapbook source coverage (LT-Rec-4 / AC-Rec-5) | MEDIUM |
| **XQ-Rec-6** | Maintain the lineage-query drift register on every audit-spine change | MEDIUM |
| **XQ-Rec-7** | Long-term: replace SIEM source with Postgres-direct stream (Mit-2 from §3.3) to close EX-1/EX-2 gap structurally | LOW (architectural) |

---

## 12. Closing principle (export query cohesion)

Export query cohesion is the discipline of declaring which export path answers which question. The platform has 4 paths with different coverage; coherence is achieved by **choosing the right path per intent + using multi-vocabulary OR-clauses** — not by unifying the paths (which would require runtime changes).

**Operators get coherent operational truth IF they query EX-3 for denial forensics, EX-1 for streaming-and-real-time, and use the alias-aware query templates in §6.** Single-source assumptions produce fragmented truth; multi-path discipline produces coherent truth.

**The platform is queryable across the export divergence — not because the divergence is gone, but because the divergence is mapped + the right-path-per-intent is documented.**

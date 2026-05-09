# W2-PR7A — Audit/Event Convergence (Track C)

**Wave:** Wave 2, PR 7A — canonical operational lineage convergence, audit-event subsystem unification · **Date:** 2026-05-08 · **Status:** convergence analysis only; **NO product code, NO runtime modification, NO merge** · **Authority:** subordinate to `TRUST_GUARANTEE_LEXICON.md`, `w2-pr7a-lineage-topology-map.md`

This doc determines whether `packages/audit/AuditEvent.ts`, `apps/api/backend/src/services/audit/auditLedger.ts`, and `apps/api/backend/src/services/audit/auditService.ts` represent **one canonical operational lineage system OR partially divergent systems**.

The central finding: **THE THREE FILES REPRESENT PARTIALLY DIVERGENT SYSTEMS using overlapping vocabularies for related-but-not-identical concepts.** Convergence is a doc-level + adapter-layer concern, not a code-rewrite concern (the YC MVP frozen file precludes that).

---

## 1. The three subsystems

### 1.1 Subsystem A: `packages/audit/AuditEvent.ts`

**Status:** Frozen YC MVP (file-header: "behavior frozen. Do not modify without scope approval").

**Vocabulary:**
- `AUDIT_EVENT_TYPES` enum — 24 strict event-type strings (`NPI_INGESTED`, `RECOGNITION`, `ACCEPTANCE`, `START`, `START_ATTESTED`, `IDEMPOTENT_REPLAY`, `CONCURRENCY_GUARD_TRIGGERED`, etc.).
- `AuditEventType` — union of those 24.

**Shape:**
```ts
type AuditEventInput = {
  audit_event_id?: string;
  clinician_id: string;
  event_type: AuditEventType;
  reference_id: string;
  occurred_at: string;  // RFC3339 UTC
  metadata?: AuditEventMetadata;
};
```

**Used by:**
- `packages/audit/AuditScrapbook.ts` (switches on event_type for `IDEMPOTENT_REPLAY`, `CONCURRENCY_GUARD_TRIGGERED`).
- `packages/domain-common/__tests__/adversarial.frozen.test.ts` (5 canonical non-repudiation events: RECOGNITION, ACCEPTANCE, EMPLOYER_ACCEPTANCE, START, START_ATTESTED).

**Key field name:** `event_type` (snake_case).

### 1.2 Subsystem B: `apps/api/backend/src/services/audit/auditLedger.ts`

**Status:** Active backend service.

**Vocabulary:**
- `AuditCategory` enum — 15 functional categories (`ISSUANCE`, `PRESENTATION`, `VERIFICATION`, `REVOCATION`, `DECISION`, `MONITORING`, `FEDERATION`, `COMPLIANCE`, `AUTH`, `ADMIN`, `SYSTEM`, `TRUST_STATE_CHANGE`, `READINESS_CHANGE`, `BUNDLE_EXPORT`, `SIMULATION`).
- `AuditSeverity` — `'INFO' | 'WARNING' | 'CRITICAL' | 'EMERGENCY'`.

**Shape:**
```ts
interface AuditEntry {
  eventId: string;
  time: string;              // ISO-8601
  traceId: string;           // UUID
  category: AuditCategory[]; // ARRAY of categories
  actor: string;
  resource: string;
  requestFields: ...;
  resultFields: ...;
  severity: AuditSeverity;
  receiptHash: string;       // SHA-256 of canonical content
}
```

**Used by:**
- `appendAuditEvent` (in-memory append).
- `exportAuditPage` / `exportSinceTime` (cursor-based SIEM export).
- `auditService.ts` (which calls `appendAuditEvent` then dual-writes to Postgres).

**Key field name:** `category` (camelCase, ARRAY).

### 1.3 Subsystem C: `apps/api/backend/src/services/audit/auditService.ts` + Postgres `prisma.auditEvent`

**Status:** Active backend service + DB table.

**Vocabulary:**
- `prisma.auditEvent.type: String` — free-form; arbitrary string accepted.
- Common usage in employer-review handlers: `'EMPLOYER_REVIEW_ACCEPTED'`, `'EMPLOYER_REVIEW_REFRESH_REQUESTED'`, `'EMPLOYER_REVIEW_ROUTED_TO_REVIEW'`, `'EMPLOYER_PACKET_SHARED'`, `'ARTIFACT_EXPORTED'` — none of which appear in Subsystem A's `AUDIT_EVENT_TYPES` enum.

**Shape (DB column):**
```sql
model AuditEvent {
  id             String   @id @default(uuid()) @db.Uuid
  type           String   -- free-form
  hash           String   -- SHA-256
  referenceId    String?
  clinicianId    String?
  metadata       Json?
  createdAt      DateTime @default(now())
  organizationId String?  -- nullable; not populated today
  anchored       Boolean  @default(false)
  merkleRoot     String?
  ...
}
```

**Used by:**
- `createAuditEvent` (auditService.ts:60) — fire-and-forget T0 dual-write.
- `requireAuditBeforeResponse` (auditService.ts:130) — synchronous T1 write.
- Direct `prisma.$transaction((tx) => tx.auditEvent.create(...))` in route handlers + service functions — T2 atomic writes.

**Key field name:** `type` (no case prefix, free-form).

---

## 2. The convergence problem

### 2.1 Three vocabularies; three field names; three semantic axes

| Subsystem | Field name | Type | Vocabulary | Examples |
|---|---|---|---|---|
| A: `packages/audit/AuditEvent.ts` | `event_type` | strict enum | `AUDIT_EVENT_TYPES` (24) | `RECOGNITION`, `START_ATTESTED`, `IDEMPOTENT_REPLAY` |
| B: `auditLedger.ts` | `category` | strict enum | `AuditCategory` (15) | `ISSUANCE`, `DECISION`, `BUNDLE_EXPORT` |
| C: `prisma.auditEvent` | `type` | free-form string | ad-hoc | `EMPLOYER_REVIEW_ACCEPTED`, `EMPLOYER_PACKET_SHARED`, `ARTIFACT_EXPORTED` |

**Track C finding AC-CONV-1:** the three vocabularies serve different conceptual axes:

- **Subsystem A** classifies SPECIFIC EVENTS in the canonical wedge (recognition → acceptance → start).
- **Subsystem B** classifies FUNCTIONAL CATEGORIES (which subsystem produced the event).
- **Subsystem C** is the persistent table; accepts any string.

The conceptual axes are LEGITIMATELY different. They are NOT redundant. But there is NO documented mapping between them.

### 2.2 The dual-write translation

`auditService.ts:60` (`createAuditEvent`) translates `AuditEntry` (Subsystem B's shape) → `prisma.auditEvent` (Subsystem C's shape):

```ts
// auditService.ts:80
type: Array.isArray(entry.category) ? entry.category.join(',') : String(entry.category),
```

**The `type` column receives a comma-joined `AuditCategory[]` string.** E.g., `type: 'ISSUANCE,DECISION'`. This is NEITHER a Subsystem A event-type NOR a Subsystem C free-form domain string — it's a DERIVED value from Subsystem B.

Meanwhile, employer-review handlers WRITE DIRECTLY to `prisma.auditEvent.create({type: 'EMPLOYER_REVIEW_ACCEPTED', ...})` — bypassing `createAuditEvent` entirely. Their `type` values are NOT comma-joined categories; they're domain-specific event names that don't appear in any enum.

**Track C finding AC-CONV-2:** the Postgres `auditEvent.type` column has TWO completely different content patterns depending on writer:

- Comma-joined categories (when written via `createAuditEvent`).
- Domain-specific event names (when written via direct `prisma.auditEvent.create`).

A SOC analyst querying `WHERE type = 'DECISION'` finds the dual-write rows; querying `WHERE type = 'EMPLOYER_REVIEW_ACCEPTED'` finds the direct-write rows. Cross-vocabulary queries don't compose.

### 2.3 The hash-content asymmetry

| Subsystem | Hash field | Content hashed |
|---|---|---|
| A | `metadata` (canonical via `AuditEventInput` shape) | UNVERIFIED — frozen YC MVP |
| B | `AuditEntry.receiptHash` | Canonical content of the entry |
| C | `prisma.auditEvent.hash` | SHA-256 of canonical content (per the writer's choice) — varies |

Direct prisma writers compute their own hash:
- `share-packet`: `sha256ForPayload({type: 'EMPLOYER_PACKET_SHARED', referenceId, metadata})` (line 702–706).
- `confirm-start`: `attestationHash` of `{attestationId, acceptanceId, entityId, employerId, clinicianNpi, startedAt, role, facility}` (line 850).
- `packet`: `sha256ForPayload({type: 'ARTIFACT_EXPORTED', referenceId, metadata})` (line 614–617).

**Track C finding AC-CONV-3:** the `hash` column's content varies by writer. `share-packet` and `packet` hash a 3-field shape `{type, referenceId, metadata}`. `confirm-start` hashes a 7-field domain-specific shape. `createAuditEvent`'s dual-write uses `entry.receiptHash` (Subsystem B's canonical hash). **Cross-row hash comparison is meaningless** — different writers hash different content.

### 2.4 The metadata-shape asymmetry

| Subsystem | Metadata shape |
|---|---|
| A | `AuditEventMetadata = Readonly<Record<string, unknown>>` — open |
| B | `AuditEntry` has structured fields (`requestFields`, `resultFields`); no `metadata` |
| C | `prisma.auditEvent.metadata: Json?` — open JSON |

When `createAuditEvent` translates B → C, it constructs metadata from B's fields:
```ts
metadata: JSON.parse(JSON.stringify({ traceId, category, actor, resource, requestFields, resultFields, severity }))
```

When direct prisma writers create rows, they construct metadata in their own shape (e.g., employer-review handlers' metadata has `acceptanceId`, `auditEventId`, `attribution`, `trustSnapshot`, `acceptance`, etc.).

**Track C finding AC-CONV-4:** metadata shape varies by writer. Forensic queries on `metadata.<field>` must know which writer produced the row.

---

## 3. Lineage discontinuities

### 3.1 Mid-flow vocabulary jumps

A logical operation can produce audit rows in MULTIPLE vocabularies:

1. Web request arrives → `appendAuditEvent` records `{category: ['SYSTEM', 'AUTH']}` in-memory (Subsystem B vocab).
2. Service function runs → emits Subsystem A canonical event (e.g., `EMPLOYER_ACCEPTANCE`) via `requireAuditBeforeResponse` to Postgres (Subsystem C using Subsystem A's enum literal).
3. Same service function ALSO writes Subsystem-C-direct row with `type: 'EMPLOYER_REVIEW_ACCEPTED'` (free-form).

A SOC analyst tracing the request gets THREE rows in different vocabularies. `traceId` connects them (when propagated); without traceId, reconstruction depends on `referenceId` chain + timestamp proximity.

**Track C finding AC-CONV-5:** lineage discontinuity is operationally tractable VIA traceId, but ONLY if traceId propagates through every writer. The frozen `AuditEvent.ts`'s `AuditEventInput` shape has NO `traceId` field. Subsystem A is not natively trace-aware.

### 3.2 Conflicting event meanings

| Concept | Subsystem A primitive | Subsystem C primitive |
|---|---|---|
| "Acceptance happened" | `EMPLOYER_ACCEPTANCE` (canonical enum) | `EMPLOYER_REVIEW_ACCEPTED` (free-form, employer-review handler) |
| "Start happened" | `START_ATTESTED` (canonical) | (also `START_ATTESTED` — convergent here; written via `tx.auditEvent.create` at line 877 with the same string) |
| "Recognition happened" | `RECOGNITION` (canonical) | UNVERIFIED in employer-review surface (recognition is upstream) |

**Track C finding AC-CONV-6:** `EMPLOYER_ACCEPTANCE` (canonical) and `EMPLOYER_REVIEW_ACCEPTED` (free-form) likely express the SAME event but use DIFFERENT names. A canonical-events forensic query (e.g., "all 5 canonical non-repudiation events") may MISS the `EMPLOYER_REVIEW_ACCEPTED` rows.

### 3.3 Event survivability gaps

| Surface | Survives across-process? | Survives in scrapbook? | Survives SIEM export? |
|---|---|---|---|
| In-memory `AuditEntry` (Subsystem B) | NO unless dual-write succeeded | UNVERIFIED — depends on scrapbook source | YES via `exportAuditPage` |
| Postgres `auditEvent` row (Subsystem C) | YES (Postgres ACID) | UNVERIFIED — likely YES if scrapbook reads Postgres | NO direct path documented; SIEM export reads in-memory |
| Subsystem A canonical event written via `requireAuditBeforeResponse` | YES (Postgres) | UNVERIFIED | NO direct path |

**Track C finding AC-CONV-7:** the SIEM export path streams from in-memory ledger (Subsystem B), NOT from Postgres (Subsystem C). Direct prisma writers (employer-review handlers) bypass the in-memory ledger — their rows do NOT appear in SIEM stream. This is a SIGNIFICANT survivability gap if SIEM export is the operator's primary view.

### 3.4 Partial-write ambiguity

When `createAuditEvent` (T0) fire-and-forget DB write fails:
- In-memory ledger has the entry.
- Postgres does NOT.
- CRITICAL log signals the gap.

A SIEM consumer reading from in-memory ledger sees the entry. A forensic Postgres query does NOT find it. The two views disagree.

**Track C finding AC-CONV-8:** T0 fire-and-forget creates partial-write states where in-memory and Postgres diverge. T1 (`requireAuditBeforeResponse`) and T2 (`prisma.$transaction`) avoid this; T0 does not. The wave's 6 in-scope handlers use T2 — partial-write ambiguity does NOT apply to the wave's own writes.

---

## 4. Per-axis convergence assessment

| Axis | Subsystem A | Subsystem B | Subsystem C | Convergent? |
|---|---|---|---|---|
| Event type vocabulary | strict enum (24) | n/a (uses category) | free-form string | NO — divergent |
| Functional category vocabulary | n/a | strict enum (15) | n/a | n/a — only B has |
| Hash content | UNVERIFIED | `receiptHash` of canonical content | per-writer (varies) | NO — divergent content shapes |
| Metadata shape | open | structured fields | open | partial — open allows but doesn't enforce |
| traceId propagation | NO native field | YES (`traceId` field) | YES via `metadata.traceId` (when written) | partial — A doesn't carry it |
| Severity | n/a | YES (4 levels) | n/a | n/a — only B has |
| Anchored / Merkle root | n/a | n/a | YES (DB columns) | n/a — only C has |
| Actor field | `clinician_id` (subject!) | `actor` (acting principal) | `clinicianId` (DB column — subject) AND `metadata.actorId` (Lock v2) | DIVERGENT — A and C use clinicianId for subject; B has actor for principal |

**Track C finding AC-CONV-9:** the most semantically-confusing axis is the actor/subject conflation. Subsystem A's `clinician_id` and Subsystem C's `clinicianId` column refer to the SUBJECT (the person being credentialed). Subsystem B's `actor` refers to the PRINCIPAL (who performed the action). Fields that sound similar mean different things.

---

## 5. Are the three subsystems one canonical lineage system?

**NO.** They represent THREE PARTIALLY DIVERGENT SYSTEMS:

- A is a strict frozen enum + canonical wedge classification (designed for the 5 non-repudiation events + ingest/replay events).
- B is the in-memory append-only ledger with functional-category classification + traceId + severity (designed for SIEM streaming + ops observability).
- C is the durable Postgres table accepting free-form types + open metadata (designed as the persistent backstop for both A and B AND for direct domain writes).

The three serve different purposes that PARTIALLY OVERLAP:
- A's canonical events SHOULD appear in C's `type` column (they sometimes do, e.g., `START_ATTESTED`).
- B's categories appear in C's `type` column ONLY when written via `createAuditEvent` (comma-joined).
- C's free-form types appear ONLY in C (no enum constraint).

**Track C finding AC-CONV-10:** convergence into ONE canonical lineage system would require either:
1. A schema migration adding columns to C: `type_a` (canonical enum), `type_b` (category array), `type_c` (free-form domain). Cost: schema migration; risky.
2. An adapter layer that derives `type_a` and `type_b` from `type_c` per writer. Cost: code change; less risky.
3. A doc-level mapping that catalogs which writer produces which `type` content + which forensic queries to use. Cost: doc only; lowest risk; recommended.

---

## 6. Recommendations

| # | Recommendation | Priority |
|---|---|---|
| **AC-Rec-1** | Publish `docs/ops/audit-event-vocabulary-map.md` documenting Subsystems A, B, C + their relationships + per-writer `type` content patterns | HIGH |
| **AC-Rec-2** | Document the actor/subject conflation explicitly: `clinician_id`/`clinicianId` = SUBJECT (NPI); `actor`/`metadata.actorId` = PRINCIPAL (Clerk userId) | HIGH |
| **AC-Rec-3** | Document the hash-content asymmetry per-writer (AC-CONV-3) | MEDIUM |
| **AC-Rec-4** | Verify whether `EMPLOYER_REVIEW_ACCEPTED` (free-form) and `EMPLOYER_ACCEPTANCE` (canonical enum) refer to the same event; if yes, recommend consolidation OR document the divergence | HIGH |
| **AC-Rec-5** | Verify SIEM export source coverage — does SIEM stream the in-memory ledger ONLY, or also Postgres? Document. | HIGH |
| **AC-Rec-6** | Add `traceId` propagation to `requireAuditBeforeResponse` API (also LT-Rec-2) | MEDIUM |
| **AC-Rec-7** | For T0 fire-and-forget partial-write ambiguity, document the in-memory-vs-Postgres divergence in operational runbooks | LOW |

---

## 7. Track C determination

| Question | Answer |
|---|---|
| Are A, B, C one canonical system? | NO — partially divergent |
| Are vocabularies duplicated? | YES — `EMPLOYER_REVIEW_ACCEPTED` vs `EMPLOYER_ACCEPTANCE`; `IDEMPOTENT_REPLAY` (A) vs `<base>.duplicate_request` (Lock v2 in C) |
| Are event meanings conflicting? | YES — actor/subject conflation (AC-CONV-9); event-name parallelism (AC-CONV-6) |
| Are lineage discontinuities documented? | YES — 5 (AC-CONV-1..AC-CONV-5) |
| Are partial-write ambiguities documented? | YES — AC-CONV-8 |
| Do the three converge into one lineage system? | NO — but convergence is doc-level, not code-level |

**Track C classification:** 🟠 **FRAGMENTED — three partially divergent subsystems with overlapping but non-isomorphic vocabularies. Convergence is achievable doc-level via vocabulary-map publication.**

---

## 8. Closing principle (Track C)

The audit/event subsystem is the platform's MOST mature operational asset AND its most divergently-named one. Three vocabularies serve three legitimately-different conceptual axes (canonical-events vs functional-categories vs free-form-domain-types) but they are NOT documented as one coherent map.

**Convergence does not require code changes. It requires the vocabulary-map doc + actor/subject disambiguation + per-writer `type` content documentation.** Closing AC-Rec-1, AC-Rec-2, AC-Rec-4, AC-Rec-5 makes the subsystem genuinely operational-trust-grade — by speaking precisely about what each piece is, instead of pretending they are one canonical thing.

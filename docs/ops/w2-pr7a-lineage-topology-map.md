# W2-PR7A — Lineage Topology Map (Track A)

**Wave:** Wave 2, PR 7A — canonical operational lineage convergence, topology · **Date:** 2026-05-08 · **Status:** lineage analysis only; **NO product code, NO runtime modification, NO merge** · **Authority:** subordinate to `TRUST_GUARANTEE_LEXICON.md`, `w2-pr6a-audit-spine-certification.md`, `w2-pr5a-legitimacy-boundary-report.md`

This doc maps the **canonical operational lineage topology** — every primitive (traceId, correlationId, payloadHash, mutationFingerprint, replay events, denial events, SIEM export, scrapbook, dual-write) and how they propagate end-to-end.

The central finding: **the lineage topology is DIVERGENT — three distinct audit-event vocabularies coexist (`AUDIT_EVENT_TYPES` enum in `packages/audit`, `AuditCategory` enum in `auditLedger`, free-form strings on `prisma.auditEvent.type`).** A single logical operation produces lineage in multiple parallel namespaces. The wave preserves this divergence; certification is bounded by it.

---

## 1. The lineage primitives — full inventory

| Primitive | Where stored | Lifecycle | Wave-scope |
|---|---|---|---|
| **`traceId`** (UUID-v4) | `AuditEntry.traceId` (in-memory ledger) + `AuditEvent.metadata.traceId` (Postgres dual-write) | Per logical operation; minted by `newTraceId()` or supplied upstream | Existing |
| **`correlationId`** (UUID) | `AuditEvent.metadata.correlationId` (Postgres) | Per attempt; minted by web proxy OR client-supplied | NEW (Lock v2) |
| **`payloadHash`** (SHA-256 hex) | `AuditEvent.metadata.payloadHash` (Postgres); inconsistently populated today | Per request; SHA-256 of canonical redacted body | NEW mandate (Lock v2 + ML-Rec-1) |
| **`AuditEvent.hash`** (SHA-256 hex) | DB column | Per audit row; SHA-256 of canonical content | Existing |
| **`AuditEvent.referenceId`** (string) | DB column | Cross-row join key (no FK) | Existing |
| **`AuditEvent.clinicianId`** (NPI string) | DB column | Subject identity (NOT actor) | Existing |
| **`AuditEvent.type`** (free-form string) | DB column | Event-type label | Existing |
| **`AuditEvent.merkleRoot`** (string nullable) | DB column | L3 anchoring substrate | Existing schema; pipeline UNVERIFIED |
| **`AuditEvent.anchored`** (boolean) | DB column | L3 anchoring flag | Existing; default false; UNVERIFIED |
| **`AuditEvent.metadata.actorId`** (Clerk userId) | Postgres metadata JSON | Actor attribution; canonical name post-Lock-v2 | NEW canonical (was `metadata.employerId`) |
| **`AuditEvent.metadata.outcome`** (`'permitted' \| 'denied'`) | Postgres metadata JSON | Decision outcome | NEW (Lock v2 §8) |
| **`AuditEvent.metadata.action`** (e.g., `'employer_review.accept.role_denied'`) | Postgres metadata JSON | Action literal + denial-reason suffix | NEW (Lock v2) |
| **`mutation row's `id`** (UUID) | e.g., `EmployerAcceptance.id`, `StartAttestation.id` | Per row; primary key | Existing |
| **`outbox event's `id`** (UUID) | Outbox table | Per row | Existing |

---

## 2. Per-primitive propagation chain

### 2.1 `traceId` propagation

```
[Origin: client OR upstream service supplies; OR newTraceId() mints]
   ↓
[appendAuditEvent(traceId, ...)] — synchronous in-memory ledger append (auditLedger.ts:108)
   ↓
[fire-and-forget dual-write] — prisma.auditEvent.create with metadata.traceId (auditService.ts:60)
   ↓ OR ↓
[requireAuditBeforeResponse] — synchronous DB write (T1) — does NOT take traceId in current API; gap
   ↓
[exportAuditPage / exportSinceTime] — cursor-based SIEM export — preserves traceId as part of metadata stream
   ↓
[AuditScrapbook bundle] — downstream consumer; preserves traceId via metadata
   ↓
[forensic query] — must JSON-path metadata.traceId (Hop H5 — silent-loss frontier)
```

**Gaps:**
- `requireAuditBeforeResponse` (auditService.ts:130) does NOT accept `traceId` in input shape — the canonical L1 path doesn't propagate trace through that helper.
- Mutation rows themselves (`EmployerAcceptance`, `StartAttestation`) carry NO `traceId` column — cross-row reconstruction requires `referenceId` join.

### 2.2 `correlationId` propagation (NEW post-Lock-v2)

```
[Client: x-correlation-id header (optional UUID)] OR [Web proxy mints UUID-v4]
   ↓
[Web proxy validates UUID format; forwards x-correlation-id]
   ↓
[Backend: reads x-correlation-id from request headers]
   ↓
[Service function: passes correlationId to recordEmployerReview*]
   ↓
[Service function: writes metadata.correlationId in audit row]
   ↓
[Best-effort dedup query: prior (actorId, correlationId) within 24h]
   ↓
[Echoed in response header x-correlation-id back to client]
```

**Gaps:**
- 5 hops (per `w2-pr5a-replay-certification.md`); H5 forensic-query frontier silent-loss.
- Hops H1–H3 have no test coverage today (only H4 covered by Lock v2 §7.4).
- Echo-in-response-header invariant (audit-row's correlationId == response-header's correlationId) is undocumented.

### 2.3 `payloadHash` propagation

```
[Backend handler reads request body]
   ↓
[Strip forbidden ownership fields (tenantId, organizationContextId, etc.)]
   ↓
[Canonicalize JSON: sorted keys; no whitespace]
   ↓
[SHA-256 hex of canonical bytes]
   ↓
[Stored in metadata.payloadHash]
   ↓
[Forensic query: cluster (actorId, payloadHash) for capture-replay detection]
```

**Gaps:**
- INCONSISTENTLY populated today (per `w2-pr6a-mutation-lineage.md` §3.1):
  - `share-packet` populates `metadata.shareTokenHash` (different field name).
  - `packet` populates `metadata.manifestHash` (different field name).
  - `confirm-start` populates `attestationHash` as `AuditEvent.hash` column (different surface).
  - `accept`, `request-refresh`, `route-to-review` do NOT explicitly populate any payloadHash field.
- Lock v2 §8 mandates payloadHash for permitted-path; ML-Rec-1 + DC-Rec-2 extend to denied-path.

### 2.4 `mutationFingerprint` propagation

The **mutation fingerprint** is conceptually `SHA-256(canonical(actorId || subjectId || verb || body))`. Today it does NOT exist as a single field. It is **derivable** from the audit row's metadata + payloadHash but not pre-computed.

**Gap:** if forensics wants to query "all attempts of THIS specific mutation," they must reconstruct the fingerprint client-side. Recommendation: add `metadata.mutationFingerprint` to canonicalize the lookup. (This is ABOVE Lock v2 + this wave's recommendations — flagged as a future hardening.)

### 2.5 Replay event propagation

Two existing `AUDIT_EVENT_TYPES` cover replay-adjacent semantics:

- **`IDEMPOTENT_REPLAY`** — emitted when an idempotent operation is observed as repeat.
- **`CONCURRENCY_GUARD_TRIGGERED`** — emitted when a concurrency guard fires.

These are existing primitives in the frozen YC MVP enum. Lock v2's `<base>.duplicate_request` (denied-path action literal) is a NEW, parallel primitive — emitted on the prisma.auditEvent.type free-form path with metadata.action suffix.

**Divergence:**
- `IDEMPOTENT_REPLAY` (canonical enum) is used for SOMETHING (not employer-review surface today; `AuditScrapbook.ts:88` references it). Coverage UNVERIFIED.
- `<base>.duplicate_request` (Lock v2) is the new denial-suffix on the prisma free-form type space.

These two primitives express overlapping concepts in different vocabularies. Consumers must learn both.

### 2.6 Denial event propagation (post-Lock-v2)

```
[Step-2+ denial in handler]
   ↓
[Service function: writes metadata.outcome='denied' + metadata.action='<base>.<reason>']
   ↓
[Audit row inserted via T1 or T2]
   ↓
[SIEM export carries denial metadata]
   ↓
[Forensic query: filter metadata.outcome = 'denied']
```

**Gaps:**
- Pre-Lock-v2: NO emission (per `w2-pr6a-denial-path-certification.md`).
- Step-1 denials (no auth) emit NO audit row by design.
- Step-6 (tx-rollback) emits NO audit row by Postgres ACID.
- Hidden in `metadata.outcome` field (no top-level column for denied vs permitted).

### 2.7 SIEM export lineage

```
[appendAuditEvent → in-memory AuditEntry]
   ↓
[exportAuditPage(cursor) → paginated AuditEntry[]]
   ↓ OR ↓
[exportSinceTime(timestamp) → up to 10,000 entries]
   ↓
[SIEM consumer ingests AuditEntry shape]
```

**Gap:** SIEM export is from the IN-MEMORY ledger, not from Postgres. If process restart loses in-memory entries that haven't dual-written, SIEM stream has gaps. Recommendation TS-Rec-5 (drain-on-shutdown) addresses.

### 2.8 Scrapbook lineage

```
[AuditScrapbookBundle.ts] reads audit rows (likely from Postgres)
   ↓
[Bundle shape includes IDEMPOTENT_REPLAY + CONCURRENCY_GUARD_TRIGGERED handling]
   ↓
[Downstream consumer (UNVERIFIED what consumes)]
```

**Gap:** scrapbook source coverage UNVERIFIED. Reads from Postgres OR from in-memory ledger? `AuditScrapbook.ts:88,90` switches on event type — implying the canonical AUDIT_EVENT_TYPES vocabulary, not the free-form prisma.auditEvent.type strings used by employer-review handlers. **This is the convergence problem manifest.**

### 2.9 Dual-write lineage

```
[appendAuditEvent → AuditEntry (in-memory)]
   ↓ FIRE-AND-FORGET ↓
[prisma.auditEvent.create] — string `type` derived from `entry.category` (not event_type)
   ↓
[CRITICAL log on DB failure; in-memory entry persists; DB row missing]
```

**Gap:** the dual-write path translates `AuditCategory[]` → `type: string` by joining categories with comma (auditService.ts:80: `Array.isArray(entry.category) ? entry.category.join(',') : String(entry.category)`). The Postgres `type` column thus contains comma-separated category strings (e.g., `'ISSUANCE,DECISION'`) — which is a DIFFERENT vocabulary than `AUDIT_EVENT_TYPES` and DIFFERENT than the free-form strings used by employer-review handlers.

**THREE PARALLEL TYPE NAMESPACES on the audit table.**

---

## 3. The canonical lineage path (proposed; NOT current)

A SINGLE canonical lineage path would require:

```
1. Mutation row inserted with: id, traceId, correlationId, mutationFingerprint
2. Audit row inserted (in same tx) with:
   - type: <canonical AUDIT_EVENT_TYPES value>
   - referenceId: <mutation.id>
   - hash: SHA-256(canonical content)
   - metadata: { traceId, correlationId, payloadHash, actorId, outcome, action }
3. Outbox event inserted (in same tx) with: traceId, correlationId
4. In-memory ledger entry appended with: traceId, category, actor
5. SIEM export streams audit rows with full lineage payload
6. Scrapbook bundles audit rows by (traceId or referenceId or clinicianId)
7. Forensic query traverses (traceId | referenceId | actorId | payloadHash) to reconstruct lineage
```

**The current state diverges at:**
- Step 1: mutation rows do NOT carry traceId or correlationId or mutationFingerprint columns.
- Step 2's `type`: uses 3 different vocabularies depending on writer.
- Step 4: in-memory ledger uses `category` not `type`.
- Step 5: SIEM export streams from in-memory, not from Postgres dual-write.
- Step 6: scrapbook recognizes `AUDIT_EVENT_TYPES` only — does NOT recognize the free-form prisma type strings used by employer-review.
- Step 7: requires forensic-query author to know all fields exist (H5 silent-loss).

---

## 4. Fragmented lineage paths

### 4.1 Type-vocabulary fragmentation

| Vocabulary | Source | Coverage |
|---|---|---|
| `AUDIT_EVENT_TYPES` (24 strict enum) | `packages/audit/AuditEvent.ts` (frozen YC MVP) | Used by `AuditScrapbook.ts`, `requireAuditBeforeResponse` callers (5 canonical paths), `appendAuditEvent` consumers — partial |
| `AuditCategory` (15 categories) | `auditLedger.ts:20–37` | Used by `appendAuditEvent` directly + SIEM export shape |
| Free-form prisma.auditEvent.type strings | Direct `prisma.auditEvent.create({type: '...'})` calls | Used by employer-review handlers (`EMPLOYER_REVIEW_ACCEPTED`, `EMPLOYER_PACKET_SHARED`, `ARTIFACT_EXPORTED`) — these strings DO NOT appear in `AUDIT_EVENT_TYPES` enum |

**Track A finding LT-1:** the audit-event type space has **3 PARALLEL VOCABULARIES** with PARTIAL overlap and no canonical authority. A SOC analyst querying `WHERE type = 'EMPLOYER_REVIEW_ACCEPTED'` on Postgres finds rows; the same query against the canonical enum finds nothing (the string isn't in the enum).

### 4.2 Trace-vs-correlation fragmentation

`traceId` (existing) and `correlationId` (Lock v2) are SEPARATE primitives serving overlapping concerns:

| Primitive | Origin | Purpose | Per-row |
|---|---|---|---|
| `traceId` | `appendAuditEvent` | Logical-operation continuity | Yes |
| `correlationId` | Web proxy (Lock v2) | Per-attempt replay observability | Yes |

**Track A finding LT-2:** the wave introduces correlationId without consolidating with traceId. Consumers must learn both. A retry of a logical operation has SAME traceId (if propagated) and DIFFERENT correlationIds (per attempt).

### 4.3 Hash-field fragmentation

Multiple SHA-256 hash fields exist:

| Field | Surface | Content |
|---|---|---|
| `AuditEvent.hash` | DB column | Canonical-form hash of audit row content |
| `metadata.payloadHash` (post-Lock-v2) | Metadata JSON | SHA-256 of redacted request body |
| `metadata.shareTokenHash` | Metadata JSON (`share-packet`) | SHA-256 of share token |
| `metadata.manifestHash` | Metadata JSON (`packet`) | SHA-256 of evidence manifest |
| `attestationHash` | Inline (`confirm-start`) | SHA-256 of attestation content; written to `AuditEvent.hash` column |

**Track A finding LT-3:** five distinct SHA-256 hash purposes use different field names (or share `hash` column with different content). Forensic queries against "the hash" must know which.

### 4.4 Mutation-row vs audit-row lineage fragmentation

Mutation rows (`EmployerAcceptance`, `StartAttestation`, `HITLReviewItem`, outbox events) carry NO `traceId`, `correlationId`, `payloadHash`, or `actorId` columns. Cross-row joins between mutation and audit use only:

- `mutation.id` ↔ `audit.referenceId` (string match; no FK)
- `mutation.clinicianNpi` ↔ `audit.clinicianId` (NPI string match)

Trace + correlation + payloadHash + actorId live ONLY in audit metadata, not in mutation row metadata.

**Track A finding LT-4:** lineage is fragmented across two layers — audit rows carry rich metadata; mutation rows are narrow. Joining requires audit-side enrichment with mutation IDs (referenceId).

---

## 5. Ambiguous lineage paths

| # | Ambiguity | Cause |
|---|---|---|
| **LA-1** | Same logical operation produces audit rows with different `type` strings | Multiple writers use different vocabularies |
| **LA-2** | Same audit row queryable via `type='EMPLOYER_REVIEW_ACCEPTED'` AND via `metadata.category='DECISION'` | Free-form type vs. category-derived comma-string |
| **LA-3** | Forensic query "all events for this trace" must use `metadata.traceId` (not a top-level column) — JSON-path performance + ergonomics | Top-level column doesn't exist |
| **LA-4** | Replay attempt visible in `IDEMPOTENT_REPLAY` event (canonical enum) AND/OR `<base>.duplicate_request` action literal (Lock v2) | Two parallel replay primitives |
| **LA-5** | Audit row attributable to `metadata.actorId` AND `metadata.employerId` (during Lock v2 transition) | Field rename in flight |

---

## 6. Hidden lineage branches

| # | Branch | Why hidden |
|---|---|---|
| **HB-1** | `appendAuditEvent` writes to in-memory ledger; CRITICAL log on dual-write failure leaves in-memory-only entries | Process restart drops them; no in-memory drain hook |
| **HB-2** | `auditScrapbookBundle` source UNVERIFIED — does it read from Postgres or in-memory? | Inspection deferred (artifact bundle not attached) |
| **HB-3** | SEAL captures (`captureEmployerDecision`), learning captures (`captureDecisionSignal`), recompute jobs (`recomputeMatchBoosts`) — fire-and-forget post-tx; produce downstream artifacts (KPI funnel, learning graph, recommender boost) that have their own lineage | Side-effect lineage NOT coupled to audit-row lineage; failure invisible to audit |
| **HB-4** | `view` POST handler (in `pilotKpi.ts`) does NOT write any audit row but DOES write a `captureAdvisoryEvent` (separate pilot-KPI persistence) | Lineage exists in pilot-KPI store, not audit table |
| **HB-5** | `share-token/:token` GET resolution path queries audit metadata for `shareTokenHash` — DEPENDS ON audit retention | Hidden retention coupling |
| **HB-6** | Outbox events written in tx — separate consumer (worker) processes them with its own lineage | Worker's lineage may not propagate audit's traceId |

**Track A finding LT-5:** 6 hidden lineage branches exist. Each is operationally relevant; none is fully audit-coupled.

---

## 7. Per-primitive convergence summary

| Primitive | Canonical? | Where canonical? | Where divergent? |
|---|---|---|---|
| `traceId` | NO — partial | `auditLedger.ts` + `auditService.ts` use it | Mutation rows lack it; `requireAuditBeforeResponse` lacks input field |
| `correlationId` | YES (Lock v2 — single source: web proxy) | `auditService.ts` metadata | Will be canonical post-Lock-v2 |
| `payloadHash` | NO — fragmented | `metadata.payloadHash` (Lock v2 mandate) | Today shareTokenHash, manifestHash, attestationHash all play similar roles in different fields |
| `mutationFingerprint` | NO — derivable but not stored | Not pre-computed | Recommendation: add field |
| Replay events | NO — fragmented | `IDEMPOTENT_REPLAY` enum entry vs `<base>.duplicate_request` literal | Two parallel vocabularies |
| Denial events | YES (Lock v2 — single source: `metadata.outcome` + `metadata.action`) | Post-Lock-v2 | Will be canonical post-Lock-v2 |
| Audit-event types | NO — three vocabularies | None canonical | `AUDIT_EVENT_TYPES` enum vs `AuditCategory` vs free-form strings |

---

## 8. Track A determination

| Question | Answer |
|---|---|
| Is the canonical lineage topology mapped? | YES — this doc |
| Is the topology coherent (one path per primitive)? | NO — multiple parallel vocabularies + fragmented paths |
| Is `traceId` propagation reliable? | PARTIAL — within-process strong; cross-row weak; `requireAuditBeforeResponse` gap |
| Is `correlationId` propagation reliable post-Lock-v2? | YES (with H1–H3 test coverage gap) |
| Are hidden lineage branches enumerated? | YES — 6 documented |
| Are fragmented vocabularies enumerated? | YES — 4 fragmentation findings (LT-1..LT-4) |

**Track A classification:** 🟠 **FRAGMENTED — 4 vocabulary fragmentations + 6 hidden branches + 5 ambiguities.** The lineage topology is rich but DIVERGENT. Convergence requires either (a) enum unification (a separate wave; touches frozen YC MVP code), (b) canonical-event-type adapter layer (less invasive), OR (c) explicit doc that maps the three vocabularies and forensic queries handle all three.

---

## 9. Recommendations

| # | Recommendation | Priority |
|---|---|---|
| **LT-Rec-1** | Publish `docs/ops/audit-event-vocabulary-map.md` documenting the 3 type-vocabularies + their relationships | HIGH |
| **LT-Rec-2** | Add `traceId` parameter to `requireAuditBeforeResponse` API to close the L1 propagation gap | MEDIUM |
| **LT-Rec-3** | Add `metadata.mutationFingerprint` field for forensic-query convenience | LOW |
| **LT-Rec-4** | Document scrapbook source coverage (LT-5 / HB-2) | MEDIUM |
| **LT-Rec-5** | Echo `traceId` in response headers for client-side correlation (TS-Rec-2) | MEDIUM |

---

## 10. Closing principle (Track A)

The lineage topology is the answer to "how does one logical operation flow through every layer?" The wave's runtime supports rich lineage IN PRINCIPLE (traceId + correlationId + payloadHash + audit row + Postgres + SIEM + scrapbook) but the paths are FRAGMENTED across 3 audit-event vocabularies, 5 distinct hash-field roles, and 6 hidden branches.

**Lineage convergence is achievable without product code by publishing the vocabulary map + audit-row-schema doc + the three follow-up gates (LT-Rec-1, LT-Rec-2, LT-Rec-4).** The lexicon prevents inflation; this doc prevents fragmentation. Together they make the audit spine genuinely operational-trust-grade.

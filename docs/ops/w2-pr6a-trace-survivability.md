# W2-PR6A — Trace Survivability (Track A)

**Wave:** Wave 2, PR 6A — operational audit spine, trace survivability · **Date:** 2026-05-08 · **Status:** certification only; **NO product code, NO runtime modification, NO merge** · **Authority:** subordinate to `w2-pr6a-audit-spine-certification.md`, `TRUST_GUARANTEE_LEXICON.md`

This doc certifies **trace continuity reliability** of the audit spine. It enumerates trace-loss scenarios, downgrade scenarios, lineage fragmentation risks, and per-hop survivability.

---

## 1. The trace primitive

`apps/api/backend/src/services/audit/auditLedger.ts` provides:

- **`newTraceId()`** (line 220) — UUID-v4 minted per logical operation.
- **`appendAuditEvent(opts)`** (line 108) — synchronous in-memory append; `opts.traceId` defaults to `randomUUID()` if absent.
- **`AuditEntry.traceId`** (line 45) — required field on every entry.

`auditService.ts:60` (`createAuditEvent`):

- Creates traceId if not supplied.
- Calls `appendAuditEvent` (in-memory).
- Dual-writes to Postgres `prisma.auditEvent` with `metadata.traceId` populated.
- Postgres write is fire-and-forget (T0); CRITICAL log on failure.

`auditService.ts:130` (`requireAuditBeforeResponse`) — does NOT take traceId in its current API shape; metadata is per-call. This is a **gap** worth flagging.

---

## 2. Trace continuity per-hop

The trace's lifecycle:

```
Origin: traceId minted at first audit-write site OR forwarded from upstream
   │
   ├─► H1: in-memory ledger append (synchronous; durable within process)
   │
   ├─► H2: Postgres write (fire-and-forget; CRITICAL log on failure)
   │
   ├─► H3: cursor-based export (paginated SIEM streaming)
   │
   ├─► H4: scrapbook bundle (downstream consumer)
   │
   └─► H5: forensic query 6 months later
```

### 2.1 Per-hop survivability

| Hop | Mechanism | Survivability | Failure visibility |
|---|---|---|---|
| **H1** in-memory append | `appendAuditEvent` | 🟢 STRONG within-process | Synchronous; throws on validation failure |
| **H2** Postgres write | Fire-and-forget `prisma.auditEvent.create.catch(...)` | 🟡 PARTIAL — DB outage → row missing in DB but present in-memory | CRITICAL log; not propagated to caller |
| **H3** cursor-based export | `exportAuditPage` | 🟢 STRONG IF in-memory ledger persists across process | In-memory ledger lost on process restart |
| **H4** scrapbook bundle | `auditScrapbookBundle.ts` + `AuditScrapbook.ts` | 🟢 STRONG IF the bundle reads from durable Postgres | UNVERIFIED — depends on bundle source |
| **H5** forensic query | Operator query | 🟠 FRAGMENTED — query author must KNOW `metadata.traceId` exists | Silent loss if author doesn't query the field |

**Track A finding TS-1:** the audit spine has STRONG within-process trace continuity AND mature dual-write infrastructure. The dominant trace-loss risks are (a) DB outage during fire-and-forget write (T0 path), (b) process restart losing in-memory ledger that hadn't dual-written, (c) H5 forensic-query-frontier silent loss.

---

## 3. Trace-loss scenarios

| # | Scenario | Effect on trace |
|---|---|---|
| **TL-1** | DB outage during `createAuditEvent` (T0) | In-memory ledger has the entry; Postgres does not. CRITICAL log signals the gap; no caller-visible failure |
| **TL-2** | Process crash before in-memory entry dual-writes | Both in-memory and Postgres lose the entry |
| **TL-3** | Process restart between in-memory append and dual-write | Same as TL-2 |
| **TL-4** | DB outage during `requireAuditBeforeResponse` (T1) | Throws; mutation does NOT commit; caller receives 5xx (correct fail-closed) |
| **TL-5** | DB outage during `prisma.$transaction` (T2 — C-1 handlers) | Tx aborts; mutation + audit both roll back; caller receives 5xx (correct) |
| **TL-6** | Scrapbook bundle reads stale data | Depends on bundle source — UNVERIFIED |
| **TL-7** | SIEM cursor pagination races concurrent writes | Standard cursor-pagination concern; new writes after cursor advance not in current page |
| **TL-8** | Forensic query 6 months later, audit retention < 6 months | Trace data GC'd; query returns nothing |
| **TL-9** | Forensic query author doesn't query `metadata.traceId` | Trace exists; query doesn't use it; silent loss |

### 3.1 Mitigations

- TL-1: documented in code comment at `auditService.ts:75` ("On DB failure: log CRITICAL but do not throw — do not break callers"). Acceptable trade-off for non-canonical events. Canonical events use T1/T2 instead.
- TL-2/TL-3: bounded by process-restart frequency + in-memory ledger size. Recommendation: a "drain on shutdown" hook that flushes in-memory entries before process exit.
- TL-4/TL-5: correct fail-closed; no mitigation needed.
- TL-8: requires retention SLA formalization (gate G7).
- TL-9: requires `audit-row-schema.md` publication (gate inferred from H5 silent loss).

**Track A finding TS-2:** TL-2, TL-3, TL-8, TL-9 are the four un-mitigated trace-loss scenarios. Of these, TL-9 is the highest leverage (silent and operator-controlled). TL-8 is the most operationally consequential (data simply gone).

---

## 4. Trace downgrade scenarios

A trace can degrade (lose information) without being lost entirely:

| # | Downgrade | Effect |
|---|---|---|
| **TD-1** | traceId minted at backend (no upstream propagation from web/proxy) | Single-tier trace; cannot correlate to web-layer logs |
| **TD-2** | Multiple traceIds minted for one logical operation (e.g., service function calls another that mints fresh) | Lineage fragmented; cross-id correlation requires `referenceId` join |
| **TD-3** | traceId stored only in `metadata.traceId` (not a top-level column) | Forensic queries must use JSON-path; performance + ergonomic concerns |
| **TD-4** | traceId is randomUUID (no structure / no namespace) | Cannot infer origin from the id itself |
| **TD-5** | traceId not echoed in response headers | Client cannot correlate their request to platform's trace |
| **TD-6** | correlationId (Lock v2 — different field!) and traceId (existing — different field) coexist; consumers must learn both | Two parallel observability primitives |

**Track A finding TS-3:** the wave introduces `correlationId` (Lock v2) as a distinct field from the pre-existing `traceId`. The two serve overlapping purposes — replay observability (correlationId) vs. logical-operation lineage (traceId). Consumers (SOC, dashboards, runbooks) must understand both. Recommendation: explicit `audit-row-schema.md` documents both, their semantics, when to use which, and how they relate.

---

## 5. Correlation propagation (the wave's contribution)

Per `w2-pr5a-replay-certification.md` Track B, Lock v2's correlationId chain has 5 hops:

```
Client → Proxy → Backend → Service → Audit Metadata → Forensic Query
```

Trace + correlation are SEPARATE primitives:

- **traceId**: minted by `auditService.ts`/`auditLedger.ts`; existing; per-logical-operation.
- **correlationId**: minted by Lock v2 proxy; new; per-attempt; client-supplied OR proxy-generated.

A row in audit metadata could have:
- `traceId: <uuid-A>` — the logical operation
- `correlationId: <uuid-B>` — the request attempt

**Track A finding TS-4:** documentation must clarify that traceId and correlationId answer different questions. A retry of a logical operation produces SAME traceId (if propagated), DIFFERENT correlationIds (per attempt). Best-effort dedup is correlationId-based; logical-operation reconstruction is traceId-based.

---

## 6. Lineage fragmentation risks

| # | Risk | Mechanism |
|---|---|---|
| **LF-1** | Mutation row lacks traceId (only audit row carries it) | Cross-row joins via `referenceId` string match — works, but indirect |
| **LF-2** | Outbox event lacks traceId | Same — outbox is a separate row in the tx; if it doesn't carry traceId, cross-store lineage breaks |
| **LF-3** | Side-effect calls (SEAL, learning, recompute) don't carry traceId | These run post-tx; failures don't propagate; no traceId in their logs |
| **LF-4** | StartAttestation references EmployerAcceptance via `acceptanceId`, not `traceId` | Same row-match concern |
| **LF-5** | Audit retention not aligned with FK-equivalent lookup needs | `referenceId`-matched cross-row queries silently fail when one side is GC'd |
| **LF-6** | Multiple audit rows for one logical operation use different traceIds | Lineage reconstruction depends on `referenceId` chain, not traceId chain |

**Track A finding TS-5:** the audit spine's lineage primitives are `traceId` + `referenceId` + `correlationId` + `clinicianId`. Cross-row joins typically use `referenceId` or `clinicianId` (NPI). traceId is best for "all events in this logical operation" — but only if upstream propagates it. Today, upstream propagation is best-effort.

---

## 7. Trace continuity classifications

### 7.1 Per-property

| Property | Status |
|---|---|
| Within-process traceId continuity | 🟢 CERTIFIED |
| Postgres dual-write durability | 🟡 PARTIAL — fire-and-forget T0 path |
| Synchronous DB write before 2xx (T1) | 🟢 CERTIFIED |
| Atomic-with-mutation (T2 via `prisma.$transaction`) | 🟢 CERTIFIED for 4 C-1 handlers |
| Cursor-based SIEM export | 🟢 CERTIFIED — `exportAuditPage` available |
| traceId in response headers (echo to client) | 🟠 UNVERIFIED — code does not echo today |
| traceId-correlationId distinction documented | 🔴 NOT YET — this PR's recommendation |
| Forensic-query schema doc | 🔴 NOT YET — recommendation |
| Audit retention SLA formalized | 🔴 NOT YET — gate G7 |
| Drain-on-shutdown hook for in-memory ledger | 🟠 UNVERIFIED |
| Cross-store lineage (in-memory ↔ Postgres ↔ scrapbook) | 🟡 PARTIAL — works in steady state; fragments on outage |

### 7.2 Aggregate

**Trace survivability:** 🟡 **PARTIAL.** Strong primitives, mature dual-write, cursor-based export. Weakened by undocumented retention, missing forensic-query schema doc, and the H5 silent-loss frontier.

---

## 8. Recommendations

| # | Recommendation | Priority |
|---|---|---|
| **TS-Rec-1** | Publish `docs/ops/audit-row-schema.md` documenting traceId + correlationId + payloadHash + all metadata fields | HIGH |
| **TS-Rec-2** | Echo traceId in response headers (`x-trace-id`) for client-side correlation | MEDIUM |
| **TS-Rec-3** | Document the traceId-vs-correlationId distinction explicitly | MEDIUM |
| **TS-Rec-4** | Formalize audit retention SLA (gate G7) | HIGH |
| **TS-Rec-5** | Add drain-on-shutdown hook for in-memory ledger to flush pending dual-writes | LOW |
| **TS-Rec-6** | Make `requireAuditBeforeResponse` accept `traceId` parameter to support upstream propagation | LOW |
| **TS-Rec-7** | Document the H5 forensic-query-frontier as a known silent-loss boundary | HIGH |

---

## 9. Track A determination

| Question | Answer |
|---|---|
| Is trace continuity reliable within-process? | YES — 🟢 CERTIFIED |
| Is trace continuity reliable across-process? | PARTIAL — 🟡 fire-and-forget T0 leaves a gap |
| Are trace-loss scenarios documented? | YES (this doc) — 9 enumerated |
| Are downgrade scenarios documented? | YES — 6 enumerated |
| Is the H5 silent-loss frontier mitigated? | NO — requires `audit-row-schema.md` publication |
| Is correlation propagation auditable? | YES post-Lock-v2 (correlationId stamping) |
| Is lineage fragmentation bounded? | PARTIAL — 6 fragmentation paths enumerated |

**Track A classification:** 🟡 **PARTIAL** — strong within-process; partial across-process; H5 silent-loss boundary is the largest single trace-survivability risk.

---

## 10. Closing principle (Track A)

Trace survivability is the discipline of ensuring that what was recorded can be retrieved. The audit spine has mature primitives (in-memory ledger + Postgres dual-write + cursor-based SIEM export + scrapbook bundle). The wave's risks are operational (retention SLA, schema doc, response-header echo) rather than architectural.

**Trace continuity is CERTIFIABLE within-process; PARTIAL across-process; FRAGMENTED at the forensic-query frontier without `audit-row-schema.md` publication.** Closing TS-Rec-1, TS-Rec-4, TS-Rec-7 advances trace survivability from PARTIAL to CERTIFIED.

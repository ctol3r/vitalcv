# W2-PR9A — Correlation Collapse Review (Track B)

**Wave:** Wave 2, PR 9A — operational failure survivability certification, correlation collapse track · **Date:** 2026-05-08 · **Status:** survivability analysis only; **NO product code, NO runtime modification, NO merge** · **Authority:** subordinate to `TRUST_GUARANTEE_LEXICON.md`, `replay-taxonomy-map.md`, `w2-pr5a-replay-certification.md`, `w2-pr7a-lineage-topology-map.md`

This doc reviews **trace + correlationId propagation failure modes** under degraded runtime conditions. It identifies hidden lineage discontinuities, async correlation loss, retry-loop fragmentation, and replay correlation ambiguity.

The central thesis: **correlation propagation degrades silently at multiple hops** under failure conditions. Most degradations are observable IF the right query is run; some are H5-frontier silent (forensic-query author doesn't know to ask).

---

## 1. The 5-hop propagation chain (recap)

```
[Client] → [Web Proxy] → [Backend Route] → [Service Function] → [Audit Metadata] → [Forensic Query]
   H1          H2              H3                  H4                   H5
```

Per `w2-pr5a-replay-certification.md` Track B + `w2-pr7a-lineage-topology-map.md` §2.2.

Each hop has its own failure modes. Aggregate survivability is bounded by the weakest hop.

---

## 2. Per-hop failure modes (under degraded conditions)

### 2.1 H1 — Client → Proxy

| Failure mode | Cause | Effect |
|---|---|---|
| Client doesn't send `x-correlation-id` | UI not updated; old client | Proxy generates fresh per attempt; honest-client retry produces N different correlationIds; dedup ineffective |
| Client sends malformed correlationId (not UUID) | Client bug | Proxy validates + rejects OR overrides; client never knows which |
| Client sends same correlationId for distinct operations | Client bug; correlationId reuse | Distinct operations may collide on dedup gate; first wins, second appears as "duplicate" |
| Proxy rate-limit drops request | Network condition | No backend reach; no audit; client retries |

**Hop status (degraded):** 🟡 PARTIAL — proxy generates correlationId on absence; honest-client correctness depends on client discipline.

### 2.2 H2 — Proxy → Backend

| Failure mode | Cause | Effect |
|---|---|---|
| Proxy regression: header forwarding broken | Code bug; deploy issue | Backend doesn't see correlationId; defaults to NULL; observable in audit-row metadata |
| Proxy timeout: backend unreachable | Backend degraded | Caller sees 504; no audit row; web-layer log captures |
| Proxy returns 200 silently (without backend reach) | Misconfigured proxy | DL-3 scenario (per `w2-pr6a-denial-path-certification.md`); silent |

**Hop status (degraded):** 🟡 PARTIAL — most failures are observable; SD-LIN-6 silent-200 risk.

### 2.3 H3 — Backend route → Service function

| Failure mode | Cause | Effect |
|---|---|---|
| Backend route handler doesn't pass correlationId to service | Code regression | `metadata.correlationId` becomes NULL; observable in audit row |
| Backend uses different field name (typo) | Code regression | Same |
| Backend wraps in different context object | Refactor | Same |

**Hop status (degraded):** 🟡 PARTIAL — observable in audit row.

### 2.4 H4 — Service function → Audit metadata

| Failure mode | Cause | Effect |
|---|---|---|
| Metadata builder forgets `correlationId` field | Code regression | Audit row missing correlationId; observable |
| Metadata builder writes stale value | Race condition; closures | Subtle; correlationId mismatched to actual request |
| Service function called from non-route context | Internal call doesn't propagate proxy-context | NULL correlationId by design (system-initiated) |

**Hop status (degraded):** 🟡 PARTIAL — most failures observable; race condition rare.

### 2.5 H5 — Audit metadata → Forensic query

| Failure mode | Cause | Effect |
|---|---|---|
| Forensic query author doesn't filter on `metadata.correlationId` | Operator unawareness | **SILENT LOSS** — data exists; query never asks |
| Schema rename breaks query | Lock v2 deprecation | Old queries silently miss new rows |
| JSON-path query syntax mistake | Operator error | Returns 0 rows; operator may interpret as "no replay activity" |

**Hop status (degraded):** 🟠 **FRAGMENTED — H5 SILENT-LOSS FRONTIER.** Most operationally consequential.

---

## 3. Trace propagation failure modes (parallel chain)

`traceId` (existing, separate from correlationId) has its own propagation chain through `auditService.ts`/`auditLedger.ts`:

```
[Origin: client OR upstream service] → [appendAuditEvent(traceId)] → [in-memory ledger entry] → [dual-write to Postgres metadata.traceId] → [forensic query]
```

| Failure mode | Cause | Effect |
|---|---|---|
| `appendAuditEvent` called without `opts.traceId` | Caller code | Defaults to `randomUUID()`; trace continuity broken (each call new trace) |
| `requireAuditBeforeResponse` doesn't accept `traceId` (current API gap) | Existing API shape | Per `w2-pr6a-trace-survivability.md` §1; T1 path doesn't propagate traceId from upstream |
| `prisma.$transaction` direct writes (T2) don't include `metadata.traceId` | Code regression | Audit row has no traceId; cross-row reconstruction must use `referenceId` chain |
| Process restart loses in-memory entries before dual-write | Operational | Postgres has them only if dual-write fired before restart |

**Aggregate trace propagation status (degraded):** 🟡 **PARTIAL — strong within-process; weakened by API gap (T1) + T2-direct-writer omission patterns + process restart.**

---

## 4. Correlation downgrade paths

A correlationId can DEGRADE — exist on some rows in a chain but not others.

| Pattern | Cause |
|---|---|
| **CD-1** | Permitted row carries correlationId; denied row in same retry chain doesn't | Lock v2 mandate covers both — but implementation may vary; verify per-handler |
| **CD-2** | C-1 audit-row carries correlationId; outbox event in same tx doesn't | Outbox writer may not pass through; observable in outbox metadata |
| **CD-3** | T0 dual-write to Postgres includes correlationId; in-memory ledger entry doesn't | If proxy doesn't update T0 callers; partial coverage |
| **CD-4** | C-2 share-packet audit row has correlationId; downstream `share-token/:token` GET resolution doesn't propagate | Share-token resolution is independent flow; no correlation back |

**Track B finding CC-1:** correlation downgrade is operationally tolerable for retry-observability purposes (the dedup gate fires per-hop); it weakens cross-chain reconstruction (forensic queries can't find all related events by correlationId alone).

---

## 5. Async correlation loss

When operations cross async boundaries (queue dispatch, fire-and-forget side effects, scheduled jobs), correlation propagation requires explicit threading.

### 5.1 Per-async-boundary

| Boundary | Mechanism | Status |
|---|---|---|
| Side-effect Promise dispatched within request handler | `void capture*({...})` calls | Side effect's metadata may not include correlationId; if it doesn't, async correlation lost |
| Outbox event written, processed by worker | Worker reads outbox row metadata | Worker may or may not propagate correlationId; depends on worker code |
| Scheduled job (e.g., recompute, decay check) | Job code self-mints traceId | No upstream correlationId by design |
| Webhook callback (Clerk, Stripe, etc.) | Webhook handler doesn't know upstream correlationId | New correlationId per webhook; old chain ends at handler boundary |

**Track B finding CC-2:** async correlation propagation is per-handler discipline. There is no platform-wide convention. Recommendations: (a) every async dispatch from a request handler should carry forward the request's correlationId in the dispatch metadata; (b) scheduled jobs declare new correlationId in their metadata explicitly.

---

## 6. Retry-loop fragmentation

A client retrying due to network failure can produce these correlation patterns:

| Retry pattern | Effect on correlation chain |
|---|---|
| Same client correlationId on every retry | DEDUP GATE FIRES; only first commit visible; honest-client succeeds via 409 detection |
| Fresh correlationId per retry attempt | DEDUP GATE INEFFECTIVE; multiple permitted commits possible; capture-replay-equivalent |
| Sometimes-same, sometimes-fresh (client buggy) | Mixed: some retries caught, others not; SOC analysis ambiguous |
| Retry past 24h dedup window | Dedup ineffective; old correlationId reusable |
| Retry from different client (e.g., user opens new tab) | Fresh correlationId by definition; not detectable as retry without payloadHash clustering |

**Track B finding CC-3:** retry-loop fragmentation is the dominant correlation-collapse mode. Honest clients with discipline (same correlationId per retry) are observable; bug-prone clients are partially observable.

---

## 7. Replay correlation ambiguity

When a correlationId appears multiple times, ambiguity arises:

| Ambiguity | Disambiguation |
|---|---|
| Same `(actor, correlationId)` permitted + denied | First-attempt permitted; later denied = honest retry caught |
| Same `(actor, correlationId)` denied + permitted | RACE: first-attempt actually went to TOCTOU; second appears as duplicate |
| Same `(actor, correlationId)` both permitted (TWO rows) | TOCTOU race; both committed; dedup failed |
| Same `(actor, correlationId)` two permitted with different `payloadHash` | Capture-modify-replay scenario |
| Different `(actor, correlationId)` with same `payloadHash` | Capture-replay or coincidence (negligible at SHA-256) |

Per `replay-taxonomy-map.md` §6 disambiguation matrix.

---

## 8. Hidden lineage discontinuities under degraded conditions

| Scenario | Discontinuity |
|---|---|
| **HD-1** Network partition mid-tx | Tx aborts; all rows roll back; lineage as if request never happened |
| **HD-2** Database failover during tx | Same |
| **HD-3** Process restart during T0 dual-write window | In-memory entry lost AND Postgres write didn't fire; full audit loss |
| **HD-4** SIEM consumer disconnected mid-export | Pagination cursor lost; SIEM resync may miss intermediate events |
| **HD-5** Audit retention sweep runs mid-query | Forensic query returns incomplete result |
| **HD-6** Schema migration in progress | Audit-row read may use stale schema |
| **HD-7** Clerk degradation mid-request | Web middleware fails-closed; mutation never reaches backend; lineage starts and ends at middleware-level log |

**Track B finding CC-4:** HD-1, HD-2, HD-3, HD-7 are by-design lineage gaps (correct fail-closed behavior). HD-4, HD-5, HD-6 are operational concerns requiring runbook discipline. HD-3 is the most operationally-significant gap (process restart racing T0 fire-and-forget) — recommendation: avoid T0 for canonical events.

---

## 9. Survivability gaps

Aggregating all the gaps:

| # | Gap | Severity | Mitigation |
|---|---|---|---|
| **CCG-1** | H5 silent-loss frontier (forensic-query author unawareness) | HIGH | Publish `audit-row-schema.md` |
| **CCG-2** | T1 (`requireAuditBeforeResponse`) doesn't accept traceId | MEDIUM | Add traceId param (LT-Rec-2) |
| **CCG-3** | T0 fire-and-forget process-restart race (HD-3) | MEDIUM | Avoid T0 for canonical events; drain-on-shutdown hook (TS-Rec-5) |
| **CCG-4** | Async correlation propagation per-handler (no convention) | MEDIUM | Document per-handler convention |
| **CCG-5** | Retry-loop client discipline variance | LOW | Client-retry guidance doc (RC-Rec-7 / TS-Rec related) |
| **CCG-6** | Correlation downgrade in C-2 share-packet downstream resolution | LOW | Document; deferred to future wave |
| **CCG-7** | Audit retention SLA undocumented | HIGH | Formalize retention SLA |
| **CCG-8** | Schema-rename query drift (e.g., employerId → actorId) | MEDIUM | Deprecation timeline + carry-both-fields window |

---

## 10. Per-handler correlation collapse profile

Under degraded conditions:

| Handler | H1-H4 propagation | H5 forensic | Async coupling | Aggregate |
|---|---|---|---|---|
| `accept` | 🟡 PARTIAL post-Lock-v2 | 🟠 FRAGMENTED H5 | 🟡 PARTIAL (SEAL/learning don't carry correlation) | 🟡 **PARTIAL** |
| `confirm-start` | 🟡 PARTIAL | 🟠 FRAGMENTED H5 | 🟡 PARTIAL (KPI capture) | 🟡 **PARTIAL** |
| `request-refresh` | 🟡 PARTIAL | 🟠 FRAGMENTED H5 | 🟡 PARTIAL | 🟡 **PARTIAL** |
| `route-to-review` | 🟡 PARTIAL | 🟠 FRAGMENTED H5 | 🟡 PARTIAL | 🟡 **PARTIAL** |
| `share-packet` | 🟡 PARTIAL | 🟠 FRAGMENTED H5 + downstream-resolution gap | n/a | 🟠 **FRAGMENTED** |
| `packet` | 🟡 PARTIAL | 🟠 FRAGMENTED H5 | n/a | 🟡 **PARTIAL** |

---

## 11. Track B determination

| Question | Answer |
|---|---|
| Are H1-H4 correlation failures observable? | YES — all surface in audit-row missing-field |
| Is H5 forensic-query frontier observable? | NO — silent-loss; requires audit-row-schema doc |
| Is async correlation loss bounded? | PARTIAL — per-handler discipline; no platform convention |
| Are retry-loop fragmentations enumerated? | YES — 5 patterns (§6) |
| Are hidden lineage discontinuities enumerated? | YES — 7 (HD-1..HD-7) |
| Is degraded-runtime correlation collapse enumerated? | YES — 8 survivability gaps (CCG-1..CCG-8) |

**Track B classification:** 🟡 **PARTIAL — H1-H4 propagation observable; H5 frontier silent-loss; async + retry-loop bounded by handler discipline.**

---

## 12. Closing principle (Track B)

Correlation propagation under degraded conditions is the discipline of preserving lineage signal across hops where the runtime can fail. The 5 hops have different failure characteristics; the H5 silent-loss frontier is the dominant operational risk.

**Correlation survives degradation IF: (a) operators query the right metadata fields (closes H5), (b) T0 fire-and-forget is avoided for canonical events (closes HD-3), (c) async dispatches carry forward correlationId (closes CCG-4), (d) retention SLA is formalized (closes CCG-7).** The wave's contribution is enumeration; the durable mitigation is documentation discipline + per-handler async-correlation conventions.

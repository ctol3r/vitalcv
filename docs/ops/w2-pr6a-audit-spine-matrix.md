# W2-PR6A — Audit Spine Certification Matrix (Track E)

**Wave:** Wave 2, PR 6A — operational audit spine, certification matrix · **Date:** 2026-05-08 · **Status:** matrix only; **NO product code, NO runtime modification, NO merge** · **Authority:** subordinate to `w2-pr6a-audit-spine-certification.md`; consolidates Tracks A (`w2-pr6a-trace-survivability.md`), B (`w2-pr6a-mutation-lineage.md`), C (`w2-pr6a-denial-path-certification.md`), D (`w2-pr6a-attribution-durability.md`)

This doc consolidates per-audit-surface certification across the 5 dimensions named in the wave brief: **trace continuity, attribution durability, denial observability, replay visibility, metadata survivability.**

Each surface is assigned one of:

- 🟢 **CERTIFIED** — substrate exists; lexicon-aligned wording available; testable
- 🟡 **PARTIAL** — substrate partial OR substrate exists but Lock v2 implementation not yet merged
- 🟠 **FRAGMENTED** — substrate exists but lineage breaks at well-defined boundaries (retention, schema-rename, GC)
- 🔴 **UNSAFE** — substrate absent OR design-intentional gap that requires explicit disclosure

---

## 1. Surfaces inventoried

The audit spine spans 11 surfaces across infrastructure + per-handler audit emission + downstream consumers.

| # | Surface | Layer |
|---|---|---|
| **AS1** | `auditLedger.ts` — in-memory append-only ledger with `traceId` | infrastructure |
| **AS2** | `auditService.ts` — tiered T0/T1/T2 audit-write infrastructure + dual-write to Postgres | infrastructure |
| **AS3** | `prisma.auditEvent` — Postgres durable storage | infrastructure |
| **AS4** | `exportAuditPage` / `exportSinceTime` — cursor-based SIEM export | infrastructure |
| **AS5** | `AuditScrapbook` — bundle construction + scrapbook for downstream consumers | infrastructure |
| **AS6** | `accept` audit emission (C-1, transactional) | per-handler |
| **AS7** | `confirm-start` audit emission (C-1) | per-handler |
| **AS8** | `request-refresh` audit emission (C-1) | per-handler |
| **AS9** | `route-to-review` audit emission (C-1, with HITL silent-degrade) | per-handler |
| **AS10** | `share-packet` audit emission (C-2, audit-as-persistence) | per-handler |
| **AS11** | `packet` audit emission (C-2, audit-as-export-receipt) | per-handler |

The per-handler surfaces map to the same 6 in-scope branches reviewed in `w2-pr5a-trust-surface-certification-matrix.md`. The 4 audit-spine infrastructure surfaces are NEW to this wave's certification.

---

## 2. The certification matrix

Post-Lock-v2 + recommendations (ML-Rec-1, ML-Rec-2, DC-Rec-1, DC-Rec-2, AD-Rec-1, TS-Rec-1, TS-Rec-4, TS-Rec-7).

| # | Surface | Trace continuity | Attribution durability | Denial observability | Replay visibility | Metadata survivability | **Aggregate** |
|---|---|---|---|---|---|---|---|
| **AS1** ledger | 🟢 CERTIFIED — `traceId` propagation in-process | n/a | n/a | n/a | 🟢 CERTIFIED — append-only | 🟢 **CERTIFIED** |
| **AS2** auditService (T0/T1/T2) | 🟡 PARTIAL — T0 fire-and-forget gap; T1+T2 strong | 🟢 CERTIFIED | n/a | n/a | 🟢 CERTIFIED | 🟢 **CERTIFIED** (T1+T2) |
| **AS3** Postgres `prisma.auditEvent` | 🟢 CERTIFIED — ACID | 🟢 CERTIFIED | 🟢 CERTIFIED (post-Lock-v2 denied path) | 🟢 CERTIFIED (post-Lock-v2 correlationId) | 🟡 PARTIAL — JSON metadata is rename-fragile | 🟡 **PARTIAL** |
| **AS4** SIEM export | 🟢 CERTIFIED — cursor-based | n/a | n/a | n/a | 🟡 PARTIAL — depends on metadata schema doc (TS-Rec-1) | 🟢 **CERTIFIED** |
| **AS5** AuditScrapbook bundle | 🟠 FRAGMENTED — UNVERIFIED bundle source coverage | 🟠 UNVERIFIED | 🟠 UNVERIFIED | 🟠 UNVERIFIED | 🟠 UNVERIFIED | 🟠 **FRAGMENTED** (inspection deferred) |
| **AS6** `accept` | 🟡 PARTIAL — needs traceId echo in response | 🟡 PARTIAL — proxy-bounded | 🟢 CERTIFIED-IN-CONTRACT | 🟢 CERTIFIED-IN-CONTRACT | 🟡 PARTIAL — `actorId` rename pending | 🟡 **PARTIAL** |
| **AS7** `confirm-start` | 🟡 PARTIAL | 🟡 PARTIAL | 🟢 CERTIFIED-IN-CONTRACT | 🟡 PARTIAL — deprecation window | 🟡 PARTIAL | 🟡 **PARTIAL** |
| **AS8** `request-refresh` | 🟡 PARTIAL | 🟡 PARTIAL | 🟢 CERTIFIED-IN-CONTRACT | 🟢 CERTIFIED-IN-CONTRACT | 🟡 PARTIAL | 🟡 **PARTIAL** |
| **AS9** `route-to-review` | 🟡 PARTIAL | 🟡 PARTIAL | 🟢 CERTIFIED-IN-CONTRACT + Sentry breadcrumb | 🟢 CERTIFIED-IN-CONTRACT | 🟡 PARTIAL — `reviewItemCreated: false` flag | 🟡 **PARTIAL** |
| **AS10** `share-packet` | 🟠 FRAGMENTED — audit IS persistence | 🟡 PARTIAL | 🟡 PARTIAL — denied-path | 🟡 PARTIAL — token TTL boundary | 🟠 FRAGMENTED — retention dependency | 🟠 **FRAGMENTED** |
| **AS11** `packet` | 🟠 FRAGMENTED — audit IS export receipt | 🟡 PARTIAL | 🟡 PARTIAL | 🟡 PARTIAL | 🟠 FRAGMENTED | 🟠 **FRAGMENTED** |

---

## 3. Aggregate distribution (post-Lock-v2 + recommendations)

| Status | Count | Surfaces |
|---|---|---|
| 🟢 **CERTIFIED** | 3 | AS1 ledger, AS2 auditService (T1+T2), AS4 SIEM export |
| 🟡 **PARTIAL** | 5 | AS3 Postgres, AS6 accept, AS7 confirm-start, AS8 request-refresh, AS9 route-to-review |
| 🟠 **FRAGMENTED** | 3 | AS5 scrapbook, AS10 share-packet, AS11 packet |
| 🔴 **UNSAFE** | 0 | — |
| **TOTAL** | **11** | |

The 3 CERTIFIED surfaces are the audit-spine infrastructure foundation. The 5 PARTIAL surfaces are the per-handler emission paths post-Lock-v2 (would advance to CERTIFIED with retention SLA + audit-row-schema doc + payloadHash mandate). The 3 FRAGMENTED surfaces have substrate but break at well-defined boundaries (retention, GC, bundle-source coverage).

---

## 4. Per-dimension aggregate

### 4.1 Trace continuity

| Status | Count | Notes |
|---|---|---|
| 🟢 CERTIFIED | 3 (AS1, AS3, AS4) | Strong primitives + Postgres + SIEM export |
| 🟡 PARTIAL | 5 (AS2, AS6, AS7, AS8, AS9) | T0 fire-and-forget gap; needs response-header echo |
| 🟠 FRAGMENTED | 3 (AS5, AS10, AS11) | Bundle source UNVERIFIED; audit-as-persistence retention-bound |

### 4.2 Attribution durability

| Status | Count | Notes |
|---|---|---|
| 🟢 CERTIFIED | 2 (AS2, AS3) | Persistence layer is solid |
| 🟡 PARTIAL | 6 (AS6–AS11) | Proxy-bounded; per-org NULL today |
| 🟠 FRAGMENTED | 1 (AS5) | UNVERIFIED |
| n/a | 2 (AS1, AS4) | Infrastructure layer; not actor-attributing |

### 4.3 Denial observability

| Status | Count | Notes |
|---|---|---|
| 🟢 CERTIFIED-IN-CONTRACT | 4 (AS3, AS6, AS7, AS8, AS9) | Post-Lock-v2 mandates Step-2+ denied emission |
| 🟡 PARTIAL | 2 (AS10, AS11) | C-2 cosmetic; denied-path partial |
| n/a | 4 | Infrastructure |

### 4.4 Replay visibility

| Status | Count | Notes |
|---|---|---|
| 🟢 CERTIFIED-IN-CONTRACT | 3 (AS3, AS6, AS8, AS9) | correlationId-stamped post-Lock-v2 |
| 🟡 PARTIAL | 3 (AS7, AS10, AS11) | Deprecation window / token boundary |
| n/a | 4 |

### 4.5 Metadata survivability

| Status | Count | Notes |
|---|---|---|
| 🟢 CERTIFIED | 2 (AS1, AS2) | Frozen YC MVP enum + tiered infrastructure |
| 🟡 PARTIAL | 5 (AS3, AS6, AS7, AS8, AS9) | Schema rename concerns; needs `audit-row-schema.md` |
| 🟠 FRAGMENTED | 3 (AS5, AS10, AS11) | Retention-bound |

---

## 5. Cross-cutting findings

### 5.1 Audit-spine infrastructure is mature

3 of 4 infrastructure surfaces (AS1 ledger, AS2 auditService, AS4 SIEM export) reach CERTIFIED. The audit spine has been engineered with care; the wave does NOT need to introduce new infrastructure.

### 5.2 The wave's contribution is narrow but high-value

Post-Lock-v2's contribution to the audit spine:

- correlationId stamping on every audit row (replay visibility CERTIFIED).
- Denied-path emission for Step-2+ (denial observability CERTIFIED).
- payloadHash mandate (capture-replay forensic detection — requires ML-Rec-1 + DC-Rec-2).
- `actorId` canonical naming + deprecation timeline for `employerId` (metadata survivability improved).

These are 4 narrow but high-value extensions to a mature spine.

### 5.3 The 3 FRAGMENTED surfaces share a common cause

AS5 (scrapbook) is FRAGMENTED because bundle source coverage is UNVERIFIED. AS10 (share-packet) and AS11 (packet) are FRAGMENTED because they use audit-as-persistence and depend on retention SLA.

**All three fragmentations close** when:
1. `audit-row-schema.md` published (AS5 inspection becomes possible).
2. Audit retention SLA formalized (AS10 + AS11 retention-dependency closes).

### 5.4 No UNSAFE surfaces

Every surface has either a CERTIFIED status, a documented PARTIAL with closure path, or a FRAGMENTED with retention-dependency closure. No surface is irretrievably UNSAFE.

---

## 6. Coverage delta — Pre-Lock-v2 vs Post-Lock-v2

| Surface | Pre-Lock-v2 aggregate | Post-Lock-v2 aggregate | Δ |
|---|---|---|---|
| AS1 ledger | 🟢 CERTIFIED | 🟢 CERTIFIED | unchanged |
| AS2 auditService | 🟢 CERTIFIED (T1+T2) | 🟢 CERTIFIED | unchanged |
| AS3 Postgres | 🟡 PARTIAL — no denied; no correlationId | 🟡 PARTIAL → mostly CERTIFIED | improved |
| AS4 SIEM export | 🟢 CERTIFIED | 🟢 CERTIFIED | unchanged |
| AS5 scrapbook | 🟠 FRAGMENTED | 🟠 FRAGMENTED | unchanged (inspection deferred) |
| AS6 accept | 🟠 FRAGMENTED — no denied; no correlationId | 🟡 PARTIAL | improved |
| AS7 confirm-start | 🟠 FRAGMENTED | 🟡 PARTIAL | improved |
| AS8 request-refresh | 🟠 FRAGMENTED | 🟡 PARTIAL | improved |
| AS9 route-to-review | 🟠 FRAGMENTED | 🟡 PARTIAL + Sentry | improved |
| AS10 share-packet | 🟠 FRAGMENTED | 🟠 FRAGMENTED | partial — denied-path improved |
| AS11 packet | 🟠 FRAGMENTED | 🟠 FRAGMENTED | partial — denied-path improved |

**Delta:** 4 per-handler surfaces shift from FRAGMENTED to PARTIAL. AS3 improves substantially within PARTIAL. 0 surfaces regress. 3 CERTIFIED preserved.

---

## 7. Track E determination

| Question | Answer |
|---|---|
| Are 3+ infrastructure surfaces CERTIFIED? | YES — AS1 ledger, AS2 auditService (T1+T2), AS4 SIEM export |
| Does Lock v2 advance per-handler surfaces from FRAGMENTED to PARTIAL? | YES — 4 of 6 per-handler surfaces improve |
| Are FRAGMENTED surfaces convertible to PARTIAL/CERTIFIED with named follow-ups? | YES — `audit-row-schema.md` + retention SLA close all 3 |
| Are UNSAFE-by-design surfaces present in the audit spine? | NO — every surface has a closure path |
| Is matrix lexicon-conformant? | YES — every cell uses lexicon-aligned descriptions |

**Track E classification:** 🟡 **PARTIAL — CERTIFIABLE-IN-CONTRACT for the post-Lock-v2 + recommendations transition; CERTIFIABLE-IN-IMPLEMENTATION pending the gates from `w2-pr5a-legitimacy-boundary-report.md` §3 PLUS the additional audit-spine recommendations (ML-Rec-1, ML-Rec-2, DC-Rec-1, DC-Rec-2, AD-Rec-1, TS-Rec-1, TS-Rec-4, TS-Rec-7).**

---

## 8. Closing principle (Track E)

The audit spine certification matrix is the single-glance answer to "is the operational audit infrastructure trustworthy?" The wave preserves a mature foundation, advances 4 per-handler surfaces, and explicitly bounds the 3 FRAGMENTED surfaces with named retention/schema-doc closures.

**The audit spine is CERTIFIABLE post-Lock-v2 + recommendations. It is the platform's most defensible operational asset.** Closure depends on documentation discipline (audit-row-schema, retention SLA, deploy runbook), not on additional code.

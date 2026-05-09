# W2-PR7A — Lineage Certification Matrix (Track E)

**Wave:** Wave 2, PR 7A — canonical operational lineage convergence, certification matrix · **Date:** 2026-05-08 · **Status:** matrix only; **NO product code, NO runtime modification, NO merge** · **Authority:** consolidates Tracks A (`w2-pr7a-lineage-topology-map.md`), B (`w2-pr7a-replay-taxonomy-convergence.md`), C (`w2-pr7a-audit-event-convergence.md`), D (`w2-pr7a-denial-lineage-integrity.md`)

This doc consolidates per-lineage-surface certification across the 6 dimensions named in the wave brief: **trace continuity, replay continuity, denial continuity, export continuity, attribution continuity, metadata survivability.**

Each surface is assigned one of:

- 🟢 **CANONICAL** — substrate exists; one canonical path; lexicon-aligned wording available; testable
- 🟡 **PARTIAL** — substrate exists but Lock v2 implementation not yet merged OR documentation deferred
- 🟠 **FRAGMENTED** — substrate exists but lineage breaks at well-defined boundaries (vocabulary, retention, GC)
- 🔴 **DIVERGENT** — multiple parallel substrates / vocabularies coexist with overlapping but non-isomorphic semantics

---

## 1. Surfaces inventoried

The lineage surfaces span 11 distinct artifacts:

| # | Surface | Layer |
|---|---|---|
| **LS1** | `traceId` (in-memory ledger + Postgres metadata) | primitive |
| **LS2** | `correlationId` (Lock v2; web proxy → backend → audit metadata) | primitive (NEW) |
| **LS3** | `payloadHash` (Lock v2 mandate; per-row content fingerprint) | primitive (NEW) |
| **LS4** | `mutationFingerprint` (proposed; not stored) | primitive (proposed) |
| **LS5** | Audit-event vocabulary (`AUDIT_EVENT_TYPES` enum + `AuditCategory` + free-form prisma type) | vocabulary |
| **LS6** | Replay event taxonomy (`IDEMPOTENT_REPLAY` + `CONCURRENCY_GUARD_TRIGGERED` + `<base>.duplicate_request`) | taxonomy |
| **LS7** | Denial-path emission (Step-2+ post-Lock-v2; Step-1 + Step-6 silent by design) | event class |
| **LS8** | SIEM export (`exportAuditPage` / `exportSinceTime` from in-memory ledger) | export |
| **LS9** | Scrapbook bundle (`AuditScrapbook` reading event types) | export |
| **LS10** | Postgres dual-write (`prisma.auditEvent.create`) | persistence |
| **LS11** | Side-effect lineage (SEAL captures, learning, recompute, KPI) | downstream |

---

## 2. The certification matrix

Post-Lock-v2 + recommendations from W2-PR4B/5A/6A/7A.

| # | Surface | Trace continuity | Replay continuity | Denial continuity | Export continuity | Attribution continuity | Metadata survivability | **Aggregate** |
|---|---|---|---|---|---|---|---|---|
| **LS1** `traceId` | 🟡 PARTIAL — within-process strong; cross-row weak; `requireAuditBeforeResponse` API gap | n/a | 🟡 PARTIAL — propagates to denied rows when populated | 🟡 PARTIAL — SIEM stream OK; Postgres direct OK | 🟢 CANONICAL — distinct from actor | 🟡 PARTIAL — JSON-path query | 🟡 **PARTIAL** |
| **LS2** `correlationId` (Lock v2) | n/a (per-attempt, not per-operation) | 🟢 CANONICAL-IN-CONTRACT — one source (proxy); one purpose (replay obs.) | 🟢 CANONICAL-IN-CONTRACT (post-Lock-v2 dedup denial) | 🟡 PARTIAL — DL-8 SIEM gap | 🟢 CANONICAL — actor + correlationId pair | 🟡 PARTIAL — JSON-path | 🟢 **CANONICAL-IN-CONTRACT** |
| **LS3** `payloadHash` | n/a | 🟢 CANONICAL-IN-CONTRACT (post ML-Rec-1) | 🟢 CANONICAL-IN-CONTRACT (post DC-Rec-2 extension) | 🟡 PARTIAL — DL-8 SIEM gap | 🟢 CANONICAL — content-bound | 🟡 PARTIAL — JSON-path | 🟢 **CANONICAL-IN-CONTRACT** |
| **LS4** `mutationFingerprint` (proposed) | n/a | n/a | n/a | n/a | n/a | n/a | 🟠 **NOT YET — proposed** |
| **LS5** Audit-event vocabulary | n/a | n/a | n/a | 🔴 DIVERGENT — 3 parallel vocabularies (Track C) | n/a | 🔴 DIVERGENT — `EMPLOYER_REVIEW_ACCEPTED` (free-form) vs `EMPLOYER_ACCEPTANCE` (canonical) overlap | 🔴 **DIVERGENT** |
| **LS6** Replay event taxonomy | n/a | 🔴 DIVERGENT — `IDEMPOTENT_REPLAY` (canonical) vs `<base>.duplicate_request` (Lock v2); two parallel detection layers | n/a | n/a | n/a | n/a | 🔴 **DIVERGENT** |
| **LS7** Denial-path emission | 🟢 CANONICAL post-Lock-v2 (Step-2+) | 🟢 CANONICAL post-Lock-v2 (correlationId-stamped) | 🟢 CANONICAL post-Lock-v2 | 🟠 FRAGMENTED — DL-8 (SIEM gap for T2 writers) | 🟢 CANONICAL — actorId on every denied row | 🟡 PARTIAL — depends on `audit-row-schema.md` | 🟡 **PARTIAL** |
| **LS8** SIEM export (in-memory) | 🟢 CANONICAL — cursor-based + time-bounded | 🟡 PARTIAL — depends on what's in in-memory | 🟠 FRAGMENTED — T2-writer denials INVISIBLE (DL-8) | 🟢 CANONICAL — paginated streaming | 🟢 CANONICAL | 🟡 PARTIAL — schema doc | 🟠 **FRAGMENTED** |
| **LS9** Scrapbook bundle | 🟠 FRAGMENTED — UNVERIFIED source | UNVERIFIED for Lock v2 denial-path rows | UNVERIFIED | UNVERIFIED | UNVERIFIED | UNVERIFIED | 🟠 **FRAGMENTED** |
| **LS10** Postgres dual-write | 🟢 CANONICAL — Postgres ACID | 🟢 CANONICAL post-Lock-v2 | 🟢 CANONICAL post-Lock-v2 (T2 writes preserved) | 🟢 CANONICAL via Postgres direct query | 🟢 CANONICAL | 🟡 PARTIAL — `metadata` JSON shape rename-fragile | 🟢 **CANONICAL** (with metadata-survivability caveat) |
| **LS11** Side-effect lineage | 🟠 FRAGMENTED — fire-and-forget; no traceId propagation | n/a | n/a — side effects don't fire on denial | 🟠 FRAGMENTED — KPI / SEAL / learning have own stores | n/a | n/a | 🟠 **FRAGMENTED** (intentional) |

---

## 3. Aggregate distribution

| Status | Count | Surfaces |
|---|---|---|
| 🟢 **CANONICAL** | 1 | LS10 Postgres dual-write |
| 🟢 **CANONICAL-IN-CONTRACT** (Lock v2) | 2 | LS2 correlationId, LS3 payloadHash |
| 🟡 **PARTIAL** | 2 | LS1 traceId, LS7 denial-path emission |
| 🟠 **FRAGMENTED** | 4 | LS4 mutationFingerprint (proposed), LS8 SIEM export, LS9 scrapbook, LS11 side-effect |
| 🔴 **DIVERGENT** | 2 | LS5 audit-event vocabulary, LS6 replay event taxonomy |
| **TOTAL** | **11** | |

The 2 DIVERGENT surfaces are the headline: 3 audit-event vocabularies + 2 replay taxonomies coexist. Convergence is doc-level (vocabulary-map publication) — does NOT require code changes.

The 4 FRAGMENTED surfaces have substrate but break at well-defined boundaries (proposed-but-not-implemented, SIEM source coverage, scrapbook UNVERIFIED, side-effect intentional fire-and-forget).

The 5 CANONICAL/PARTIAL surfaces are the strongest — they advance to fully CANONICAL with the recommendations + Lock v2 implementation.

---

## 4. Per-dimension aggregate

### 4.1 Trace continuity

| Status | Count | Notes |
|---|---|---|
| 🟢 CANONICAL | 2 | LS8 SIEM (cursor-based), LS10 Postgres |
| 🟡 PARTIAL | 2 | LS1 traceId, LS7 denial-path |
| 🟠 FRAGMENTED | 2 | LS9 scrapbook (UNVERIFIED), LS11 side-effect |
| n/a | 5 |

### 4.2 Replay continuity

| Status | Count | Notes |
|---|---|---|
| 🟢 CANONICAL-IN-CONTRACT | 2 | LS2 correlationId, LS3 payloadHash, LS7 |
| 🟡 PARTIAL | 1 | LS8 SIEM (depends on coverage) |
| 🔴 DIVERGENT | 1 | LS6 replay event taxonomy |

### 4.3 Denial continuity

| Status | Count | Notes |
|---|---|---|
| 🟢 CANONICAL post-Lock-v2 | 3 | LS2, LS3, LS7 |
| 🟠 FRAGMENTED | 2 | LS8 (DL-8 gap), LS9 |
| n/a | rest |

### 4.4 Export continuity

| Status | Count | Notes |
|---|---|---|
| 🟢 CANONICAL | 2 | LS8 cursor-based, LS10 Postgres direct |
| 🟠 FRAGMENTED | 3 | LS7 (DL-8), LS9 (UNVERIFIED), LS11 (separate stores) |
| 🔴 DIVERGENT | 1 | LS5 |

### 4.5 Attribution continuity

| Status | Count | Notes |
|---|---|---|
| 🟢 CANONICAL | 5 | LS1, LS2, LS3, LS7, LS10 |
| n/a | rest (vocabularies, exports, side-effects) |

### 4.6 Metadata survivability

| Status | Count | Notes |
|---|---|---|
| 🟡 PARTIAL | 5 | All metadata-bearing surfaces; depends on `audit-row-schema.md` |
| 🔴 DIVERGENT | 2 | LS5, LS6 — vocabulary + taxonomy fragmentations |

---

## 5. Convergence priorities

The matrix surfaces a clear priority order:

| Priority | Action | Closes |
|---|---|---|
| **P0** | Publish `audit-event-vocabulary-map.md` (LT-Rec-1, AC-Rec-1) | Closes LS5 DIVERGENT → PARTIAL |
| **P0** | Publish `replay-taxonomy-map.md` (RT-Rec-1) | Closes LS6 DIVERGENT → PARTIAL |
| **P1** | Mandate payloadHash on denied rows (DC-Rec-2 / DL-Rec-5) | Strengthens LS3 + LS7 |
| **P1** | Address DL-8 SIEM gap (DL-Rec-1) | Closes LS7 + LS8 FRAGMENTED → CANONICAL |
| **P1** | Publish `audit-row-schema.md` (TS-Rec-1, AC-Rec-2) | Strengthens metadata survivability across all surfaces |
| **P2** | Add traceId to `requireAuditBeforeResponse` (LT-Rec-2 / AC-Rec-6) | Closes LS1 PARTIAL → CANONICAL |
| **P2** | Verify scrapbook source coverage (LT-Rec-4 / AC-Rec-5) | Closes LS9 FRAGMENTED |
| **P3** | Add `mutationFingerprint` field (LT-Rec-3) | Adds LS4 |

When P0+P1+P2 land (all doc-level + minor API), the lineage matrix advances substantially.

---

## 6. Convergence delta — Pre-Lock-v2 vs Post-Lock-v2 + recommendations

| Surface | Pre-Lock-v2 aggregate | Post-Lock-v2 + recs aggregate | Δ |
|---|---|---|---|
| LS1 traceId | 🟡 PARTIAL | 🟡 PARTIAL → 🟢 CANONICAL with LT-Rec-2 | improved |
| LS2 correlationId | 🔴 DOES NOT EXIST | 🟢 CANONICAL-IN-CONTRACT | introduced |
| LS3 payloadHash | 🟠 FRAGMENTED — inconsistent | 🟢 CANONICAL-IN-CONTRACT (with mandate) | improved |
| LS4 mutationFingerprint | 🔴 DOES NOT EXIST | 🟠 PROPOSED | proposal |
| LS5 audit-event vocabulary | 🔴 DIVERGENT | 🔴 DIVERGENT → 🟡 PARTIAL with vocabulary-map | partial improvement (doc) |
| LS6 replay event taxonomy | 🔴 DIVERGENT | 🔴 DIVERGENT → 🟡 PARTIAL with taxonomy-map | partial improvement (doc) |
| LS7 denial-path emission | 🔴 PRE-LOCK-V2 ZERO | 🟡 PARTIAL → 🟢 CANONICAL post-Lock-v2 | major improvement |
| LS8 SIEM export | 🟠 FRAGMENTED — coverage gap | 🟠 FRAGMENTED → 🟢 CANONICAL with DL-Rec-1 | conditional improvement |
| LS9 scrapbook | 🟠 FRAGMENTED — UNVERIFIED | 🟠 UNCHANGED until source verified | unchanged |
| LS10 Postgres dual-write | 🟢 CANONICAL | 🟢 CANONICAL | unchanged |
| LS11 side-effect | 🟠 FRAGMENTED (intentional) | 🟠 UNCHANGED (intentional) | unchanged |

**Delta summary:**
- 1 surface introduced (LS2).
- 1 surface proposed (LS4).
- 4 surfaces improve (LS1, LS3, LS7, LS8) post-Lock-v2 + recommendations.
- 2 surfaces convert DIVERGENT → PARTIAL with doc publication (LS5, LS6).
- 2 surfaces unchanged (LS9 UNVERIFIED, LS11 intentional fragmentation).
- 1 surface preserved CANONICAL (LS10).

**Net:** the wave moves the lineage matrix from "pervasively fragmented + divergent" to "mostly canonical + 2 documented divergences."

---

## 7. Track E determination

| Question | Answer |
|---|---|
| Are CANONICAL lineage surfaces present today? | YES — LS10 Postgres dual-write |
| Does Lock v2 introduce new CANONICAL-IN-CONTRACT surfaces? | YES — LS2 correlationId, LS3 payloadHash |
| Are DIVERGENT surfaces convertible to CANONICAL with documentation? | PARTIALLY — vocabulary + taxonomy maps make them PARTIAL; full convergence requires deprecation |
| Are FRAGMENTED surfaces convertible to CANONICAL with named follow-ups? | YES — DL-Rec-1 (SIEM gap) + AC-Rec-5 (scrapbook source) |
| Are intentional fragmentations explicitly disclosed? | YES — LS11 side-effects, LS7 Step-1/Step-6 silent gaps |

**Track E classification:** 🟡 **PARTIAL — CANONICAL-IN-CONTRACT for the post-Lock-v2 + recommendations transition; CANONICAL-IN-IMPLEMENTATION pending vocabulary-map publication + DL-Rec-1 SIEM coverage + scrapbook source verification.**

---

## 8. Closing principle (Track E)

The lineage certification matrix shows that the platform has rich operational lineage primitives but uses them across MULTIPLE PARALLEL VOCABULARIES + 4 FRAGMENTED export surfaces + 2 INTENTIONAL silent gaps + 1 DIVERGENT taxonomy.

**Convergence is achievable doc-level. The wave's contribution to canonical lineage is real (LS2, LS3, LS7) but does NOT eliminate the divergence at LS5 + LS6 — those require deprecation / mapping decisions that touch frozen YC MVP code.**

The matrix is honest. The wave is genuinely advancing the lineage posture. The remaining DIVERGENCES are documented + scoped + addressable. The platform is **canonical-in-segments, divergent-by-vocabulary, fragmented-at-export-edges** — and explicitly so.

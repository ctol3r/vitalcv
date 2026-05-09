# Operational Guarantee Matrix

**Status:** **OPERATIONAL** — frozen reference for VitalCV per-guarantee strength · **Date established:** 2026-05-08 · **Authority:** subordinate to `trust-class-taxonomy.md`, `runtime-trust-class-map.md`, `trust-boundary-clarification.md`, `TRUST_GUARANTEE_LEXICON.md`

This doc consolidates the platform's operational guarantees into a single-glance matrix across 6 dimensions × 5 trust classes. Each cell is assigned 🟢 STRONG / 🟡 PARTIAL / 🟠 WEAK / 🔴 FRAGILE.

---

## 1. The guarantee matrix

| Guarantee | C-1 (Transactional canonical) | C-2 (Cosmetic transactional) | T0 (Fire-and-forget eventual) | R0 (Replay-instrumentation) | D0 (Denial-instrumentation) |
|---|---|---|---|---|---|
| **Replay visibility** | 🟢 STRONG (correlationId stamped) | 🟡 PARTIAL (correlationId; share-packet retry mints fresh token) | 🟠 WEAK (no Lock v2 path) | 🟢 STRONG by definition | 🟢 STRONG post-Lock-v2 (replay denials emit) |
| **Replay durability** | 🟡 PARTIAL (best-effort dedup; TOCTOU race; DB UNIQUE deferred to MIG-A) | 🟠 WEAK (audit-as-persistence; share token fresh per retry) | 🔴 FRAGILE (T0 dual-write race) | 🟡 PARTIAL (within retention) | 🟡 PARTIAL (within retention) |
| **Audit durability** | 🟢 STRONG (Postgres ACID) | 🟢 STRONG (Postgres ACID) | 🟠 WEAK (in-memory + best-effort Postgres) | 🟢 STRONG (Postgres) | 🟢 STRONG (Postgres) |
| **Attribution durability** | 🟢 STRONG (within scope of T2 topology) | 🟢 STRONG (same) | 🟠 WEAK (in-memory volatile) | 🟢 STRONG | 🟢 STRONG |
| **Export durability** | 🟡 PARTIAL (EX-3 STRONG; EX-1/EX-2 FRAGMENTED via DL-8) | 🟡 PARTIAL (same) | 🟡 PARTIAL (SIEM stream covers in-memory; Postgres partial coverage on T0 fail) | 🟡 PARTIAL (R0-Canonical via SIEM; R0-Lock-v2 only via EX-3) | 🟡 PARTIAL (EX-3 STRONG; SIEM gap) |
| **Forensic durability** | 🟡 PARTIAL (DEPENDS on retention SLA — gate G7) | 🟠 WEAK (audit-as-persistence; retention DIRECTLY affects token TTL) | 🟠 WEAK (T0 partial-write states; in-memory loss) | 🟡 PARTIAL (within retention) | 🟡 PARTIAL |

---

## 2. Per-class aggregate

| Class | STRONG count | PARTIAL count | WEAK count | FRAGILE count | **Aggregate strength** |
|---|---|---|---|---|---|
| C-1 | 4 | 2 | 0 | 0 | 🟢 **STRONG** |
| C-2 | 2 | 3 | 1 | 0 | 🟡 **PARTIAL** |
| T0 | 0 | 1 | 4 | 1 | 🟠 **WEAK** |
| R0 | 4 | 2 | 0 | 0 | 🟢 **STRONG** (within observability scope) |
| D0 | 4 | 2 | 0 | 0 | 🟢 **STRONG** post-Lock-v2 |

---

## 3. Per-dimension aggregate

| Dimension | C-1 | C-2 | T0 | R0 | D0 | **Aggregate** |
|---|---|---|---|---|---|---|
| Replay visibility | 🟢 | 🟡 | 🟠 | 🟢 | 🟢 | 🟡 PARTIAL |
| Replay durability | 🟡 | 🟠 | 🔴 | 🟡 | 🟡 | 🟠 WEAK |
| Audit durability | 🟢 | 🟢 | 🟠 | 🟢 | 🟢 | 🟢 STRONG (T0 outlier) |
| Attribution durability | 🟢 | 🟢 | 🟠 | 🟢 | 🟢 | 🟢 STRONG (T0 outlier) |
| Export durability | 🟡 | 🟡 | 🟡 | 🟡 | 🟡 | 🟡 PARTIAL universally (DL-8 SIEM gap) |
| Forensic durability | 🟡 | 🟠 | 🟠 | 🟡 | 🟡 | 🟡 PARTIAL — DEPENDS on retention SLA |

---

## 4. Cross-cutting findings

### 4.1 Replay durability is the WEAKEST dimension

🟠 WEAK aggregate. T0 is FRAGILE. Even C-1 is PARTIAL because DB-UNIQUE-enforced replay prevention is deferred to MIG-A. Until then: best-effort dedup with TOCTOU race.

Mitigations: ML-Rec-1 (payloadHash mandate) for forensic detection; MIG-A schema migration for prevention.

### 4.2 Audit + Attribution durability are STRONG (with T0 outlier)

C-1, C-2, R0, D0 all 🟢 STRONG via Postgres ACID. T0 fire-and-forget is the single weak point — wave's 6 in-scope handlers DO NOT use T0, so the wave's surfaces are uniformly STRONG on these dimensions.

### 4.3 Export durability is universally PARTIAL

🟡 PARTIAL across ALL classes because of DL-8 SIEM coverage gap. EX-3 Postgres direct is the canonical fallback. Mit-2 (SIEM source extension to Postgres) closes structurally.

### 4.4 Forensic durability is universally PARTIAL — bounded by retention SLA

🟡 PARTIAL across all classes. The single most consequential operational gap. Gate G7 (retention SLA formalization) closes.

### 4.5 The 5 classes are NOT substitutable

Per `trust-class-taxonomy.md` §9 + this matrix: T0 is WEAK on 4 of 6 dimensions; C-1 is STRONG on 4 of 6. Treating T0 as C-1 is the dominant operator-assumption hazard.

---

## 5. Per-handler guarantee profile (wave-scope)

| Handler | Replay vis | Replay dur | Audit dur | Attribution dur | Export dur | Forensic dur | **Aggregate** |
|---|---|---|---|---|---|---|---|
| `accept` (C-1) | 🟢 STRONG | 🟡 PARTIAL | 🟢 STRONG | 🟢 STRONG | 🟡 PARTIAL | 🟡 PARTIAL | 🟢 **STRONG** |
| `confirm-start` (C-1) | 🟢 STRONG | 🟡 PARTIAL (deprecation window) | 🟢 STRONG | 🟢 STRONG | 🟡 PARTIAL | 🟡 PARTIAL | 🟢 **STRONG** |
| `request-refresh` (C-1) | 🟢 STRONG | 🟡 PARTIAL | 🟢 STRONG | 🟢 STRONG | 🟡 PARTIAL | 🟡 PARTIAL | 🟢 **STRONG** |
| `route-to-review` (C-1) | 🟢 STRONG | 🟡 PARTIAL | 🟢 STRONG | 🟢 STRONG | 🟡 PARTIAL | 🟡 PARTIAL | 🟢 **STRONG** |
| `share-packet` (C-2) | 🟡 PARTIAL | 🟠 WEAK | 🟢 STRONG (audit IS persistence) | 🟢 STRONG | 🟡 PARTIAL | 🟠 WEAK (token TTL bounded by retention) | 🟡 **PARTIAL** |
| `packet` (C-2) | 🟡 PARTIAL | 🟡 PARTIAL | 🟢 STRONG | 🟢 STRONG | 🟡 PARTIAL | 🟡 PARTIAL | 🟡 **PARTIAL** |

---

## 6. Forbidden upgrades

The following upgrades are FORBIDDEN by lexicon:

| Forbidden upgrade | Lexicon-aligned alternative |
|---|---|
| 🟢 STRONG → "guaranteed" | Use "STRONG within scope of <substrate>" |
| 🟡 PARTIAL → "guaranteed within reasonable conditions" | Use "PARTIAL — bounded by <condition>" |
| 🟠 WEAK → "best-effort but reliable" | Use "WEAK — fire-and-forget; partial-write states exist" |
| 🔴 FRAGILE → "reliable in normal operation" | Use "FRAGILE — partial-write race exists by design" |
| Audit durability "L2" → "tamper-proof" | Forbidden per lexicon §1.5; use "tamper-evident given DB integrity" |
| Replay durability "best-effort dedup" → "replay-protected" | Forbidden per lexicon §1.3 |
| Attribution durability "STRONG" → "non-repudiable" | Forbidden per lexicon §1.1 |

---

## 7. Recommendations

| # | Recommendation | Priority |
|---|---|---|
| **OG-Rec-1** | Adopt this matrix as part of operational runbook | HIGH |
| **OG-Rec-2** | Dashboard widgets label per-handler guarantee profile (per §5) | MEDIUM |
| **OG-Rec-3** | Codex audit prompt verifies wave PRs use lexicon-aligned strength wording | HIGH |
| **OG-Rec-4** | Per-guarantee improvement priorities: replay durability (MIG-A) → forensic durability (G7 retention SLA) → export durability (Mit-2 SIEM source change) | MEDIUM |

---

## 8. Closing principle (operational guarantee matrix)

The matrix is the single-glance answer to "how strong is each guarantee for each runtime path?" The platform's strongest guarantees are at L2 audit durability for C-1/C-2/R0/D0. The weakest is replay durability across all classes. The wave's 6 in-scope handlers split 4-STRONG (C-1) + 2-PARTIAL (C-2) on aggregate.

**The matrix prevents inflation. It also prevents understatement. The platform delivers exactly what the matrix shows — no more, no less.**

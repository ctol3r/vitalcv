# W2-PR9A — Async Export Survivability (Track D)

**Wave:** Wave 2, PR 9A — operational failure survivability certification, export track · **Date:** 2026-05-08 · **Status:** survivability analysis only; **NO product code, NO runtime modification, NO merge** · **Authority:** subordinate to `export-query-cohesion.md`, `w2-pr6a-trace-survivability.md`, `w2-pr7a-audit-event-convergence.md`

This doc determines whether **SIEM exports, forensic exports, lineage exports, and denial exports** remain canonical, attributable, replay-coherent, and operationally survivable under degraded conditions.

The central thesis: **export survivability is FRAGMENTED — EX-3 Postgres direct is most resilient; EX-1/EX-2 SIEM streams are degradation-vulnerable; EX-4 scrapbook is UNVERIFIED.** Per `TRUST_GUARANTEE_LEXICON.md` non-negotiable rule #3: "export survivability is NOT immutability."

---

## 1. The 4 export paths under degraded conditions

Per `export-query-cohesion.md` §1:

| Path | Source | Degradation profile |
|---|---|---|
| EX-1 SIEM cursor | In-memory ledger | LOSES T2-direct-writer rows; loses entries on process restart before dual-write |
| EX-2 SIEM time-bounded | Same | Same |
| EX-3 Postgres direct | DB | RESILIENT — Postgres ACID; degrades only under DB outage / retention sweep / migration |
| EX-4 Scrapbook bundle | UNVERIFIED | UNVERIFIED — depends on bundle source coverage |

---

## 2. Per-export × per-condition matrix

| Export type | DC-1 retry | DC-2 async lag | DC-3 dup storm | DC-4 denial regression | DC-5 process restart | EX paths affected |
|---|---|---|---|---|---|---|
| **SIEM real-time stream** | 🟢 R | 🟢 R | 🟢 R (bursts) | 🟡 P (denials missing) | 🟠 F (T0 dual-write window) | EX-1/EX-2 |
| **Forensic export** | 🟢 R | 🟢 R | 🟢 R | 🟡 P (denial gap survives in EX-3) | 🟢 R (Postgres) | EX-3 |
| **Lineage export** | 🟢 R | 🟢 R | 🟢 R | 🟡 P | 🟢 R | EX-3 |
| **Denial export** | 🟢 R | 🟢 R | 🟢 R | 🔴 C if regression | 🟢 R | EX-3 |
| **Scrapbook bundle** | UNVERIFIED on every dimension | | | | | EX-4 |

---

## 3. Export drift modes

### 3.1 ED-1 — SIEM stream loses T2 writer rows

**Cause:** SIEM streams from in-memory ledger (`exportAuditPage`); T2 direct writers bypass the in-memory ledger (DL-8 from `w2-pr6a-denial-path-certification.md`).

**Effect:** SIEM consumer sees ~50% of audit-row population for the wave's 6 in-scope handlers post-Lock-v2.

**Severity:** HIGH — operational SOC may form false belief about denial volume.

**Mitigation:** documented per Mit-3 in `export-query-cohesion.md` §3.3; long-term Mit-2 (SIEM source extended to Postgres) is the structural fix.

### 3.2 ED-2 — Audit retention sweep mid-export

**Cause:** Forensic export reads Postgres while retention sweep deletes old rows.

**Effect:** Export sees inconsistent row count between page 1 and page N.

**Severity:** MEDIUM — bounded by retention SLA + sweep frequency.

**Mitigation:** snapshot-based reads OR repeatable-read isolation OR retention SLA respecting export windows.

### 3.3 ED-3 — Schema migration in flight

**Cause:** Schema change (e.g., `metadata.employerId` → `metadata.actorId`) lands while export queries still use old field.

**Effect:** Old queries silently miss new rows; new queries miss old rows.

**Severity:** MEDIUM — bounded by deprecation timeline + carry-both-fields window.

**Mitigation:** explicit deprecation timeline + dual-field support window per ML-Rec-2.

### 3.4 ED-4 — Cursor pagination races concurrent writes

**Cause:** SIEM consumer paginates from cursor C; new writes after cursor advance are not in current page.

**Effect:** Eventually-consistent SIEM stream; new rows surface in next page.

**Severity:** LOW — standard cursor-pagination semantics; SIEM consumer expected to handle.

### 3.5 ED-5 — Multi-region export divergence (future)

**Cause:** Multi-region deploy with eventual-consistent audit replication.

**Effect:** Different regions return different export results.

**Severity:** N/A today (single-region); future-wave concern.

---

## 4. Delayed lineage scenarios

Lineage export expects to find ALL events for a logical operation (chain reconstruction by `traceId` or `referenceId`). Under degraded conditions:

| Scenario | Effect |
|---|---|
| **DL-1** Async-side-effect commits LATER than expected | Side-effect-emitted audit row appears later in chain; chain reconstruction at time T misses it |
| **DL-2** Worker-processed outbox event commits LATER | Same |
| **DL-3** Webhook-callback audit row commits LATER | Same — webhook may lag minutes/hours |
| **DL-4** SEAL/learning capture commits LATER (or never) | Side-effect intentionally fire-and-forget; chain reconstruction may show "permitted" but no SEAL completion |

**Track D finding ES-1:** delayed-lineage scenarios are operationally-tolerable (eventually-consistent chain reconstruction) IF the export query allows for staging delay. Real-time forensic queries against the most recent N seconds may see incomplete chains.

---

## 5. Export fragmentation

| # | Fragmentation | Cause |
|---|---|---|
| **EF-1** | T2-direct-writer rows in Postgres but NOT in SIEM stream | DL-8 |
| **EF-2** | T0 fire-and-forget rows in in-memory ledger but NOT in Postgres | T0 dual-write failure |
| **EF-3** | Pre-Lock-v2 rows lack `metadata.outcome` field | Schema-evolution drift |
| **EF-4** | Scrapbook bundle source coverage UNVERIFIED | LT-Rec-4 / AC-Rec-5 not closed |
| **EF-5** | Side-effect-emitted rows in different store (KPI, learning) — not in audit table at all | Cross-store fragmentation |
| **EF-6** | Web-layer access logs (denied pre-auth requests) in different store entirely | Cross-store fragmentation |

**Track D finding ES-2:** export fragmentation is per-source. EX-3 Postgres direct has the highest coverage of audit-table rows; EX-1/EX-2 have less; EX-4 unknown; cross-store concerns require operator awareness of multiple stores.

---

## 6. Replay-export mismatch

Per `export-query-cohesion.md` §3.1, the SIEM stream misses T2-direct-writer rows. For replay events:

| Replay event source | EX-1 SIEM | EX-3 Postgres |
|---|---|---|
| `IDEMPOTENT_REPLAY` (canonical, T0/T1 path) | YES | YES |
| `CONCURRENCY_GUARD_TRIGGERED` (canonical, T0/T1 path) | YES | YES |
| `<base>.duplicate_request` (Lock v2 T2 direct) | **NO** | YES |
| `<base>.already_accepted` (Lock v2 T2 direct) | **NO** | YES |

**Track D finding ES-3:** SIEM-based replay analysis MISSES Lock v2 denied-replay events. Operators monitoring SIEM for replay trends form an INCOMPLETE picture. Postgres direct (EX-3) is the canonical source for Lock v2 replay observability.

---

## 7. Per-export-type survivability classification

### 7.1 SIEM exports (EX-1, EX-2)

| Property | Status |
|---|---|
| Canonical (lossless) | 🟠 FRAGMENTED — DL-8 SIEM coverage gap |
| Attributable | 🟢 RESILIENT — actor in metadata |
| Replay-coherent | 🟠 FRAGMENTED — Lock v2 denied-replay missing |
| Operationally survivable (under degraded conditions) | 🟡 PARTIAL — process restart loses in-memory window |

**Aggregate (EX-1/EX-2):** 🟠 **FRAGMENTED — useful for streaming + ops monitoring but NOT canonical for forensics.**

### 7.2 Forensic exports (EX-3)

| Property | Status |
|---|---|
| Canonical | 🟢 RESILIENT — full Postgres coverage |
| Attributable | 🟢 RESILIENT |
| Replay-coherent | 🟢 RESILIENT post-Lock-v2 |
| Operationally survivable | 🟢 RESILIENT — Postgres ACID; degrades only under DB outage / retention / migration |

**Aggregate (EX-3):** 🟢 **RESILIENT — canonical forensic source.**

### 7.3 Lineage exports

Cross-row chain reconstruction (per Q-CANON-6 / Q-CANON-8 from `canonical-query-model.md` §4):

| Property | Status |
|---|---|
| Canonical | 🟢 RESILIENT via EX-3 |
| Attributable | 🟢 RESILIENT |
| Replay-coherent | 🟡 PARTIAL — chain may include replay rows; operator must classify |
| Operationally survivable | 🟢 RESILIENT — Postgres + multi-vocabulary OR-clauses |

**Aggregate (lineage):** 🟢 **RESILIENT via EX-3.**

### 7.4 Denial exports

| Property | Status |
|---|---|
| Canonical (post-Lock-v2 + DC-Rec-2) | 🟢 RESILIENT via EX-3 |
| Attributable | 🟢 RESILIENT |
| Replay-coherent | 🟢 RESILIENT |
| Operationally survivable | 🟡 PARTIAL — DC-4 regression is the dominant risk |

**Aggregate (denial):** 🟡 **PARTIAL — RESILIENT under normal operation; COLLAPSE-PRONE under DC-4 regression.**

### 7.5 Scrapbook exports (EX-4)

| Property | Status |
|---|---|
| All dimensions | 🟠 UNVERIFIED |

**Aggregate (EX-4):** 🟠 **UNVERIFIED — inspection deferred.**

---

## 8. Export survivability recommendations

| # | Recommendation | Priority |
|---|---|---|
| **ES-Rec-1** | Document EX-3 Postgres direct as canonical for forensics in operational runbook | HIGH |
| **ES-Rec-2** | Document SIEM coverage gap (DL-8) prominently in SOC playbooks | HIGH |
| **ES-Rec-3** | Long-term: extend SIEM source to Postgres direct (Mit-2) to close EX-1/EX-2 gap structurally | MEDIUM |
| **ES-Rec-4** | Verify EX-4 scrapbook source coverage (closes LT-Rec-4 / AC-Rec-5) | MEDIUM |
| **ES-Rec-5** | Operational alerting on retention sweep + schema migration timing | MEDIUM |
| **ES-Rec-6** | Document delayed-lineage scenarios (DL-1..DL-4) in operational runbook | MEDIUM |
| **ES-Rec-7** | Cross-store export coordination (audit + KPI + learning) — define which store answers which forensic question | LOW |

---

## 9. Track D determination

| Question | Answer |
|---|---|
| Are SIEM exports canonical? | NO — 🟠 FRAGMENTED (DL-8) |
| Are forensic exports (EX-3) canonical? | YES — 🟢 RESILIENT |
| Are lineage exports survivable? | YES via EX-3 |
| Are denial exports survivable? | YES via EX-3; 🔴 COLLAPSE-PRONE under DC-4 |
| Is replay-export coherent across paths? | NO — SIEM misses Lock v2 denied-replay (EF-1, ES-3) |
| Are export drift modes enumerated? | YES — 5 (ED-1..ED-5) |
| Are delayed-lineage scenarios enumerated? | YES — 4 (DL-1..DL-4) |
| Are export fragmentations enumerated? | YES — 6 (EF-1..EF-6) |

**Track D classification:** 🟡 **PARTIAL — RESILIENT for EX-3 forensic + lineage + denial exports; FRAGMENTED for EX-1/EX-2 SIEM streams; UNVERIFIED for EX-4 scrapbook.**

---

## 10. Closing principle (Track D)

Export survivability is the discipline of declaring which export path is canonical for which forensic intent, and bounding what each path can claim. EX-3 Postgres direct is the workhorse. EX-1/EX-2 SIEM streams are degradation-prone for the wave's T2-direct-writer surface. EX-4 scrapbook is unverified.

**Exports survive degradation IF: (a) operators query EX-3 for forensics, (b) SOC playbooks document the SIEM coverage gap, (c) DC-4 regression is detected via dashboard alerting, (d) scrapbook source coverage is verified.** The wave's contribution is enumeration; the durable mitigation is documentation discipline + per-intent path-discipline.

**Export survivability verdict:** 🟡 **CANONICAL for EX-3; FRAGMENTED for EX-1/EX-2; UNVERIFIED for EX-4.**

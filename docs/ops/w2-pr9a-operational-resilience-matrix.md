# W2-PR9A — Operational Resilience Matrix (Track E)

**Wave:** Wave 2, PR 9A — operational failure survivability certification, resilience matrix · **Date:** 2026-05-08 · **Status:** matrix only; **NO product code, NO runtime modification, NO merge** · **Authority:** consolidates Tracks A (`w2-pr9a-partial-write-survivability.md`), B (`w2-pr9a-correlation-collapse.md`), C (`w2-pr9a-replay-survivability.md`), D (`w2-pr9a-export-survivability.md`)

This doc consolidates per-failure-condition certification across the 5 dimensions: **attribution survivability, replay survivability, denial survivability, export survivability, lineage continuity.**

Each cell is assigned one of:

- 🟢 **RESILIENT** — survives the failure mode without degradation
- 🟡 **DEGRADED** — survives but with reduced fidelity / coverage / clarity
- 🟠 **FRAGMENTED** — survives only on some paths; partial loss
- 🔴 **COLLAPSED** — fails to survive

---

## 1. Failure conditions inventoried

10 distinct degraded conditions consolidated from prior tracks:

| # | Failure condition | Source |
|---|---|---|
| **F-1** | Network retry storm (single client) | Track C DC-1 |
| **F-2** | Async lag (worker / side-effect delay) | Track C DC-2 |
| **F-3** | Duplicate submission storm (concurrent) | Track C DC-3 |
| **F-4** | Denial regression (DC-4) | Tracks C+D |
| **F-5** | Process restart mid-flight (DC-5) | Track C |
| **F-6** | T0 fire-and-forget DB write fails | Track A PW-5 |
| **F-7** | C-2 audit-vs-delivery divergence (PW-3) | Track A |
| **F-8** | Outbox worker silent failure (PW-7) | Track A |
| **F-9** | Audit retention sweep mid-export | Track D ED-2 |
| **F-10** | Schema migration in flight | Track D ED-3 |
| **F-11** | T2 topology breach (forged x-clerk-user-id) | Tracks A+D from prior waves |
| **F-12** | Clerk degradation | Tracks B+C |

---

## 2. The resilience matrix

| Failure condition | Attribution | Replay | Denial | Export | Lineage continuity | **Aggregate** |
|---|---|---|---|---|---|---|
| **F-1** Network retry storm | 🟢 R | 🟢 R observability | 🟢 R | 🟢 R via EX-3 | 🟢 R | 🟢 **RESILIENT** |
| **F-2** Async lag | 🟢 R | 🟢 R | 🟢 R | 🟢 R | 🟡 D (delayed-lineage DL-1..4) | 🟡 **DEGRADED** |
| **F-3** Duplicate submission storm | 🟢 R | 🟡 D (TOCTOU) / 🟠 F (share-packet) | 🟢 R | 🟢 R via EX-3 | 🟡 D | 🟡 **DEGRADED** |
| **F-4** Denial regression (DC-4) | 🔴 C (no row) | 🔴 C (denied-replay invisible) | 🔴 C | 🔴 C (zero denial rows) | 🔴 C | 🔴 **COLLAPSED** |
| **F-5** Process restart mid-flight | 🟡 D (T0 in-memory volatile) | 🟡 D | 🟡 D | 🟠 F (T0 dual-write window) | 🟡 D | 🟡 **DEGRADED** |
| **F-6** T0 dual-write DB fails | 🟠 F (in-memory has; Postgres doesn't) | 🟠 F | 🟠 F | 🟠 F (SIEM has; Postgres doesn't) | 🟠 F | 🟠 **FRAGMENTED** |
| **F-7** C-2 audit-vs-delivery divergence | 🟢 R (audit persists) | 🟢 R | 🟢 R | 🟢 R via EX-3 | 🟠 F (delivery state unknown) | 🟠 **FRAGMENTED** |
| **F-8** Outbox worker silent failure | 🟢 R (outbox row persists) | n/a | n/a | n/a | 🟠 F (downstream effects missing) | 🟠 **FRAGMENTED** |
| **F-9** Audit retention sweep mid-export | 🟢 R (retained rows) | 🟡 D (older replay context lost) | 🟡 D | 🟡 D (page-inconsistency) | 🟠 F (chain may be truncated) | 🟡 **DEGRADED** |
| **F-10** Schema migration in flight | 🟡 D (field rename window) | 🟡 D | 🟡 D | 🟡 D | 🟡 D | 🟡 **DEGRADED** |
| **F-11** T2 topology breach | 🔴 C (forged actorId silently legitimate) | 🟡 D (correlationId still works) | 🟡 D | 🟢 R (audit captures forged identity) | 🟡 D | 🟠 **FRAGMENTED** |
| **F-12** Clerk degradation | 🟢 R via fail-closed | 🟢 R (no requests reach backend) | 🟢 R (503 emitted) | 🟢 R | 🟢 R (no chains to continue) | 🟢 **RESILIENT** |

---

## 3. Aggregate distribution

| Status | Count | Failure conditions |
|---|---|---|
| 🟢 **RESILIENT** | 2 | F-1 (retry storm), F-12 (Clerk degradation) |
| 🟡 **DEGRADED** | 5 | F-2 (async lag), F-3 (duplicate storm), F-5 (process restart), F-9 (retention sweep), F-10 (schema migration) |
| 🟠 **FRAGMENTED** | 4 | F-6 (T0 DB fail), F-7 (C-2 delivery), F-8 (outbox worker), F-11 (T2 topology breach) |
| 🔴 **COLLAPSED** | 1 | F-4 (denial regression DC-4) |
| **TOTAL** | **12** | |

**Headline:** the platform survives the dominant operational failure modes with degraded but useful fidelity. Only F-4 (denial regression) is COLLAPSE-prone — and that is mitigatable via test coverage + dashboard alerting (RS-Rec-1 + RS-Rec-2).

---

## 4. Per-dimension aggregate

### 4.1 Attribution survivability

| Status | Count |
|---|---|
| 🟢 RESILIENT | 7 |
| 🟡 DEGRADED | 2 |
| 🟠 FRAGMENTED | 1 |
| 🔴 COLLAPSED | 2 (F-4, F-11) |

**Aggregate:** 🟢 STRONG. Vulnerable to F-4 denial regression + F-11 topology breach.

### 4.2 Replay survivability

| Status | Count |
|---|---|
| 🟢 RESILIENT | 5 |
| 🟡 DEGRADED | 4 |
| 🟠 FRAGMENTED | 2 |
| 🔴 COLLAPSED | 1 (F-4) |

**Aggregate:** 🟡 DEGRADED. Strong observability under most conditions; COLLAPSE-prone under F-4.

### 4.3 Denial survivability

| Status | Count |
|---|---|
| 🟢 RESILIENT | 5 |
| 🟡 DEGRADED | 4 |
| 🟠 FRAGMENTED | 2 |
| 🔴 COLLAPSED | 1 (F-4) |

**Aggregate:** 🟡 DEGRADED. Same profile as replay.

### 4.4 Export survivability

| Status | Count |
|---|---|
| 🟢 RESILIENT | 7 |
| 🟡 DEGRADED | 2 |
| 🟠 FRAGMENTED | 2 |
| 🔴 COLLAPSED | 1 (F-4) |

**Aggregate:** 🟢 STRONG via EX-3 Postgres direct.

### 4.5 Lineage continuity

| Status | Count |
|---|---|
| 🟢 RESILIENT | 3 |
| 🟡 DEGRADED | 4 |
| 🟠 FRAGMENTED | 4 |
| 🔴 COLLAPSED | 1 (F-4) |

**Aggregate:** 🟡 DEGRADED. Most-fragmented dimension; depends on chain reconstruction across rows.

---

## 5. Cross-cutting findings

### 5.1 The dominant collapse risk is F-4 (denial regression)

If implementation regresses to drop denied-row emission on any path, ALL 5 dimensions COLLAPSE for that path. Mitigation: test coverage + dashboard alerting (denial-rate variance alarm) per RS-Rec-1 + RS-Rec-2.

### 5.2 The dominant FRAGMENTED risks are T0 fire-and-forget + C-2 delivery + topology breach

- F-6 T0 DB fail: avoid T0 for canonical events.
- F-7 C-2 delivery: document audit-vs-delivery divergence; consider response-delivery telemetry.
- F-11 T2 topology breach: deploy-time runbook + network-topology assertion.

### 5.3 The dominant DEGRADED risks are operational

- F-2 async lag, F-3 duplicate storm, F-5 process restart, F-9 retention sweep, F-10 schema migration — all bounded by operational discipline + documented runbooks.

### 5.4 The platform is RESILIENT under the most common honest-client failure (F-1) and the most common platform-degradation (F-12 Clerk down)

Both produce well-understood, testable outcomes. The wave preserves these.

---

## 6. Per-handler resilience profile

| Handler | F-1 | F-2 | F-3 | F-4 | F-5 | F-6 | F-7 | F-8 | F-9 | F-10 | F-11 | F-12 | **Aggregate** |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| `accept` | 🟢 | 🟡 | 🟡 | 🔴 | 🟡 | n/a (T2) | n/a (C-1) | 🟠 | 🟡 | 🟡 | 🟠 | 🟢 | 🟡 **DEGRADED** |
| `confirm-start` | 🟢 | 🟡 | 🟡 | 🔴 | 🟡 | n/a | n/a | 🟠 | 🟡 | 🟡 | 🟠 | 🟢 | 🟡 **DEGRADED** |
| `request-refresh` | 🟢 | 🟡 | 🟡 | 🔴 | 🟡 | n/a | n/a | 🟠 | 🟡 | 🟡 | 🟠 | 🟢 | 🟡 **DEGRADED** |
| `route-to-review` | 🟢 | 🟡 | 🟡 | 🔴 | 🟡 | n/a | n/a | 🟠 (HITL) | 🟡 | 🟡 | 🟠 | 🟢 | 🟡 **DEGRADED** |
| `share-packet` | 🟢 | n/a | 🟠 | 🔴 | 🟡 | n/a | 🔴 (audit-vs-delivery) | n/a | 🟡 | 🟡 | 🟠 | 🟢 | 🟠 **FRAGMENTED** |
| `packet` | 🟢 | n/a | 🟡 | 🔴 | 🟡 | n/a | 🔴 (audit-vs-delivery) | n/a | 🟡 | 🟡 | 🟠 | 🟢 | 🟠 **FRAGMENTED** |

---

## 7. Closing classification

**Overall operational resilience of the wave's surface:** 🟡 **DEGRADED — RESILIENT under common failures (F-1, F-12); DEGRADED under most operational conditions (F-2, F-3, F-5, F-9, F-10); FRAGMENTED on specific patterns (T0 dual-write, C-2 delivery, T2 topology breach, outbox worker); COLLAPSE-PRONE only under F-4 denial regression (mitigatable).**

The 4 C-1 transactional handlers reach 🟡 DEGRADED aggregate (strong operationally but bounded by F-4 + F-11 risks). The 2 C-2 audit-as-persistence handlers reach 🟠 FRAGMENTED (PW-3 audit-vs-delivery is the structural concern).

---

## 8. Track E determination

| Question | Answer |
|---|---|
| Is the platform operationally resilient? | **PARTIALLY — 🟡 DEGRADED under most conditions; RESILIENT under F-1 + F-12** |
| Is the dominant collapse risk identified? | YES — F-4 denial regression |
| Are FRAGMENTED conditions enumerated? | YES — F-6, F-7, F-8, F-11 |
| Are DEGRADED conditions bounded by operational discipline? | YES — runbook + alerting |
| Per-handler aggregate? | 4 DEGRADED + 2 FRAGMENTED |

**Track E classification:** 🟡 **DEGRADED — operationally resilient with explicit fragmentation surfaces; collapse risk bounded to F-4 mitigatable via testing + alerting.**

---

## 9. Closing principle (Track E)

The operational resilience matrix shows that the platform survives most operational failures with degraded but useful fidelity. The single COLLAPSE risk (F-4 denial regression) is implementation-controllable. The FRAGMENTED risks are operationally-bounded. The DEGRADED risks are runbook-mitigatable.

**The platform is operationally survivable IF: (a) test coverage prevents F-4, (b) dashboard alerting on denial-rate variance catches F-4, (c) operational runbooks document F-2/F-5/F-9/F-10/F-11, (d) C-2 audit-vs-delivery divergence is communicated to stakeholders.** No single failure mode produces unrecoverable platform state.

**Operational resilience verdict:** 🟡 **DEGRADED-AT-WORST under common operational conditions; RESILIENT-WITH-DOCUMENTATION under degraded conditions.**

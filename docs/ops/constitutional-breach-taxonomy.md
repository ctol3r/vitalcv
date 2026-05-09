# Constitutional Breach Taxonomy

**Status:** **CONSTITUTIONAL — BREACH MODEL** · **Date established:** 2026-05-08 · **Authority:** subordinate to `constitutional-drift-registry.md`, `runtime-governance-telemetry.md`, `survivability-inflation-audit.md`

This doc defines the 8 constitutional breach classes that VitalCV's operational governance can experience. Each breach has an operator/forensic/trust impact + detectability + escalation severity.

The contract: **breach simulation is modeling, NOT chaos engineering.** This doc reasons about what happens IF constitutional guarantees degrade — to inform operator response, not to introduce failure.

---

## 1. The 8 breach classes

| # | Breach | Definition | Aggregate |
|---|---|---|---|
| **CB-1** | Semantic drift | Forbidden phrases enter platform surfaces; lexicon enforcement failed | 🟡 DEGRADED |
| **CB-2** | Replay inflation | Replay claims drift from observability to prevention framing | 🟠 FRAGMENTING |
| **CB-3** | Export survivability degradation | EX-3 unavailable OR EX-1 vs EX-3 variance escalates | 🟠 FRAGMENTING |
| **CB-4** | Dashboard/runtime divergence | Widgets show counts inconsistent with canonical queries | 🟡 DEGRADED |
| **CB-5** | Lineage fragmentation | Audit chains incomplete; cross-row joins fail | 🟠 FRAGMENTING |
| **CB-6** | Forensic continuity degradation | Audit retention shortened; forensic horizon collapses | 🔴 CRITICAL |
| **CB-7** | Trust-class mismatch | T0 paths shipped where C-1 was expected; operator believes false guarantee | 🔴 CRITICAL |
| **CB-8** | Audit survivability collapse | F-4 regression; denial-rate drops > 50% silently | 🔴 CRITICAL |

---

## 2. Per-breach detail

### 2.1 CB-1 Semantic drift

**Definition:** any of 7 lexicon-forbidden phrases enters PR descriptions / dashboards / marketing without allowlist.

**Operator impact:** false security beliefs propagate; downstream consumers trust inflated claims.

**Forensic impact:** PR-history language drift; Codex audit transcripts contradict reality.

**Trust impact:** marketing-grade inflation if leaks externally.

**Survivability impact:** LOW — caught at PR review by lexicon enforcement.

**Detectability:** 🟢 HIGH (CI-grep + Codex SAFE).

**Escalation:** P0 if shipped (constitutional breach); P1 if caught at review.

### 2.2 CB-2 Replay inflation

**Definition:** replay claims drift from "observability + best-effort dedup" to "prevention" framing.

**Operator impact:** false sense of security against capture-replay.

**Forensic impact:** SOC may not investigate suspected replay attacks.

**Trust impact:** customer / regulator confusion if marketing inherits.

**Survivability impact:** MEDIUM — replay observability still works; users miscalibrate trust.

**Detectability:** 🟢 HIGH (CI-grep + Codex).

**Escalation:** P1; founder review if marketing surface leaked.

### 2.3 CB-3 Export survivability degradation

**Definition:** EX-3 Postgres direct unavailable OR row-count drops > 50% from baseline.

**Operator impact:** forensic queries fail; SOC operations blocked.

**Forensic impact:** new audit rows queryable only via SIEM (which has DL-8 gap); investigation incomplete.

**Trust impact:** compliance + customer trust loss visible.

**Survivability impact:** HIGH — primary forensic source compromised.

**Detectability:** 🟢 HIGH (continuous monitoring).

**Escalation:** P0; ops on-call paged.

### 2.4 CB-4 Dashboard/runtime divergence

**Definition:** widget count > 5% variance from canonical Q-CANON for same time window.

**Operator impact:** decisions based on incorrect dashboard data.

**Forensic impact:** if dashboard is decision input, decisions are wrong.

**Trust impact:** internal credibility loss.

**Survivability impact:** MEDIUM — runtime data still correct; presentation drifted.

**Detectability:** 🟡 MEDIUM (quarterly + on-demand).

**Escalation:** P1; dashboard owner remediates.

### 2.5 CB-5 Lineage fragmentation

**Definition:** audit chains incomplete; mean events per chain drops below baseline.

**Operator impact:** chain reconstruction returns incomplete results.

**Forensic impact:** logical-operation forensics blind for affected operations.

**Trust impact:** compliance audit risk.

**Survivability impact:** MEDIUM — partial chains still queryable; full reconstruction degraded.

**Detectability:** 🟡 MEDIUM (weekly).

**Escalation:** P1; audit + ops review.

### 2.6 CB-6 Forensic continuity degradation

**Definition:** audit retention SLA shortened OR retention sweep deletes operationally-relevant rows.

**Operator impact:** forensic horizon collapses; old investigations impossible.

**Forensic impact:** historical attack patterns invisible; capture-replay forensic detection collapses.

**Trust impact:** compliance + legal admissibility loss.

**Survivability impact:** HIGH — irreversible loss for affected window.

**Detectability:** 🟢 HIGH (retention SLA monitoring).

**Escalation:** P0; founder + legal coordination.

### 2.7 CB-7 Trust-class mismatch

**Definition:** T0 fire-and-forget path shipped where C-1 atomic was expected; operator forms false guarantee belief.

**Operator impact:** mutation may persist while audit lost; partial-write states.

**Forensic impact:** orphaned mutation rows; audit trail incomplete.

**Trust impact:** compliance + audit failure.

**Survivability impact:** HIGH — silent partial-writes; recovery requires mutation-to-audit reconciliation.

**Detectability:** 🟡 MEDIUM (Codex audit + reviewer playbook + T0 CRITICAL log monitoring).

**Escalation:** P0; hotfix; founder review.

### 2.8 CB-8 Audit survivability collapse

**Definition:** F-4 regression. Denial-emission silently dropped from one or more handlers; denial-rate variance > 50% drop.

**Operator impact:** denied attempts silently disappear from audit.

**Forensic impact:** capture-replay attacks invisible; cross-actor probing invisible; SOC blind.

**Trust impact:** cryptographic-grade trust loss for audit log.

**Survivability impact:** CRITICAL — audit log no longer complete record.

**Detectability:** 🟢 HIGH (denial-rate variance alerting).

**Escalation:** P0; immediate hotfix; rollback consideration; founder + SOC + ops coordination.

---

## 3. Aggregate breach distribution

| Severity | Count | Breaches |
|---|---|---|
| 🟢 CONTAINED | 0 | (none — all classes have some impact) |
| 🟡 DEGRADED | 2 | CB-1 (semantic drift), CB-4 (dashboard divergence) |
| 🟠 FRAGMENTING | 3 | CB-2 (replay inflation), CB-3 (export degradation), CB-5 (lineage fragmentation) |
| 🔴 CRITICAL | 3 | CB-6 (forensic collapse), CB-7 (trust-class mismatch), CB-8 (audit collapse) |

---

## 4. Per-breach impact matrix

| Breach | Operator | Forensic | Trust | Survivability | Detectability | Escalation |
|---|---|---|---|---|---|---|
| CB-1 | LOW | LOW | MEDIUM (if external) | LOW | 🟢 HIGH | P1 (P0 if shipped) |
| CB-2 | MEDIUM | MEDIUM | MEDIUM | MEDIUM | 🟢 HIGH | P1 |
| CB-3 | HIGH | HIGH | MEDIUM | HIGH | 🟢 HIGH | P0 |
| CB-4 | MEDIUM | MEDIUM (if decision input) | LOW | MEDIUM | 🟡 MED | P1 |
| CB-5 | MEDIUM | HIGH | MEDIUM | MEDIUM | 🟡 MED | P1 |
| CB-6 | HIGH | CRITICAL (irreversible) | HIGH | HIGH | 🟢 HIGH | P0 |
| CB-7 | HIGH | HIGH | HIGH | HIGH | 🟡 MED | P0 |
| CB-8 | HIGH | CRITICAL | CRITICAL | CRITICAL | 🟢 HIGH | P0 |

---

## 5. Closing principle (breach taxonomy)

The taxonomy names what can break. 0 CONTAINED breaches means every class has impact; the question is severity + detectability. CRITICAL breaches (CB-6, CB-7, CB-8) require immediate ops + founder coordination; FRAGMENTING breaches (CB-2, CB-3, CB-5) require investigation + remediation; DEGRADED breaches (CB-1, CB-4) require playbook execution.

**Naming the breach is the first step. Operators reach the runbook only after classification.**

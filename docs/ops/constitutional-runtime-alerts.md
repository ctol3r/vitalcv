# Constitutional Runtime Alerts

**Status:** **OPERATIONAL — ALERT DEFINITIONS** · **Date established:** 2026-05-08 · **Authority:** subordinate to `runtime-governance-telemetry.md`, `constitutional-integrity-signals.md`

This doc defines runtime alert conditions for constitutional drift / replay degradation / export degradation / audit collapse / drift-threshold exceedance / replay taxonomy fragmentation / dashboard mismatch.

The contract: **alerts are visibility, NOT remediation.** Per non-negotiable rule #7: alerts may not imply automatic remediation. Operators interpret + act.

---

## 1. The 7 alert classes

| # | Alert | Trigger | Severity | Escalation |
|---|---|---|---|---|
| **CA-1** | Replay semantics inflation | CIS-1 fires; PR contains "replay protected"/"replay-resistant" without allowlist | 🔴 P0 | Block merge; founder review |
| **CA-2** | Dashboard/runtime mismatch | TG-7 → 🟠 DRIFTING OR 🔴 VIOLATING | 🟠 P1 | Dashboard governance review; widget remediation |
| **CA-3** | Export survivability collapse | TG-3 → 🔴 VIOLATING (EX-3 unavailable OR row-count drop > 50%) | 🔴 P0 | Hotfix; ops investigation |
| **CA-4** | Audit survivability collapse | TG-2 → 🔴 VIOLATING (denial-rate variance > 50% drop) | 🔴 P0 | F-4 regression; hotfix; founder review |
| **CA-5** | Drift-threshold exceedance | TG-1 → 🟠 DRIFTING (3+ forbidden phrases in 7-PR window) | 🟡 P2 | Reviewer training; lexicon enforcement audit |
| **CA-6** | Replay taxonomy fragmentation | TG-2 + CIS-5 divergent | 🟡 P2 | SOC playbook review; vocabulary-map update |
| **CA-7** | Operator-visible guarantee mismatch | TG-7 + TG-1 + TG-6 composite | 🟠 P1 | Dashboard governance + Codex audit |

---

## 2. Per-alert detail

### 2.1 CA-1 Replay semantics inflation

**Trigger:** PR description / commit message / audit-row label / dashboard contains lexicon-forbidden replay phrase.

**Detection:** CI-grep at PR-build (per `semantic-drift-detection.md` §2.1 + §2.3).

**Severity:** 🔴 **P0** — constitutional breach if shipped.

**Operator impact:** PR blocked; author updates wording.

**Forensic impact:** if shipped, downstream consumers form false security beliefs.

**Trust impact:** marketing-grade inflation risk.

**Escalation path:**
1. CI fails → author notified.
2. If author overrides → reviewer escalates to founder.
3. Lock v2 wording fixes (current open) covered separately.

### 2.2 CA-2 Dashboard/runtime mismatch

**Trigger:** widget count > 5% variance from canonical Q-CANON for same time window.

**Detection:** quarterly dashboard audit + on-demand cross-check (per `dashboard-governance-enforcement.md` §6).

**Severity:** 🟠 **P1**.

**Operator impact:** dashboard widget shows wrong data; operator decisions misinformed.

**Forensic impact:** if dashboard is forensic-decision input, decisions are based on incorrect data.

**Trust impact:** internal credibility loss.

**Escalation path:**
1. Variance detected → dashboard owner notified.
2. Widget query reviewed against vocabulary-map + alias-layer.
3. Widget updated OR labeled DEGRADED until fixed.

### 2.3 CA-3 Export survivability collapse

**Trigger:** TG-3 → 🔴 (EX-3 unavailable OR row-count drop > 50%).

**Detection:** continuous monitoring of EX-3 response time + row-count trends.

**Severity:** 🔴 **P0**.

**Operator impact:** forensic queries fail; SOC operations degraded.

**Forensic impact:** new audit rows may not be queryable; investigation blocked.

**Trust impact:** ops failure visible to compliance + customers.

**Escalation path:**
1. Monitoring catches → ops on-call paged.
2. Investigate DB outage, retention sweep error, or schema migration issue.
3. Hotfix; backfill if possible.

### 2.4 CA-4 Audit survivability collapse

**Trigger:** TG-2 → 🔴 (denial-rate variance > 50% drop OR correlationId presence < 60%).

**Detection:** continuous monitoring of denial-rate baseline.

**Severity:** 🔴 **P0** — F-4 regression risk.

**Operator impact:** denied attempts silently disappearing from audit; security forensics blind.

**Forensic impact:** capture-replay attacks invisible; cross-actor probing invisible.

**Trust impact:** cryptographic-grade trust loss for audit log.

**Escalation path:**
1. Monitoring catches → ops on-call paged.
2. Identify which path stopped emitting denied rows.
3. Hotfix the implementation regression.
4. Founder review per F-4 collapse classification.

### 2.5 CA-5 Drift-threshold exceedance

**Trigger:** TG-1 → 🟠 DRIFTING.

**Detection:** rolling 7-PR window forbidden-phrase count.

**Severity:** 🟡 **P2**.

**Operator impact:** lexicon enforcement weakening.

**Escalation path:**
1. Reviewer playbook re-trained.
2. Codex prompt re-verified.
3. Quarterly governance review.

### 2.6 CA-6 Replay taxonomy fragmentation

**Trigger:** Cross-vocabulary query result variance > threshold (CIS-5).

**Detection:** quarterly SOC audit.

**Severity:** 🟡 **P2**.

**Escalation:** vocabulary-map review; alias relationships updated.

### 2.7 CA-7 Operator-visible guarantee mismatch

**Trigger:** Composite of TG-1 + TG-6 + TG-7 — drifts visible to operators.

**Detection:** governance review.

**Severity:** 🟠 **P1**.

**Escalation:** dashboard governance + Codex audit + reviewer training.

---

## 3. Alert response runbook

For each alert:

1. Identify class (CA-1..CA-7).
2. Apply per-class severity + escalation.
3. Document in incident log.
4. Update `constitutional-drift-registry.md` if new drift identified.
5. Quarterly post-incident review.

---

## 4. Closing principle (alerts)

Alerts make constitutional integrity DEGRADATIONS visible to operators in time to act. They do NOT auto-remediate. Operators apply per-class playbooks; founder + ops + SOC + reviewer roles each have responsibilities.

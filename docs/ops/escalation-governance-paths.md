# Escalation Governance Paths

**Status:** **OPERATIONAL — ESCALATION PATHS** · **Date established:** 2026-05-08 · **Authority:** subordinate to `constitutional-containment-taxonomy.md`, `integrity-stress-escalation-paths.md`, `constitutional-runtime-alerts.md`

This doc maps the operational escalation paths from initial degradation detection to founder-level coordination. Each escalation has triggers, severity, visibility, containment opportunities, and irreversible-fragmentation thresholds.

---

## 1. The 5 escalation paths

| # | Path | From | To | Trigger |
|---|---|---|---|---|
| **EG-1** | Author → Reviewer | PR author | PR reviewer | CI-grep fail OR Codex audit reject |
| **EG-2** | Reviewer → Founder | PR reviewer | Founder | Reviewer can't resolve OR repeated drift |
| **EG-3** | Ops → SOC | Ops on-call | SOC team | Continuous-monitoring alarm fires |
| **EG-4** | SOC → Founder | SOC team | Founder | CRITICAL severity OR irreversible fragmentation imminent |
| **EG-5** | Founder → External coordination | Founder | Legal / compliance / customer | External commitment at stake |

---

## 2. Per-path detail

### 2.1 EG-1 Author → Reviewer

**Trigger:** CA-1 (replay inflation) OR CA-5 (drift threshold) at PR-build.

**Severity:** P1-P2.

**Visibility:** PR comment + CI failure + Codex transcript.

**Operator action:** PR author updates wording / adds class declaration / adds test coverage.

**Dashboard action:** none yet (PR-level).

**Forensic implications:** none (caught pre-merge).

**Export implications:** none.

**Replay implications:** none (caught pre-merge).

**Containment opportunity:** rewrite PR before merge.

**Irreversible threshold:** merge without resolution.

### 2.2 EG-2 Reviewer → Founder

**Trigger:** reviewer can't resolve OR pattern of drift across PRs.

**Severity:** P1.

**Visibility:** review comments + escalation thread.

**Operator action:** founder reviews scope + lexicon + class assignment.

**Dashboard action:** drift widget (W-5) shows DRIFT state.

**Forensic implications:** if drift relates to audit-coupling, audit forensics may be compromised.

**Export implications:** dashboard / SIEM if affected.

**Replay implications:** if drift relates to replay-taxonomy.

**Containment opportunity:** founder approval gate.

**Irreversible threshold:** repeated drift without remediation = constitutional drift.

### 2.3 EG-3 Ops → SOC

**Trigger:** CA-3 (export collapse) OR CA-4 (audit collapse) OR CA-2 (dashboard mismatch).

**Severity:** P0 (CA-3, CA-4) OR P1 (CA-2).

**Visibility:** ops on-call alert → SOC dashboard.

**Operator action:** SOC investigates per-class playbook (per `constitutional-governance-runbook.md`).

**Dashboard action:** affected widget shows DEGRADED / FRAGMENTING / VIOLATION state.

**Forensic implications:** depends on class.

**Export implications:** CA-3 directly affects forensic queries.

**Replay implications:** CA-4 directly affects replay observability.

**Containment opportunity:** SOC playbook execution.

**Irreversible threshold:** CA-4 regression-window denials are gone (cannot recover).

### 2.4 EG-4 SOC → Founder

**Trigger:** CRITICAL severity (CA-3, CA-4) OR irreversible fragmentation imminent (CT-5 forensic SLA breach).

**Severity:** P0.

**Visibility:** founder briefing.

**Operator action:** founder coordinates ops + SOC + legal.

**Dashboard action:** CHS shows COLLAPSING (per `constitutional-health-model.md`).

**Forensic implications:** CRITICAL — forensic horizon may collapse.

**Export implications:** CRITICAL — primary forensic source compromised.

**Replay implications:** CRITICAL — capture-replay forensic detection at risk.

**Containment opportunity:** founder-level resource coordination.

**Irreversible threshold:** CT-5 forensic past-window data loss.

### 2.5 EG-5 Founder → External coordination

**Trigger:** external commitment at stake (regulator / compliance / customer).

**Severity:** P0.

**Visibility:** external comms.

**Operator action:** founder + legal + customer success coordinated response.

**Dashboard action:** internal CHS reflected in customer-facing trust statements.

**Forensic implications:** if forensic loss requires disclosure.

**Export implications:** if export availability is contractually committed.

**Replay implications:** rare but possible if replay-prevention claim was made externally.

**Containment opportunity:** truthful external comms; lexicon-aligned remediation language.

**Irreversible threshold:** external trust damage; legal exposure.

---

## 3. Cross-path interaction

EG-1 → EG-2 → EG-3 → EG-4 → EG-5 is the worst-case escalation chain (PR-level drift propagates to external commitment).

**Mitigation:** lexicon enforcement at EG-1 prevents propagation upstream; reviewer discipline at EG-2 catches patterns; SOC discipline at EG-3 contains runtime issues; founder review at EG-4 prevents external commitment.

---

## 4. Per-path response time SLA (recommended)

| Path | Initial response | Containment SLA | Remediation SLA |
|---|---|---|---|
| EG-1 | seconds (CI) | per-PR | per-PR |
| EG-2 | hours | days | per-wave |
| EG-3 | minutes (alert) | hours | days |
| EG-4 | hours | hours | days |
| EG-5 | hours | hours-days | per-incident |

---

## 5. Closing principle (escalation paths)

Escalation is the discipline of routing degradation to the right responder + the right action time + the right scope. EG-1 catches the most; EG-2 and beyond escalate by severity + scope + irreversibility.

**Each path has visible triggers + named responders + bounded SLA. Escalation does not auto-resolve; it routes to humans who execute.**

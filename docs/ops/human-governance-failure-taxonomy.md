# Human Governance Failure Taxonomy

**Status:** **OPERATIONAL — HUMAN FAILURE MODEL** · **Date established:** 2026-05-08 · **Authority:** subordinate to `constitutional-containment-taxonomy.md`, `constitutional-runtime-alerts.md`, `runtime-integrity-dashboard.md`

This doc defines 8 human failure classes that erode VitalCV constitutional governance over time. Each class names: operator behavior, constitutional impact, replay impact, forensic impact, survivability impact, detectability, escalation risk.

The contract: **monitoring is NOT operator comprehension** (per non-negotiable rule #1). Dashboards + alerts + runbooks exist; humans interpret + act. The taxonomy names where humans drift.

---

## 1. The 8 human failure classes

| # | Class | Definition | Aggregate |
|---|---|---|---|
| **HF-1** | Alert fatigue | High alert volume → operator becomes desensitized → real alerts ignored | 🠀 DRIFTING |
| **HF-2** | Replay-warning normalization | "Replay observability degraded" warning becomes routine; operators stop investigating | 🠀 DRIFTING |
| **HF-3** | Dashboard optimism bias | Operators read dashboards favorably; CT-DEGRADED widgets dismissed as "always shows yellow" | 🠀 DRIFTING |
| **HF-4** | Escalation paralysis | Operator unsure whether to escalate; defers; degradation expands | 🟡 DEGRADED |
| **HF-5** | Badge desensitization | Trust-class / lineage badges (per `dashboard-governance-enforcement.md`) become wallpaper; operators stop reading | 🟡 DEGRADED |
| **HF-6** | Survivability overconfidence | Operators infer "platform is robust" from RESILIENT badges; under-investigate FRAGMENTING ones | 🠀 DRIFTING |
| **HF-7** | Forensic shortcutting | Time-pressured operators query EX-1 SIEM (faster) instead of EX-3 canonical; miss DL-8 gap | 🠀 DRIFTING |
| **HF-8** | Constitutional override normalization | Founder approvals for "temporary" override become routine; permanent acceptance | 🔴 ERODING |

---

## 2. Per-class detail

### 2.1 HF-1 Alert fatigue

| Aspect | Status |
|---|---|
| Operator behavior | Ignores P2-P3 alerts; investigates only P0-P1 |
| Constitutional impact | Lower-severity drifts accumulate undetected |
| Replay impact | CIS-5 vocabulary divergence ignored |
| Forensic impact | Lineage fragmentation creeps in unaddressed |
| Survivability impact | DEGRADED → FRAGMENTING transitions undetected |
| Detectability | 🟡 MEDIUM (alert acknowledgment rate trends) |
| Escalation risk | HIGH — chains escalate without intervention |

### 2.2 HF-2 Replay-warning normalization

| Aspect | Status |
|---|---|
| Operator behavior | "Replay degradation" alerts seen as routine; not investigated |
| Constitutional impact | F-4 regression risk goes uninvestigated |
| Replay impact | CB-8 audit collapse may emerge unnoticed |
| Forensic impact | Capture-replay attacks invisible |
| Survivability impact | Replay survivability silently FRAGMENTING |
| Detectability | 🟡 MEDIUM (alert-to-investigation time trends) |
| Escalation risk | HIGH — F-4 collapse mitigation depends on rapid investigation |

### 2.3 HF-3 Dashboard optimism bias

| Aspect | Status |
|---|---|
| Operator behavior | Reads CT-DEGRADED widgets as "yellow is fine"; reads CI-GREEN composite as "we're good" |
| Constitutional impact | Per-widget DEGRADED states accumulate without action |
| Replay impact | W-3 replay widget DEGRADED state ignored |
| Forensic impact | W-7 forensic widget DEGRADED state ignored |
| Survivability impact | DEGRADED → FRAGMENTING progression unobserved |
| Detectability | 🟠 LOW (no direct telemetry on operator interpretation) |
| Escalation risk | HIGH |

### 2.4 HF-4 Escalation paralysis

| Aspect | Status |
|---|---|
| Operator behavior | Unsure whether to escalate to founder; defers; consults colleague |
| Constitutional impact | EG-3 → EG-4 transition delayed |
| Replay impact | F-4 hotfix delayed |
| Forensic impact | CB-6 retention SLA breach delayed if escalation lags |
| Survivability impact | DEGRADED → ESCALATING transition not contained |
| Detectability | 🟢 HIGH (incident-response time-to-escalation metric) |
| Escalation risk | MEDIUM (escalation eventually happens; just slower) |

### 2.5 HF-5 Badge desensitization

| Aspect | Status |
|---|---|
| Operator behavior | Trust-class / lineage badges become visual noise; operator queries data without consulting badges |
| Constitutional impact | Operator inherits unsafe assumptions per `runtime-trust-class-map.md` §7 (T0 mistaken for C-1, etc.) |
| Replay impact | Replay-state classification mistakes |
| Forensic impact | Cross-vocabulary OR-clause queries skipped; partial truth taken as canonical |
| Survivability impact | Class-mismatch decisions accumulate |
| Detectability | 🟠 LOW (no direct telemetry) |
| Escalation risk | MEDIUM |

### 2.6 HF-6 Survivability overconfidence

| Aspect | Status |
|---|---|
| Operator behavior | Reads RESILIENT badges as "this won't fail"; under-investigates FRAGMENTING; misses CRITICAL transitions |
| Constitutional impact | CB-3 / CB-5 / CB-7 / CB-8 (FRAGMENTING/CRITICAL classes) under-investigated |
| Replay impact | CB-8 audit collapse risk dismissed until variance alarm |
| Forensic impact | CB-6 forensic-retention SLA monitoring relaxed |
| Survivability impact | All FRAGMENTING / ESCALATING classes risk emerging unaddressed |
| Detectability | 🟠 LOW |
| Escalation risk | HIGH |

### 2.7 HF-7 Forensic shortcutting

| Aspect | Status |
|---|---|
| Operator behavior | Time-pressured during incident; queries EX-1 SIEM (faster) instead of EX-3 (canonical) |
| Constitutional impact | DL-8 SIEM coverage gap operationalized as "good enough" |
| Replay impact | Lock v2 denied-replay rows missed in incident response |
| Forensic impact | Investigations conclude on incomplete data |
| Survivability impact | False sense of forensic completeness |
| Detectability | 🟡 MEDIUM (per-incident playbook adherence audit) |
| Escalation risk | HIGH (incident decisions made on partial truth) |

### 2.8 HF-8 Constitutional override normalization

| Aspect | Status |
|---|---|
| Operator behavior | Repeated "temporary" override requests for same drift; founder approvals become routine; override never expires |
| Constitutional impact | Permanent acceptance of constitutional violation |
| Replay impact | Inflation phrases shipped repeatedly with override |
| Forensic impact | Constitutional drift institutionalized |
| Survivability impact | Lexicon enforcement weakened across time |
| Detectability | 🟢 HIGH (override audit trail; per `constitutional-override-governance.md`) |
| Escalation risk | CRITICAL — the override IS the drift |

---

## 3. Aggregate distribution

| Status | Count | Failures |
|---|---|---|
| 🟢 CONTAINED | 0 | none — all human failures have impact |
| 🟡 DEGRADED | 2 | HF-4 (escalation paralysis), HF-5 (badge desensitization) |
| 🠀 DRIFTING | 5 | HF-1, HF-2, HF-3, HF-6, HF-7 |
| 🔴 ERODING | 1 | HF-8 (constitutional override normalization) |

---

## 4. Per-class impact matrix

| Class | Const. impact | Replay impact | Forensic impact | Survivability impact | Detectability | Escalation risk |
|---|---|---|---|---|---|---|
| HF-1 alert fatigue | MEDIUM | MEDIUM | MEDIUM | MEDIUM | 🟡 MED | HIGH |
| HF-2 replay normalization | MEDIUM | HIGH | HIGH | HIGH | 🟡 MED | HIGH |
| HF-3 dashboard optimism | MEDIUM | MEDIUM | MEDIUM | MEDIUM | 🟠 LOW | HIGH |
| HF-4 escalation paralysis | LOW (delayed) | MEDIUM | MEDIUM | MEDIUM | 🟢 HIGH | MEDIUM |
| HF-5 badge desensitization | MEDIUM | MEDIUM | MEDIUM | MEDIUM | 🟠 LOW | MEDIUM |
| HF-6 survivability overconfidence | HIGH | HIGH | HIGH | HIGH | 🟠 LOW | HIGH |
| HF-7 forensic shortcutting | HIGH | HIGH | HIGH | HIGH | 🟡 MED | HIGH |
| HF-8 override normalization | CRITICAL | varies | HIGH | HIGH | 🟢 HIGH | CRITICAL |

---

## 5. Cross-cutting findings

### 5.1 HF-3 + HF-5 + HF-6 share LOW detectability

These three are about operator INTERPRETATION of dashboard signals — no direct telemetry exists for "did the operator read this correctly?" Mitigation: per-quarter SOC training + decision-audit sampling.

### 5.2 HF-8 is the unique ERODING class

Override normalization is the only HF that converts temporary acceptance into permanent constitutional drift. Mitigation: override expiration + audit trail per `constitutional-override-governance.md`.

### 5.3 HF-2 + HF-7 directly enable F-4 regression

Replay-warning normalization (HF-2) + forensic shortcutting (HF-7) compound: operators who normalize replay alerts AND shortcut to SIEM (which misses Lock v2 denials per DL-8) miss F-4 regressions until variance alarm fires.

### 5.4 The 5 DRIFTING classes have HIGH escalation risk

All 5 DRIFTING (HF-1, HF-2, HF-3, HF-6, HF-7) carry HIGH escalation risk. Mitigation: continuous SOC training + alert-tuning + dashboard simplification.

---

## 6. Closing principle (human governance failure taxonomy)

Humans drift in predictable ways. Naming the drift IS the first defense. The taxonomy gives founder + ops leadership concrete failure classes to monitor + train against.

**Constitutional governance is human governance + automated discipline. Either alone fails. Both together survive.**

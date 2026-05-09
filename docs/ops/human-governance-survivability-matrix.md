# Human Governance Survivability Matrix

**Status:** **OPERATIONAL — HUMAN SURVIVABILITY MATRIX** · **Date established:** 2026-05-08 · **Authority:** consolidates `human-governance-failure-taxonomy.md`, `governance-erosion-escalation.md`, `operator-overconfidence-review.md`, `constitutional-override-governance.md`

This doc consolidates per-human-failure × per-survivability-axis classification.

Each cell: 🟢 RESILIENT / 🟡 FATIGUED / 🠀 NORMALIZING / 🔴 ERODING.

---

## 1. The matrix

| Human failure | Drift surv. | Replay surv. | Forensic surv. | Escalation surv. | Operator-awareness surv. | **Aggregate** |
|---|---|---|---|---|---|---|
| **HF-1** alert fatigue | 🟡 F | 🟡 F | 🟡 F | 🠀 N | 🟡 F | 🟡 **FATIGUED** |
| **HF-2** replay-warning normalization | 🠀 N | 🠀 N (R-OBSERVED missed) | 🠀 N (capture-replay invisible) | 🠀 N | 🠀 N | 🠀 **NORMALIZING** |
| **HF-3** dashboard optimism | 🠀 N (CT-DEGRADED ignored) | 🟡 F | 🟡 F | 🠀 N | 🠀 N | 🠀 **NORMALIZING** |
| **HF-4** escalation paralysis | 🟡 F | 🟡 F | 🟡 F | 🠀 N | 🟢 R (eventually escalates) | 🟡 **FATIGUED** |
| **HF-5** badge desensitization | 🠀 N (class mistakes accumulate) | 🟡 F | 🟡 F | 🟡 F | 🠀 N | 🠀 **NORMALIZING** |
| **HF-6** survivability overconfidence | 🠀 N | 🠀 N | 🠀 N | 🠀 N | 🠀 N | 🠀 **NORMALIZING** |
| **HF-7** forensic shortcutting | 🠀 N (DL-8 forgotten) | 🠀 N (Lock v2 denials missed) | 🠀 N (incomplete investigations) | 🟡 F | 🠀 N | 🠀 **NORMALIZING** |
| **HF-8** override normalization | 🔴 E (institutionalized drift) | 🔴 E | 🔴 E | 🔴 E | 🔴 E | 🔴 **ERODING** |

---

## 2. Aggregate distribution

| Status | Count | Failures |
|---|---|---|
| 🟢 RESILIENT | 0 | none — every human failure carries impact |
| 🟡 FATIGUED | 2 | HF-1 (alert fatigue), HF-4 (escalation paralysis) |
| 🠀 NORMALIZING | 5 | HF-2, HF-3, HF-5, HF-6, HF-7 |
| 🔴 ERODING | 1 | HF-8 (override normalization) |

---

## 3. Per-axis aggregate

| Axis | RESILIENT | FATIGUED | NORMALIZING | ERODING |
|---|---|---|---|---|
| Drift survivability | 0 | 3 | 4 | 1 |
| Replay survivability | 0 | 4 | 3 | 1 |
| Forensic survivability | 0 | 4 | 3 | 1 |
| Escalation survivability | 1 | 4 | 2 | 1 |
| Operator-awareness survivability | 0 | 2 | 5 | 1 |

**Aggregate per axis:** all 5 axes are mostly NORMALIZING/FATIGUED with HF-8 ERODING. Operator-awareness is the LEAST RESILIENT axis (5 NORMALIZING).

---

## 4. Cross-cutting findings

### 4.1 No human failure is fully RESILIENT

Every HF carries some axis-level survivability impact. Human governance is INHERENTLY degradation-prone; the only RESILIENCE comes from cross-checking + cadence + automation.

### 4.2 NORMALIZING is the dominant pattern (5 of 8)

Most human failures fall into NORMALIZING — operators incrementally accept degradation as routine. This is the dominant erosion mode. Mitigation: continuous training + dashboard simplification + automated cross-check.

### 4.3 HF-8 is the unique ERODING failure

Override normalization institutionalizes drift across ALL 5 survivability axes. Mitigation: `constitutional-override-governance.md` framework — expiration + audit + closure plan.

### 4.4 Operator-awareness survivability is most fragile

5 of 8 HFs degrade operator-awareness. This is the substrate of all other mitigations — if operators don't see / understand / care, no other mechanism saves the platform.

---

## 5. Mitigation per axis

| Axis | Mitigation strategy |
|---|---|
| Drift survivability | CI-grep enforcement + Codex SAFE prompt + lexicon discipline |
| Replay survivability | payloadHash mandate (ML-Rec-1) + variance alerting + R-state taxonomy training |
| Forensic survivability | Audit retention SLA (gate G7) + cross-source verification + EX-3 default playbook |
| Escalation survivability | Named responders + bounded SLA + on-call rotation |
| Operator-awareness survivability | Quarterly training + dashboard simplification + operator decision-audit sampling |

---

## 6. Cross-vector compounding

HF-2 + HF-7 + HF-3 compound: replay warnings normalized + forensic shortcutting + dashboard optimism = operators dismiss "replay degradation" alerts AND skip cross-checking AND read CI-DEGRADED widgets favorably. Compound effect: F-4 audit collapse mitigation falls behind detection.

HF-5 + HF-6 + HF-7 compound: badge desensitization + survivability overconfidence + forensic shortcutting = operators don't read badges, trust strength labels, AND query SIEM as canonical. Compound effect: trust-class mismatches accumulate AND go undetected.

HF-1 + HF-4 compound: alert fatigue + escalation paralysis = operators ignore alerts AND defer escalation. Compound effect: P0/P1 incidents escalate slower than SLA.

HF-8 + any: override normalization can institutionalize ANY failure class.

---

## 7. Per-failure mitigation playbook

| Failure | Primary mitigation |
|---|---|
| HF-1 alert fatigue | Alert tuning + bounded-frequency SLA |
| HF-2 replay normalization | Per-incident root-cause investigation; SOC training refresh |
| HF-3 dashboard optimism | Per-TG dimension breakdown; quarterly per-widget review |
| HF-4 escalation paralysis | Named responders + bounded SLA + escalation playbook |
| HF-5 badge desensitization | Dashboard simplification + badge prominence + decision-audit sampling |
| HF-6 survivability overconfidence | Strength-badge caveat links; quarterly HCA-* hidden-ambiguity review |
| HF-7 forensic shortcutting | SOC playbook MANDATES EX-3 cross-check; per-incident playbook adherence audit |
| HF-8 override normalization | `constitutional-override-governance.md` expiration + audit + closure plan |

---

## 8. Closing principle (human governance survivability matrix)

Human governance is degradation-prone in 8 named ways across 5 survivability axes. NO human failure is RESILIENT; the matrix shows the platform's human-side discipline is the weakest link. Mitigation requires: cadence + automation + cross-check + named-responder accountability.

**Constitutional governance is human governance + automated discipline + per-role accountability. The platform's safety is the product of these. Without all three, normalization wins.**

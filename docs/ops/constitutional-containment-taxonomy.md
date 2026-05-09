# Constitutional Containment Taxonomy

**Status:** **OPERATIONAL — CONTAINMENT MODEL** · **Date established:** 2026-05-08 · **Authority:** subordinate to `constitutional-breach-taxonomy.md`, `constitutional-runtime-alerts.md`, `constitutional-recovery-semantics.md`

This doc defines the 7 containment classes for VitalCV constitutional degradation. Each class names: operator response, escalation urgency, containment scope, survivability impact, forensic impact, dashboard visibility, recovery confidence.

The contract: **containment is NOT remediation** (per non-negotiable rule #2). Containment STOPS escalation; remediation (per `constitutional-recovery-semantics.md`) restores property.

---

## 1. The 7 containment classes

| # | Class | Definition | Aggregate |
|---|---|---|---|
| **CT-1** | Localized drift | Single PR / dashboard / surface drifts; bounded scope | 🟢 CONTAINABLE |
| **CT-2** | Replay degradation | Replay observability / detection / dedup degrades | 🟡 DEGRADED |
| **CT-3** | Export degradation | EX-3 availability / SLA / variance degrades | 🟠 FRAGMENTING |
| **CT-4** | Lineage fragmentation | Audit chain incompleteness rises | 🠀 FRAGMENTING |
| **CT-5** | Forensic degradation | Audit retention / forensic horizon shrinks | 🔴 ESCALATING |
| **CT-6** | Dashboard/runtime divergence | Widget counts diverge from canonical queries | 🟡 DEGRADED |
| **CT-7** | Constitutional violation | Forbidden phrasing shipped / class-mismatch shipped | 🔴 ESCALATING |

---

## 2. Per-class containment profile

### 2.1 CT-1 Localized drift

| Aspect | Status |
|---|---|
| Operator response | Investigate per `constitutional-drift-registry.md`; classify drift; apply per-class playbook |
| Escalation urgency | LOW — single surface; bounded |
| Containment scope | Single PR / single doc / single dashboard widget |
| Survivability impact | LOW — drift caught; bounded |
| Forensic impact | LOW — typically wording / classification only |
| Dashboard visibility | 🟡 DEGRADED indicator on affected surface |
| Recovery confidence | 🟢 STRONG (per-PR verification via CI-grep + Codex) |

### 2.2 CT-2 Replay degradation

| Aspect | Status |
|---|---|
| Operator response | Check correlationId presence rate; check denial-rate variance; check `<base>.duplicate_request` emission |
| Escalation urgency | MEDIUM |
| Containment scope | Per-handler OR cross-handler (all 5 mutating use Lock v2 dedup) |
| Survivability impact | MEDIUM — observability degraded; capture-replay forensic detection at risk |
| Forensic impact | MEDIUM — replay attack visibility weakened |
| Dashboard visibility | 🟡 W-3 widget shows degraded state |
| Recovery confidence | 🟡 PARTIAL (forward-looking restoration; regression-window denials gone) |

### 2.3 CT-3 Export degradation

| Aspect | Status |
|---|---|
| Operator response | Check EX-3 availability + SLA; check EX-1 vs EX-3 variance; identify root cause (DB outage / retention sweep / migration) |
| Escalation urgency | HIGH (P0 if EX-3 unavailable) |
| Containment scope | Platform-wide (all forensic queries affected) |
| Survivability impact | HIGH — primary forensic source compromised |
| Forensic impact | HIGH — investigations blocked during outage |
| Dashboard visibility | 🠀 W-4 widget shows fragmented state |
| Recovery confidence | 🟡 PARTIAL (availability restored; outage-window data may be inconsistent) |

### 2.4 CT-4 Lineage fragmentation

| Aspect | Status |
|---|---|
| Operator response | Investigate chain-completeness drop; identify cause (T0 failure spike / retention sweep / worker delay); audit retention SLA |
| Escalation urgency | MEDIUM |
| Containment scope | Per-handler OR domain-wide |
| Survivability impact | MEDIUM — chain reconstruction degraded for affected window |
| Forensic impact | MEDIUM-HIGH — older chains may be permanently incomplete |
| Dashboard visibility | 🠀 W-6 widget shows fragmented state |
| Recovery confidence | 🟠 LIMITED — past chains often unrecoverable |

### 2.5 CT-5 Forensic degradation

| Aspect | Status |
|---|---|
| Operator response | Check retention SLA; identify why retention shortened; restore retention immediately for future |
| Escalation urgency | CRITICAL (P0 — irreversible past data loss) |
| Containment scope | Platform-wide |
| Survivability impact | CRITICAL for affected window |
| Forensic impact | CRITICAL — past forensic horizon collapses |
| Dashboard visibility | 🔴 W-7 widget shows escalating state |
| Recovery confidence | 🔴 NO recovery for past window; 🟢 forward-looking only |

### 2.6 CT-6 Dashboard/runtime divergence

| Aspect | Status |
|---|---|
| Operator response | Cross-check widget vs Q-CANON canonical query; update widget query OR label DEGRADED |
| Escalation urgency | MEDIUM |
| Containment scope | Per-widget |
| Survivability impact | LOW (runtime data correct) |
| Forensic impact | MEDIUM if dashboard is decision input |
| Dashboard visibility | 🟡 W-2/W-3/etc. widget shows divergent state |
| Recovery confidence | 🟢 STRONG (widget fix verifiable) |

### 2.7 CT-7 Constitutional violation

| Aspect | Status |
|---|---|
| Operator response | Identify violation class (lexicon / class-mismatch / etc.); assess scope; founder review |
| Escalation urgency | CRITICAL (P0) |
| Containment scope | Wave-PR (if caught at gate) OR platform-wide (if shipped) |
| Survivability impact | HIGH if shipped to external surface |
| Forensic impact | HIGH if past PRs inherited the violation |
| Dashboard visibility | ⚫ W-5 widget shows VIOLATION state |
| Recovery confidence | 🟡 PARTIAL — wording revertible; downstream consumer beliefs harder to retract |

---

## 3. Aggregate distribution

| Status | Count | Classes |
|---|---|---|
| 🟢 CONTAINABLE | 1 | CT-1 |
| 🟡 DEGRADED | 2 | CT-2, CT-6 |
| 🠀 FRAGMENTING | 2 | CT-3, CT-4 |
| 🔴 ESCALATING | 2 | CT-5, CT-7 |

---

## 4. Containment vs recovery — explicit distinction

Per non-negotiable rule #2:

| Action | Definition | Example |
|---|---|---|
| **Containment** | STOPS escalation chain; freezes scope | Block PR with forbidden phrase; pause widget showing wrong data |
| **Remediation** | RESTORES property | Update wording per lexicon; fix widget query; restore EX-3 SLA |

A containment can occur WITHOUT remediation (e.g., CT-7 ESCALATING contained at PR-block; remediation = wording fix in same PR).

---

## 5. Closing principle (containment taxonomy)

The 7 classes name what's containable + at what cost. CT-5 (forensic) and CT-7 (violation) are ESCALATING — require immediate founder coordination. CT-3 + CT-4 are FRAGMENTING — require rapid response. CT-2 + CT-6 are DEGRADED — playbook execution. CT-1 is CONTAINABLE — routine.

**Containment is the operator's first action. Remediation is the second. Both required for full response.**

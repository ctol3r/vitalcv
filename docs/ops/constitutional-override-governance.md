# Constitutional Override Governance

**Status:** **CONSTITUTIONAL — OVERRIDE FRAMEWORK** · **Date established:** 2026-05-08 · **Authority:** subordinate to `human-governance-failure-taxonomy.md` HF-8, `constitutional-containment-taxonomy.md` CT-7, `TRUST_GUARANTEE_LEXICON.md` §6

This doc defines how temporary overrides must behave: visibility, expiration, survivability risk, forensic warning requirements, constitutional impact disclosure.

The contract: **temporary overrides must remain explicitly temporary** (per non-negotiable rule #4). Override normalization (HF-8) is the dominant ERODING risk; the framework here is the discipline.

---

## 1. The 4 override classes

| # | Class | Example |
|---|---|---|
| **OV-1** | Degraded replay visibility accepted | Lock v2 wording fix deferred; "replay resistance" wording shipped temporarily |
| **OV-2** | Export lag tolerated | EX-3 SLA missed during incident; ops accepts SIEM-primary forensic temporarily |
| **OV-3** | Forensic incompleteness acknowledged | Audit retention SLA temporarily reduced (e.g., during DB migration) |
| **OV-4** | Lineage fragmentation temporarily accepted | T0 path used for canonical event during emergency; mutation-vs-audit reconciliation deferred |

---

## 2. Mandatory override fields

Every override approval MUST specify:

| Field | Required content |
|---|---|
| **Override ID** | UUID for tracking |
| **Override class** | OV-1 / OV-2 / OV-3 / OV-4 |
| **Specific drift** | Cross-reference to `constitutional-drift-registry.md` entry (e.g., L-DR-1) |
| **Scope** | Which surfaces / handlers / paths affected |
| **Approval requester** | Name + role |
| **Approver** | Founder (per `TRUST_GUARANTEE_LEXICON.md` §6) |
| **Approval timestamp** | UTC ISO-8601 |
| **Expiration timestamp** | UTC ISO-8601 — MUST be ≤ 30 days from approval |
| **Renewal policy** | "Auto-expire" OR "Renewal requires founder + Codex SAFE re-audit" |
| **Survivability risk** | Per `constitutional-failure-survivability.md` for the affected breach class |
| **Forensic risk** | What forensic capability is temporarily reduced |
| **Constitutional impact** | What lexicon-aligned wording is temporarily NOT enforced |
| **Closure plan** | Specific gate / wave / commit that closes the override |

---

## 3. Per-class override behavior

### 3.1 OV-1 Degraded replay visibility

**Visibility:** dashboard W-3 widget shows "Replay observability degraded — override active until [date]; reason: [link to override]" + ⚫ CT-VIOLATION badge.

**Expiration:** ≤ 30 days; auto-expire to ENFORCED state.

**Survivability risk:** capture-replay attacks during override window may go undetected if payloadHash not enabled.

**Forensic warning:** "investigation of [date range] should treat replay-attack detection as best-effort only."

**Constitutional impact:** lexicon §1.3 forbidden phrase shipped temporarily.

### 3.2 OV-2 Export lag tolerated

**Visibility:** W-4 widget shows "Export survivability degraded — EX-3 SLA exception active until [date]; SOC defaults to EX-1 SIEM with DL-8 disclosure" + 🠀 CT-FRAGMENTING badge.

**Expiration:** ≤ 7 days; renewal requires ops + founder.

**Survivability risk:** forensic queries may miss T2-direct-writer rows; investigations during window incomplete.

**Forensic warning:** "investigations during [date range] cross-reference EX-3 when restored."

**Constitutional impact:** DL-8 SIEM gap operationally tolerated.

### 3.3 OV-3 Forensic incompleteness acknowledged

**Visibility:** W-7 widget shows "Forensic continuity degraded — audit retention temporarily reduced from [old] to [new] until [date]" + 🔴 CT-ESCALATING badge.

**Expiration:** ≤ 14 days; renewal requires founder + legal review.

**Survivability risk:** CB-6 forensic-collapse risk for any data falling outside reduced retention.

**Forensic warning:** "data older than [reduced retention] may not be queryable; investigations limited to [retention window]."

**Constitutional impact:** CB-6 forensic past-window data loss possibility.

### 3.4 OV-4 Lineage fragmentation temporarily accepted

**Visibility:** W-6 widget shows "Lineage continuity degraded — [specific fragmentation] active until [date]; reconciliation deferred" + 🠀 CT-FRAGMENTING badge.

**Expiration:** ≤ 7 days; renewal requires SOC + founder.

**Survivability risk:** orphaned mutations may accumulate; CB-7 trust-class mismatch risk if T0 used.

**Forensic warning:** "audit-mutation reconciliation pending; investigations may show orphaned rows."

**Constitutional impact:** trust-class discipline temporarily relaxed.

---

## 4. Override audit trail

Every override produces a permanent audit trail entry:

```
Override Audit Entry
====================
ID: <UUID>
Class: <OV-1..OV-4>
Drift: <cross-reference>
Scope: <surfaces>
Requester: <name + role>
Approver: <founder>
Approval timestamp: <ISO-8601>
Expiration: <ISO-8601>
Renewal policy: <auto-expire / renewal-required>
Survivability risk: <description>
Forensic risk: <description>
Constitutional impact: <description>
Closure plan: <gate / wave / commit>
Status: ACTIVE / EXPIRED / RENEWED / CLOSED

History:
  <timestamp>: APPROVED by <approver>
  <timestamp>: RENEWAL #N approved by <approver>
  <timestamp>: CLOSED — closure-plan commit <hash>
```

Stored: `docs/ops/override-audit-log/` directory; one entry per override.

---

## 5. Override expiration enforcement

| Mechanism | Detail |
|---|---|
| **Auto-expire** | Default. CI-grep allowlist entry expires; lexicon enforcement re-tightens |
| **Manual closure** | When closure-plan commit lands; override marked CLOSED in audit log |
| **Renewal** | Requires founder approval + Codex SAFE re-audit; renewal increments counter; max renewals before mandatory closure: 3 |

---

## 6. Override normalization detection

Per HF-8 escalation chain (per `governance-erosion-escalation.md` EE-5):

| Indicator | Severity |
|---|---|
| Same override ID renewed > 3 times | 🟡 P2 — pattern detected |
| Same OV class renewed across multiple overrides in 30-day window | 🠀 P1 — class-pattern emerging |
| Override expired but unclosed (audit log shows EXPIRED but drift still present) | 🔴 P0 — violation |
| Quarterly governance review finds active overrides exceed 5 | 🠀 P1 — fatigue indicator |

---

## 7. Forbidden override patterns

| Pattern | Why forbidden |
|---|---|
| "Permanent override" | Overrides MUST expire (per non-negotiable rule #4) |
| "Until further notice" | Equivalent to permanent; prohibited |
| "Override for the [domain] team" | Scope must be specific (handler / surface / path) |
| "Override per founder verbal approval" | Approval must be in audit log with timestamp |
| "Implicit override" (drift exists; no formal approval) | All overrides must be explicit + audited |

---

## 8. Override-to-closure tracking

Every override has a closure plan. Tracking:

```
Override closure SLA
====================
OV-1 (replay visibility): ≤ 30 days; founder + Codex re-audit
OV-2 (export lag): ≤ 7 days; ops + founder
OV-3 (forensic): ≤ 14 days; founder + legal
OV-4 (lineage): ≤ 7 days; SOC + founder
```

Quarterly governance review: count active overrides + average time-to-closure + renewal-rate per class.

---

## 9. Closing principle (constitutional override governance)

Overrides are CONTAINMENT mechanisms, not REMEDIATION. They permit temporary acceptance of constitutional drift while remediation is prepared. Without expiration discipline, overrides become institutionalized drift (HF-8).

**Every override is: visible + expiring + audited + scoped + closure-planned. Anything else is forbidden.**

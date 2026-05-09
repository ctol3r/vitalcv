# Integrity Stress Escalation Paths

**Status:** **OPERATIONAL — ESCALATION MODEL** · **Date established:** 2026-05-08 · **Authority:** subordinate to `constitutional-breach-taxonomy.md`, `runtime-governance-telemetry.md`

This doc models how constitutional degradation escalates over time. Goal: **identify intervention points BEFORE escalation reaches irreversible-drift threshold.**

---

## 1. The 5 escalation chains

| # | Chain | Triggering condition | Terminal state |
|---|---|---|---|
| **EC-1** | Replay ambiguity → operator overtrust | TG-2 → 🟡 DEGRADED | Operators trust replay denials as prevention |
| **EC-2** | Export lag → constitutional drift | TG-3 → 🟡 DEGRADED | EX-3 source becomes default, EX-1 SIEM stream forgotten |
| **EC-3** | Lineage fragmentation → forensic blindness | TG-4 → 🟡 DEGRADED | Audit chains fail; investigations incomplete |
| **EC-4** | Audit T0 failures → silent partial-writes | CIS-4 elevated | Mutations persist while audits lost |
| **EC-5** | Lock-v2 wording inflation → marketing leak | TG-1 → 🟡 DEGRADED | "Replay protected" reaches external surface |

---

## 2. EC-1 — Replay ambiguity → operator overtrust

```
Stage 1: Replay ambiguity detected
  - SOC sees R-OBSERVED + R-DENIED rows; unclear which is which
  - Visibility: 🟡 DEGRADED in TG-2

Stage 2: Replay inflation
  - Dashboard widget labeled "Replay protected" (forbidden phrase)
  - Visibility: 🟠 DRIFTING in TG-1

Stage 3: Replay misclassification
  - SOC marks capture-replay as "honest retry" (R-DENIED conflated with R-OBSERVED)
  - Visibility: 🟠 DRIFTING in TG-2 + TG-1 composite

Stage 4: Forensic ambiguity
  - Investigation conclusions wrong; capture-replay attacks unattributed
  - Visibility: 🟠 DRIFTING in CH-5 forensic continuity

Stage 5: Operator overtrust (terminal)
  - Customer / regulator told "we prevent replays"
  - Visibility: 🔴 CRITICAL — external trust commitment exceeds runtime
```

**Escalation triggers:**
- Stage 1 → 2: dashboard owner adds "Replay protected" badge.
- Stage 2 → 3: SOC playbook not updated with anti-aliases.
- Stage 3 → 4: incident response uses dashboard data uncritically.
- Stage 4 → 5: external surface (sales, marketing) inherits.

**Visibility windows:**
- Stage 1: per-PR (dashboard widget review).
- Stage 2: CI-grep at PR-build (lexicon enforcement).
- Stage 3: SOC playbook review (quarterly).
- Stage 4: post-incident review.
- Stage 5: external customer / regulator surface audit.

**Containment opportunities:** any of stages 1-4 with playbook discipline.

**Irreversible drift point:** Stage 5 — once external commitment is made, retraction has trust + legal costs.

---

## 3. EC-2 — Export lag → constitutional drift

```
Stage 1: EX-3 occasional slowness
  - Forensic queries take longer than SLA
  - Visibility: 🟡 DEGRADED in TG-3

Stage 2: Export divergence
  - EX-1 vs EX-3 variance increases beyond DL-8 baseline
  - Visibility: 🟠 DRIFTING in TG-3

Stage 3: Lineage inconsistency
  - EX-1 SIEM stream and EX-3 Postgres show different audit chains
  - Visibility: 🟠 DRIFTING in CH-4 export coherence

Stage 4: Forensic fragmentation
  - SOC defaults to whichever path is fastest; cross-source verification skipped
  - Visibility: 🟠 DRIFTING in TG-5 forensic degradation

Stage 5: Constitutional drift (terminal)
  - Operators forget the structural DL-8 SIEM gap
  - Dashboard claims "complete audit log via SIEM" (forbidden phrase)
  - Visibility: 🔴 CRITICAL — CB-1 constitutional breach
```

**Escalation triggers:**
- Stage 1 → 2: ops doesn't investigate EX-3 slowness root cause.
- Stage 2 → 3: dashboard widgets default to EX-1 source without canonical-query cross-check.
- Stage 3 → 4: SOC training erodes; new analysts don't know about DL-8.
- Stage 4 → 5: dashboard widget label drifts to forbidden phrasing.

**Visibility windows:**
- Stages 1-2: continuous monitoring (TG-3).
- Stage 3: weekly cross-source variance check.
- Stage 4: quarterly SOC audit.
- Stage 5: CI-grep + Codex audit.

**Containment opportunities:** stages 1-3 highest leverage.

**Irreversible drift point:** Stage 5 inflation reaching external customer surface (per EC-1 logic).

---

## 4. EC-3 — Lineage fragmentation → forensic blindness

```
Stage 1: Audit retention shortened
  - Old rows GC'd before forensic horizon
  - Visibility: 🟡 DEGRADED in TG-4 + CH-5

Stage 2: Audit chain incompleteness rises
  - Mean events per chain drops below baseline
  - Visibility: 🟠 DRIFTING in TG-4

Stage 3: Cross-row joins fail
  - referenceId joins return zero for older operations
  - Visibility: 🟠 DRIFTING in CH-5

Stage 4: Forensic blindness for affected window
  - Investigations of older incidents impossible
  - Visibility: 🔴 CRITICAL in CH-5

Stage 5: Compliance / legal failure (terminal)
  - Audit produces "complete log" claim that can't be verified
  - Visibility: 🔴 CRITICAL — CB-6 forensic collapse
```

**Containment opportunities:** Stage 1 (formalize retention SLA — gate G7).

**Irreversible drift point:** Stage 4 — past data is gone; can't be recovered.

---

## 5. EC-4 — Audit T0 failures → silent partial-writes

```
Stage 1: T0 CRITICAL log volume rises
  - createAuditEvent dual-write Postgres failures elevated
  - Visibility: 🟡 DEGRADED in CIS-4

Stage 2: Postgres-vs-in-memory divergence
  - SIEM stream shows entries Postgres doesn't have
  - Visibility: 🟠 DRIFTING in CH-4

Stage 3: Silent partial-writes
  - Mutations succeed (non-T0 path); audits lost (T0 path)
  - Visibility: 🟠 DRIFTING in CH-2

Stage 4: Trust-class mismatch realization
  - Operator audit reveals T0 was used for canonical event
  - Visibility: 🔴 CRITICAL — CB-7

Stage 5: Mutation-without-audit hotfix (terminal)
  - Hotfix to migrate T0 → C-1; backfill if possible
  - Visibility: 🔴 CRITICAL — incident response
```

**Containment opportunities:** Stage 1 monitoring + Stage 2 cross-source variance alerting.

**Irreversible drift point:** Stage 4 — partial-write rows from past period can't be retroactively coupled.

---

## 6. EC-5 — Lock-v2 wording inflation → marketing leak

```
Stage 1: Lock v2 doc retains "atomic mutation+audit" / "replay resistance" wording (current state)
  - Visibility: 🟡 DEGRADED in TG-1 (lexicon)
  - L-DR-1, L-DR-2 in drift registry

Stage 2: PR description copies Lock v2 wording
  - Author inherits pattern
  - Visibility: 🟠 DRIFTING (CI-grep should catch but allowlist for Lock v2 doc)

Stage 3: Implementation PR ships with inflated wording
  - Codex SAFE caught OR not (depending on prompt enforcement)
  - Visibility: depends on CR-2/CR-4 rejection at merge gate

Stage 4: Dashboard widget inherits wording
  - Operational surface adopts inflated phrasing
  - Visibility: 🟠 DRIFTING in TG-7 + TG-1

Stage 5: Marketing surface inherits (terminal)
  - vitalcv.com or sales material adopts
  - Visibility: 🔴 CRITICAL — external trust commitment
```

**Containment opportunities:** Stage 1 fix (Lock v2 wording fix per W2-PR2C R2 + R10).

**Irreversible drift point:** Stage 5 marketing inheritance.

---

## 7. Cross-chain interaction

EC-1 + EC-2 can compound: if export degradation (EC-2) makes SOC default to EX-3 silently, AND replay observability becomes ambiguous (EC-1), the combined effect is "operators trust SIEM data that lacks denial visibility AND misclassify replay states."

EC-4 + EC-3 compound: silent partial-writes (EC-4) rendered invisible by forensic blindness (EC-3) means uncovered failures.

EC-5 + EC-1 compound: Lock v2 wording (EC-5) provides terminology that inflates EC-1 chain.

**Containment cross-leverage:** lexicon enforcement (TG-1) is upstream of EC-1, EC-2, EC-5. Closing TG-1 prevents the linguistic substrate of three chains.

---

## 8. Closing principle (escalation paths)

Constitutional degradation escalates predictably. The chains are foreseeable; the visibility windows are real; the containment opportunities are upstream. The irreversible-drift points are downstream — typically external trust commitments that can't be retracted without cost.

**Operators intervene early; founder reviews escalations; the chains are bounded by discipline + monitoring + lexicon.**

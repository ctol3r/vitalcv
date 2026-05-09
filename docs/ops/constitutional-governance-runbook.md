# Constitutional Governance Runbook

**Status:** **OPERATIONAL — RUNBOOK** · **Date established:** 2026-05-08 · **Authority:** consolidates `constitutional-containment-taxonomy.md`, `escalation-governance-paths.md`, `constitutional-decision-matrix.md`, `integrity-containment-dashboard.md`

This is the operator runbook for constitutional degradation response. For each scenario, the runbook defines: investigation sequence, visibility sequence, containment sequence, escalation sequence, forensic-caution sequence.

---

## 1. The 6 runbook scenarios

| # | Scenario | Triggers |
|---|---|---|
| **RB-1** | Replay degradation | TG-2 → 🟡/🠀/🔴 OR CIS-3/CIS-5 alarm |
| **RB-2** | Export degradation | TG-3 → 🟡/🠀/🔴 OR CA-3 alarm |
| **RB-3** | Lineage fragmentation | TG-4 → 🟡/🠀/🔴 OR weekly chain-completeness drop |
| **RB-4** | Dashboard/runtime divergence | TG-7 → 🟡/🠀/🔴 OR CA-2 alarm |
| **RB-5** | Constitutional drift | TG-1 → 🟡/🠀/🔴 OR CA-1/CA-5 alarm |
| **RB-6** | Constitutional violation | CT-7 indicator OR shipped forbidden phrasing detected |

---

## 2. Universal runbook prefix (every scenario)

Before specific scenario steps, every operator runs:

```
1. CONFIRM — verify the alarm is not a false positive
   - Cross-check telemetry source
   - Check baseline window for natural variance
   - Confirm via secondary signal where possible

2. CLASSIFY — identify containment class (CT-1..CT-7)
   - Per `constitutional-containment-taxonomy.md`

3. DOCUMENT — open incident ticket
   - Severity per escalation paths
   - Affected scope (per-handler / domain / platform)
   - Trigger time
```

Then proceed to scenario-specific steps.

---

## 3. RB-1 Replay degradation runbook

```
INVESTIGATION
1. Check correlationId presence rate on recent audit rows
   Q: SELECT COUNT(*) FILTER (WHERE metadata->>'correlationId' IS NULL),
              COUNT(*) AS total
       FROM audit_events WHERE created_at > now() - interval '1 hour'
2. Check denial-rate variance vs 7-day baseline (Q-CANON-7 from canonical-query-model.md)
3. Identify which path is degrading (per-handler breakdown)

VISIBILITY
4. W-3 widget should show 🠀 CT-FRAGMENTING or 🔴 CT-ESCALATING
5. SOC playbook: replay-taxonomy disambiguation matrix (replay-taxonomy-map.md §6)

CONTAINMENT
6. If specific handler: pause handler-level traffic if feasible
7. If multi-handler: SOC + Codex audit assessment
8. Identify root cause: regression / config change / new code path

ESCALATION
9. If denial-rate variance > 50% drop: P0 ops + founder
10. If replay observability appears in marketing/dashboard: CA-1 inflation; founder review

FORENSIC CAUTION
11. Past replay-attempts during regression window may be invisible
12. payloadHash clustering (RG-Rec-2) recovers some forensic signal
13. Document affected window scope; founder + legal coordination if needed
```

---

## 4. RB-2 Export degradation runbook

```
INVESTIGATION
1. Check EX-3 Postgres availability + SLA
2. Check EX-3 row-count trend vs 7-day baseline
3. Check EX-1 SIEM stream lag
4. Identify root cause: DB outage / retention sweep / migration

VISIBILITY
5. W-4 widget should show degraded state
6. Cross-source variance > DL-8 baseline = new T2 writers OR T0 failures

CONTAINMENT
7. Restore EX-3 availability (DB ops)
8. If retention sweep error: PAUSE sweep; investigate
9. If schema migration: PAUSE migration if it affects forensic queries

ESCALATION
10. EX-3 unavailable > 5 minutes: P0 ops on-call
11. Forensic investigations actively blocked: founder briefing
12. Past data potentially lost: founder + legal coordination

FORENSIC CAUTION
13. SIEM stream may have data EX-3 doesn't (or vice versa per DL-8)
14. Cross-source verification REQUIRED before forensic conclusions
15. Document outage window; bound queries to pre-outage data if needed
```

---

## 5. RB-3 Lineage fragmentation runbook

```
INVESTIGATION
1. Run chain-completeness query (per CIS-7)
2. Identify which traceIds / referenceIds have incomplete chains
3. Check audit retention sweep timing
4. Check T0 CRITICAL log volume

VISIBILITY
5. W-6 widget shows degraded state
6. Per-traceId timeline view in dashboard

CONTAINMENT
7. If retention sweep: pause sweep; restore retention SLA
8. If T0 spike: identify T0 paths failing; consider migration to T1
9. If worker delay: investigate worker queue lag

ESCALATION
10. If past chains lost: P0 forensic team + founder
11. If chain reconstruction broken for active investigations: SOC escalates

FORENSIC CAUTION
12. Past chains may be permanently incomplete (CB-5 fragmenting)
13. Document affected window
14. Backup-recovery may help if backup retention covers
```

---

## 6. RB-4 Dashboard/runtime divergence runbook

```
INVESTIGATION
1. Identify which widget is divergent
2. Compare widget query to canonical Q-CANON template
3. Check vocabulary-map for missing aliases
4. Check audit-row-schema for field semantics

VISIBILITY
5. Dashboard widget should show 🟡 CT-DEGRADED label
6. Cross-source variance metric on dashboard

CONTAINMENT
7. Label widget DEGRADED until fix
8. Update widget query to canonical OR-clause
9. Review widget owner + dashboard governance

ESCALATION
10. If forbidden phrasing on widget: CA-1 inflation; founder review
11. If widget is decision input: notify decision-makers of divergence

FORENSIC CAUTION
12. Past decisions based on divergent widget may be wrong
13. Document decision-window affected
```

---

## 7. RB-5 Constitutional drift runbook

```
INVESTIGATION
1. CI-grep failures: list affected PRs / docs / files
2. Codex audit verdicts: review rejection reasons
3. 7-PR rolling window for forbidden phrase trend
4. Identify drift source (author / pattern / regression)

VISIBILITY
5. W-5 widget shows DRIFT state
6. Drift registry updated with new entries

CONTAINMENT
7. Block PRs containing drift; require remediation
8. Review reviewer playbook + Codex prompt
9. If pattern across PRs: reviewer training

ESCALATION
10. If drift shipped: P1 review; founder review for repeat patterns
11. If drift reaches dashboard / marketing: CA-1; founder + legal

FORENSIC CAUTION
12. Past PRs with shipped drift may have inflated commit messages
13. Document scope; consider revert + re-merge with corrected wording
```

---

## 8. RB-6 Constitutional violation runbook

```
INVESTIGATION
1. Identify violation class (lexicon shipped / class-mismatch / etc.)
2. Assess scope (PR-level / dashboard / marketing / external)
3. Identify root cause (gate failure / human override / undetected)

VISIBILITY
4. ⚫ CT-VIOLATION indicator on affected dashboard
5. CHS metric drops to COLLAPSING
6. Founder briefing within 1 hour

CONTAINMENT
7. Block further propagation: pause affected PRs / dashboards / customer comms
8. If shipped externally: prepare correction comms (lexicon-aligned)
9. Update gate that failed (CI-grep / Codex prompt / reviewer playbook)

ESCALATION
10. P0 incident; founder + legal + compliance + customer success
11. Post-incident review
12. Constitutional drift registry updated

FORENSIC CAUTION
13. External commitments based on violation may have legal weight
14. Truthful retraction language (lexicon-aligned)
15. Document root cause + fix + post-incident actions
```

---

## 9. Per-runbook completion criteria

A runbook is COMPLETE when:

1. Investigation: root cause identified.
2. Visibility: degradation visible to operator + founder if escalated.
3. Containment: scope frozen; no further escalation.
4. Escalation: appropriate path traversed (EG-1..EG-5).
5. Forensic caution: past-data implications documented.
6. Remediation: applied (per `constitutional-recovery-semantics.md`).
7. Verification: per recovery-confidence tier (CI re-pass / Codex re-audit / canonical-query verification).
8. Post-incident: updated drift registry + lessons learned.

---

## 10. Closing principle (governance runbook)

The runbook is the operator's bible for constitutional degradation response. Every scenario has investigation → visibility → containment → escalation → forensic caution sequence. Operators consult; SOC executes; founder approves escalations.

**Documented governance becomes operational governance through runbook discipline. Without the runbook, operators improvise; with it, response is consistent + auditable + complete.**

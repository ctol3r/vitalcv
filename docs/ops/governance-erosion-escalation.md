# Governance Erosion Escalation

**Status:** **OPERATIONAL — EROSION MODEL** · **Date established:** 2026-05-08 · **Authority:** subordinate to `human-governance-failure-taxonomy.md`, `integrity-stress-escalation-paths.md`

This doc models how operational shortcuts evolve into constitutional degradation through human normalization. Each erosion path traces from initial shortcut to irreversible governance loss.

---

## 1. The 5 erosion paths

| # | Path | Initial shortcut | Terminal state |
|---|---|---|---|
| **EE-1** | Replay-warning normalization | Operators ignore "replay degradation" alerts | Forensic trust erosion (capture-replay attacks invisible) |
| **EE-2** | Export-lag acceptance | Operators tolerate EX-3 latency | Constitutional drift institutionalized (DL-8 SIEM gap forgotten) |
| **EE-3** | Lineage incompleteness normalization | Operators accept "occasional missing rows" | Forensic blindness for affected windows |
| **EE-4** | Badge desensitization | Operators stop reading trust-class badges | Class-mismatch decisions (T0 ≈ C-1 confusion) |
| **EE-5** | Override normalization | Founder approvals for "temporary" override repeat | Permanent constitutional violation |

---

## 2. Per-path stages

### 2.1 EE-1 Replay-warning normalization → forensic trust erosion

```
Stage 1: Replay-degradation alert fires (CIS-3 OR CIS-5)
  - Operator investigates; finds bounded cause
  - Trust intact

Stage 2: Alert recurrence
  - Operator: "It always shows yellow"
  - Investigation depth shrinks

Stage 3: Replay ambiguity normalized
  - Operator skips disambiguation matrix consultation
  - Replay-state classification mistakes accumulate

Stage 4: Replay inflation tolerated
  - Dashboard widget labeled "Replay protected" (forbidden phrase)
  - CI-grep allowlist gets entry "for routine use"

Stage 5: Forensic trust erosion (terminal)
  - Capture-replay attacks invisible AND operationally tolerated
  - "Replay-protected" claim reaches external surface
  - Constitutional violation institutionalized
```

**Erosion triggers:**
- Stage 1 → 2: alert frequency exceeds investigation capacity.
- Stage 2 → 3: SOC playbook not refreshed.
- Stage 3 → 4: Codex audit prompt not enforced for new dashboards.
- Stage 4 → 5: marketing surface inheritance.

**Normalization thresholds:**
- Stage 2: 3 alerts in 7 days without root-cause investigation.
- Stage 3: SOC consultations of disambiguation matrix drop > 50%.
- Stage 4: dashboard / commit message contains forbidden phrase.
- Stage 5: external commitment.

**Escalation windows:**
- Stage 2 → 3: weeks.
- Stage 3 → 4: months.
- Stage 4 → 5: months to years.

**Containment opportunities:** Stage 1 (alert tuning); Stage 2 (SOC training refresh); Stage 3 (dashboard governance audit).

**Irreversible governance erosion point:** Stage 5 external commitment.

### 2.2 EE-2 Export-lag acceptance → constitutional drift

```
Stage 1: EX-3 query latency occasionally elevated
  - Ops: "It's just slow today"

Stage 2: SOC defaults to EX-1 SIEM (faster)
  - DL-8 SIEM gap forgotten in routine work

Stage 3: Dashboard widgets default to EX-1 source
  - Coverage gap operationally tolerated

Stage 4: SOC playbook updated to "use SIEM as primary"
  - DL-8 acknowledgment drops from playbook

Stage 5: Constitutional drift institutionalized (terminal)
  - "SIEM has all events" becomes operational truth
  - DL-8 forgotten; canonical EX-3 path becomes legacy
  - "Complete audit log via SIEM" reaches external claims
```

**Erosion triggers:**
- Stage 1 → 2: ops doesn't investigate EX-3 slowness root cause.
- Stage 2 → 3: dashboard owners default to faster source without documenting.
- Stage 3 → 4: SOC training doesn't refresh per DL-8.
- Stage 4 → 5: external commitment.

**Containment opportunities:** Stage 1 (root-cause investigation); Stage 3 (dashboard governance audit per `dashboard-governance-enforcement.md`).

**Irreversible governance erosion point:** Stage 5.

### 2.3 EE-3 Lineage incompleteness normalization → forensic blindness

```
Stage 1: Audit-chain query returns occasional incompleteness
  - Operator: "Worker delay; it'll catch up"

Stage 2: Mean events per chain drops below baseline
  - "We just have more T0 paths now"

Stage 3: Cross-row joins silently failing
  - SOC accepts partial chain reconstruction

Stage 4: Audit retention SLA shortened
  - "It saves cost; investigations rarely need older data"

Stage 5: Forensic blindness (terminal)
  - Past investigations impossible
  - Compliance audit fails: "complete audit trail" claim unverifiable
```

**Containment opportunities:** Stage 1-2 (root-cause); Stage 4 (founder + legal review of retention SLA).

**Irreversible governance erosion point:** Stage 5 — past data lost.

### 2.4 EE-4 Badge desensitization → class-mismatch decisions

```
Stage 1: Trust-class + lineage badges become standard
  - Operators read them initially

Stage 2: Badges become wallpaper
  - Operators query data without consulting badges

Stage 3: T0 path used where C-1 expected
  - Class-mismatch undetected at code review

Stage 4: Silent partial-writes accumulate
  - CB-7 trust-class mismatch FRAGMENTING

Stage 5: Audit-vs-mutation reconciliation reveals orphans (terminal)
  - Past rows have no audit trail
  - Compliance + legal exposure
```

**Containment opportunities:** Stage 2 (dashboard simplification + badge prominence); Stage 3 (Codex audit + reviewer playbook).

**Irreversible governance erosion point:** Stage 5 — orphaned mutations cannot retroactively gain audit pairing.

### 2.5 EE-5 Override normalization → permanent constitutional violation

```
Stage 1: Founder approves temporary override for one drift instance
  - "Just this once; we'll fix in next wave"

Stage 2: Same drift recurs; second override approved
  - Pattern emerging

Stage 3: Override audit trail shows recurring approvals
  - Founder approval becomes routine for this drift class

Stage 4: Override expiration not enforced
  - "Temporary" becomes permanent

Stage 5: Constitutional violation institutionalized (terminal)
  - Drift becomes part of platform's documented behavior
  - Lexicon enforcement weakened
  - Marketing surface inheritance possible
```

**Containment opportunities:** ALL stages — override audit trail visibility per `constitutional-override-governance.md`.

**Irreversible governance erosion point:** Stage 5 — once institutionalized, requires founder coordination to retract.

---

## 3. Cross-path interactions

EE-1 + EE-2 compound: replay normalization (EE-1) makes operators tolerate EE-2's export degradation as "we have alternatives" — when in reality the alternatives miss Lock v2 denials per DL-8.

EE-3 + EE-4 compound: lineage incompleteness (EE-3) makes badge desensitization (EE-4) self-reinforcing: operators trust runtime data without badges because chain-completeness queries are routine ambiguous.

EE-5 + any other: override normalization can institutionalize ANY drift class by repeated approval.

**Cross-leverage mitigation:** quarterly governance review covering all 5 paths simultaneously catches compounding earlier than per-path monitoring.

---

## 4. Per-path containment opportunities (priority)

| Path | Highest-leverage stage | Mitigation |
|---|---|---|
| EE-1 | Stage 1 | Alert tuning + bounded-frequency SLA |
| EE-2 | Stage 1 | EX-3 latency root-cause investigation |
| EE-3 | Stage 4 | Founder + legal review on retention SLA changes |
| EE-4 | Stage 2 | Dashboard simplification + badge prominence |
| EE-5 | All stages | Override audit + expiration enforcement |

---

## 5. Closing principle (governance erosion escalation)

Erosion is incremental. Each shortcut feels reasonable in isolation. The chains show how reasonable shortcuts compound into constitutional violation. Containment requires operators + founder + reviewer at each stage.

**The earliest stage is the highest-leverage. The terminal stage is irreversible. Time is on the side of erosion; vigilance is the only defense.**

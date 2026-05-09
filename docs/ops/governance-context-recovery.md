# Governance Context Recovery

**Status:** **OPERATIONAL — RECOVERY MECHANISMS** · **Date established:** 2026-05-08 · **Authority:** subordinate to `constitutional-doctrine-persistence.md`, `governance-knowledge-survivability.md`

This doc defines how operators recover lost governance context when institutional knowledge degrades. Each mechanism is bounded — recovery is partial; speed depends on the surface; some context is irrecoverable.

The contract: **institutional memory survivability is probabilistic** (per non-negotiable rule #7). Recovery mechanisms reduce the probability of catastrophic loss; they don't prevent it.

---

## 1. The 5 recovery mechanisms

| # | Mechanism | What it recovers | Recovery quality |
|---|---|---|---|
| **GR-1** | Doctrine bundle re-read | Canonical rules + their reasoning | 🟢 STRONG (if docs preserved) |
| **GR-2** | Wave-history walkthrough | WHY each constitutional decision was made | 🟡 PARTIAL (depends on PR descriptions + commit messages) |
| **GR-3** | Override audit log review | Past drift acceptance pattern; what was tolerated | 🟢 STRONG (if audit log preserved) |
| **GR-4** | Drift registry consultation | Known active drifts + closure status | 🟢 STRONG |
| **GR-5** | Mentorship + institutional-memory interview | Tacit knowledge + judgment-call context | 🟠 LIMITED (depends on mentor availability + recall) |

---

## 2. Per-mechanism detail

### 2.1 GR-1 Doctrine bundle re-read

**What:** operator re-reads canonical constitutional docs from `docs/ops/`.

**When to use:** new role onboarding; post-incident retrospective; quarterly governance review.

**Recovery quality:** 🟢 STRONG — docs are durable and version-controlled. Limitation: docs explain WHAT, not always WHY.

**Choke point:** if doctrine docs are deprecated/removed (IM-7 abandonment), recovery via this mechanism fails.

**Mitigation:** mandatory doctrine bundle preservation per `constitutional-doctrine-persistence.md` §2.

### 2.2 GR-2 Wave-history walkthrough

**What:** operator reviews PR #277 (and successor wave PRs) commit history + PR descriptions to reconstruct WHY each governance decision was made.

**When to use:** maintainer onboarding; constitutional override review; founder coordination on major drift.

**Recovery quality:** 🟡 PARTIAL — PR descriptions vary in completeness. Per Codex SAFE prompt, future PRs should be more rigorous; legacy PRs may lack context.

**Choke point:** PR/commit history GC; repository migration.

**Mitigation:** preserve git history; tag major constitutional waves; preserve Codex audit transcripts.

### 2.3 GR-3 Override audit log review

**What:** operator reviews `docs/ops/override-audit-log/` (or equivalent) entries for past constitutional acceptance patterns.

**When to use:** considering new override request; quarterly governance review; identifying institutionalized drift.

**Recovery quality:** 🟢 STRONG — log entries are structured per `constitutional-override-governance.md` §4.

**Choke point:** log curation discipline. If overrides shipped without audit-log entry (forbidden per §7), past pattern is invisible.

**Mitigation:** mandatory audit-log entry per override; quarterly audit.

### 2.4 GR-4 Drift registry consultation

**What:** operator consults `constitutional-drift-registry.md` for known active drifts + their classification + closure gate.

**When to use:** investigating new degradation; planning new wave; post-incident analysis.

**Recovery quality:** 🟢 STRONG — registry is structured + version-controlled.

**Choke point:** registry currency. Stale entries reduce trust in registry; new drifts may not be added.

**Mitigation:** quarterly registry audit; per-wave registry update.

### 2.5 GR-5 Mentorship + institutional-memory interview

**What:** operator consults longest-tenured colleague OR founder for tacit context.

**When to use:** complex constitutional decisions; novel inflation patterns; founder-coordination scenarios.

**Recovery quality:** 🟠 LIMITED — depends on mentor's recall + availability + alignment with documented doctrine.

**Choke point:** mentor turnover; founder unavailability.

**Mitigation:** structured knowledge-transfer interviews when key personnel transition out; onboarding mentor pairing per `constitutional-doctrine-persistence.md` §7.

---

## 3. Governance breadcrumb systems

Beyond formal recovery mechanisms, breadcrumbs throughout the platform enable context reconstruction:

| Breadcrumb | Where | What it preserves |
|---|---|---|
| Lexicon-aligned wording in audit-row labels | Postgres audit_event.metadata.action | Forbidden-phrase discipline visible in data |
| Constitutional-doc cross-references in Codex audit transcripts | PR conversations | WHY each rule applied |
| Trust-class declarations in PR descriptions | git history | Per-path classification recorded |
| Override-audit-log entries | docs/ops/override-audit-log/ | Past acceptance patterns |
| Wave-PR description (e.g., this PR #277 chain) | git history | Full constitutional reasoning history |
| Drift-registry cross-references | registry doc | Active drift state |
| Codex SAFE verdict transcripts | merge-gate artifacts | Per-PR constitutional state |

A future operator reconstructing context starts from any breadcrumb; cross-references propagate.

---

## 4. Institutional memory reconstruction paths

When context is partially lost, operators can reconstruct:

### 4.1 Path 1: From a single PR forward

Operator reviewing PR #N for context:
1. Read PR description.
2. Follow Codex SAFE verdict transcript.
3. Cross-reference doctrine docs cited in transcript.
4. Cross-reference drift registry for any active drifts referenced.
5. Cross-reference override audit log for any override referenced.

### 4.2 Path 2: From a drift entry

Operator investigating drift:
1. Open drift registry entry.
2. Cross-reference closing wave per §5 of registry.
3. Cross-reference originating doc.
4. Cross-reference override-audit-log if accepted via override.

### 4.3 Path 3: From a runbook scenario

Operator executing runbook:
1. Open runbook scenario.
2. Cross-reference containment taxonomy class.
3. Cross-reference escalation path.
4. Cross-reference decision matrix.
5. Cross-reference recovery semantics.

### 4.4 Path 4: From a dashboard widget

Operator interpreting widget:
1. Read widget's trust-class + lineage badges.
2. Cross-reference runtime-trust-class-map.
3. Cross-reference canonical-query-model for widget's data source.
4. Cross-reference operational-guarantee-matrix for per-class strength.

---

## 5. Forensic doctrine references

When investigating an incident, the canonical reference path:

```
Step 1: Identify breach class (constitutional-breach-taxonomy.md)
Step 2: Identify containment class (constitutional-containment-taxonomy.md)
Step 3: Apply runbook scenario (constitutional-governance-runbook.md)
Step 4: Apply decision matrix (constitutional-decision-matrix.md)
Step 5: Apply recovery semantics (constitutional-recovery-semantics.md)
Step 6: Update drift registry (constitutional-drift-registry.md)
Step 7: Document in override audit log if applicable (constitutional-override-governance.md)
```

This 7-step pattern is itself a doctrine artifact; preserved per `constitutional-doctrine-persistence.md`.

---

## 6. Recovery-mechanism failure scenarios

| Scenario | Mitigation |
|---|---|
| Doctrine doc deprecated → GR-1 fails | Quarterly doctrine audit per `constitutional-doctrine-persistence.md` PM-1 |
| PR history GC'd → GR-2 fails | Preserve git history; tag constitutional waves |
| Override audit log incomplete → GR-3 fails | Audit log entry mandatory per override-governance §4 |
| Drift registry stale → GR-4 fails | Quarterly registry audit; per-wave update mandate |
| All mentors transitioned → GR-5 fails | Structured knowledge-transfer interviews on departure |

---

## 7. Recovery confidence per scenario

For each scenario, the realistic recovery confidence:

| Scenario | Recovery confidence |
|---|---|
| New hire onboarding (full bundle preserved) | 🟢 STRONG |
| New maintainer 1 year after wave (PR + transcripts preserved) | 🟢 STRONG |
| New operator 5 years after wave (some drift institutionalized) | 🟡 PARTIAL — depends on bundle currency |
| Recovery 10 years after wave (founder transitioned, mentors unavailable) | 🟠 LIMITED — depends on doctrine-bundle preservation discipline |
| Recovery after constitutional re-write (institutional discontinuity) | 🔴 LIMITED — past doctrine may be irrecoverable |

---

## 8. Closing principle (governance context recovery)

Recovery mechanisms reduce institutional memory loss. None prevents it absolutely. The 5 mechanisms compose: any single one can fail; collective redundancy preserves substrate.

**Future operators can reconstruct constitutional reasoning IF the bundle is preserved + the breadcrumbs are intact + the discipline of mentorship + audit-log + drift-registry continues.** The platform's institutional survivability is a discipline, not a guarantee.

# Institutional Memory Failure Taxonomy

**Status:** **OPERATIONAL — INSTITUTIONAL MEMORY MODEL** · **Date established:** 2026-05-08 · **Authority:** subordinate to `human-governance-failure-taxonomy.md`, `governance-erosion-escalation.md`, `constitutional-override-governance.md`

This doc defines 8 institutional memory failure classes — how governance intent + constitutional reasoning erode across time despite documentation. Each names: institutional behavior, governance impact, replay impact, forensic impact, survivability impact, detectability, recoverability.

The contract: **documentation existence is NOT institutional understanding** (per non-negotiable rule #1). Docs persist; doctrine literacy degrades.

---

## 1. The 8 institutional memory failure classes

| # | Class | Definition | Aggregate |
|---|---|---|---|
| **IM-1** | Replay-caution erosion | "Replay observability" framing forgotten; new hires assume prevention | 🠀 FORGOTTEN |
| **IM-2** | Survivability-language dilution | Lexicon-aligned wording diluted; "atomic" / "tamper-evident" qualifiers dropped | 🠀 FORGOTTEN |
| **IM-3** | Override normalization institutionalization | Repeated overrides documented as "standard practice"; expiration discipline forgotten | 🔴 INSTITUTIONALIZED |
| **IM-4** | Forensic-shortcut institutionalization | "SOC uses SIEM as primary" becomes documented norm; DL-8 caveat lost | 🔴 INSTITUTIONALIZED |
| **IM-5** | Dashboard optimism institutionalization | "If green, we're fine" becomes operational truth; CT trajectory ignored | 🠀 FORGOTTEN |
| **IM-6** | Constitutional-context loss | New contributors don't know WHY docs exist; treat as bureaucratic | 🟡 ERODING |
| **IM-7** | Governance-doc abandonment | Docs marked stale; not consulted; eventually deprecated without replacement | 🠀 FORGOTTEN |
| **IM-8** | Drift normalization inheritance | Past drift accepted by previous team becomes "the way it is" for new team | 🔴 INSTITUTIONALIZED |

---

## 2. Per-class detail

### 2.1 IM-1 Replay-caution erosion

**Institutional behavior:** new hires read "replay observability" docs as "we have replay protection"; vocabulary discipline degrades.

**Governance impact:** lexicon §1.3 forbidden phrases creep back in.

**Replay impact:** capture-replay attacks under-investigated.

**Forensic impact:** replay-state classification mistakes accumulate.

**Survivability impact:** F-4 collapse mitigation depends on caution; erosion increases risk.

**Detectability:** 🟡 MEDIUM (CI-grep + Codex catches; underlying institutional understanding harder to measure).

**Recoverability:** 🟡 PARTIAL (re-training restores; institutional inertia resists).

### 2.2 IM-2 Survivability-language dilution

**Institutional behavior:** "atomic mutation+audit" gets shortened to "atomic mutation" in casual speech; eventually appears unqualified in PRs.

**Governance impact:** IP-1 atomicity inflation per `survivability-inflation-audit.md`.

**Replay impact:** N/A directly; indirectly affects R0 framing.

**Forensic impact:** L4/L5 audit-strength claims may creep in.

**Survivability impact:** trust-class boundaries blur (HF-5 + IM-2 compound).

**Detectability:** 🟢 HIGH (CI-grep on PR descriptions).

**Recoverability:** 🟢 STRONG (lexicon enforcement re-tightens).

### 2.3 IM-3 Override normalization institutionalization

**Institutional behavior:** override audit log shows recurring renewals for same drift; founder approvals routine; "this is just how we do it."

**Governance impact:** HF-8 + EE-5 institutionalized at organizational level.

**Replay impact:** if override class is OV-1 (replay), permanent inflation risk.

**Forensic impact:** if override class is OV-3 (forensic), permanent past-window data loss tolerance.

**Survivability impact:** drift becomes platform's documented behavior.

**Detectability:** 🟢 HIGH (override audit log reveals patterns).

**Recoverability:** 🟠 LIMITED — once institutionalized, retraction has organizational cost.

### 2.4 IM-4 Forensic-shortcut institutionalization

**Institutional behavior:** SOC playbook updated to default EX-1 SIEM; DL-8 caveat moved to footnote then dropped.

**Governance impact:** EE-2 institutionalized.

**Replay impact:** Lock v2 denied-replay rows missed in routine investigation.

**Forensic impact:** investigations conclude on incomplete data as standard practice.

**Survivability impact:** false sense of forensic completeness institutionalized.

**Detectability:** 🟡 MEDIUM (per-incident playbook adherence audit).

**Recoverability:** 🟡 PARTIAL (playbook can be re-tightened; SOC training required).

### 2.5 IM-5 Dashboard optimism institutionalization

**Institutional behavior:** dashboards become reassurance theater; new operators inherit "if green, we're fine" reading.

**Governance impact:** OO-1 + HF-3 institutionalized.

**Replay impact:** W-3 widget DEGRADED states ignored as routine.

**Forensic impact:** W-7 forensic widget DEGRADED states ignored.

**Survivability impact:** CT trajectory awareness lost.

**Detectability:** 🟠 LOW (no direct telemetry on operator interpretation).

**Recoverability:** 🟡 PARTIAL (dashboard redesign + training).

### 2.6 IM-6 Constitutional-context loss

**Institutional behavior:** new contributors read constitutional docs without understanding WHY they exist; treat as bureaucratic compliance.

**Governance impact:** all rules followed mechanically without reasoning; novel inflation patterns slip past existing rules.

**Replay impact:** edge cases not caught by literal rule application.

**Forensic impact:** investigations follow checklist without judgment.

**Survivability impact:** governance becomes compliance theater.

**Detectability:** 🟠 LOW.

**Recoverability:** 🟢 STRONG (cause-narrative onboarding + mentorship).

### 2.7 IM-7 Governance-doc abandonment

**Institutional behavior:** docs marked "stale"; not consulted; eventually quietly removed during cleanup.

**Governance impact:** rules lose substrate; lexicon enforcement weakens.

**Replay impact:** taxonomy maps deprecated; replay-state classification regresses.

**Forensic impact:** query templates lost; SOC reverts to ad-hoc queries.

**Survivability impact:** entire governance bundle dissolves over years.

**Detectability:** 🟡 MEDIUM (doc-access metrics if instrumented).

**Recoverability:** 🟠 LIMITED (re-establishing doctrine is wave-scale effort).

### 2.8 IM-8 Drift normalization inheritance

**Institutional behavior:** past drift (e.g., L-DR-1 Lock v2 wording) accepted by previous team; new team inherits as "the way it is."

**Governance impact:** all past constitutional drifts solidify.

**Replay impact:** all replay-related drifts solidify.

**Forensic impact:** all forensic-related drifts solidify.

**Survivability impact:** drift registry becomes legacy-debt list, not active risk inventory.

**Detectability:** 🟢 HIGH (drift registry audit reveals stale entries).

**Recoverability:** 🟠 LIMITED — institutional change is slow.

---

## 3. Aggregate distribution

| Status | Count | Failures |
|---|---|---|
| 🟢 PRESERVED | 0 | none — all classes erode |
| 🟡 ERODING | 1 | IM-6 (constitutional-context loss) |
| 🠀 FORGOTTEN | 4 | IM-1, IM-2, IM-5, IM-7 |
| 🔴 INSTITUTIONALIZED | 3 | IM-3, IM-4, IM-8 |

---

## 4. Closing principle (institutional memory failure taxonomy)

Institutional memory degrades by predictable mechanisms. NO class is fully preserved by documentation alone. The 3 INSTITUTIONALIZED classes (IM-3, IM-4, IM-8) are the most consequential — they convert organizational behavior into permanent drift.

**Governance is a living practice. Documentation is its substrate. Without practice, the substrate dissolves.**

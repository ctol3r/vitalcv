# Constitutional Enforcement Matrix

**Status:** **CONSTITUTIONAL — ENFORCEMENT LAYER** · **Date established:** 2026-05-08 · **Authority:** subordinate to `TRUST_GUARANTEE_LEXICON.md`, `trust-class-taxonomy.md`, `operational-guarantee-matrix.md`, `replay-taxonomy-map.md`, `audit-event-vocabulary-map.md`, `canonical-query-model.md`, `export-query-cohesion.md`

This doc is the operational bridge from **documented governance** to **enforceable governance**. It enumerates every governance surface and assigns the enforcement methods that prevent drift.

The central rule: **documentation alone is NOT enforcement.** Each surface needs a CI-grep, PR-review, dashboard, operator, AND/OR Codex enforcement mechanism — composed redundantly so a single missed gate doesn't allow drift.

---

## 1. The 7 governance surfaces

| # | Surface | Source of truth | Drift hazard |
|---|---|---|---|
| **GS-1** | Trust lexicon (7 forbidden phrases) | `TRUST_GUARANTEE_LEXICON.md` | "non-repudiable" / "replay protected" / "tamper-proof" / etc. inflation |
| **GS-2** | Trust classes (C-1 / C-2 / T0 / R0 / D0) | `trust-class-taxonomy.md` + `runtime-trust-class-map.md` | T0 mistaken for C-1; class-substitution operator hazards |
| **GS-3** | Replay taxonomy (5 states + R-CAT-* framework) | `replay-taxonomy-map.md` | "replay protected" inflation; R-OBSERVED ↔ R-DENIED conflation |
| **GS-4** | Export guarantees (4 paths × per-intent) | `export-query-cohesion.md` + `canonical-query-model.md` | DL-8 SIEM gap forgotten; "complete audit log" inflation |
| **GS-5** | Operational guarantees (per-class strength matrix) | `operational-guarantee-matrix.md` | "guaranteed" / "atomic" unqualified; STRONG/PARTIAL/WEAK conflation |
| **GS-6** | Lineage classifications (6 lineage types) | `trust-boundary-clarification.md` | L-T (transactional) ↔ L-E (eventual) conflation; L-RO ↔ L-RF mistakes |
| **GS-7** | Survivability language (5 implication patterns) | `survivability-inflation-audit.md` | IP-1..IP-5 inflations in PR descriptions, dashboards, marketing |

---

## 2. The 5 enforcement methods

| Method | Where applied | Cost | Latency |
|---|---|---|---|
| **EM-1: CI-grep** | Code + docs at PR-build time | LOW | seconds |
| **EM-2: PR review** | Manual reviewer pass on every PR | MEDIUM | hours-days |
| **EM-3: Dashboard label** | Live dashboards rendering audit data | MEDIUM | continuous |
| **EM-4: Operator runbook** | SOC playbook; on-call training | LOW (doc) + MEDIUM (training) | per-incident |
| **EM-5: Codex SAFE prompt** | Codex audit at merge gate | LOW (prompt) + MEDIUM (audit time) | per-PR-merge |

Each surface needs ≥ 2 redundant methods.

---

## 3. The enforcement matrix

| Surface | EM-1 CI-grep | EM-2 PR review | EM-3 Dashboard | EM-4 Operator | EM-5 Codex | **Drift-detection strategy** |
|---|---|---|---|---|---|---|
| **GS-1 Trust lexicon** | ✅ Mandatory: scan PRs + docs for the 7 forbidden phrases (per `w2-pr4b-trust-language-enforcement.md` §3) | ✅ Reviewer playbook §5 of W2-PR4B | n/a (lexicon governs phrasing, not data display) | ✅ Lexicon adoption checklist | ✅ Codex prompt scans for the 7 phrases | Multi-layer; HIGHEST priority |
| **GS-2 Trust classes** | 🟡 PARTIAL: grep new prisma.auditEvent.create sites for class assignment | ✅ Reviewer assigns class per `runtime-trust-class-map.md` | ✅ Dashboard labels which class each metric reflects | ✅ Per-handler class profile in runbook | ✅ Codex verifies class assignment in PR description | 4-layer enforcement |
| **GS-3 Replay taxonomy** | ✅ Grep for "replay protected" / "replay-resistant" / "replay-prevented" | ✅ Reviewer ensures replay claims use 5-state vocabulary | ✅ Dashboard distinguishes R-OBSERVED / R-DENIED / R-COLLAPSED counts | ✅ Replay-observability runbook (RT-Rec-1 / TS-Rec equivalent) | ✅ Codex scans for forbidden replay phrases + correct R-state usage | Multi-layer |
| **GS-4 Export guarantees** | 🟠 LIMITED: hard to grep for export-coverage claims | ✅ Reviewer verifies wave's PR cites EX-3 as canonical for forensics | ✅ Dashboard labels which EX path each widget uses | ✅ Export-cohesion runbook | ✅ Codex verifies wave PR doesn't claim "complete audit log via SIEM" | Operator + Codex carry weight |
| **GS-5 Operational guarantees** | 🟡 PARTIAL: grep for unqualified "guaranteed" / "atomic" | ✅ Reviewer verifies guarantee strength matches matrix | ✅ Dashboard widgets render strength labels (STRONG / PARTIAL / WEAK / FRAGILE) | ✅ Guarantee matrix in runbook | ✅ Codex scans wave PR for inflation per `survivability-inflation-audit.md` IP-1..IP-5 | Multi-layer |
| **GS-6 Lineage classifications** | 🟠 LIMITED: hard to grep for lineage-type claims | ✅ Reviewer asserts lineage type per `trust-boundary-clarification.md` | ✅ Dashboard labels lineage type | ✅ Decision tree in runbook | ✅ Codex verifies lineage-type assignment | Operator + Codex carry weight |
| **GS-7 Survivability language** | ✅ Grep for IP-1..IP-5 forbidden patterns | ✅ Reviewer playbook | ✅ Dashboard widgets avoid forbidden phrasings | ✅ OUI-1..OUI-6 hazards in runbook | ✅ Codex scans for inflation patterns | Multi-layer; CRITICAL priority |

---

## 4. Per-surface enforcement profile

### 4.1 GS-1 — Trust lexicon (HIGHEST priority)

**Source:** `TRUST_GUARANTEE_LEXICON.md` §1.

**Drift hazard:** any PR / doc / dashboard / marketing surface using "non-repudiable", "cryptographically guaranteed", "replay protected", "signed mutation", "tamper-proof", "trustless", "provably secure" without substrate.

**Enforcement (composed):**
1. CI-grep (per `w2-pr4b-trust-language-enforcement.md` §3 + W2-PR4B allowlist).
2. PR-review playbook §5.6 step.
3. Codex SAFE prompt scan.

**Fail-closed posture:** if any of the 3 methods is missing, the lexicon is enforceable but degraded. Closing all 3 makes lexicon bulletproof for new content; legacy content covered by per-W2-PR4B allowlist.

### 4.2 GS-2 — Trust classes

**Source:** `trust-class-taxonomy.md` + `runtime-trust-class-map.md`.

**Drift hazard:** new audit-emitting paths added without class assignment; existing paths re-classified without authority.

**Enforcement (composed):**
1. PR review verifies new path's class.
2. Dashboard labels (e.g., `accept` widget shows "C-1 + R0 + D0").
3. Codex audit verifies wave PRs declare class.
4. Operator runbook references map.

**CI-grep limitation:** classifying paths is semantic; harder to grep for. PR review carries weight.

### 4.3 GS-3 — Replay taxonomy

**Source:** `replay-taxonomy-map.md`.

**Drift hazard:** replay claims drift toward "prevention" wording; R-OBSERVED conflated with R-DENIED.

**Enforcement (composed):**
1. CI-grep for "replay protected" family (per GS-1).
2. PR review for 5-state usage.
3. Dashboard distinguishes states.
4. Codex SAFE prompt.

### 4.4 GS-4 — Export guarantees

**Source:** `export-query-cohesion.md` + `canonical-query-model.md`.

**Drift hazard:** "complete audit log via SIEM" claims; forgetting DL-8 SIEM coverage gap.

**Enforcement (composed):**
1. PR review for export-path declaration.
2. Dashboard labels (e.g., "Source: EX-3 Postgres direct").
3. Operator runbook for export discipline.
4. Codex SAFE prompt scans for "complete export" framing.

### 4.5 GS-5 — Operational guarantees

**Source:** `operational-guarantee-matrix.md`.

**Drift hazard:** unqualified "guaranteed" / "atomic" claims; STRONG/PARTIAL/WEAK conflation.

**Enforcement (composed):**
1. CI-grep for "guaranteed" / "atomic" without qualifier (regex tricky).
2. PR review per matrix.
3. Dashboard labels per-handler strength.
4. Codex SAFE prompt scans for inflation patterns IP-1..IP-5.

### 4.6 GS-6 — Lineage classifications

**Source:** `trust-boundary-clarification.md`.

**Drift hazard:** L-T (transactional) confused with L-E (eventual); operator-decision-tree skipped.

**Enforcement (composed):**
1. PR review per decision tree.
2. Dashboard labels lineage type.
3. Codex SAFE prompt verifies lineage-type assignment in PR.
4. Operator training on decision tree.

### 4.7 GS-7 — Survivability language

**Source:** `survivability-inflation-audit.md` + lexicon.

**Drift hazard:** IP-1..IP-5 inflation patterns in any surface.

**Enforcement (composed):**
1. CI-grep for forbidden phrases (overlaps GS-1).
2. PR review per OUI-1..OUI-6 hazards.
3. Dashboard avoids forbidden phrasings.
4. Codex SAFE prompt comprehensive scan.

---

## 5. Enforcement gap aggregation

| Surface | Strongest method | Weakest method | Aggregate enforcement strength |
|---|---|---|---|
| GS-1 lexicon | EM-1 CI-grep + EM-5 Codex | EM-3 dashboard (n/a — lexicon is wording-only) | 🟢 STRONG |
| GS-2 trust classes | EM-2 PR review + EM-3 dashboard | EM-1 CI-grep (semantic, hard) | 🟡 PARTIAL — depends on review discipline |
| GS-3 replay taxonomy | EM-1 CI-grep + EM-3 dashboard | EM-4 operator (training) | 🟢 STRONG |
| GS-4 export guarantees | EM-2 PR review + EM-5 Codex | EM-1 CI-grep (limited) | 🟡 PARTIAL |
| GS-5 operational guarantees | EM-3 dashboard + EM-5 Codex | EM-1 CI-grep (regex tricky) | 🟡 PARTIAL |
| GS-6 lineage classifications | EM-2 + EM-3 + EM-5 | EM-1 CI-grep (semantic) | 🟡 PARTIAL |
| GS-7 survivability language | EM-1 CI-grep + EM-5 Codex (overlaps GS-1) | EM-3 dashboard | 🟢 STRONG |

**Aggregate enforcement strength:** 🟡 **PARTIAL — STRONG for lexicon + replay + survivability language (CI-grep applicable); PARTIAL for trust classes + export + operational guarantees + lineage (semantic; depends on PR review + Codex).**

---

## 6. Drift-detection strategies (per-surface)

| Surface | Drift detection | Frequency |
|---|---|---|
| GS-1 lexicon | CI-grep on every PR | Per-PR |
| GS-2 trust classes | New audit-emitting paths flagged for class assignment | Per-PR |
| GS-3 replay taxonomy | CI-grep + dashboard variance alerting on R-state counts | Per-PR + continuous |
| GS-4 export guarantees | PR-review checklist; periodic SOC audit | Per-PR + quarterly |
| GS-5 operational guarantees | CI-grep + PR-review per matrix | Per-PR |
| GS-6 lineage classifications | PR-review per decision tree | Per-PR |
| GS-7 survivability language | Comprehensive CI-grep + PR-review | Per-PR |

---

## 7. Implementation roadmap

| Wave | Action | Closes |
|---|---|---|
| **Wave A — CI-grep wiring** | Implement `w2-pr4b-trust-language-enforcement.md` §3 CI-grep + allowlist | GS-1, GS-3, GS-7 (lexicon + replay phrases + inflation patterns) |
| **Wave B — Codex prompt extension** | Per `codex-constitutional-prompt-layer.md` (this PR's Track C) | GS-1, GS-2, GS-3, GS-4, GS-5, GS-6, GS-7 (all surfaces) |
| **Wave C — Dashboard labeling** | Per `dashboard-governance-enforcement.md` (Track D) | GS-2, GS-3, GS-5, GS-6 |
| **Wave D — PR review playbook** | Update SOC + reviewer training | All surfaces |
| **Wave E — Operator runbook** | Consolidate runbook | All surfaces |

---

## 8. Closing principle (enforcement matrix)

The matrix converts documented governance into enforceable governance through composed methods. No single method is sufficient; redundancy across CI + PR-review + dashboard + operator + Codex makes drift-prevention bulletproof.

**Enforcement is achievable WITHOUT runtime changes — purely by closing the 5 implementation waves above.** The lexicon is the rule; the matrix is the enforcement scaffolding; the implementation waves are the operational follow-through.

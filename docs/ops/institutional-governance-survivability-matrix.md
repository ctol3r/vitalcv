# Institutional Governance Survivability Matrix

**Status:** **OPERATIONAL — INSTITUTIONAL SURVIVABILITY MATRIX** · **Date established:** 2026-05-08 · **Authority:** consolidates `institutional-memory-failure-taxonomy.md`, `governance-knowledge-survivability.md`, `constitutional-doctrine-persistence.md`, `governance-context-recovery.md`

This doc consolidates per-governance-surface × per-survivability-axis classification.

Each cell: 🟢 DURABLE / 🟡 FRAGILE / 🠀 ERODING / 🔴 FORGETTABLE.

---

## 1. The matrix

| Governance surface | Replay-gov surv. | Forensic-gov surv. | Override-gov surv. | Constitutional-awareness surv. | Dashboard-honesty surv. | **Aggregate** |
|---|---|---|---|---|---|---|
| **GS-A** Trust lexicon (7 forbidden phrases) | 🟢 D (CI-grep + Codex enforced) | 🟢 D | 🟢 D | 🟡 F (depends on operator literacy) | 🟢 D | 🟢 **DURABLE** |
| **GS-B** Trust-class taxonomy | 🟡 F | 🟡 F | 🟡 F | 🠀 E (HF-5 badge desensitization) | 🟡 F | 🟡 **FRAGILE** |
| **GS-C** Replay taxonomy (5-state) | 🟡 F (counterintuitive distinctions) | 🟡 F | 🟢 D (allowlist permanent) | 🠀 E (IM-1 erosion) | 🟡 F | 🟡 **FRAGILE** |
| **GS-D** Audit-event vocabulary map | 🟡 F | 🟢 D (alias map preserved) | 🟢 D | 🠀 E (3-vocabulary complexity) | 🟡 F | 🟡 **FRAGILE** |
| **GS-E** Override audit log | 🟢 D | 🟢 D | 🟢 D (audit-log mandatory) | 🠀 E (HF-8 normalization risk) | 🟢 D | 🟡 **FRAGILE** (despite mechanism strength — depends on discipline) |
| **GS-F** Constitutional governance runbook | 🟡 F | 🟡 F | 🟡 F | 🠀 E (IM-7 abandonment risk) | 🟡 F | 🟡 **FRAGILE** |
| **GS-G** Drift registry | 🟢 D | 🟢 D | 🟢 D | 🟡 F (currency-dependent) | 🟢 D | 🟢 **DURABLE** (with currency discipline) |
| **GS-H** Operational alias layer | 🟡 F | 🟡 F | 🟢 D | 🠀 E (forensic shortcutting) | 🟡 F | 🟡 **FRAGILE** |
| **GS-I** Lock v2 wording (current open drift L-DR-1, L-DR-2) | 🠀 E (institutionalizing) | 🟡 F | 🠀 E | 🠀 E | 🠀 E | 🠀 **ERODING** |
| **GS-J** L3 anchoring claim (UNVERIFIED) | n/a | 🠀 E (drift if unverified gets claimed) | 🟢 D (AS-Rec-1 documented) | 🟡 F | 🠀 E | 🠀 **ERODING** |

---

## 2. Aggregate distribution

| Status | Count | Surfaces |
|---|---|---|
| 🟢 DURABLE | 2 | GS-A (lexicon), GS-G (drift registry) |
| 🟡 FRAGILE | 6 | GS-B, GS-C, GS-D, GS-E, GS-F, GS-H |
| 🠀 ERODING | 2 | GS-I (Lock v2 wording), GS-J (L3 anchoring claim) |
| 🔴 FORGETTABLE | 0 | none — every surface has at least mechanism-level preservation |

---

## 3. Per-axis aggregate

| Axis | DURABLE | FRAGILE | ERODING | FORGETTABLE |
|---|---|---|---|---|
| Replay-gov | 3 | 5 | 1 | 0 |
| Forensic-gov | 4 | 5 | 1 | 0 |
| Override-gov | 6 | 3 | 1 | 0 |
| Constitutional-awareness | 0 | 3 | 5 | 0 |
| Dashboard-honesty | 3 | 5 | 1 | 0 |

**Constitutional-awareness is the LEAST DURABLE axis** — 5 ERODING. This aligns with `human-governance-survivability-matrix.md` finding: operator-awareness is the weakest survivability axis.

---

## 4. Cross-cutting findings

### 4.1 GS-A and GS-G are the durable anchors

Lexicon (CI-grep + Codex enforced) and drift registry (structured + curated) are the two DURABLE surfaces. They survive turnover via mechanism enforcement, not human memory.

### 4.2 6 surfaces are FRAGILE

Most governance surfaces require active discipline + operator literacy + quarterly review. Without these, they erode silently.

### 4.3 GS-I and GS-J are actively ERODING

Lock v2 wording fix is open (L-DR-1, L-DR-2); L3 anchoring claim status UNVERIFIED. Both are actively eroding without resolution. Mitigation: close W2-PR2C R2 + W2-PR3B AS-Rec-1.

### 4.4 No FORGETTABLE surface

Every governance surface has at least one preservation mechanism (lexicon CI-grep, audit-log discipline, drift-registry curation, etc.). Total loss requires multiple-mechanism failure.

---

## 5. Constitutional-awareness fragility deep-dive

Constitutional-awareness is the substrate axis. If operators don't UNDERSTAND why governance matters, they don't ACT to preserve it.

| Surface | Awareness fragility cause |
|---|---|
| GS-A lexicon | Operators may follow forbidden-phrase rules without understanding underlying L4/L5 substrate gap |
| GS-B trust-class | HF-5 badge desensitization → operators stop reading |
| GS-C replay | Counterintuitive distinction → operators infer prevention from observability |
| GS-D vocabulary | 3-vocabulary complexity → operators choose simpler queries that miss aliases |
| GS-E override | HF-8 normalization → operators routine-approve |
| GS-F runbook | IM-7 abandonment → docs stop being consulted |
| GS-H alias-layer | HF-7 forensic shortcutting → operators skip cross-vocabulary OR-clauses |
| GS-I Lock v2 wording | Open drift not closed → erosion accelerates |
| GS-J L3 anchoring | UNVERIFIED status not resolved → claim risk increases |

Mitigation: mandatory onboarding + quarterly governance review + per-role training (per `constitutional-doctrine-persistence.md` §3 + §5).

---

## 6. Per-surface survivability mitigation

| Surface | Highest-leverage mitigation |
|---|---|
| GS-A lexicon | CI-grep + Codex prompt continuity |
| GS-B trust-class | Per-PR Codex class-assignment verification |
| GS-C replay | DC-1 onboarding card + W-3 widget warning |
| GS-D vocabulary | SOC playbook + alias-layer onboarding |
| GS-E override | Audit log discipline + max-3-renewal limit |
| GS-F runbook | Quarterly runbook drill |
| GS-G drift registry | Quarterly registry audit |
| GS-H alias-layer | Q-CANON template literacy training |
| GS-I Lock v2 wording | CLOSE the wording fix (W2-PR2C R2 + R10) |
| GS-J L3 anchoring | VERIFY pipeline coverage (AS-Rec-1) |

---

## 7. Closing principle (institutional governance survivability matrix)

The matrix shows that institutional governance is FRAGILE-AT-MOST surfaces. Only 2 surfaces are DURABLE; 6 are FRAGILE; 2 are ERODING. NO surface is FORGETTABLE — every one has at least mechanism-level preservation.

**Survivability is a discipline, bounded by mechanism + cadence + operator literacy. The platform survives institutionally IF: (a) GS-I + GS-J open drifts close, (b) constitutional-awareness axis is continuously refreshed, (c) the 6 FRAGILE surfaces are actively maintained, (d) the 2 DURABLE surfaces remain mechanism-enforced.**

Without these, FRAGILE → ERODING → INSTITUTIONALIZED is the silent path.

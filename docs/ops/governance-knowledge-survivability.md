# Governance Knowledge Survivability

**Status:** **OPERATIONAL — KNOWLEDGE-SURVIVABILITY ASSESSMENT** · **Date established:** 2026-05-08 · **Authority:** subordinate to `institutional-memory-failure-taxonomy.md`, `TRUST_GUARANTEE_LEXICON.md`, `trust-class-taxonomy.md`

This doc determines whether future operators (new hires, future maintainers, future reviewers) could understand 6 critical governance distinctions. Identifies fragile doctrine surfaces, likely-forgotten concepts, institutional-memory choke points, governance-context collapse risks.

---

## 1. The 6 critical distinctions

| # | Distinction | Why it matters |
|---|---|---|
| **GK-1** | Replay visibility ≠ replay prevention | Lexicon §1.3; F-4 collapse mitigation depends on this |
| **GK-2** | Observability ≠ durability | Telemetry presence ≠ data persistence |
| **GK-3** | C-1 ≠ T0 | Trust-class mismatch (CB-7) hazard |
| **GK-4** | Temporary overrides are dangerous | HF-8 + IM-3 institutionalization risk |
| **GK-5** | Dashboards inflate by omission | OO-1 + HF-3 hazard |
| **GK-6** | Lineage fragmentation matters | CB-5 + IM-4 hazard |

---

## 2. Per-distinction survivability

### 2.1 GK-1 Replay visibility ≠ replay prevention

**Substrate docs:** `TRUST_GUARANTEE_LEXICON.md` §1.3, `replay-taxonomy-map.md`, `w2-pr5a-replay-certification.md`, `w2-pr3b-replay-governance.md`.

**Survivability:** 🟡 FRAGILE.

**Why fragile:**
- Distinction is COUNTERINTUITIVE — "we have replay observability" sounds like we have protection.
- Marketing surfaces (vitalcv.com) inflate by adjacent claims ("cryptographically-signed snapshot").
- New operators may not read all 4 substrate docs.

**Mitigation:** mandatory onboarding doctrine card (per `constitutional-doctrine-persistence.md`); CI-grep enforcement (per `semantic-drift-detection.md`); Codex SAFE prompt scan.

**Likely-forgotten concept:** correlationId-based dedup is BEST-EFFORT (TOCTOU race). Operators may forget the race window exists.

### 2.2 GK-2 Observability ≠ durability

**Substrate docs:** `runtime-trust-class-map.md` HCA-4 (in-memory ledger), `w2-pr6a-trace-survivability.md`, `w2-pr9a-export-survivability.md`.

**Survivability:** 🟡 FRAGILE.

**Why fragile:**
- "We have telemetry on X" feels equivalent to "X is preserved."
- In-memory ledger entries are observable but volatile (lost on process restart pre-dual-write).
- T0 fire-and-forget creates partial-write states.

**Mitigation:** mandatory doctrine card; reviewer playbook step.

**Likely-forgotten concept:** T0 path's fire-and-forget pattern. Operators may treat audit-row presence as proof-of-durability.

### 2.3 GK-3 C-1 ≠ T0

**Substrate docs:** `trust-class-taxonomy.md`, `runtime-trust-class-map.md`, `operational-guarantee-matrix.md`.

**Survivability:** 🟡 FRAGILE.

**Why fragile:**
- Both are "audit-emitting paths"; surface similarity hides substrate difference.
- Code review may not catch class-mismatch without explicit Codex prompt.
- HF-5 badge desensitization compounds.

**Mitigation:** mandatory class-assignment in PR description per Codex prompt; per-handler badge prominence.

**Likely-forgotten concept:** atomicity is a `prisma.$transaction` property — not an "any audit-emitting path" property.

### 2.4 GK-4 Temporary overrides are dangerous

**Substrate docs:** `constitutional-override-governance.md`, `human-governance-failure-taxonomy.md` HF-8, `governance-erosion-escalation.md` EE-5.

**Survivability:** 🠀 FORGOTTEN.

**Why forgotten:**
- Each individual override seems reasonable.
- The PATTERN of overrides (HF-8) requires audit-trail review — easily skipped.
- Founder approval normalizes the request.

**Mitigation:** override audit log monitoring; renewal limit (max 3); quarterly governance review of active overrides.

**Likely-forgotten concept:** override expiration. New operators may not enforce expiration without seeing the historical drift.

### 2.5 GK-5 Dashboards inflate by omission

**Substrate docs:** `dashboard-governance-enforcement.md`, `operator-overconfidence-review.md` OO-1, `survivability-inflation-audit.md` IP-1..IP-5.

**Survivability:** 🟡 FRAGILE.

**Why fragile:**
- Inflation by omission is silent — no positive signal that something's wrong.
- Operators trained on "alert means problem" miss "missing caveat means problem."

**Mitigation:** mandatory badges per widget; CI-DEGRADED indicator prominence; quarterly per-widget review.

**Likely-forgotten concept:** absence of CI-DEGRADED badge does NOT prove the widget is canonical. Per-widget review confirms.

### 2.6 GK-6 Lineage fragmentation matters

**Substrate docs:** `w2-pr7a-lineage-topology-map.md`, `constitutional-failure-survivability.md` CB-5.

**Survivability:** 🠀 FORGOTTEN.

**Why forgotten:**
- Past chains "look fine"; gaps invisible.
- Forensic queries on recent data succeed; investigations rarely span lineage horizons.

**Mitigation:** weekly chain-completeness telemetry; quarterly lineage audit.

**Likely-forgotten concept:** cross-row joins via `referenceId` are string-match (no FK); GC of one side breaks lineage silently.

---

## 3. Aggregate distribution

| Status | Count | Distinctions |
|---|---|---|
| 🟢 DURABLE | 0 | none |
| 🟡 FRAGILE | 4 | GK-1, GK-2, GK-3, GK-5 |
| 🠀 FORGOTTEN | 2 | GK-4, GK-6 |
| 🔴 LOST | 0 | none yet |

---

## 4. Fragile doctrine surfaces

| Surface | Fragility |
|---|---|
| Replay taxonomy (5-state model) | 🟡 FRAGILE — counterintuitive distinctions |
| Trust-class taxonomy (C-1/C-2/T0/R0/D0) | 🟡 FRAGILE — surface similarity hides substrate |
| Override audit-log discipline | 🠀 FORGOTTEN — pattern visibility easily skipped |
| Lineage chain reconstruction | 🠀 FORGOTTEN — gaps invisible without query |
| Dashboard badge contract | 🟡 FRAGILE — silent inflation by omission |
| Lexicon forbidden-phrase list | 🟢 DURABLE (CI-grep enforced) |
| L1-L5 audit-strength taxonomy | 🟡 FRAGILE — operators may conflate L2 with L3+ |

---

## 5. Likely-forgotten concepts (priority list)

| Rank | Concept | Why prioritized |
|---|---|---|
| 1 | TOCTOU race on correlationId dedup | Critical to honest replay-observability framing |
| 2 | Override expiration discipline | HF-8 ERODING risk |
| 3 | DL-8 SIEM coverage gap | EE-2 institutionalization risk |
| 4 | T0 fire-and-forget partial-write semantics | CB-7 trust-class mismatch hazard |
| 5 | Pre-tx race windows in C-1 handlers (HCA-1) | Operator-assumption hazard |
| 6 | Step-1 + Step-6 silent denial design | Forensic-completeness inflation |
| 7 | L3 anchoring pipeline UNVERIFIED | Substrate-claim inflation |

---

## 6. Institutional-memory choke points

Where institutional knowledge concentrates — turnover risk:

| Choke point | Concentrated knowledge |
|---|---|
| Founder | All constitutional-doctrine context; override approval history |
| W2-PR2B implementation author | Lock v2 reasoning; trust-class assignments |
| Codex SAFE prompt author | Constitutional audit prompt content |
| Original auditService.ts authors (frozen YC MVP) | T0/T1/T2 design rationale |
| First-wave SOC analysts | Per-runbook playbook judgment calls |

**Mitigation:** mandatory doctrine onboarding (per `constitutional-doctrine-persistence.md`); per-role training; founder-coordinated knowledge transfer.

---

## 7. Governance-context collapse risks

Scenarios where context collapses irrecoverably:

| Risk | Trigger |
|---|---|
| Single founder turnover | Founder is the only constitutional-decision authority for many drifts |
| W2-PR2B author turnover | Lock v2 wording fix never lands; drift L-DR-1, L-DR-2 institutionalize |
| SOC team turnover within 6 months | Runbook judgment calls lost |
| Marketing turnover | Banned-strings list discipline relaxes |
| New AI agents (without doctrine context) | Prompt drift; incorrect classifications |

---

## 8. Closing principle (governance knowledge survivability)

Institutional knowledge IS fragile. No critical distinction is fully DURABLE. The 6 critical distinctions in §1 are the substrate of constitutional governance; if any fades, the platform's safety degrades. Mitigation: mandatory onboarding + per-role training + automated enforcement (CI + Codex) + quarterly knowledge audit.

**Knowledge survives organizations through DISCIPLINE, not DOCUMENTATION. Documentation is the substrate; discipline is the sustainer.**

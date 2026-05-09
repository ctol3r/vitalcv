# Constitutional Doctrine Persistence

**Status:** **CONSTITUTIONAL — DOCTRINE PERSISTENCE FRAMEWORK** · **Date established:** 2026-05-08 · **Authority:** subordinate to `governance-knowledge-survivability.md`, `institutional-memory-failure-taxonomy.md`

This doc designs how constitutional governance persists through new hires, new maintainers, new operators, future AI agents, future dashboards, future PR reviewers.

The contract: **doctrine survival requires more than doc existence.** It requires canonical surfaces + mandatory onboarding + required warnings + active enforcement.

---

## 1. The 6 doctrine-persistence audiences

| # | Audience | Persistence challenge |
|---|---|---|
| **DP-1** | New hires (engineers / SOC / ops) | No prior context; needs onboarding |
| **DP-2** | New maintainers (taking over wave-area ownership) | Wave-context history needed |
| **DP-3** | New operators (incident response handoff) | Runbook + decision-matrix literacy |
| **DP-4** | Future AI agents (Codex / future Claude / etc.) | Prompt + doctrine bundle continuity |
| **DP-5** | Future dashboards (new tooling generations) | Badge contract + integrity-indicator inheritance |
| **DP-6** | Future PR reviewers (rotating reviewer role) | Reviewer playbook + lexicon literacy |

---

## 2. Canonical doctrine surfaces

The platform MUST preserve these surfaces as CANONICAL. They cannot be quietly deprecated:

| Surface | Role | Cannot be quietly removed because... |
|---|---|---|
| `TRUST_GUARANTEE_LEXICON.md` | Trust-language enforcement | 7 forbidden phrases; CI-grep + Codex depend |
| `trust-class-taxonomy.md` | Per-path classification | Operators + Codex + runbook depend |
| `audit-event-vocabulary-map.md` | Cross-vocabulary canonical alias | Forensic queries depend |
| `replay-taxonomy-map.md` | 5-state replay model | SOC playbook depends |
| `MUTATION_GATE_SEQUENCE.md` | Canonical 6-step gate | Implementation pattern depends |
| `OWNERSHIP_INVARIANTS.md` | Layer-3 invariants | Future-migration design depends |
| `AUTHORIZATION_BASELINE_V1.md` | Baseline floor | Deferred-risk register references |
| `constitutional-override-governance.md` | Override discipline | Audit-log discipline depends |
| `constitutional-governance-runbook.md` | Operator runbook | SOC depends |
| `constitutional-enforcement-matrix.md` | Per-surface enforcement map | Codex prompt depends |

---

## 3. Mandatory onboarding doctrine

Every new hire / maintainer / operator MUST consume:

### 3.1 Tier-1 doctrine cards (required day-1)

| Card | Length | Audience |
|---|---|---|
| **DC-1: Replay observability ≠ replay prevention** | 1 page | DP-1, DP-2, DP-3 |
| **DC-2: Trust-class taxonomy 5-card** (C-1/C-2/T0/R0/D0 with 1-line each) | 1 page | All |
| **DC-3: Lexicon 7 forbidden phrases + alternatives** | 1 page | All |
| **DC-4: Override audit + expiration** | 1 page | DP-2, DP-3, founder-adjacent |
| **DC-5: Dashboard badge contract** | 1 page | DP-1, DP-3, DP-5 |
| **DC-6: SOC runbook 6-scenario summary** | 1 page | DP-3 |

Each card has the WHY (institutional context) + WHAT (the rule) + EXAMPLES (good + bad).

### 3.2 Tier-2 doctrine bundle (required week-1)

Full constitutional doc bundle: `VITALCV_OPERATING_DOCTRINE.md`, `SECURITY_INVARIANTS.md`, `OWNERSHIP_INVARIANTS.md`, all `*-taxonomy.md`, all `*-matrix.md`.

### 3.3 Tier-3 wave-history (required month-1 for maintainers)

Read W2-PR2B → W2-PR15A wave outputs for context on every constitutional decision. Onboarding mentor walks through.

---

## 4. Required governance warnings

Every doc, dashboard, and PR-template surface displays MANDATORY warnings:

### 4.1 Replay warning

```
⚠ REPLAY GOVERNANCE WARNING:
  - Replay observability is NOT replay prevention.
  - correlationId-based dedup is BEST-EFFORT (TOCTOU race exists).
  - Capture-replay attacks require payloadHash forensic detection.
  - Lexicon §1.3 forbidden phrases: "replay protected" / "replay-resistant" / "replay-secure".
```

Surfaces: `replay-taxonomy-map.md` header; W-3 dashboard widget; SOC runbook RB-1.

### 4.2 Trust-class warning

```
⚠ TRUST-CLASS GOVERNANCE WARNING:
  - C-1 ≠ C-2 ≠ T0. Each has different atomicity / durability / survivability.
  - T0 fire-and-forget creates partial-write states. Avoid for canonical events.
  - Per-path class assignment required in PR description (per Codex prompt).
  - Cross-reference: runtime-trust-class-map.md
```

Surfaces: `trust-class-taxonomy.md` header; W-2 dashboard widget; PR template.

### 4.3 Override warning

```
⚠ OVERRIDE GOVERNANCE WARNING:
  - Temporary overrides MUST expire (≤ 30 days; renewal max 3).
  - Override audit log entry mandatory.
  - HF-8 institutionalization risk: repeated overrides become permanent drift.
  - Cross-reference: constitutional-override-governance.md
```

Surfaces: founder approval template; override audit log; quarterly governance review.

### 4.4 Forensic warning

```
⚠ FORENSIC GOVERNANCE WARNING:
  - EX-3 Postgres direct is canonical for forensics.
  - EX-1/EX-2 SIEM stream has DL-8 coverage gap (T2-direct-writers missing).
  - Audit retention SLA is load-bearing for past-window queries.
  - CB-6 forensic past-window data loss is IRREVERSIBLE.
```

Surfaces: SOC runbook; W-7 dashboard widget; forensic export documentation.

### 4.5 Dashboard warning

```
⚠ DASHBOARD GOVERNANCE WARNING:
  - Widgets without trust-class + lineage badges may inflate by omission.
  - CI-GREEN composite ≠ "no concerns" — drill into per-TG dimensions.
  - CT trajectory matters as much as CI state.
  - Cross-reference: dashboard-governance-enforcement.md
```

Surfaces: every dashboard tab; quarterly dashboard review.

---

## 5. Survivability doctrine preservation mechanisms

| Mechanism | Description | Cadence |
|---|---|---|
| **PM-1 Quarterly governance review** | Founder + ops + SOC + reviewer team review all doctrine docs + drift registry + override log + survivability matrix | Quarterly |
| **PM-2 Annual constitutional audit** | External or peer review of constitutional bundle; identify obsolete docs vs durable doctrine | Annual |
| **PM-3 Onboarding doctrine refresh** | Tier-1 cards updated when wave changes occur | Per-wave |
| **PM-4 Mentorship pairing** | New hires paired with constitutional-context mentor for first 90 days | Per-hire |
| **PM-5 Codex prompt review** | Constitutional prompt reviewed each major Codex version | Per-Codex-version |
| **PM-6 Dashboard contract review** | Per-widget badge + integrity indicator audit | Quarterly |
| **PM-7 Override audit log review** | Active overrides + renewal patterns + closure rate | Quarterly |
| **PM-8 Lexicon allowlist audit** | Allowlist additions justified + reason still valid | Quarterly |

---

## 6. Replay-doctrine preservation specifics

Replay doctrine is fragile (per `governance-knowledge-survivability.md` GK-1). Specific preservation:

1. **DC-1 onboarding card** mandatory day-1.
2. **W-3 dashboard widget** displays REPLAY GOVERNANCE WARNING permanently.
3. **SOC runbook RB-1** opens with the warning.
4. **Codex SAFE prompt** explicitly rejects replay-prevention framing (CR-2 per `codex-constitutional-prompt-layer.md`).
5. **CI-grep** enforces lexicon §1.3 forbidden phrases.
6. **Quarterly review** verifies replay-state classification queries return expected R-state distribution.
7. **External audit** verifies replay-related claims align to runtime substrate.

Five overlapping mechanisms. Single-mechanism failure is recoverable; total failure requires all 5 to lapse.

---

## 7. Per-audience persistence pathway

| Audience | Onboarding | Ongoing |
|---|---|---|
| DP-1 new hire | Tier-1 cards day-1; Tier-2 week-1 | Quarterly review |
| DP-2 new maintainer | Tier-1+2 day-1; Tier-3 month-1; mentor pairing | Per-wave constitutional check-in |
| DP-3 new operator | Tier-1+2 day-1; runbook walkthrough; shadow on-call | Quarterly runbook drill |
| DP-4 future AI agents | Constitutional prompt + doctrine bundle in context | Per-prompt-version review |
| DP-5 future dashboards | Badge contract + integrity-indicator template | Per-widget review |
| DP-6 future PR reviewers | Reviewer playbook + lexicon literacy | Per-PR Codex assist |

---

## 8. Closing principle (constitutional doctrine persistence)

Doctrine persistence is a discipline, not a documentation task. Onboarding cards + warnings + quarterly review + mentor pairing + Codex prompt continuity + lexicon enforcement compose to keep the substrate active.

**Doctrine survives WHO is in the room IF the room rules survive who's in the room. Build the room; preserve the rules.**

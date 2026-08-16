# Minimum Friction — Optimization Model

**Program:** Minimum Friction (MF-WAVE-00, research/architecture only)
**Baseline:** `origin/main` @ `df0ff184c2da9fbc8cfaf73f26e1928188113e61` (2026-08-16)
**Status:** Research deliverable. Design only — no optimizer is implemented in this wave.

> **DESIGN-ONLY BOUNDARY** applies (see SECURITY_PRIVACY_MODEL for the verbatim text).

---

## 0. The core question (Q1 / Q14) — answered from code

**Q1 — Is there code that computes "what should the user do next" ordered by impact?**
*Ordered: yes. By impact: no.* Three heuristic planners exist and are wired:

- `apps/web/lib/agent/policy/rank.ts` → `rankActions()` — a 6-tier greedy sort
  (blocker-resolving → VitalCV-can-do-now → one-consent-away → unblocks-downstream →
  informational → optional), urgency as an intra-tier tiebreak. It **deliberately rejects**
  impact ordering (its header explains why: promoting urgent-but-optional enrichment above
  blocking work is the wrong answer).
- `packages/domain-evidence/src/intelligence/intelligence.ts` → `prioritizeActions()` — a fixed
  insight-kind→priority map (risk=high, gap=medium, opportunity=low), then sorted by id.
- `apps/api/backend/src/services/decision/nbaEngine.ts` → `generateNextBestAction()` — emits ONE
  action with a **self-declared** `impactEstimate` string (`LOW|MEDIUM|HIGH`), not a derived count.

**None counts "this action satisfies N requirements."** No exact minimum-action set/state planner
exists. The PTC architecture map records this directly (P-020: "No exact minimum-action set/state
planner found").

**Q14 — Can the Trust Optimizer support minimum-clinician-action planning via an objective
profile, without a second optimizer?** *The optimizer does not exist as code* — there is no
`optimizer.ts`, no objective type, no goal parameter, nothing to quote. From the **specification**
(`docs/trust-computing/PTC_RESEARCH_REGISTER.md`), it is designed **single-objective**
(`MINIMUM_ACTION_COUNT`, deterministic BFS over action-state transitions, lexical-id tiebreak, no
invented cost) and **multi-objective / Pareto is explicitly DEFERRED** ("never collapse unknowns
into a fake score").

**Conclusion (settles Q14, and the thesis §19 direction):** Minimum Friction should **not** create
a second optimizer. `MINIMUM_ACTION_COUNT` over an action space **filtered by owner** already *is*
minimum-clinician-action planning — and the existing StartAgent action model already carries the
`owner` (`vitalcv` vs clinician) and `permission` (`observe|prepare|execute_with_consent`)
discriminators the filter needs. The single highest-leverage design decision available **right now,
before the optimizer file is written**, is to *parameterize the objective and the action-space
filter at the function signature* rather than hardcode `MINIMUM_ACTION_COUNT`. That forecloses
nothing the PTC docs commit to and makes MF an objective **profile**, not a fork.

---

## 1. Hard constraints (these are constraints, NOT weights)

A plan is **invalid** — not merely worse — if it does any of:

1. fabricates professional truth;
2. promotes AI inference (`INFERRED`) to source-backed / decision-grade;
3. treats unavailable evidence as adverse (the `notFound` ≠ `checked` split already enforces this
   in `packages/trust-state/sourceCoverage.ts`);
4. shares without valid authorization (recipient + purpose + consent);
5. sends data to the wrong recipient;
6. violates a data-handling rule (see `deriveHandlingDecision`, SECURITY §4);
7. uses insufficient identity assurance for a consequential action (see the A0–A5 ladder);
8. mutates an immutable historical submission (sealed packet / snapshot);
9. converts employer-independent computation into employer acceptance (`SATISFIED` never means
   accepted — PTC boundary chain);
10. silently resolves conflicting evidence (must produce `CONFLICT`/review);
11. turns `unknown` into `satisfied`.

These map 1:1 onto the four benchmark zero-invariants (BENCHMARK, PRIOR_ART):
`FALSE_TRUTH_PROMOTION = 0`, `UNAUTHORIZED_DISCLOSURE = 0`, `CROSS_RECIPIENT_CONSENT_REUSE = 0`,
`UNKNOWN_TO_SATISFIED = 0`. A planner that can *represent* an invalid plan is itself a defect
(security-by-construction, SECURITY §6).

## 2. The friction vector

A per-plan measurement vector. **Unknown stays `null`** — never zero, never imputed.

```ts
interface FrictionVector {
  clinicianActions: number            // discrete clinician-required steps
  clinicianMinutes: number | null     // null until telemetry exists
  sensitiveAttributesCollected: number// NEW sensitive attrs this plan collects
  documentsRequested: number
  disclosedAttributes: number         // attributes revealed to a recipient
  sourceQueries: number
  humanReviews: number                // clinician OR reviewer review steps
  waitMinutes: number | null
  monetaryCost: number | null
}
```

Rationale for `null`-not-`0`: the repo's entire truth posture is that "we did not measure this" is
a distinct state from "this is zero" (the `notFound`/`checked` split; `estimatedDays` is always
`null` in the pure mobility layer). The friction vector inherits that discipline.

## 3. Objective profile — v0, lexicographic, no fake weights

Among **valid** plans (§1 satisfied), minimize **lexicographically** in this fixed order. No plan
with a higher-priority advantage is ever traded for a lower-priority one; there are **no numeric
weights** to tune and none are invented.

```
0. (gate) plan is valid                       — hard constraints, §1
1. minimize  sensitiveAttributesCollected     — collect the least sensitive data
2. minimize  clinicianActions                 — ask the clinician to do the least
3. minimize  clinicianMinutes  (skip if null) — then their time, when known
4. minimize  documentsRequested
5. minimize  disclosedAttributes              — reveal the least
6. minimize  sourceQueries
7. minimize  humanReviews
8. minimize  waitMinutes       (skip if null)
9. minimize  monetaryCost      (skip if null)
tiebreak:    lexical order of stable action IDs (matches PTC v0.1)
```

This is deliberately the **product objective profile** of the PTC optimizer's `MINIMUM_ACTION_COUNT`
skeleton: same deterministic search, same lexical-id tiebreak, `null`-aware comparators that skip
unmeasured dimensions rather than defaulting them. Weighted scalarization is a later step gated on
observed product data (thesis §4: "Do not invent numeric weights until observed product data
justifies them").

**Why sensitive-collection outranks clinician-actions:** a plan that saves the clinician one click
by collecting an SSN it does not need is the wrong plan. Data minimization is a safety property;
click-count is a comfort property. Safety wins.

## 4. Action model

**Reuse — do not invent.** The StartAgent `AgentAction` (`apps/web/lib/agent/types.ts`) already
carries every field the objective needs:

| Need | Existing field |
|---|---|
| Whose work is it? | `owner` (`vitalcv` \| clinician \| …) |
| Consent gate? | `permission` (`observe` \| `prepare` \| `execute_with_consent`), `consentScope` |
| What it unblocks | `resolvesBlockerIds`, `dependencies` |
| Evidence it touches | `evidenceRefs` |
| Expected result | `expectedOutcome` |

The **action-space filter for minimum-clinician-action** is simply
`action.owner === 'clinician' && action.permission !== 'observe'` counted into `clinicianActions`,
while `owner === 'vitalcv'` actions are "safe automatic work" that cost the clinician nothing (they
still cost `sourceQueries`, ranked lower). No new action type is required for MF v0.

## 5. Leverage calculation (§14 of brief) — deterministic vs potential vs AI-predicted

The optimizer answers "what is the *smallest* set of clinician actions to reach the goal." The
**leverage** view answers a different question for the "One Thing" UX: "which single action, done
now, produces the largest safe state transition?" For every candidate action, compute and **keep
separate** (never sum):

```
DETERMINISTIC impact  — requirements this action provably moves to SATISFIED,
                        counted from the compiled dependency index (exact).
POTENTIAL impact      — requirements it *could* move, contingent on a source
                        result not yet known (bounded, labelled contingent).
AI-PREDICTED impact   — opportunities/preflights an inference *suggests* it helps
                        (candidate only; never counted as fact).
```

These three are the exact provenance grades the repo already draws (deterministic fact / source
fact / user attestation / inference / unknown). The "One Thing" card shows the **deterministic**
number as the headline and exposes the other two as clearly-labelled secondary detail. **"Why
this?" traverses the backlinks** (Career Graph `requires`/`satisfies` edges — see ARCHITECTURE_MAP
§8), so the leverage claim is auditable, not asserted.

Today none of the three heuristic planners computes even the deterministic number (Q1). Producing
it requires the compiled dependency index, which is `NEW` (PTC docs only). So leverage is a
**post-compiler** capability; MF's Demo-0 can *fixture* it (ARCHITECTURE_MAP / EXECUTION_PLAN).

## 6. Relation to the Trust Optimizer — the boundary

```
                 ┌─────────────────────────────────────────────┐
                 │   PTC Trust Compiler + dependency index      │  (NEW — docs only)
                 │   → exact "what evidence satisfies what"     │
                 └───────────────────┬─────────────────────────┘
                                     │ requirement/evidence dependency facts
                 ┌───────────────────▼─────────────────────────┐
                 │   PTC bounded optimizer (MINIMUM_ACTION_COUNT)│ (NEW — docs only)
                 │   deterministic BFS over action-state space   │
                 └───────────────────┬─────────────────────────┘
                                     │ parameterize: objective profile + action-space filter
                 ┌───────────────────▼─────────────────────────┐
                 │   MINIMUM FRICTION = objective PROFILE        │  ← this program
                 │   MINIMUM_CLINICIAN_ACTIONS / MINIMUM_DISCLOSURE│
                 │   friction vector + lexicographic ordering    │
                 └─────────────────────────────────────────────┘
```

MF owns: the friction vector, the lexicographic objective profile, the owner-filtered action space,
the leverage view, and the "One Thing" selection. MF does **not** own: the compiler, the dependency
index, the search algorithm, or a second optimizer. **One optimizer, multiple objective profiles.**

**Caveat on minimum-disclosure:** minimizing *disclosed* attributes optimizes over *which evidence
to reveal at a fixed satisfied state*, which is a different state space than *which actions to reach
that state*. Same BFS skeleton, different goal predicate. Keep them as two objective profiles over
one engine, not one blended score (this is exactly why the PTC register groups disclosure with
human-effort as deferred Pareto axes).

## 7. What this model refuses to do

- No weighted score with invented coefficients (v0 is purely lexicographic).
- No imputing `null` friction dimensions to `0`.
- No second optimizer, no graph DB, no new agent runtime (DO-NOT-BUILD).
- No collapsing the three impact grades into one number.
- No objective that can select an invalid (§1-violating) plan — validity is a gate, not a term.

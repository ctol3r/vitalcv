# W235-C3 — Reputation Dimension Model

**Wave:** 235 · **Depends on:** [C2](./C2-reputation-projection-model.md)
**Date:** 2026-06-21 · Architecture for implementation (no code this wave).

Five domain-facing reputation dimensions, each a **deterministic re-grouping** of the seven W222 trust dimensions + evidence counts. Mapping is explicit so the derivation is auditable.

---

## 0. Dimension ids

```ts
type ReputationDimensionId =
  | 'authority' | 'leadership' | 'research' | 'academic' | 'operational';
```

## 1. Mapping to trust dimensions + evidence classes

| Reputation dimension | Backed by trust dimension(s) | Contributing evidence classes | Score rule |
|---|---|---|---|
| **AuthorityReputation** | `authority` | licensure, board_cert, registration, exclusion, enrollment | = `authorityTrust.score` |
| **LeadershipReputation** | `leadership` | privilege, peer_review | = `leadershipTrust.score` |
| **ResearchReputation** | `research` | research, publication | = `researchTrust.score` |
| **AcademicReputation** | `professional` (training subset) + `research` | training, research, publication | = **mean**(trainingEvidenceScore, researchTrust.score) where present; null if neither |
| **OperationalReputation** | `professional` + `institutional` | employment, recognition, acceptance, start, training | = **min**(professionalTrust.score, institutionalTrust.score) where both present, else the present one |

**Why min/mean, never sum:** combining with `min`/`mean` keeps the result in `[0,1]` and never exceeds either contributing trust score — preserving the no-inflation guarantee. A `sum` could manufacture reputation above the evidence ceiling and is banned.

## 2. Independence vs. shared inputs

Reputation dimensions, like trust dimensions, are **computed independently**. AcademicReputation and ResearchReputation both read research evidence; this is intentional (a publication reinforces both academic standing and research output) and does not let one dimension's score feed another's — each is derived directly from the trust layer, not from a sibling reputation dimension.

## 3. Per-dimension rollups (objective)

Each `ReputationDimension` (C2 §2) carries, in addition to `score`:
- `breadth` — distinct decision-grade evidence count in its classes.
- `distinctSources` — distinct backing sources/jurisdictions.
- `recognitionCount` — for `leadership`/`operational`, signed canonical-path events (RECOGNIZED_BY/ACCEPTED_BY/STARTED_AT).
- `lastReinforcedAt` — currency.
- `basis` — the contributing `evidenceId`s.

## 4. Worked example

A cardiologist with: CA + NV board-verified licenses (checked), one ABMS board cert (checked), 3 publications (checked), one residency (checked), one employer recognition (signed):

| Dimension | score | breadth | notes |
|---|---|---|---|
| AuthorityReputation | high (= authorityTrust) | 3 (2 licenses + 1 cert) | 2 jurisdictions |
| LeadershipReputation | null | 0 | no privilege/peer-review evidence → honest null |
| ResearchReputation | high | 3 | publications |
| AcademicReputation | mean(training, research) | 4 | residency + publications |
| OperationalReputation | = professional (institutional null) | 2 | employment + recognition; recognitionCount 1 |

LeadershipReputation is honestly `null/unknown` — no leadership evidence exists, and nothing fabricates it.

## 5. Honesty constraints (tested when built)

1. No reputation dimension score exceeds its contributing trust score(s).
2. Gated/stale evidence never raises a dimension (decision-grade only in `breadth` and score).
3. A dimension with no contributing decision-grade evidence is `null` / `unknown`.
4. Combination is `min`/`mean` only — never `sum`; property test asserts `score ≤ min(contributing trust scores)` for `min`-combined dimensions.

## 6. Success-criteria answer

- **How do we preserve trust invariants?** Reputation dimensions are anchored to trust dimension scores and bounded by them (`min`/`mean`, never `sum`); decision-grade gating and honest absence carry through unchanged.

**Deliverable status:** complete. → C4.

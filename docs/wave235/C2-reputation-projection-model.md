# W235-C2 — Reputation Projection Model

**Wave:** 235 · **Depends on:** [C1](./C1-reputation-signal-inventory.md)
**Date:** 2026-06-21 · Architecture only.

`projectReputation(evidence, trust, timeline) → ReputationProjection`. Pure, deterministic, re-projection of objective signals — extends the W225 `ReputationSummary` seed into domain dimensions + history.

---

## 0. The Objectivity Contract (every reputation number obeys all five)

1. **Traceable** — carries the `evidenceId`s it derives from (`basis`); a reader can verify it by hand.
2. **Evidence-bounded** — a reputation dimension score never exceeds its underlying trust dimension score (anchored to the W222 monotonic guarantee; no inflation).
3. **Decision-grade-gated** — only `checked` evidence raises reputation; gated/stale/notDecisionGrade cannot.
4. **No editorial weights** — any combination of signals uses explicit, documented, equal-or-justified factors; no learned or arbitrary weighting.
5. **Honest absence** — no evidence in a domain → `score: null`, `standing: 'unknown'` (never a fabricated 0-or-positive).

This contract is the formal answer to "how do we avoid subjective scoring."

## 1. `ReputationProjection`

```ts
interface ReputationProjection {
  subjectKey: string;
  /** Reuses/extends the W225 ReputationSummary (overall standing + counts + trend). */
  overall: ReputationSummary;
  dimensions: ReputationDimension[];   // the 5 of C3, always all present
  history: ReputationHistory;          // C4
  basis: {
    totalEvidence: number;
    decisionGradeEvidence: number;
    distinctSources: string[];
    distinctJurisdictions: string[];
  };
}
```

## 2. `ReputationDimension` (shape used by C3)

```ts
interface ReputationDimension {
  dimension: ReputationDimensionId;        // C3
  /** = underlying trust dimension score, or null. NEVER exceeds it. */
  score: number | null;
  standing: 'established' | 'emerging' | 'provisional' | 'unknown';
  /** distinct decision-grade evidence count in this domain. */
  breadth: number;
  /** distinct sources/jurisdictions backing it. */
  distinctSources: string[];
  /** most recent reinforcement timestamp (currency). */
  lastReinforcedAt: string | null;
  /** signed-canonical recognition events contributing (operational/leadership). */
  recognitionCount: number;
  /** full traceability — the evidenceIds this score derives from. */
  basis: string[];
}
```

## 3. Derivation (deterministic)

For each reputation dimension:
1. `score` = the underlying trust dimension `score` (C3 maps which trust dimension(s) feed it). When two trust dimensions feed one reputation dimension, combine by **min or mean of the contributing trust scores** (documented per dimension) — never a sum (sums could exceed 1 and inflate).
2. `standing` = same threshold ladder as W225 (`>=0.67 established`, `>=0.34 emerging`, `>0 provisional`, else/unknown).
3. `breadth` = count of distinct decision-grade `EvidenceObject`s in the contributing classes.
4. `distinctSources` / `lastReinforcedAt` / `recognitionCount` = rollups over the contributing `CareerEvent`s.
5. `basis` = the contributing `evidenceId`s (the receipt for the score).

## 4. Relationship to existing layers

- **Reads only** `EvidenceCollection` + `TrustProjection` + `TimelineProjection` — all already shipped. No new measurement, no new persistence.
- `overall` reuses the W225 `ReputationSummary` verbatim (standing/trend/counts) — reputation projection is its richer sibling, not a replacement.

## 5. Success-criteria answers

- **How do we derive reputation?** Re-project objective trust/evidence/recognition signals into domain dimensions (§3).
- **How do we avoid subjective scoring?** The Objectivity Contract (§0) — traceable, evidence-bounded, decision-grade-gated, no editorial weights, honest absence.

**Deliverable status:** complete. → C3.

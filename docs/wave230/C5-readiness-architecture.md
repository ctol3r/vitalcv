# W230-C5 — Readiness Architecture

**Wave:** 230 · **Depends on:** [C3](./C3-gap-engine-blueprint.md)
**Date:** 2026-06-21

`ReadinessProjection`: a deterministic verdict — **Ready / Near Ready / Blocked / Unknown** — for a clinician against one opportunity. Reuses the W205 recruiter-rollup honesty pattern, extended with the gap engine.

---

## 0. Signature

```ts
function projectReadiness(
  opportunity: OpportunityObject,
  gaps: GapReport,            // from detectGaps (C3)
  trust: TrustProjection,     // W222
  evidence: EvidenceCollection,
): ReadinessProjection;       // pure, deterministic
```

## 1. `ReadinessProjection`

```ts
type MobilityReadiness = 'ready' | 'near_ready' | 'blocked' | 'unknown';

interface ReadinessProjection {
  subjectKey: string;
  opportunityId: string;
  readiness: MobilityReadiness;
  rationale: string;
  /** Hard blockers (no remediation path). */
  blockers: string[];
  /** Gaps with a known remediation path. */
  fixableGaps: string[];
  estimatedStartDays: number | null;
}
```

## 2. Verdict rules (deterministic precedence — first match wins)

1. **`blocked`** — any of:
   - an `exclusion`/sanction evidence is adverse, or a mandatory credential is `revoked`/`reviewRequired` (hard safety/authority block), **or**
   - a `mandatory` gap is `missing` with **no** remediation path.
2. **`unknown`** — evidence coverage is insufficient to judge: overall `decisionGradeEvidence === 0`, or the opportunity's mandatory dimensions have `null` trust (nothing checked yet / `CHECKING`-equivalent).
3. **`ready`** — every `mandatory` requirement is **satisfied** by decision-grade evidence and there are no blockers.
4. **`near_ready`** — all remaining `mandatory` gaps are `insufficient`/`stale`/`missing-with-remediation` (a real path exists: refresh, endorsement, review). Preferred gaps never block.
5. else **`unknown`** (never default to ready).

This mirrors `deriveRecruiterRollup` (W205): **`ready` is reachable only with decision-grade evidence and zero blockers**; anything uncertain degrades honestly.

## 3. Mapping to the four outputs

| Output | Meaning | Driven by |
|---|---|---|
| **Ready** | reusable evidence already satisfies all mandatory requirements | all mandatory gaps `satisfied`, no blockers |
| **Near Ready** | a clear, time-bounded path exists | mandatory gaps all have remediation (endorsement/refresh/review) |
| **Blocked** | safety/authority block or unremediable missing mandatory | exclusion adverse / revoked / missing-no-path |
| **Unknown** | not enough checked evidence to judge | `decisionGradeEvidence === 0` or mandatory dimensions `null` |

## 4. `estimatedStartDays`

- `ready` → 0 (or the opportunity's onboarding floor).
- `near_ready` → max of the fixable gaps' `remediation.estimatedDays` (endorsement delay from `getEndorsementDelay`, refresh SLA). `null` if none known — **never fabricated**.
- `blocked` / `unknown` → `null`.

## 5. Honesty constraints (tested when built)

1. `ready` requires **decision-grade** satisfaction of every mandatory requirement (no gated/stale shortcut) — the partial-stays-partial rule, end to end.
2. `unknown ≠ blocked` — absence of evidence is honest uncertainty, not a negative verdict (Trust Graph Rule 35: absence of a recorded revocation is not a guarantee, and absence of evidence is not a fail).
3. A `preferred` gap can lower strength but can never produce `blocked` or downgrade `ready`.
4. `estimatedStartDays` is `null` unless a real source provides it.
5. Deterministic: same inputs → same verdict (no `Date.now()` in the projector).

## 6. Relationship to existing readiness

- The existing `PassportData.readiness` (`DECISION_GRADE/PARTIAL/CHECKING/BLOCKED`) is **per-clinician, opportunity-agnostic**. `ReadinessProjection` is **per-opportunity** and consumes the same evidence — they agree on the partial-stays-partial spine but answer different questions.
- `MobilityReadiness` deliberately uses distinct labels (`ready/near_ready/blocked/unknown`) to avoid being confused with the clinician-level `ReadinessState`.

## 7. Success-criteria answer

- **How do we calculate readiness?** A deterministic precedence over the gap report + trust dimensions, producing Ready/Near Ready/Blocked/Unknown with an honest rationale and a non-fabricated time estimate.

**Deliverable status:** complete. → C6 (Implementation Readiness Report).

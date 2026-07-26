# W230-C3 — Gap Engine Blueprint

**Wave:** 230 · **Depends on:** [C2](./C2-opportunity-architecture.md)
**Date:** 2026-06-21

Deterministic gap detection: `(OpportunityObject, EvidenceCollection, TrustProjection) → Gap[]`. Pure set/threshold comparison — no matching algorithm.

---

## 0. Signature

```ts
function detectGaps(
  opportunity: OpportunityObject,
  evidence: EvidenceCollection,
  trust: TrustProjection,
): GapReport;   // pure, deterministic
```

## 1. `Gap` model

```ts
type GapKind = 'missing' | 'insufficient' | 'stale' | 'satisfied';

interface Gap {
  requirementId: string;
  label: string;
  necessity: 'mandatory' | 'preferred';
  kind: GapKind;
  /** Honest reason, in the source-coverage vocabulary. */
  reason: string;
  /** Evidence that partially satisfies but isn't decision-grade (the fixable path). */
  blockingEvidenceIds: string[];
  /** Whether a known remediation path exists (e.g. compact endorsement). */
  remediation: GapRemediation | null;
}

interface GapRemediation {
  type: 'request_refresh' | 'apply_endorsement' | 'submit_evidence' | 'await_review';
  detail: string;
  estimatedDays: number | null;   // from readiness engine / endorsementDelays
}

interface GapReport {
  opportunityId: string;
  subjectKey: string;
  gaps: Gap[];
  mandatoryUnmet: number;
  preferredUnmet: number;
}
```

## 2. Per-requirement evaluation (deterministic rules)

### EvidenceRequirement
1. Find evidence in `evidence.byClass[evidenceClass]` (optionally filtered by `jurisdiction === value.jurisdiction`).
2. If a match has `status` meeting `minStatus` (default `checked`) → **satisfied**.
3. If a match exists but is gated/stale/pending/reviewRequired → **insufficient** (or **stale** if stale), `blockingEvidenceIds = [match]`, remediation `request_refresh` / `await_review`.
4. If no match at all → **missing**. If `jurisdiction` set and the clinician holds a compact-eligible license elsewhere → remediation `apply_endorsement` with `getEndorsementDelay(state, profession)`.

### TrustRequirement
1. Read `trust.dimensions[dimension].score`.
2. `null` → **missing** ("no evidence in this dimension"). `< minScore` → **insufficient** (cite `weakening` evidenceIds). `>= minScore` → **satisfied**.

### ExperienceRequirement
1. Read `trust.dimensions[dimension].decisionGradeCount`.
2. `>= minDecisionGradeCount` → **satisfied**; else **insufficient** / **missing** with the count shortfall.

## 3. Worked examples (brief's list)

| Requirement | Evidence/trust state | Gap |
|---|---|---|
| License in NV (mandatory) | only CA license (checked), NLC compact member | `missing` + remediation `apply_endorsement` (estimatedDays from `getEndorsementDelay('NV', profession)`) |
| Board cert (mandatory) | no board_cert evidence | `missing`, remediation `submit_evidence` |
| Board cert (mandatory) | board_cert present but `gated` | `insufficient`, `blockingEvidenceIds`, remediation `await_review` |
| Experience ≥ 3 (preferred) | professional `decisionGradeCount = 1` | `insufficient` (preferred → strength only) |
| Leadership (preferred) | leadership dimension `null` | `missing` (preferred) |

## 4. Honesty rules (tested when built)

1. A gated/stale match **never** satisfies a `checked`-min requirement — it's `insufficient`, not satisfied.
2. Jurisdiction is exact; cross-state satisfaction only appears as a `remediation` (endorsement), never as a satisfied gap.
3. `missing` vs `insufficient` is distinguished honestly (no evidence vs present-but-not-decision-grade).
4. Remediation `estimatedDays` is `null` unless the readiness engine / endorsement table provides a real number — never fabricated.
5. Deterministic ordering: gaps sorted mandatory-first, then by requirementId.

## 5. Reuse

- `EvidenceCollection.byClass`, `coverageSummary` (W220).
- `TrustProjection.dimensions[*].{score, decisionGradeCount, weakening}` (W222).
- `getEndorsementDelay`, `NLC_COMPACT_STATES`, `COUNSELING_COMPACT_STATES` (existing backend) for endorsement remediation.
- `computeReadiness` per-state for `estimatedDays`.

## 6. Success-criteria answer

- **How do we identify gaps?** A pure per-requirement evaluation over `byClass` + `dimensions`, producing typed `Gap`s with honest `missing`/`insufficient`/`stale` kinds and real remediation paths.

**Deliverable status:** complete. → C4 (Mobility API).

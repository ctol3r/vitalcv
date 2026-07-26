# W235-C1 — Reputation Signal Inventory

**Wave:** 235 (Professional Reputation Engine) · **Role:** Claude Code
**Date:** 2026-06-21
**Inputs analyzed:** EvidenceCollection (W220), GraphProjection (W221), TrustProjection (W222), TimelineProjection + ReputationSummary (W225).

The deterministic signals from which reputation can be **derived** — never rated, never opined.

---

## 0. Definition (the anti-subjectivity anchor)

In VitalCV, **reputation = the depth, breadth, and currency of source-backed professional evidence in a domain.** It is *not* a popularity, peer-opinion, or quality score. Every reputation number must trace to countable, source-backed facts: how much decision-grade evidence, across how many distinct sources/jurisdictions, how recently re-verified. No human rating, no ML, no hidden weights.

## 1. Signals already available

| Signal | Source | Objective? |
|---|---|---|
| Decision-grade evidence count (per class) | `EvidenceCollection.byClass`, `decisionGrade` | yes — a count |
| Source breadth | distinct `EvidenceObject.source.sourceId` (decision-grade) | yes — a count |
| Jurisdictional breadth | licensure/registration `value.jurisdiction` | yes — a count |
| Trust dimension scores (7) | `TrustProjection.dimensions[*].score` | yes — bounded mean of evidence (W222) |
| Dimension `supporting`/`weakening`/`origins` | `DimensionTrust` | yes — evidence id lists |
| Recognition count | `CareerEvent.recognitionImpact !== 'none'` | yes — a count of signed canonical-path events |
| Currency / recency | `CareerEvent.occurredAt`, `expiresAt`, `lifecycle` | yes — timestamps |
| Reinforcement / decay | `TrustHistory.entries`, `CareerEvent.trustImpact` | yes — signed deltas |
| Standing seed | `ReputationSummary.standing` (W225) | yes — threshold over decision-grade evidence |

## 2. Signals deliberately EXCLUDED (to avoid subjectivity)

- Peer ratings / endorsements / "likes" — none exist, none will be invented.
- Employer satisfaction / performance opinion — out of scope; not source-backed fact.
- Specialty "prestige" weighting — would inject editorial judgment.
- Any ML-derived or learned weight.

## 3. Reputation is a re-projection, not a new measurement

Every reputation signal above is **already produced** by the trust/timeline layers. The Reputation Engine (C2/C3) re-groups and rolls them up into domain-facing dimensions — it measures nothing new and adds no opinion. This is the key to "no subjective scoring": reputation inherits its objectivity from the trust layer's evidence-bounded, monotonic guarantees.

## 4. Gaps the engine must add (C2/C3)

1. **Domain regrouping** — map the 7 trust dimensions into the 5 reputation dimensions (C3), with full evidence traceability.
2. **Breadth + currency rollups** — count distinct sources/jurisdictions and most-recent reinforcement per dimension.
3. **Recovery detection** — a decay later followed by a same-dimension reinforcement (deterministic pattern, C4).
4. **Milestones** — first decision-grade evidence in a dimension, first recognition, standing crossings (deterministic events, C4).

**Deliverable status:** complete. → C2.

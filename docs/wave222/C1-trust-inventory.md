# W222-C1 — Trust Inventory

**Wave:** 222 (Trust Propagation Engine) · **Role:** Claude Code
**Date:** 2026-06-21
**Inputs reviewed:** GraphProjection (W221), EvidenceObject/EvidenceCollection (W220), trust scores.

The deterministic trust signals available to the propagation engine — what exists, where it comes from, and the rule that keeps it honest.

---

## 0. Principle

Trust is **deterministic and evidence-bounded**. No ML, no opaque scoring. Every signal traces to a source-backed evidence object whose status is verbatim from coverage. Aggregation is **monotonic-down** (W220-C3): trust flows *up* from evidence into dimensions and an overall score, but is never inflated by neighbors.

## 1. Per-node trust signal (already in the graph)

Each evidence `GraphNode` carries:

| Field | Meaning | Source |
|---|---|---|
| `status` | `checked / stale / pending / gated / accessRequired / reviewRequired / notDecisionGrade / previewOnly / unavailable` | verbatim from `CanonicalSourceCoverage` |
| `trustScore` | 0..1, **monotonic, non-inflating** | `statusTrustScore(status)` — only `checked`=1; every gated state=0 |
| `decisionGrade` | derived, `=== status==='checked'` | never set directly |
| `evidenceSource` | the backing source id (origin) | EvidenceObject.source |
| `evidenceClass` | which dimensions it feeds | EvidenceObject.evidenceClass |
| `checkedAt` / `expiresAt` / `lifecycle` | temporal signal for history | EvidenceObject |

`statusTrustScore`: `checked → 1`, `stale → 0.4`, `pending → 0.2`, `reviewRequired → 0.1`, everything gated/unavailable/notDecisionGrade/previewOnly/accessRequired `→ 0`.

## 2. Dimension signals (C3)

Seven independent dimensions, each a deterministic mean of the trustScores of its contributing evidence classes. A class may feed more than one dimension; dimensions are computed independently so a shared input never feeds one dimension's score into another.

| Dimension | Contributing evidence classes | Aggregation |
|---|---|---|
| **IdentityTrust** | identity | mean of contributing trustScores, or `null` if none |
| **AuthorityTrust** | licensure, board_cert, registration, exclusion, enrollment | mean / null |
| **ProfessionalTrust** | employment, recognition, acceptance, start, training | mean / null |
| **ResearchTrust** | research, publication | mean / null |
| **LeadershipTrust** | privilege, peer_review | mean / null |
| **InstitutionalTrust** | employment, recognition, acceptance, start, training, privilege | mean / null |
| **MobilityTrust** | licensure, registration | mean / null |

Each dimension also reports: `supporting` (evidenceIds with score>0), `weakening` (score===0), `origins` (distinct sources of positive evidence), `contributingCount`, `decisionGradeCount`.

**Honesty:** a dimension with no contributing evidence returns `score: null` (not a fabricated 0 or positive). A dimension whose evidence is all gated returns `0`.

## 3. Overall signal

`overall.score` = mean of all evidence trustScores (bounded [0,1], drags down on gated/stale). Plus `decisionGradeEvidence` and `totalEvidence` counts. No weakest-link or boosting — a plain, explainable mean.

## 4. History signals (C4)

Derived deterministically from current evidence timestamps (timeline-compatible shape; **not** a substitute for the recorded audit log — that lives in `packages/audit` / `core/watchtower`, per W215-C4):

- **Reinforcement** — each `checked` evidence → `+trustScore` at `checkedAt`.
- **Decay** — each `stale` / `expired` / `revoked` evidence → `-(1 - trustScore)` at `expiresAt`.
- **Growth** — the net trend: `growing` / `decaying` / `stable` from `netDelta`.

Entries are sorted ascending by timestamp (nulls last, tiebreak evidenceId) — deterministic and replay-safe.

## 5. The five questions, answered by these signals

| Question | Answered by |
|---|---|
| Why is this clinician trusted? | dimensions with positive `score` + their `supporting` evidence |
| Where does trust originate? | `origins` per dimension (decision-grade source ids) |
| What reinforces trust? | `supporting` + history `reinforcement` entries |
| What weakens trust? | `weakening` + history `decay` entries |
| How has trust evolved? | `history.trend` + ordered entries |

## 6. What is explicitly NOT a trust signal

- No model output, no learned weights, no probabilistic confidence beyond the deterministic `statusTrustScore`.
- No neighbor-boosting: a high-trust node never raises an adjacent low-trust node.
- No upgrade of gated/stale to positive anywhere in the pipeline.

**Deliverable status:** complete. Implemented in `packages/domain-evidence/src/trust/propagate.ts` (C2–C4), `GET /api/graph/:entityId/trust` (C5), `/dev/graph/[entityId]` Trust View (C6).

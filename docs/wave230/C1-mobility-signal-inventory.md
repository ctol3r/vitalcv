# W230-C1 — Mobility Signal Inventory

**Wave:** 230 (Career Mobility Engine) · **Role:** Claude Code
**Date:** 2026-06-21
**Inputs reviewed:** EvidenceObject/EvidenceCollection (W220), GraphProjection (W221), TrustProjection — 7 dimensions + history (W222), plus the existing backend readiness engine.

The deterministic signals already available that indicate mobility readiness. **No new signals needed** — mobility is a re-read of what the evidence/trust layers already produce.

---

## 0. Principle

Mobility readiness = "is this clinician's existing, source-backed evidence sufficient for *this* opportunity, and if not, exactly what's missing?" Every signal below is deterministic and traces to a source-backed evidence object. No matching ML.

## 1. Evidence-layer signals (per `EvidenceObject`)

| Signal | Field | Mobility meaning |
|---|---|---|
| Evidence class | `evidenceClass` | what kind of requirement it can satisfy (licensure, board_cert, registration, …) |
| Status | `status` (verbatim coverage) | whether it's decision-grade now (`checked`) or owed (gated/stale/pending) |
| Decision-grade | `decisionGrade` | hard gate: only `checked` evidence satisfies a mandatory requirement |
| Jurisdiction | `value.jurisdiction` (licensure/registration) | **the core mobility signal** — which states a clinician is already licensed in |
| Freshness | `checkedAt` / `expiresAt` / `lifecycle` | whether reusable evidence is current or needs a refresh |
| Coverage summary | `EvidenceCollection.coverageSummary` | sourceIds grouped by status — the reusable-vs-owed split |

## 2. Trust-layer signals (per `TrustProjection`)

| Signal | Field | Mobility meaning |
|---|---|---|
| **MobilityTrust** | `dimensions[mobility].score` | breadth/strength of decision-grade licensure + registration |
| AuthorityTrust | `dimensions[authority]` | credential strength (license/board/registration/exclusion/enrollment) |
| ProfessionalTrust | `dimensions[professional]` | experience signal (employment/recognition/start/training) |
| LeadershipTrust | `dimensions[leadership]` | leadership signal (privilege/peer_review) |
| Dimension `supporting` | reinforcing evidenceIds | what already qualifies the clinician |
| Dimension `weakening` | gated/zero evidenceIds | **gap candidates** — evidence present but not decision-grade |
| Dimension `origins` | source ids | where the qualifying trust comes from |
| Overall | `overall.decisionGradeEvidence / totalEvidence` | how much of the evidence is reusable now |

## 3. History signals (per `TrustHistory`)

| Signal | Field | Mobility meaning |
|---|---|---|
| Decay entries | `history.entries[type='decay']` | reusable evidence about to expire → near-ready, needs refresh |
| Reinforcement | `history.entries[type='reinforcement']` | recently re-verified, fully reusable |
| Trend | `history.trend` | growing/decaying readiness trajectory |

## 4. Existing backend signals to reuse (not rebuild)

- **Readiness engine** (`apps/api/backend/.../readiness/readinessEngine.ts`) — `computeReadiness(npi, targetState, profession, artifacts)`: per-state readiness, blockers, `estimatedStartDays`, `clearToStartDate`.
- **Endorsement / compact** (`endorsementDelays.ts`) — `NLC_COMPACT_STATES`, `COUNSELING_COMPACT_STATES`, `getEndorsementDelay(state, profession)`: the per-state time-to-license signal.
- **Opportunity model** (Wave 227) — `Opportunity { specialties[], statesCovered[], requirements[] }`, `opportunityService`, `AcceptancePrediction { readinessBand, state, specialty, credentialTypes, gaps }`.
- **Aggregate mobility** (`/api/intelligence/mobility`) — population-level `multiStateRate`, `compactLicenseHolders`. (Per-entity mobility, C4, is distinct from this.)

## 5. The mobility question → which signals answer it

| Question | Signals |
|---|---|
| Can this clinician work in state X? | licensure/registration evidence with `value.jurisdiction === X` that is `decisionGrade`; else compact eligibility + endorsement delay |
| Is their evidence reusable? | `status === 'checked'` + not near `expiresAt` |
| What's missing for opportunity Y? | requirement set (C2) minus satisfied evidence/trust (C3) |
| How strong a candidate? | MobilityTrust + AuthorityTrust + ProfessionalTrust scores |
| When could they start? | readiness engine `estimatedStartDays` + endorsement delay |

## 6. Gaps in current signals (what the foundation must add)

1. **Jurisdiction is under-modeled in evidence.** Licensure `value.jurisdiction` exists but isn't first-class; the mobility engine needs a normalized per-state index (C3/C5). No new storage — derived from existing credential jurisdictions.
2. **No OpportunityObject in the evidence vocabulary.** The backend `Opportunity` is org-centric; mobility needs requirements expressed in `EvidenceClass`/`EvidenceStatus`/`TrustDimension` terms so gap detection is a pure diff (C2).
3. **No per-entity readiness verdict against a specific opportunity.** Readiness engine is per-state; mobility needs per-opportunity (C5).

**Deliverable status:** complete. → C2 (Opportunity Architecture).

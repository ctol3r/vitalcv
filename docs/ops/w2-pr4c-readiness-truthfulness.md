# W2-PR4C - Readiness Truthfulness

**Wave:** W2-PR4C - Dossier + Confidence Trust Alignment  
**Date:** 2026-05-09  
**Status:** Docs-only readiness truthfulness contract. No product code changed. No merge.  
**Purpose:** Keep readiness explainable, informational, freshness-aware, and separate from approval or acceptance.

## Scope

This document applies to readiness scores, source coverage rows, trust posture summaries, employer review readiness copy, and readiness-adjacent recommendations.

It does not change CRS, readiness state derivation, employer acceptance rules, or start eligibility.

## Core Rule

Readiness is an informational snapshot from available source-backed lanes and explicit gaps.

Readiness must not imply:

- employment approval;
- privileging approval;
- tenant ownership;
- verifier acceptance;
- complete credentialing;
- replay prevention;
- source truth beyond the shown freshness window.

## Runtime Baseline

The strongest current pattern is already present in passport and source coverage UI:

- `PassportSourceCoveragePanel` states that only checked sources are decision-grade.
- `PassportTrustPosture` says trust posture reflects source-backed readiness only and is not a hiring, privileging, or employment decision.
- `SourceCoverageRow` shows decision-grade vs not-decision-grade, reason, checked timestamp, and artifact id when present.
- `ReadinessState` derives strictly from launch-spine source coverage: `CHECKING`, `PARTIAL`, `DECISION_GRADE`, `BLOCKED`.

This pattern should be preserved and made easier to understand wherever readiness appears.

## Readiness Semantics

| State or copy | Safe meaning | Required limitation |
|---|---|---|
| `CHECKING` | Sources have not produced enough checked lane data yet. | No score or positive readiness claim should stand alone. |
| `PARTIAL` | At least one required lane is checked, but not all required lanes are checked. | Show missing, stale, gated, unavailable, or review-required lanes. |
| `DECISION_GRADE` | All launch-spine lanes are checked for this snapshot. | Still not employment approval or tenant acceptance. Freshness remains controlling. |
| `BLOCKED` | A hard-blocking source state exists. | Show the blocking lane and required action if known. |
| Score withheld | Source-backed claims are not attached yet. | Do not replace with optimistic default score. |
| Percent ready | Snapshot score or posture value. | Must be paired with source freshness and limitation copy. |

## Informational Wording

Allowed:

- `Readiness snapshot`
- `Source-backed readiness snapshot`
- `Current source coverage`
- `Score withheld until source-backed claims attach`
- `Partial readiness`
- `Source access required`
- `Review required before this lane can be treated as decision-grade`
- `Freshness window still applies`
- `This does not represent a hiring, privileging, or employment decision`

Avoid:

- `Approved`
- `Cleared`
- `Ready to start`
- `Ready for hire`
- `Fully verified`
- `Guaranteed start`
- `Tenant accepted`
- `Replay protected`
- `Complete credentialing`

## Explainable Uncertainty

Every readiness surface should identify the reason for uncertainty.

Minimum uncertainty labels:

| Uncertainty | Display label | Detail |
|---|---|---|
| Source pending | `Pending source` | Source has not returned a decision-grade result yet. |
| Source stale | `Stale source` | Evidence is outside freshness policy or requires refresh. |
| Source gated | `Access required` | Institutional or source access is needed before the lane can be checked. |
| Source unavailable | `Unavailable source` | The source could not be reached or cannot currently produce a usable result. |
| Manual review | `Review required` | The lane needs human review before reliance. |
| Preview data | `Preview only` | Useful for context, not decision-grade. |
| Missing receipt | `No receipt attached` | The lane is not verified in this session. |

## Source Freshness Indicators

Readiness must show freshness at the lane level, not only at the aggregate score.

Minimum fields:

```text
Source: [source label]
State: [checked / stale / pending / access required / unavailable / review required / preview only]
Checked: [timestamp or not yet checked]
Observed: [timestamp or unavailable]
Freshness window: [duration or unavailable]
Artifact: [artifact id or none attached]
Receipt: [receipt id or none attached]
```

If a freshness timestamp is missing:

```text
Freshness unavailable. Treat this lane as not decision-grade until a source check attaches timestamped evidence.
```

## Readiness and Confidence Boundary

Readiness is not the same as confidence.

| UX value | Meaning | Required pairing |
|---|---|---|
| Confidence | Support level for a classification, source match, or recommendation. | Basis, source dependency, freshness, limitation. |
| Readiness | Current posture from source coverage and readiness rules. | Lane states, blockers, freshness, limitation. |
| CRS/score | Deterministic score from canonical inputs. | Explainability and missing-lane detail. |
| Employer action | Human or org workflow decision. | Audit event and scope. |

Do not use confidence to fill readiness gaps. Do not use readiness to imply acceptance.

## Recommended Readiness Copy Pattern

```text
Readiness snapshot: [state or score].
Basis: source coverage from [checked source count] of [required source count] launch-spine lanes.
Freshness: [current / mixed / stale / unknown].
Limits: this is informational and does not represent hiring, privileging, employment, or verifier acceptance.
Needs attention: [blocking lanes or "none shown in this snapshot"].
```

## Follow-Up Implementation Shape

A safe follow-up product PR should:

1. Add visible lane-level freshness beside every readiness aggregate.
2. Replace bare `% ready` labels with `Readiness snapshot` plus limitation copy.
3. Surface `ReadinessState` next to the score where it is currently hidden.
4. Keep `Score withheld` behavior when no source-backed claims are attached.
5. Add tests that prevent readiness copy from using approval or start guarantees.

## Honesty Assessment

**Artifact alignment:** SAFE. This document preserves the existing readiness truth contract and makes uncertainty and freshness requirements explicit.

**Runtime alignment:** MOSTLY ALIGNED. Passport/source coverage surfaces already carry strong truth language. Remaining ambiguity is concentrated in bare `% ready` displays and places where `DECISION_GRADE` can be read as approval without nearby limitation copy.

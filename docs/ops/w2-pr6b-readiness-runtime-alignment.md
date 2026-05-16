# W2-PR6B - Readiness Runtime Alignment

**Wave:** W2-PR6B - Trust-State Runtime Explainability
**Date:** 2026-05-08
**Status:** Docs-only readiness runtime alignment review. No product code changed. No merge.
**Risk class:** SAFE.
**Purpose:** Determine whether readiness states a clinician, employer, or verifier can read are runtime-aligned, freshness-aware, and bounded against approval/acceptance misreads.

## Scope

Readiness is shown across: passport trust posture, trust-state cards, time-to-start estimates, lane-health badges (post-#220), and source-coverage panels. Backend producer is the resolver in `packages/trust-state/TrustStateResolver.ts`; readiness derivation is in `packages/trust-state/sourceCoverage.ts:682-717`.

This document does not change CRS, readiness derivation, or any component. It rates each surface against the four-criterion explainability ladder and the W2-PR4C readiness truthfulness contract.

## Core rule (from W2-PR4C, applied here)

Readiness is an **informational snapshot** from available source-backed lanes plus explicit gaps. It must not imply employment approval, privileging approval, tenant ownership, verifier acceptance, complete credentialing, replay prevention, or source truth beyond the shown freshness window.

## Runtime producer audit

### `TrustStateResolver.resolve()`

The resolver returns a `TrustState` with: `start_ready`, `score`, `band`, ordered `blocking_reasons`, `last_verified_at`, `audit_ref`, and metrics. Notable behaviors:

- **Decay downgrades hard.** Any of: missing PSV, expired PSV, revoked PSV, failed verification, identity conflict — forces `band = 'RED'` and clamps `score` below the 80 start threshold (`TrustStateResolver.ts:469-479`). The runtime *cannot* report green readiness while a PSV is decayed.
- **Acceptance proof must validate.** `hasAcceptanceForScope` requires both a SHA-256 hash anchor and a structurally valid `AcceptanceProofRecord` (`TrustStateResolver.ts:109-111, 219-241`). Missing or malformed proof fails closed — readiness drops.
- **Decision-grade coverage is required.** Receipts whose `source_coverage_state` is not decision-grade-truth-satisfying do not contribute to passing checks (`TrustStateResolver.ts:326-338`).
- **Stale coverage** maps to `EXPIRED_PSV` (`TrustStateResolver.ts:350-352`). Staleness is treated as decay, not as a soft warning.
- **Decay events emit `TRUST_STATE_DECAY` audit events** with `previous_band`, `new_band: 'RED'`, and reason (`TrustStateResolver.ts:481-494`). Truth: the resolver does the right thing.

**Verdict on producer:** 🟢 CLEAR. The runtime is conservative, fail-closed, and emits structured decay telemetry.

### `ReadinessState` derivation (`sourceCoverage.ts:682-717`)

States: `CHECKING | PARTIAL | DECISION_GRADE | BLOCKED`. Derived strictly from launch-spine sources (NPPES_API, OIG_LEIE, PECOS_PUBLIC, STATE_BOARD).

```
BLOCKED          ← any spine source = reviewRequired or unavailable
DECISION_GRADE   ← all spine sources = checked
PARTIAL          ← ≥1 spine source = checked
CHECKING         ← otherwise
```

**The enum is deterministic and grounded.** It is also **invisible by name** in the product (per W2-PR4D §2). The resolver knows the readiness posture; the operator does not see the literal value.

## Runtime consumer audit

### Passport trust posture — 🟢 CLEAR

`apps/web/components/passport/PassportTrustPosture.tsx`:

- Line 107: *"Trust posture reflects source-backed readiness only. It does not represent a hiring, privileging, or employment decision."* This is the strongest disclaimer in the codebase.
- Line 95, 113: `Source-backed now` / `Withheld` — score is hidden until source-backed claims attach. ✅ No optimistic default.
- Lines 156-180: structured sections — `Safe to rely on now`, `Blockers`, `Review required`, `Access required`, `Stale`, `Missing`. Each blocker is named and grouped.

| Criterion | Verdict |
|---|---|
| Named | 🟡 The `ReadinessState` literal (`PARTIAL`, `DECISION_GRADE`, etc.) is not rendered. The operator sees grouped lanes but not the aggregate enum. |
| Grounded | 🟢 Every grouped lane is shown with state and reason. |
| Bounded | 🟢 Disclaimer is unambiguous. |
| Recoverable | 🟢 Lane rows show what kind of action is needed. |

The phrase **"Safe to rely on now"** is correct in the lane-freshness sense but context-sensitive. A non-technical reader could over-extrapolate ("safe = approved"). Recommend: `Source-backed now` (already used elsewhere) or `Decision-grade now`. Verdict downgraded to 🟡 only on this one phrase.

### Trust-state card — 🟠 AMBIGUOUS

`apps/web/components/trust/TrustStateCard.tsx`:

- Lines 22-40: 3-band model — `Clear to Start` / `Needs Review` / `Action Required`.

| Criterion | Verdict |
|---|---|
| Named | 🟢 The band copy is rendered. |
| Grounded | 🟡 Card does not surface lane-level reasons; assumes the operator drills in. |
| Bounded | 🔴 No matching disclaimer to `PassportTrustPosture.tsx:107`. "Clear to Start" is the **single most extractable phrase in the product** — easy to screenshot, easy to misread as a hiring decision. |
| Recoverable | 🟡 Not within the card itself. |

**Verdict:** 🟠 AMBIGUOUS. The card is the most likely surface to be misread as approval. **Highest-leverage repair:** add the same line-107 disclaimer to `TrustStateCard`. Single-line UI change.

### Time-to-start estimate — 🟡 PARTIAL

`apps/web/components/trust/TimeToStartEstimateSummary.tsx` and `apps/web/lib/trust/time-to-start.ts`:

- Line ~125-133: `withoutVitalCvLabel: ~90 days`, `withVitalCvLabel: ~45-60 days`.

The estimates are **qualified ranges**, not commitments. Both are clearly framed as estimates, both surface a comparator. The risk is implicit: the framing of "time saved" can be read as VitalCV *shortening* verification gating, when actually it surfaces readiness earlier from existing checks.

| Criterion | Verdict |
|---|---|
| Named | 🟢 |
| Grounded | 🟡 Inputs (lane states, source freshness) are not shown beside the estimate. |
| Bounded | 🟡 No "this does not commit a hire date" copy. |
| Recoverable | n/a — informational. |

**Verdict:** 🟡 PARTIAL. Recommended: append `Estimate based on current source coverage. Not a guarantee of start date or employer commitment.`

### Lane health (post-#220) — 🟢 CLEAR

`apps/web/components/trust/LaneHealthBadge` (and the `LaneHealthMount` mounted in `apps/web/app/passport/[id]/page.tsx`):

- Compact format: `Source · State` + relative timestamp (e.g., `NPPES · Live · 2h ago`).
- Comment in `LaneHealthMount` (line 10-11) acknowledges deterministic placeholder until live probe wired.
- States Live / Degraded / Unavailable / Unknown are explicit, never claim "verified".

| Criterion | Verdict |
|---|---|
| Named | 🟢 |
| Grounded | 🟢 |
| Bounded | 🟢 |
| Recoverable | 🟡 Operator is told the lane state; not told what to do about Degraded. |

**Verdict:** 🟢 CLEAR. This is the cleanest readiness-adjacent surface added in the W2 wave.

### Source coverage panel — 🟢 CLEAR

`apps/web/components/trust/PassportSourceCoveragePanel.tsx` and `SourceCoverageRow.tsx:50-77`:

- Each row: source ID + decision-grade badge (`Decision grade` / `Not decision grade`) + status descriptor + reason + `Checked [date]` or `Not yet checked`.
- "Decision grade" badge gates positive wording.

Single gap: `Not yet checked` does not distinguish *pending*, *failed*, *not scheduled*, *never attempted*. Detail in `w2-pr6b-provenance-visibility.md`. Verdict downgraded only minimally; truth is preserved.

## Critical questions

| # | Question | Answer |
|---|---|---|
| 1 | Would a clinician misunderstand readiness as employment approval? | 🟡 LOW risk on `PassportTrustPosture` (disclaimer present); 🔴 HIGHER risk on `TrustStateCard` (no disclaimer). |
| 2 | Would a verifier read "Decision grade" as "verified by VitalCV"? | 🟡 PARTIAL. The label is precise (decision-grade-eligible), but a non-technical reader may compress it. |
| 3 | Is readiness paired with freshness at the lane level? | 🟢 YES. SourceCoverageRow shows `Checked [date]`. Aggregate score does not show last-verified-at next to it; minor. |
| 4 | Is `start_ready=true` ever reachable while a receipt is decayed? | 🟢 NO. Resolver forces `RED` band and clamps score below 80 on any decay path. |
| 5 | Is `Score withheld` honored when no source-backed claims exist? | 🟢 YES. PassportTrustPosture renders `Withheld` instead of `0%` or `N/A`. |
| 6 | Is the four-state `ReadinessState` enum ever shown by name? | 🔴 NO. The runtime computes it; the operator never sees the literal. |

## Required runtime alignment (no implementation in this wave)

A safe follow-up product PR — **not in scope here** — would:

1. Render the active `ReadinessState` literal beneath the readiness score on the passport (closes FR-S-5 from W2-PR4D).
2. Mirror the `PassportTrustPosture.tsx:107` disclaimer onto `TrustStateCard` and any other component that renders a band label.
3. Append "Estimate based on current source coverage; not a guarantee of start date." to `TimeToStartEstimateSummary`.
4. Replace the phrase **"Safe to rely on now"** with **"Source-backed now"** to remove the optional-extrapolation risk.
5. Disambiguate `Not yet checked` in `SourceCoverageRow` — separate `Pending`, `Not scheduled`, and `Failed` cases.
6. Add a regression test that asserts the `ReadinessState` literal is in the DOM whenever the readiness score is rendered.

None of (1)-(6) requires backend persistence. None alters the resolver. Each is single-PR scoped.

## Honesty assessment

**Artifact alignment:** SAFE. This document does not change derivation, scoring, or any band threshold.

**Runtime alignment:**
- **Producer (resolver):** 🟢 SAFE. Conservative, fail-closed, decay-honest.
- **Surface (UI):** 🟡 MOSTLY ALIGNED. `PassportTrustPosture` is the model; `TrustStateCard` and `TimeToStartEstimate` are weaker. The single biggest UI gain is making `ReadinessState` visible by name. The single biggest copy gain is propagating the line-107 disclaimer across surfaces.

The system computes more truth than it reveals. None of the proposed repairs widens any guarantee.

## See also

- `w2-pr6b-trust-state-explainability.md`
- `w2-pr6b-confidence-runtime-alignment.md`
- `w2-pr6b-provenance-visibility.md`
- `w2-pr6b-runtime-explainability-matrix.md`
- `w2-pr4c-readiness-truthfulness.md`
- `w2-pr4d-trust-state-continuity.md` (FR-S-5)

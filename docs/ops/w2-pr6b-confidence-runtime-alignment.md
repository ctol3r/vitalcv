# W2-PR6B - Confidence Runtime Alignment

**Wave:** W2-PR6B - Trust-State Runtime Explainability
**Date:** 2026-05-08
**Status:** Docs-only confidence runtime alignment review. No product code changed. No merge.
**Risk class:** SAFE.
**Purpose:** Determine whether confidence values shown to clinicians, verifiers, and employers are runtime-aligned, basis-disclosed, and non-misleading.

## Scope

Confidence appears in four UI families: dedicated confidence components (badge, meter, score), the Knowledge Inbox classification panel, recommendation surfaces, and readiness-adjacent score displays. Backend producer is `apps/api/backend/src/services/decision/confidenceEngine.ts`.

This document does not redesign scoring, change thresholds, or modify components. It rates each surface against the runtime input it depends on and the four-line confidence display contract from W2-PR4C.

## Display contract (from W2-PR4C, applied here)

Every confidence value must surface:

```text
Label: [Classification | Source match | Recommendation | Readiness snapshot]
Value: [band or percent]
Basis: [classifier / source adapter / evidence + freshness / coverage]
Source dependency: [source label or "no source check attached"]
Freshness: [current / stale / unknown / pending / access required / unavailable]
Limitation: [not source verification / not approval / not acceptance / no outcome history yet]
```

A confidence percentage without a basis label is treated as **not runtime-aligned**.

## Runtime producer audit

### `apps/api/backend/src/services/decision/confidenceEngine.ts`

**What the runtime actually computes:**

- `evidenceStrength` — % of required coverage lanes checked (`CanonicalSourceCoverageState` lane signal).
- `freshnessScore` — % of max TTL remaining at evaluation time.
- `issuerTrustLevel` — blended authority score.
- `outcomeHistoryStrength` — historical success rate.

**Where the runtime drifts:**

- When **no outcome history exists**, the engine defaults `outcomeHistoryStrength` to `1.0`. Absence of negative signal becomes positive support.
- `sampleSize >= 0` is a permissible state for HIGH calibrated confidence. A clinician with zero prior outcomes can be classified `READY_CONFIDENT` partly because nothing has gone wrong yet.
- Three of the four modulators (`evidenceStrength`, `freshnessScore`, `outcomeHistoryStrength`) are computed but **only `issuerTrustLevel` is rendered**, in `AcceptancePanel.tsx`. The operator sees `READY_CONFIDENT` with no decomposition.

**Verdict on producer:** 🔴 MISLEADING under the no-history default. The number says "high confidence" partly because the system has no evidence to disagree with itself.

## Runtime consumer audit

### Confidence components

| File | Line | What the user sees | Basis label? | Threshold model | Verdict |
|---|---|---|---|---|---|
| `apps/web/design-system/components/ConfidenceBadge.tsx` | 19-22 | `{pct}% confidence` | ❌ | None visible | 🔴 MISLEADING — bare percentage, no semantic anchor. |
| `apps/web/components/ui/ConfidenceMeter.tsx` | 19-59 | Horizontal bar (amber ≤40%, blue 41-70%, green 71-100%) + `{clamped}%` | ❌ | 40 / 70 | 🟠 AMBIGUOUS — color implies severity but no source grounding. |
| `apps/web/components/ui/confidence-score.tsx` | 22-47 | Bar + `{clamped}%` (green ≥95%, yellow ≥80%, red <80%) | ❌ | 80 / 95 | 🟠 AMBIGUOUS — different thresholds than `ConfidenceMeter`; appears tuned ad-hoc. |
| `apps/web/components/knowledge-inbox/KnowledgeInboxPanel.tsx` | (panel) | `{item.confidence} confidence` | ❌ | n/a | 🔴 MISLEADING — Knowledge Inbox is *classification* confidence; without the label, viewers may read it as source verification. |

**Cross-component drift:** two components disagree on what counts as "high." A 75% reading is `green` in `ConfidenceMeter` and `red` in `confidence-score`. Same number, opposite signal — a clinician comparing two surfaces in the same session can be told two different things.

### Recommendation surfaces

`apps/web/components/clinician/AcceptancePanel.tsx` renders `issuerTrustLevel` near the calibrated decision state. This is the **only** recommendation surface that exposes any modulator. The other three modulators do not surface, so the operator cannot tell whether a calibration is high because of fresh evidence or because of a missing history default.

### Readiness-adjacent

The passport readiness score (`PassportTrustPosture.tsx`) uses `Score withheld` when no source-backed claims attach — this is a **safe pattern** because absence is shown as absence, not as 100%. Readiness avoids the no-history uplift trap that confidence falls into.

## Confidence type alignment

| Type | Required label | Runtime input | Currently labeled? | Verdict |
|---|---|---|---|---|
| Classification | `Classification confidence` | Classifier inputs / text parsing | ❌ — Knowledge Inbox shows bare `confidence`. | 🔴 |
| Source match | `Source match confidence` | Adapter response, match basis | ❌ — components do not differentiate. | 🟠 |
| Recommendation | `Recommendation confidence` | Evidence strength, issuer trust, freshness, outcome history | ❌ — only enum + bar shown. | 🠠 |
| Readiness snapshot | `Readiness snapshot` | `CanonicalSourceCoverageState` aggregate | 🟢 — `PassportTrustPosture` says "Trust posture" + disclaimer. | 🟢 |

The single 🟢 row is the model. The other three should converge to the same shape: explicit label + runtime-grounded modulators + limitation text.

## Critical questions

| # | Question | Answer |
|---|---|---|
| 1 | Would a clinician believe a 95% confidence bar means the source confirmed the claim? | 🔴 YES, plausibly. None of the three confidence components disambiguates from source verification. |
| 2 | Would a verifier interpret missing outcome history as a positive signal? | 🔴 YES — the runtime itself defaults missing history to `1.0`. |
| 3 | Would a recommendation percentage be read as a deterministic outcome? | 🟠 YES — bar + percentage is universally read as certainty unless qualified. |
| 4 | Could the same number mean opposite things on different screens? | 🔴 YES — `ConfidenceMeter` and `confidence-score` disagree on threshold semantics. |
| 5 | Is any confidence surface tied to a freshness window? | 🔴 NO — none of the three components surfaces `checkedAt` or `freshUntil`. Drift is invisible. |

## Forbidden wording (recap from W2-PR4C, applies)

The following must not appear adjacent to any confidence display:

- `100% verified`
- `Fully confident`
- `Guaranteed`
- `Confidence proves readiness`
- `High confidence means source verified`
- `Ready for approval`
- `Replay protected`
- `Source confirmed before response` (unless the route actually blocks on source confirmation)

Banned-string scan over `apps/web/components` and `apps/web/app`: **0 hits**. ✅ The risk is not what is *said*; it is what is *implied by silence*.

## Required runtime alignment (no implementation in this wave)

A safe follow-up product PR — **not in scope here** — would:

1. Add required `basis` prop to `ConfidenceBadge`, `ConfidenceMeter`, `confidence-score`. Default existing unlabeled callers to `Heuristic confidence` to surface the gap rather than hide it.
2. Replace bare `{item.confidence} confidence` in `KnowledgeInboxPanel` with `{item.confidence} classification confidence`.
3. Replace the `outcomeHistoryStrength = 1.0` default with explicit `No outcome history yet` band, and downgrade calibrated state by one step when sample size is zero.
4. Unify thresholds across confidence components — pick one set (the W2-PR4C-recommended named bands are: `Low / Mixed / Strong`) and remove ad-hoc 95/80/70/40 splits.
5. Surface 3 of 4 modulators as small chips beneath `ConfidenceMeter`: `evidenceStrength`, `freshnessScore`, `outcomeHistoryStrength`. `issuerTrustLevel` is already shown in `AcceptancePanel`.
6. Add a regression test that blocks bare `% confidence` strings outside explicitly exempted tests.

Runtime consequence of (3): clinicians with no historical outcome data would no longer be auto-classified `READY_CONFIDENT`. This is a **truth gain**, not a regression.

## Honesty assessment

**Artifact alignment:** SAFE. This document defines required confidence wiring; it does not change any threshold, default, or component.

**Runtime alignment:** 🟠 AMBIGUOUS at the surface; 🔴 MISLEADING at the producer (no-history default). The runtime computes more truth than it shows, and where it shows, it shows without basis. The cleanest single fix is to require basis labels and remove the absence-as-positive-evidence default — both are local changes.

**Trust-state continuity link:** Confidence inputs are derived from `CanonicalSourceCoverageState` (lane checks) and `PsvReceiptRecord` freshness. If the source-coverage layer is honest about staleness, the confidence layer can be honest about basis. The provenance plane is already 🟢; only the UI translation is partial.

## See also

- `w2-pr6b-trust-state-explainability.md`
- `w2-pr6b-readiness-runtime-alignment.md`
- `w2-pr6b-provenance-visibility.md`
- `w2-pr6b-runtime-explainability-matrix.md`
- `w2-pr4c-confidence-explainability.md`
- `w2-pr5b-confidence-certification.md`

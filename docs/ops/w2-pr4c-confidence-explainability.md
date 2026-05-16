# W2-PR4C - Confidence Explainability

**Wave:** W2-PR4C - Dossier + Confidence Trust Alignment  
**Date:** 2026-05-09  
**Status:** Docs-only confidence contract. No product code changed. No merge.  
**Purpose:** Make confidence readable as scoped heuristic support, not verification, acceptance, or certainty.

## Scope

This document aligns confidence semantics across reusable confidence UI, Knowledge Inbox classification, recommendation calibration, and readiness-adjacent score displays.

It does not change scoring behavior. It defines the wording and metadata required before confidence can be safely shown to a clinician, verifier, or employer.

## Core Rule

Confidence must always disclose:

1. **Basis:** classification, source match, recommendation, or readiness.
2. **Source dependency:** which source lane, source adapter, or evidence category the signal depends on.
3. **Freshness:** whether the underlying evidence is current, stale, unknown, pending, gated, or unavailable.
4. **Limitation:** what the confidence value does not prove.

A confidence percentage without a basis label is incomplete.

## Runtime Findings

| Surface | Current behavior | Trust risk | Required alignment |
|---|---|---|---|
| `apps/web/design-system/components/ConfidenceBadge.tsx` | Renders `{pct}% confidence`. | The viewer cannot tell if this is heuristic, source-match, classification, or recommendation confidence. | Add a visible or accessible basis label. Default legacy callers to `Heuristic confidence`. |
| `apps/web/components/ui/ConfidenceMeter.tsx` | Renders a percent bar with no explanatory text. | Reused meter can imply generic certainty. | Require caller-supplied `basis`, `sourceLabel`, and optional `freshnessLabel`; expose them in `aria-label`/tooltip. |
| `apps/web/components/ui/confidence-score.tsx` | Uses 95/80 thresholds and highlights lower values. | Thresholds imply precision without showing what is being measured. | Tie thresholds to named bands and display basis next to the value. |
| `apps/web/components/knowledge-inbox/KnowledgeInboxPanel.tsx` | Shows `{item.confidence} confidence`. | Can be mistaken for source verification. | Show `{item.confidence} classification confidence`; retain provenance and proof-tier chips. |
| `apps/api/backend/src/services/decision/confidenceEngine.ts` | Missing outcome history defaults to `1.0`; `sampleSize >= 0` allows HIGH. | Absence of history can become confidence uplift. | Display `No outcome history yet`; do not let missing history read as proof. |

## Confidence Types

| Type | Required label | Source dependency | Freshness dependency | What it can say | What it cannot say |
|---|---|---|---|---|---|
| Classification confidence | `Classification confidence` | Classifier inputs and text parsing rules | None unless a source check is attached | The text was bucketed into a likely category. | The claim is verified or decision-grade. |
| Source-match confidence | `Source match confidence` | Specific adapter/source response and match basis | `checkedAt`, `observedAt`, `expiresAt`, `freshnessWindowHours` | The source response matched the subject under a stated basis. | The full dossier is complete. |
| Recommendation confidence | `Recommendation confidence` | Evidence strength, issuer trust, freshness, outcome history if present | Source freshness score and history sample size | The recommendation is better supported by current evidence and observed patterns. | The recommendation is correct, legally sufficient, or automatically actionable. |
| Readiness score | `Readiness snapshot` | Canonical source coverage and readiness inputs | Coverage freshness and blocking lane states | Current source-backed lanes support a readiness posture. | Employment approval, privileging approval, or verifier acceptance. |

## Minimum Display Contract

Every confidence display should provide this information:

```text
Label: [Classification confidence / Source match confidence / Recommendation confidence / Readiness snapshot]
Value: [band or percent]
Basis: [classifier / source adapter / evidence + freshness / readiness coverage]
Source dependency: [source label or "no source check attached"]
Freshness: [current / stale / unknown / pending / access required / unavailable]
Limitation: [not source verification / not an approval / not an acceptance / no outcome history yet]
```

## Allowed Wording

| Context | Safe wording |
|---|---|
| Knowledge Inbox | `High classification confidence. Not source verified.` |
| Source match | `Source match confidence: strong. NPPES checked May 9, 2026; freshness window still applies.` |
| Recommendation | `Recommendation confidence: 72%. Based on current evidence, source freshness, and observed patterns.` |
| No history | `No outcome history yet. Confidence is based on current evidence and source freshness only.` |
| Readiness-adjacent score | `Readiness snapshot. Informational; source freshness and gaps remain controlling.` |

## Forbidden Wording

- `100% verified`
- `Fully confident`
- `Guaranteed`
- `Confidence proves readiness`
- `High confidence means source verified`
- `Ready for approval`
- `Approved by tenant`
- `Legally accepted`
- `Replay protected`
- `Source confirmed before response` unless the route actually blocks on source confirmation

## Heuristic Disclosure

Heuristic confidence must say it is heuristic. Recommended default text:

```text
Heuristic confidence. This value explains how much current evidence supports the signal. It does not verify the claim, approve the clinician, or replace source checks.
```

Recommendation confidence must include the dominant inputs when available:

```text
Inputs: evidence strength, source freshness, issuer trust, outcome history sample size.
```

When `sampleSize` is zero:

```text
Outcome history: none yet.
```

Do not show missing history as positive support.

## Source Dependency

Confidence must be visually adjacent to source state whenever the signal depends on a source lane.

Required source states:

- `checked`
- `stale`
- `pending`
- `gated`
- `unavailable`
- `accessRequired`
- `reviewRequired`
- `notDecisionGrade`
- `previewOnly`

Only `checked` can support decision-grade wording. All other states must show a limitation.

## Freshness Visibility

When available, show:

- source label;
- `checkedAt` or `observedAt`;
- `expiresAt` or freshness window;
- freshness status;
- fallback text when timestamp is missing.

Timestamp fallback:

```text
Freshness: timestamp unavailable.
```

Do not hide missing freshness while leaving a positive confidence badge visible.

## Follow-Up Implementation Shape

No scoring rewrite belongs in this docs wave. A safe follow-up product PR should:

1. Add optional `basis`, `sourceLabel`, `freshnessLabel`, and `limitation` props to confidence components.
2. Default existing unlabeled callers to `Heuristic confidence`.
3. Change Knowledge Inbox copy to `classification confidence`.
4. Render `No outcome history yet` when recommendation sample size is zero.
5. Add a regression test that blocks bare `% confidence` copy outside explicitly exempted tests.

## Honesty Assessment

**Artifact alignment:** SAFE. This document makes the confidence boundary explicit without expanding runtime guarantees.

**Runtime alignment:** PARTIAL. The current product still has generic confidence UI and a no-history uplift path. Runtime should remain guarded until the display contract and no-history handling are implemented.

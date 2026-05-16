# W2-PR5B - Confidence Certification

**Wave:** W2-PR5B - Operational Trust Experience Certification
**Date:** 2026-05-08
**Status:** Docs-only certification of confidence surfaces against the PR4C display contract. No product code changed.
**Risk class:** SAFE.
**Predecessors:** PR3C confidence semantics, PR4C confidence explainability.

## Mission

Certify whether each confidence surface in VitalCV is understandable, explainable, and honest about what the value can and cannot say. PR4C wrote the display contract. PR5B audits the surfaces against the contract.

## The PR4C contract (recap)

Every confidence display must answer:

1. **Basis** — classification / source-match / recommendation / readiness / heuristic.
2. **Source dependency** — which lane or adapter the signal depends on.
3. **Freshness** — current / stale / unknown / pending / gated / unavailable.
4. **Limitation** — what the value does not prove.

A confidence percentage without a basis label is **incomplete**.

## Rating legend

🟢 CLEAR · 🟡 PARTIAL · 🟠 CONFUSING · 🔴 MISLEADING

## Surface certification

### A. Reusable confidence components

| Component | File | Renders | Basis label? | Source dep? | Freshness? | Limitation? | Rating |
|---|---|---|---|---|---|---|---|
| `ConfidenceBadge` | `apps/web/design-system/components/ConfidenceBadge.tsx` | `{pct}% confidence` | ❌ none | ❌ | ❌ | ❌ | 🔴 |
| `ConfidenceMeter` | `apps/web/components/ui/ConfidenceMeter.tsx` | percent bar | ❌ none | ❌ | ❌ | ❌ | 🔴 |
| `confidence-score` | `apps/web/components/ui/confidence-score.tsx` | percent + 95/80 thresholds | ❌ none | ❌ | ❌ | ❌ | 🔴 |

**Verdict:** all three reusable components ship as **bare percent values**. PR4C said "a confidence percentage without a basis label is incomplete." All three are incomplete and reused across multiple decision contexts (recommendation, classification, source-match, readiness). The same bar means four different things in four different places. **🔴 MISLEADING by reuse.**

### B. Caller surfaces

| Surface | Caller | Rendered as | Confidence type per PR4C | Required label | Currently rendered label | Rating |
|---|---|---|---|---|---|---|
| `KnowledgeInboxPanel` | `apps/web/components/knowledge-inbox/KnowledgeInboxPanel.tsx` | `{item.confidence} confidence` | Classification confidence | "High classification confidence. Not source verified." | bare label | 🔴 |
| `AcceptancePanel` | `apps/web/components/verifier/AcceptancePanel.tsx` | `issuerTrustLevel` chip | Recommendation confidence (one modulator only) | "Recommendation confidence. Inputs: evidence, freshness, issuer trust, history." | one chip; no label | 🟠 |
| `EmployerNextBestAction` | `apps/web/components/review/EmployerNextBestAction.tsx` | "Based on historic success rate" | Recommendation confidence | "Based on observed patterns. Sample size: [n]. This is advisory telemetry, not a guarantee." | "historic success rate" — implies predictive guarantee | 🔴 |
| `DecisionCard` | `apps/web/components/decision/DecisionCard.tsx` | `confidence` number → `ConfidenceMeter` | Recommendation confidence | "Recommendation confidence: 72%. Based on current evidence, source freshness, and observed patterns." | bare meter; rationale + drivers fields exist (optional) | 🟠 |
| Passport readiness display (`/passport`) | `apps/web/app/passport/page.tsx` | score + confidence label | Readiness snapshot | "Readiness snapshot. Informational; source freshness and gaps remain controlling." | "Very confident" near tier-upgrade prompt | 🟠 |
| `ReadinessCard` (onboarding) | `apps/web/components/onboarding/ReadinessCard.tsx` | readiness status | Readiness snapshot | same as above | not yet inspected for label posture | 🟡 |
| `careerAutopilot.ts` outputs | `apps/web/lib/.../careerAutopilot.ts` | "to reach Decision Grade" / "100% verified and ready for 1-click apply" | Recommendation/heuristic | none of these strings are allowed | "100% verified", "1-click apply", "cannot be deployed" | 🔴 |

### C. Backend confidence engine

| Engine | File | Surfaced to operator? | Rating |
|---|---|---|---|
| `confidenceEngine.ts` modulators (`evidenceStrength`, `freshnessScore`, `issuerTrustLevel`, `outcomeHistoryStrength`) | `apps/api/backend/src/services/decision/confidenceEngine.ts:23` | 1 of 4 (`issuerTrustLevel` only) | 🟠 |
| `confidenceEngine.ts` no-history default | `confidenceEngine.ts` | Missing history defaults to `1.0`; `sampleSize >= 0` allows HIGH | 🔴 — absence becomes confidence uplift |
| `CalibratedDecisionState` final enum | derived from modulators | Rendered (5 values) | 🟡 — final enum visible, drivers hidden |

**Critical finding:** confidence is computed correctly at the engine level (PR4A normalized this); the engine's no-history path uplifts confidence in the absence of evidence (UNSAFE), and three of four modulators never reach the user. The runtime knows more than the UI says.

## Confidence-type coverage

Per PR4C, four confidence types must each surface with their basis. Coverage today:

| Type | Surfaces using it | Has basis label? | Rating |
|---|---|---|---|
| Classification confidence | `KnowledgeInboxPanel` | ❌ | 🔴 |
| Source-match confidence | implicit in lane states (`checked` / `stale` / `pending` etc.) on `LaneHealthMount` | ✅ via lane state, no explicit "source match confidence" label | 🟡 |
| Recommendation confidence | `DecisionCard`, `EmployerNextBestAction`, `DecisionQueue`, `AcceptancePanel` | ❌ | 🔴 |
| Readiness snapshot | passport readiness, clinician home momentum, `ReadinessCard` | ❌ | 🟠 |

## Distinguishability — Critical question 6

**Would users distinguish heuristic / observational / authoritative / certified / anchored?**

| Term | What it means in the runtime | Visible in UI? | Distinguishable? |
|---|---|---|---|
| Heuristic | Computed by classifier or scoring engine without source check | Implicit only; no label | ❌ |
| Observational | Recorded event (e.g., audit row) without legal weight | Implicit on demo pages; no label | ❌ |
| Authoritative | Source-checked within freshness window (`CanonicalSourceCoverageState=checked`) | Lane state visible | ✅ partial |
| Certified | None of VitalCV's tiers are "certified" by an external body in the runtime | Used in copy ("Audit-grade document", "Certified compliant" — banned) | ❌ — overclaim risk |
| Anchored | Cryptographic / blockchain anchoring | `AuditProofViewer` copy implies it; runtime path uses ES256 (post #205 closure) | ❌ — copy implies anchoring without runtime evidence |

**Verdict:** **NO**, users cannot reliably distinguish the five categories. The runtime distinguishes (literal `proofTier` enum: `claim_candidate`, `needs_source_evidence`, `profile_context_only`, `source_backed`, `receipt_candidate`, `psv_receipt_candidate`, `psv_receipt`). The UI conflates them under bare "% confidence" and language drift ("verified", "certified", "anchored").

## Forbidden language scan

Per PR3C banned strings — current state:

| Banned phrase | Found in surfaces today? | Source |
|---|---|---|
| "100% verified" | YES (`careerAutopilot.ts`) | PR3C autopilot review |
| "Guaranteed" | scoped via `confidenceEngine.ts` no-history uplift to "fully confident" risk | PR3C |
| "Approve Candidate" / "Reject Candidate" | YES (`EmployerNextBestAction`) | PR3C autopilot review |
| "Execute Recommendation" | YES (`DecisionCard`) | PR3C autopilot review |
| "Cryptographically Verified" | YES (`AuditBundlePreview`) | PR3C dossier-truth |
| "Immutable Audit Trail" | YES (`AuditProofViewer`) | PR3C dossier-truth |
| "Zero-knowledge proof verified" | YES (`AuditProofViewer`) | PR3C dossier-truth |
| "Mathematical guarantees" | YES (`AuditProofViewer`) | PR3C dossier-truth |
| "Replay protected" | scoped at AuditProofViewer | PR3C |
| "Source confirmed before response" | scoped depending on route | PR3C |
| "Innocent until proven guilty" | model default risk | PR3C |
| "Trust verified" / "Verification complete" / "Readiness confirmed" | `systemVoice.ts` shared constants | PR3C |
| "Risk transferred" / "Legally accepted" / "HIPAA compliant" / "SOC2 certified" | scoped (CLAUDE.md banned) | CLAUDE.md truth contract |

**No `% confidence` regression test exists** to block bare-percent copy outside test split-join constants. PR4C recommends adding one; not yet implemented.

## Required minimum-display contract — current compliance

Per PR4C, every confidence display should provide six fields. Compliance count across inspected surfaces:

| Field | Surfaces compliant | Total inspected | Compliance % |
|---|---|---|---|
| Label (basis) | 0 | 7 | **0%** |
| Value (band or percent) | 7 | 7 | 100% |
| Basis (classifier / source / evidence / readiness) | 0 | 7 | **0%** |
| Source dependency | 1 partial (lane health) | 7 | ~14% |
| Freshness | 1 partial (lane health) | 7 | ~14% |
| Limitation | 0 | 7 | **0%** |

**Confidence understandability rollup:** **(0 + 100 + 0 + 14 + 14 + 0) / 6 ≈ 21%.**

The single positive contributor is `LaneHealthMount`, which surfaces source state (a proxy for source-match confidence) and freshness via `userFacingMessage`. Every other confidence surface is below 20%.

## Cohesion with PR4A runtime taxonomy

PR4A normalized runtime mutation classification (`R-CAT-1` through `R-CAT-6`) and replay metadata. Confidence sits *above* this layer — it is not part of the mutation taxonomy. Cohesion check:

| Runtime invariant | UI alignment |
|---|---|
| `replayCategory` distinguishes `R-CAT-1..6` | not surfaced in confidence UI; not required to be |
| `mutationFingerprint` and `payloadHash` propagate | not surfaced in confidence UI; correctly out of scope |
| `actor.attributionSource` (`human/org/system/unknown`) | not surfaced in confidence UI; should be surfaced in audit components per PR3C |

**Cohesion rating:** 🟢 — confidence and runtime taxonomy are not coupled and should not be. Cleanly separated layers.

## Heuristic disclosure — current state

Per PR4C, heuristic confidence must say it is heuristic. Required default text:

```
Heuristic confidence. This value explains how much current evidence supports the signal.
It does not verify the claim, approve the clinician, or replace source checks.
```

**Surfaces complying:** 0 of 7 inspected. **🔴.**

## No-history handling

Per PR4C, `sampleSize === 0` must show:

```
No outcome history yet. Confidence is based on current evidence and source freshness only.
```

**Engine state:** `confidenceEngine.ts` defaults missing history to `1.0`, allowing HIGH. **🔴.**

## Highest-leverage repairs (single-PR scope each)

In rank order of "confidence honesty gain per PR":

1. **Add `basis`, `sourceLabel`, `freshnessLabel`, `limitation` props to `ConfidenceMeter`, `ConfidenceBadge`, `confidence-score`.** Default existing callers to `Heuristic confidence`. Closes 5 of the 6 contract fields for every reuse.
2. **Fix `confidenceEngine.ts` no-history path.** Render `No outcome history yet`; do not let `sampleSize === 0` produce HIGH.
3. **Knowledge Inbox copy: `{conf} classification confidence`** (single string change).
4. **Surface 3 of 4 modulators (`evidenceStrength`, `freshnessScore`, `outcomeHistoryStrength`)** beneath `ConfidenceMeter`.
5. **Add a regression test** that blocks bare `% confidence` copy outside explicit test split-join constants.
6. **Replace `EmployerNextBestAction` "Based on historic success rate"** with "Based on observed patterns. Sample size: [n]. Advisory telemetry, not a guarantee."

Each is single-file, single-PR, no schema or runtime change.

## Confidence honesty assessment

**🔴 UNSAFE for any audience that interprets "% confidence" as a verification, source-backed acceptance, legal proof, or readiness guarantee.** The runtime classifier is correct (literal `decisionGrade: false`, distinct `proofTier` enum, source-state lane labels), but the UI flattens these into bare percent values that look the same regardless of basis.

**🟢 SAFE only after PR4C contract is applied at the component level**, the no-history uplift is fixed, and the regression test blocks bare-percent copy. None of these have shipped.

## Out of scope

- No copy rewrite (PR4C contract is the source of truth).
- No `confidenceEngine.ts` rewrite (one path fix, not a rewrite).
- No new confidence types.

## See also

- `w2-pr5b-operator-trust-certification.md`
- `w2-pr5b-workflow-understanding-review.md`
- `w2-pr5b-trust-experience-matrix.md`
- `w2-pr5b-operational-coherence-report.md`
- `w2-pr3c-confidence-semantics.md`
- `w2-pr4c-confidence-explainability.md`
- `w2-pr4d-trust-state-continuity.md` (modulator visibility audit)

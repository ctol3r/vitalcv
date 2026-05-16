# W2-PR3C - Confidence Semantics

**Status:** Runtime-aligned semantics contract. No product code changed.  
**Purpose:** Prevent confidence from being read as verification, legal certainty, or employer acceptance.

## Core Rule

Confidence is never a trust guarantee. It is a scoped explanation of why the system gives a signal more or less weight.

Every confidence display must answer three questions:
1. What is this confidence about?
2. Which sources or heuristics contributed?
3. What does this confidence not prove?

## Four Confidence Types

| Type | Runtime source | UX label | What it can mean | What it cannot mean |
|---|---|---|---|---|
| Classification confidence | `classifyInboxItem()` deterministic text classification | Classification confidence | The parser was able to bucket the text into a likely category. | The claim is verified, source-backed, or decision-grade. |
| Source-match confidence | Source adapter match basis (`exact`, `strong`, `partial`, `unresolved`, `no_match`) | Source match | The source response matched or did not match the subject under a stated basis. | The whole credentialing file is complete. |
| Recommendation confidence | `confidenceEngine.ts` weighted evidence/freshness/issuer/history score | Recommendation confidence | The recommendation is better supported by current evidence and observed patterns. | The recommendation is correct, legally sufficient, or guaranteed to improve outcome. |
| Readiness score | Readiness/CRS inputs from available source-backed lanes | Readiness | The current snapshot has enough checked lanes to support a level or score. | Employment approval, privileging approval, or tenant acceptance. |

## Current Alignment

### Strong

Knowledge Inbox type contracts are already aligned:
- `KnowledgeInboxClassification.decisionGrade` is fixed false at classification time.
- `KnowledgeInboxProofTier` distinguishes `claim_candidate`, `needs_source_evidence`, `profile_context_only`, and `source_backed`.
- `acceptInboxSuggestion()` caps accepted items at `profile_context_only` and keeps `verificationStatus: 'not_source_verified'`.
- The panel footer says classification organizes information and source checks decide what becomes verified.

### Drift

| Surface | Evidence | Issue | Required wording |
|---|---|---|---|
| `KnowledgeInboxPanel.tsx` | `item.confidence confidence` | "High confidence" can be read as verified. | "High classification confidence" or "Classification confidence: High". |
| `ConfidenceBadge.tsx` | numeric percent only | No basis shown for the score. | Add basis from caller or default to "heuristic confidence". |
| `ConfidenceMeter.tsx` | numeric percent only | Same bar is reused across recommendation contexts. | Add accessible label/basis: "recommendation confidence, heuristic". |
| `confidence-score.tsx` | fields below 95% highlighted | 95% threshold implies a precision standard that may not match source evidence. | Tie thresholds to named bands and source basis, not bare precision. |
| `confidenceEngine.ts` | no history defaults to 1.0 | Absence of outcomes can uplift confidence. | No history should display "no outcome history yet"; it must not create high confidence. |

## Source Awareness Requirements

Every confidence UI should render at least one of these basis labels:
- `Source match` - when derived from a primary-source or source-adapter match.
- `Classification` - when derived from text or inbox parsing.
- `Recommendation` - when derived from decision or next-best-action logic.
- `Readiness` - when derived from CRS/readiness coverage.
- `No outcome history yet` - when sample size is zero.

If a source is gated, unavailable, stale, or pending, confidence must not render as a positive standalone value. It must render with the source state next to it.

## Allowed Copy

- "Classification confidence: Medium. Not source verified."
- "Source match: exact NPI match. Freshness window still applies."
- "Recommendation confidence: 72%. Based on current evidence, source freshness, and observed patterns."
- "No outcome history yet. Confidence is based on source evidence only."
- "Confidence is informational and does not approve, reject, or credential the clinician."

## Forbidden Copy

- "100% verified"
- "Fully confident"
- "Guaranteed"
- "Mathematical guarantee"
- "Confidence proves readiness"
- "High confidence means source verified"
- "Source confirmed before response" unless the route actually blocks on source confirmation
- "Innocent until proven guilty" as a model default

## Implementation Notes For A Follow-Up PR

Do not change scoring semantics in a UX copy PR. The safe implementation shape is:
- add an optional `basis` prop to confidence display components;
- default legacy callers to "heuristic confidence";
- add `aria-label` / `title` that explains the basis;
- adjust Knowledge Inbox copy from `{item.confidence} confidence` to `{item.confidence} classification confidence`;
- change no-history recommendation output to display "no outcome history yet" instead of treating history as supportive evidence.

## Confidence Honesty Assessment

**Mixed.** Knowledge Inbox contracts are strong and source-aware. The reusable confidence UI remains too generic, and the recommendation confidence engine can convert missing history into high confidence. Product copy should be treated as **UNSAFE** until the generic confidence components carry basis labels and the no-history state stops uplifting confidence.

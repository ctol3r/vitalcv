# W2-PR3C - UX Trust Alignment

**Wave:** W2-PR3C - UX Trust Alignment  
**Date:** 2026-05-09  
**Status:** Docs-only truth-alignment pass. No product code changed. No merge.  
**Risk class:** SAFE for this artifact set because only `docs/ops/**` changed. Product surfaces reviewed include GUARDED and HIGH_RISK areas and should not be patched without a locked implementation PR.

## Mission

Align UX trust semantics with actual runtime guarantees. The UX must not imply:
- confidence is verification;
- readiness is approval;
- replay is legal proof or replay protection;
- an audit actor is a tenant owner;
- a recommendation is an autonomous decision.

## Files Inspected

Confidence and inbox:
- `apps/web/design-system/components/ConfidenceTierBadge.tsx`
- `apps/web/design-system/components/ConfidenceBadge.tsx`
- `apps/web/components/ui/ConfidenceMeter.tsx`
- `apps/web/components/ui/confidence-score.tsx`
- `apps/web/components/knowledge-inbox/KnowledgeInboxPanel.tsx`
- `apps/web/lib/knowledge-inbox/types.ts`
- `apps/web/lib/knowledge-inbox/classifyInboxItem.ts`
- `apps/api/backend/src/services/decision/confidenceEngine.ts`

Readiness, passport, review, and trust state:
- `apps/web/lib/trust/status-language.ts`
- `apps/web/components/trust/PassportSourceCoveragePanel.tsx`
- `apps/web/components/passport/PassportTrustPosture.tsx`
- `apps/web/components/passport/PassportWallet.tsx`
- `apps/web/components/review/ReviewClient.tsx`
- `apps/web/components/proof/trust-types.ts`
- `apps/web/components/proof/TrustLabel.tsx`

Autopilot and recommendation surfaces:
- `apps/api/backend/src/services/decision/careerAutopilot.ts`
- `apps/web/components/decision/DecisionCard.tsx`
- `apps/web/components/decision/DecisionQueue.tsx`
- `apps/web/components/review/EmployerNextBestAction.tsx`
- `apps/web/components/review/EmployerDecisionConsole.tsx`
- `apps/web/lib/systemVoice.ts`

Dossier, replay, and audit wording:
- `apps/web/components/verifier/AuditProofViewer.tsx`
- `apps/web/components/decision/AuditBundlePreview.tsx`
- `apps/web/components/trust-state/AuditTrailTimeline.tsx`
- `apps/web/components/trust/TrustContainerPanel.tsx`
- `apps/api/backend/src/services/audit/replayEngine.ts`
- `apps/api/backend/src/routes/auditReplay.ts`
- `docs/ops/vitalcv-100pct-action-map.md`
- `docs/ops/vitalcv-100-completion-master-plan.md`

## Runtime Truth Baseline

| UX word | Runtime meaning allowed | Runtime meaning forbidden |
|---|---|---|
| Confidence | Heuristic support level, source match strength, or recommendation calibration with visible basis. | Verification, certainty, legal sufficiency, or probability of employer outcome. |
| Readiness | Informational snapshot from available source-backed lanes and explicit gaps. | Hiring approval, privileging approval, deployability, or complete credentialing. |
| Replay | Reconstruction/hash comparison over persisted decision inputs and available artifacts. | Anti-replay guarantee, legal proof, immutable truth, or full event history guarantee. |
| Audit | Recorded event metadata with actor/system attribution when present. | Tenant ownership proof, legal acceptance, or proof that every related event was captured. |
| Autopilot | Assistive next-step suggestions that require human action. | Autonomous decisioning, automatic acceptance, or guaranteed next outcome. |

## Alignment Improvements Captured

1. Confidence vocabulary is split into four distinct concepts: classification confidence, source-match confidence, recommendation confidence, and readiness score. These must not be collapsed into one generic percentage.
2. Dossier/replay copy now has a documented boundary: show "recorded artifact hash", "available persisted evidence", and "hash comparison"; avoid "immutable", "mathematical guarantees", "zero-knowledge", and "full replay" unless backed by shipped runtime behavior.
3. Autopilot copy has a documented boundary: user-visible language should say "suggestion", "recommended next step", or "assistive recommendation", not "execute", "approve", "reject", "autonomous", or "1-click".
4. Readiness language is anchored to the existing passport/review truth contract: source-backed, freshness-aware, non-authoritative, and blocked by missing/gated/stale/review-required lanes.
5. Audit attribution is clarified as "recorded actor/system metadata", not tenant ownership or legal proof.

## Findings

| ID | Surface | Evidence | Drift | Severity | Required alignment |
|---|---|---|---|---|---|
| C-1 | Numeric confidence UI | `ConfidenceBadge.tsx:19-21`, `ConfidenceMeter.tsx:6-18` | Percent bars render without explaining whether the number is source match, classifier confidence, or recommendation calibration. | P1 | Label the basis near the value or via accessible copy: "heuristic confidence", "source match confidence", or "recommendation confidence". |
| C-2 | Confidence engine | `confidenceEngine.ts:44-66` | No-history default is treated as 1.0 and `sampleSize >= 0` permits HIGH; this can turn absence of outcomes into confidence. | P1 | No history should render as "no outcome history yet", not confidence uplift. |
| I-1 | Knowledge Inbox | `KnowledgeInboxPanel.tsx:76-81`, `types.ts:3-12`, `classifyInboxItem.ts:6-14` | Type and classifier contracts are strong, but UI shows "High confidence" without saying "classification confidence". | P2 | Prefix or tooltip the field as classification confidence; keep "source checks decide" footer. |
| D-1 | Dossier/proof viewer | `AuditProofViewer.tsx:41-47`, `148-157` | Claims "Immutable Audit Trail", "mathematical guarantees", "zero-knowledge proof verified", and biometric binding not supported by inspected runtime. | P0 | Replace with recorded evidence/hash/replay wording or keep this surface out of production. |
| D-2 | Audit bundle preview | `AuditBundlePreview.tsx:30-56` | "Cryptographically Verified" and hardcoded "SHA-256 RSA" imply live signature semantics beyond the prop shape. | P1 | Tie label strictly to the supplied signature status and actual algorithm metadata. |
| R-1 | Replay service/routes | `replayEngine.ts:1-15`, `auditReplay.ts:112-118` | "fully replayable", "deterministic", and "Ready for Joint Commission review..." overstate current replay guarantees and legal posture. | P1 | Say replay reconstructs available persisted evidence and performs hash comparison; avoid audit-readiness claims. |
| A-1 | Career autopilot | `careerAutopilot.ts:53-114` | "cannot be deployed", "reach Decision Grade", "100% verified", and "1-click apply" overstate authority and autonomy. | P1 | Use assistive next-step language and source-dependent readiness caveats. |
| A-2 | Employer next best action | `EmployerNextBestAction.tsx:28-63`, `73-76`, `98-104` | Recommendation buttons map to "Approve Candidate" and "Reject Candidate"; learning label omits advisory limitation. | P1 | Use "Proceed with review" and "Route to review"; label learning as based on observed patterns. |
| A-3 | System voice | `systemVoice.ts:23-43` | "Execute recommendation", "Trust verified", "Verification complete", and "Readiness confirmed" are risky as shared copy constants. | P1 | Default constants should be assistive and source-dependent. |
| RS-1 | Passport/review readiness | `PassportSourceCoveragePanel.tsx:14-16`, `PassportTrustPosture.tsx:103-108`, `ReviewClient.tsx:1782-1785` | Mostly aligned. Existing copy says source-backed and non-authoritative; score gating is present. | Clean with P2 drift | Preserve current pattern; avoid "Decision-ready" where it can be read as approval. |
| AU-1 | Audit trail | `AuditTrailTimeline.tsx:87-94` | "Cryptographically Backed" renders unconditionally even though signer/hash are optional per event. | P1 | Render "hash recorded" only when a hash exists; otherwise "event metadata recorded". |
| AU-2 | Audit attribution | `EmployerDecisionConsole.tsx:381-390`, `replayEngine.ts:350-359` | Actor/system attribution is present, but the UX does not explain when actor is system-derived vs confirmed human/org. | P2 | Show attribution basis: human, organization, system, or unknown. Do not imply ownership. |

## Required UX Copy Contract

Use:
- "Source-backed readiness snapshot"
- "Checked source", "pending source", "access required", "review required"
- "Heuristic confidence"
- "Classification confidence"
- "Recommendation confidence"
- "Based on observed patterns"
- "Recorded audit event"
- "Hash comparison"
- "Replay of available persisted evidence"
- "Suggested next action"

Avoid:
- "100% verified"
- "1-click apply"
- "autonomous"
- "approve candidate" as a recommendation label
- "reject candidate" as a recommendation label
- "mathematical guarantees"
- "zero-knowledge proof"
- "biometric signature payload"
- "immutable audit trail" unless backed by the shipped write path
- "fully replayable"
- "ready for Joint Commission review"
- "tenant owns" or any tenant ownership implication from an audit actor field

## Validation

Docs generated only. No build, tests, or product runtime checks were run because no production files changed.

Commands used during scan:
- `git branch --show-current`
- `git status --short`
- `git log --oneline -n 5`
- targeted `rg` and `nl -ba` reads over the inspected files listed above

## Verdict

**UNSAFE for product UX/runtime alignment.**

The docs-only wave is safe to land as an artifact, but the product surfaces still contain semantic inflation in dossier/proof, replay, autopilot, and generic confidence UI. Passport/review readiness semantics are the strongest aligned area and should be preserved.

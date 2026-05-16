# W2-PR3D - Workflow + Product Coherence

**Wave:** W2-PR3D - Workflow + Product Coherence
**Date:** 2026-05-08
**Status:** Docs-only operational coherence review. No product code changed. No merge.
**Risk class:** SAFE for this artifact set because only `docs/ops/**` is added. Product surfaces reviewed include GUARDED and HIGH_RISK areas; required alignments below need locked implementation PRs with Codex SAFE verification before any UI rewiring.

## Mission

Reduce fragmentation across onboarding, passport, inbox, verifier actions, trust-state continuity, and readiness explainability. Locate the points where:

- the clinician cannot find the next obvious destination,
- the verifier cannot complete a single end-to-end request,
- a single trust state means different things in different layers,
- a "next step" emitter does not ship an `href`.

PR3D does not change product code. PR3D quantifies where the workflow is fragmented today and identifies the single highest-leverage coherence improvement.

## Companion documents

- `docs/ops/w2-pr3d-clinician-workflow-map.md` — clinician-side route inventory, linear flow chain, dead-end register.
- `docs/ops/w2-pr3d-verifier-workflow-map.md` — issuer + employer route inventory, demo-vs-wired matrix, dossier continuity gaps.
- `docs/ops/w2-pr3d-workflow-fragmentation-register.md` — prioritized fragmentation register with severity and required alignment.

## Predecessors (in scope as truth baseline, not for re-review)

- `docs/ops/w2-pr3c-ux-truth-alignment.md` — language-level truth alignment.
- `docs/ops/w2-pr3c-confidence-semantics.md` — four kinds of confidence; tier semantics.
- `docs/ops/w2-pr3c-dossier-truth-review.md` — dossier wording boundary.
- `docs/ops/w2-pr3c-autopilot-language-review.md` — recommendation copy boundary.

PR3D assumes those alignments. PR3D's contribution is *workflow continuity* — does each truthful surface link to the next truthful surface, or is the user dead-ended?

## Files Inspected

Clinician onboarding and home:
- `apps/web/app/onboarding/page.tsx`
- `apps/web/app/onboarding/identity/page.tsx`
- `apps/web/app/onboarding/fetching/page.tsx`
- `apps/web/app/onboarding/readiness/page.tsx`
- `apps/web/app/onboarding/success/page.tsx`
- `apps/web/app/clinician/onboarding/page.tsx`
- `apps/web/app/clinician/profile/page.tsx`
- `apps/web/app/clinician/profile-layers/page.tsx`
- `apps/web/app/clinician/import/page.tsx`
- `apps/web/app/clinician/mobile-capture/page.tsx`
- `apps/web/app/clinician/device-security/page.tsx`
- `apps/web/app/holder/home/page.tsx`
- `apps/web/components/mobile/ClinicianHomeSurface.tsx`
- `apps/web/app/passport/page.tsx`
- `apps/web/app/passport/[id]/page.tsx`
- `apps/web/app/passport/[id]/PassportEntityClient.tsx`

Verifier (issuer) chain:
- `apps/web/app/issuer/request/[requestId]/page.tsx`
- `apps/web/app/issuer/verify/[requestId]/page.tsx`
- `apps/web/app/issuer/review/[requestId]/page.tsx`
- `apps/web/app/issuer/policy-review/[requestId]/page.tsx`
- `apps/web/app/issuer/psv-receipt/[requestId]/page.tsx`
- `apps/web/app/issuer/psv-reuse/[receiptId]/page.tsx`
- `apps/web/app/issuer/persistence-adapter/[requestId]/page.tsx`
- `apps/web/app/issuer/audit-boundary/[requestId]/page.tsx`
- `apps/web/app/issuer/backend-persistence/[requestId]/page.tsx`
- `apps/web/lib/issuer-verification/receiptCandidate.ts`
- `apps/web/lib/issuer-verification/policyReview.ts`
- `apps/web/lib/issuer-verification/types.ts`

Employer side:
- `apps/web/app/employer/dashboard/page.tsx`
- `apps/web/app/employer/worklist/page.tsx`
- `apps/web/app/employer/review/[applicationId]/page.tsx`
- `apps/web/app/employer/decision/[applicationId]/page.tsx`
- `apps/web/app/employers/page.tsx`
- `apps/web/app/review/[entityId]/page.tsx`
- `apps/web/app/review/[entityId]/ReviewPageClient.tsx`
- `apps/web/components/review/EmployerNextBestAction.tsx`
- `apps/web/components/review/EmployerDecisionConsole.tsx`
- `apps/web/components/verifier/WorklistPanel.tsx`

Trust state and readiness:
- `packages/trust-state/sourceCoverage.ts`
- `packages/trust-state/contracts.ts`
- `apps/web/lib/trust/status-language.ts`
- `apps/web/components/trust/PassportSourceCoveragePanel.tsx`
- `apps/web/components/passport/PassportTrustPosture.tsx`
- `apps/api/backend/src/services/decision/confidenceEngine.ts`

Inbox and recommendation surfaces:
- `apps/web/lib/knowledge-inbox/types.ts`
- `apps/web/lib/knowledge-inbox/classifyInboxItem.ts`
- `apps/web/components/knowledge-inbox/KnowledgeInboxPanel.tsx`
- `apps/web/components/decision/DecisionQueue.tsx`
- `apps/web/components/decision/DecisionCard.tsx`
- `apps/web/components/clinician/NextBestAction.tsx`
- `apps/web/components/workspace/NextBestAction.tsx`
- `apps/web/components/passport/WhatsNextPanel.tsx`

## Runtime Coherence Baseline

| Workflow concept | What it must mean today | What it must not imply |
|---|---|---|
| Onboarding | A guided path from sign-up to a passport entity that is reachable, with explicit hand-offs. | An autonomous, self-completing checklist; verification of any field as a side effect of capture. |
| Passport | The clinician-facing canonical view of source-backed lanes, freshness, and gaps. | Approval surface; legal acceptance; complete credentialing. |
| Inbox / Next Best Action | A list of suggested next actions where each item ships an `href` to a real, wired destination. | An action queue that "does" things on click; an autopilot that bypasses human action. |
| Issuer chain | A sequence of demo / scaffold surfaces today; each disclaims persistence and is non-binding. | Persisted verification; legal proof; finalized PSV receipt. |
| Employer flow | A reviewable, decision-recording surface today only as a shell. | Live decision intake; persisted decision outcomes. |
| Dossier | A reviewable audit trail of recorded events for a request, reachable from a single entrypoint. | Tenant-owned legal document; complete history guarantee. |
| Trust state | A single layered model where one fact has at most one user-facing state, with the underlying gate label visible when the state is non-trivial. | Multiple labels for the same fact across surfaces; invisible gate refusals. |

## Findings By Domain

### D1. Onboarding fragmentation (P0)

| ID | Evidence | Drift |
|---|---|---|
| O-1 | `apps/web/app/onboarding/page.tsx` advertises milestone chain `identity → fetching → readiness → success`. | Chain is unrealizable. |
| O-2 | `apps/web/app/onboarding/identity/page.tsx:4`, `fetching/page.tsx:4`, `readiness/page.tsx:4`, `success/page.tsx:4` each `export default () => redirect('/')`. | All four advertised steps redirect to `/`. The user can never traverse the chain. |
| O-3 | `apps/web/app/clinician/onboarding/page.tsx:77-89` has the only working onboarding CTAs ("Open profile" → `/clinician/profile`, "Import from existing sources" → `/clinician/import`). | Two onboarding entry points exist; `/onboarding` is foundation copy with no CTAs and `/clinician/onboarding` is the real entry. |
| O-4 | `apps/web/app/clinician/profile/page.tsx:208,226` is read-only ("foundation shell. Editing flow … ship in subsequent waves"); completion summary hard-coded `0/0` (lines 136-138). | "Open profile" from onboarding lands the user in a non-editable shell. |
| O-5 | No link from onboarding success to `/passport` or `/passport/[id]`. | Onboarding does not hand off to the passport. |

### D2. Clinician hub multiplicity (P1)

| ID | Evidence | Drift |
|---|---|---|
| H-1 | Three candidate clinician homes: `/clinician/profile` (read-only), `/clinician/profile-layers` (foundation doc), `/holder/home` (operational, the only one with action wiring). | Discoverability is fragmented. The actual operational home is at `/holder/home`, but `/clinician/onboarding` does not link there. |
| H-2 | `apps/web/components/mobile/ClinicianHomeSurface.tsx:241-280,346-366,470` is the only clinician surface with primary-action `href`, blocker `href`s, and a quick-action grid that links to `/holder/readiness`, `/holder/opportunities`, `/holder/applications`. | The action wiring lives in one component, but the rest of the clinician surface area does not adopt the pattern. |
| H-3 | `/clinician/import/page.tsx:19-71` lists 8 import cards (CV, document, PubMed, LinkedIn, Doximity, CSV, export bundle, shareable passport); all marked entry-point-only or planned. | "Import from existing sources" CTA from onboarding lands in a card grid where no card is wired. |
| H-4 | `/clinician/mobile-capture/page.tsx:30`, `/clinician/device-security/page.tsx:28`, `/mobile/native-readiness/page.tsx:30` all marked planned. | Three orphan branches advertised but not wired into the main flow. |

### D3. Verifier (issuer) chain has no forward navigation (P0)

The truth contract says `apps/web/app/issuer/{review,policy-review}/[requestId]/page.tsx` are "demo renders only" with `recordedBy: 'demo'`. PR3D confirms this is the case for nine surfaces.

| ID | Surface | Demo disclaimer | Forward link? |
|---|---|---|---|
| I-1 | `issuer/request/[requestId]:378` | "Submitting on this page does not write a real audit-event row and does not send any email or SMS." | None. |
| I-2 | `issuer/verify/[requestId]:159` | "This view is a demo placeholder. No email is sent and no record is written from this page." | None. |
| I-3 | `issuer/review/[requestId]:258` | "Submitting on this page does not finalize verification. Only a policy-review decision can convert a candidate into a PSV receipt." | None. |
| I-4 | `issuer/policy-review/[requestId]:293-296` | "Submitting on this page does not write an audit event and does not finalize verification. A PSV receipt candidate is not a global PSV receipt." | None. |
| I-5 | `issuer/psv-receipt/[requestId]:298-300` | "This page does not write a real audit-event row. Audit metadata stays in pending_not_written." | None. |
| I-6 | `issuer/psv-reuse/[receiptId]:342-345` | "Submitting on this page does not write an audit event ... VitalCV records revocations and supersessions when reported; it does not poll source systems." | None. |
| I-7 | `issuer/persistence-adapter/[requestId]:135-137,197` | "Repository persistence is disabled unless explicitly configured ... no client-safe repository writer exists yet." | None. |
| I-8 | `issuer/audit-boundary/[requestId]:184,202` | "No database, network, or external call is made by this page." Events `demo_not_persisted`. | None. |
| I-9 | `issuer/backend-persistence/[requestId]:161-163` | "Backend persistence is not active unless a server-side writer confirms the write ... Repository compatibility alone is not an audit trail." | None. |

A verifier cannot traverse `request → verify → review → policy-review → psv-receipt` from inside the product. Each surface ends with a disclaimer block and no `<Link>` to the next surface. The chain is a set of nine standalone demos.

### D4. Employer flow is a shell (P1)

| ID | Evidence | Drift |
|---|---|---|
| E-1 | `/employer/dashboard/page.tsx:18-22` shows static cards with hard-coded counts (12 new, 5 under review, etc.) and no link to `/employer/worklist` or to any application. | Dashboard does not link into worklist or review. |
| E-2 | `/employer/worklist/page.tsx:5-24,42` uses `SAMPLE_WORKLIST_ITEMS` with comment "Live DB integration is planned"; `WorklistPanel.tsx:111-173` rows fire `onSelect(item)` callback only, no `href`. | Clicking a worklist row navigates nowhere. |
| E-3 | `/employer/review/[applicationId]/page.tsx:36,48-52` ships three CTAs ("Accept as head start", "Request missing info", "Reject") that are visual only; "has no persisted decision outcome in this shell". | Reviewer-side decisions are not recordable. |
| E-4 | `/employer/decision/[applicationId]/page.tsx:31,37-39` is explicit: "Decision recording is planned for the production workflow". | Decision surface is non-functional. |
| E-5 | `/employers/page.tsx:1-22` redirects to `/pilot`. | The plural URL is a dead alias bouncing to a different intent (pilot intake). |

### D5. Three "review" surfaces serve different audiences but share a verb (P1)

| Route | Audience | Status |
|---|---|---|
| `/review/[entityId]` | Public wedge / employer entrypoint. Links to `/review/request` and `/passport` (`ReviewPageClient`). | Partially wired. |
| `/employer/review/[applicationId]` | Internal authenticated employer review. | Demo only; CTAs not wired. |
| `/issuer/review/[requestId]` | Verifier-side receipt-candidate review. | Demo only; no forward link. |

The three surfaces are semantically distinct, but the verb collision ("review") makes deep-linking, search, and analytics ambiguous, and creates the risk that one is updated while the others drift.

### D6. Dossier continuity is broken (P1)

Five audit components exist; none has a discoverable route:
- `apps/web/components/verifier/AuditProofViewer.tsx`
- `apps/web/components/decision/AuditBundlePreview.tsx`
- `apps/web/components/trust-state/AuditTrailTimeline.tsx`
- `apps/web/components/employer/AuditTerminal.tsx`
- `apps/web/components/clinician/AuditScrapbook.tsx`

The only audit-shaped surface a verifier can navigate to is `/issuer/audit-boundary/[requestId]`, which is a demo non-persisting surface with all events tagged `demo_not_persisted`. There is no single "dossier for request X" entrypoint.

### D7. Trust state name collisions and invisible layers (P0)

The state machine is correct; its visibility is fragmented. Detail in `w2-pr3d-workflow-fragmentation-register.md` (FR-S-1 through FR-S-6).

| Word | Layer A | Layer B | Risk |
|---|---|---|---|
| `review_required` | `CanonicalSourceCoverageState` (source check failed; clinician contacts board). | `ReceiptCandidateReviewState` (issuer response is incomplete; reviewer requests follow-up from issuer). | HIGH. Same label, opposite remediations. |
| `verified` | `TrustUiStatus.verified` (passport lane is source-checked). | `KnowledgeInboxVerificationStatus.source_verified` (inbox item confirmed by source — never rendered). | HIGH. Asymmetric visibility. |
| `ready` | `ReceiptCandidateReviewState.ready_for_policy_review` (policy gate input). | `ReadinessState.DECISION_GRADE` (passport pilot-readiness lane). | MEDIUM. Same connotation, different scopes. |

Five-gate sequence in `apps/web/lib/issuer-verification/policyReview.ts:67-122` runs in this order: `action → wrong_office → unable_to_verify → conflict_review_required → review_state !== ready_for_policy_review → legally_only && !limitationNote`. The contract phrasing implies a different ordering (action → wrong_office → unable_to_verify → conflict_review → ready state → legally_only). The code is correct; the contract phrasing should be tightened so reviewers can reconcile a `refusalGate` value to a contract sentence. Refusal-gate labels (`action_does_not_create_candidate`, `wrong_office_cannot_create_candidate`, `unable_to_verify_cannot_create_candidate`, `conflict_review_unresolved`, `review_state_not_ready`, `legally_only_requires_limitation_note`) are emitted on `PolicyReviewOutcome.refusalGate` but never rendered to a UI.

### D8. Inbox / next-step fragmentation (P0)

| Emitter | Has `href`? |
|---|---|
| `apps/web/components/workspace/NextBestAction.tsx:31-56` (line 41 uses `<Link href={…}>`) | Yes. The exception. |
| `apps/web/components/mobile/ClinicianHomeSurface.tsx` (`primaryAction`, blocker rows, quick-action grid) | Yes. |
| `apps/web/components/knowledge-inbox/KnowledgeInboxPanel.tsx:119-138` ("Dismiss" / "Add as profile context") | No. Buttons render with no `href`/`onClick` handler. |
| `apps/web/components/decision/DecisionCard.tsx:173-186` ("Execute Recommendation", "Defer Signal") | No. Pure callbacks. |
| `apps/web/components/decision/DecisionQueue.tsx:30-117` | No. Pure callbacks. |
| `apps/web/components/review/EmployerNextBestAction.tsx:109-117` | No. `onActionClick` callback only. |
| `apps/web/components/clinician/NextBestAction.tsx:15-40` | No. `action.onClick` only. |
| `apps/web/components/verifier/WorklistPanel.tsx:111-173` | No. `onSelect(item)` only. |

A clinician can sit on a screen labelled "do this next" and click — and nothing navigates. The contract violation is not "we promised autonomy"; it's "we promised a destination and there is no destination." This is the single highest-leverage repair.

## Severity Prioritization

| Tier | Items | Why |
|---|---|---|
| P0 | D1 (broken onboarding chain), D3 (issuer chain has no forward links), D7 (`review_required` and `verified` collisions), D8 (next-step emitters without `href`). | Each blocks the user from completing the obvious next step or makes the next step semantically ambiguous. |
| P1 | D2 (clinician hub multiplicity), D4 (employer shell), D5 (three reviews), D6 (dossier with no entry route). | Each creates discoverability failures and update-drift risk; none of them blocks a single user goal in isolation but they multiply with D1/D3/D8. |
| P2 | D2-H4 mobile/device-security orphan branches; `/employers` redirect alias. | Low-traffic, isolated; safe to defer. |

## Recommended PR Sequencing (no implementation in this wave)

1. **PR3D-FIX-1 (P0).** Replace the four `redirect('/')` files at `apps/web/app/onboarding/{identity,fetching,readiness,success}/page.tsx` with either (a) deletion + a single `/onboarding` page that links forward to `/clinician/onboarding` and `/passport`, or (b) real step pages that link forward. Today, the chain misleads anyone reading `/onboarding/page.tsx`.
2. **PR3D-FIX-2 (P0).** Add navigation links between adjacent issuer demo pages (`request → verify → review → policy-review → psv-receipt`) so a verifier can traverse the demo end-to-end. Each page already disclaims persistence; the disclaimer covers the linkage.
3. **PR3D-FIX-3 (P0).** Adopt the `Workspace/NextBestAction.tsx` `href` pattern in `KnowledgeInboxPanel`, `DecisionCard`, `EmployerNextBestAction`, and `WorklistPanel`. Where there is no destination yet, render the item with no button and a "destination not yet available" hint, not a button that does nothing.
4. **PR3D-FIX-4 (P0).** Disambiguate `review_required` by either renaming `ReceiptCandidateReviewState.review_required` → `issuer_response_incomplete` (preferred), or by always namespacing the badge as `Source review required` vs `Issuer review required` in copy.
5. **PR3D-FIX-5 (P1).** Add a single dossier entrypoint at `/passport/[id]/dossier` (or `/issuer/dossier/[requestId]`) that mounts `AuditTrailTimeline` for that request. Keep the demo disclaimer; do not wire persistence in this PR.
6. **PR3D-FIX-6 (P1).** Render `PolicyReviewOutcome.refusalGate` on the policy-review surface so a verifier can see which of the six gates blocked a candidate.

Each repair is scoped to a single PR. None of the above is in scope for PR3D.

## Out of scope for PR3D

- No backend persistence wiring. The verifier chain remains demo-only until ISSUER-3/ISSUER-4.
- No truth-contract changes. ReceiptCandidate and PSVReceiptCandidate semantics are governed by the existing contract.
- No mobile / device-security surface activation.
- No copy rewrite. PR3C covered language; PR3D covers continuity.

## Final answers (this wave)

1. **Highest-friction workflow:** the verifier (issuer) chain. Nine demo pages, zero forward links, every page disclaims persistence. A verifier cannot complete a single end-to-end request inside the product.
2. **Highest-confusion trust state:** `review_required`. It exists in three layers (`CanonicalSourceCoverageState`, `ReceiptCandidateReviewState`, and the inbox `needs_review` connotation) with the same label and different correct remediations.
3. **Biggest onboarding gap:** the four step pages (`/onboarding/{identity,fetching,readiness,success}`) all `redirect('/')`. The advertised milestone chain is unreachable, and there is no onboarding → passport hand-off.
4. **Strongest single coherence improvement:** make every "do this next" emitter ship an `href`. Adopt `Workspace/NextBestAction.tsx`'s pattern across `KnowledgeInboxPanel`, `DecisionCard`, `EmployerNextBestAction`, and `WorklistPanel`. This single change closes the largest set of dead ends on the clinician *and* employer sides simultaneously.
5. **SAFE.** This artifact set is `docs/ops/**` only; no product code changed.

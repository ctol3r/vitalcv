# W2-PR3D - Verifier Workflow Map

**Wave:** W2-PR3D - Workflow + Product Coherence
**Date:** 2026-05-08
**Status:** Docs-only. Read-only investigation of issuer + employer + review surfaces. No product code changed.
**Risk class:** SAFE.

## Mission

Map every verifier-facing route in `apps/web/app/issuer/`, `apps/web/app/employer/`, and the three review surfaces; record where each surface is demo vs wired; identify the dossier discoverability gap; surface state-machine visibility gaps. Companion to `w2-pr3d-product-coherence-review.md`.

## Issuer (verifier-side) chain

The truth contract from `apps/web/lib/issuer-verification/` is correct: helpers are pure transforms, the demo pages explicitly disclaim persistence, and `accept_candidate` (under `policyReview.ts`) is the only path to a `PSVReceiptCandidate`. PR3D's contribution: every page in this chain is a standalone demo with no forward link.

### Route inventory

| # | Route | File | What is shown | Demo disclaimer |
|---|---|---|---|---|
| 1 | `/issuer/request/[requestId]` | `apps/web/app/issuer/request/[requestId]/page.tsx` | Consent + request lifecycle timeline. Claim summary, consent status, manual send link, list of seven possible next actions. `recordedBy: 'demo'` (line 107). | "Submitting on this page does not write a real audit-event row and does not send any email or SMS." (line 378). |
| 2 | `/issuer/verify/[requestId]` | `apps/web/app/issuer/verify/[requestId]/page.tsx` | Issuer response capture. Seven response options: `confirm`, `partially_confirm`, `correct`, `unable_to_verify`, `requires_release`, `wrong_office`, `legally_only`. | "This view is a demo placeholder. No email is sent and no record is written from this page." (line 159). |
| 3 | `/issuer/review/[requestId]` | `apps/web/app/issuer/review/[requestId]/page.tsx` | Receipt candidate view. Claim, issuer, response status, responder attribution, source basis, five possible next actions. `buildReceiptCandidateFromIssuerResponse` invoked with `recordedBy: 'demo'` (line 107). | "Submitting on this page does not finalize verification. Only a policy-review decision can convert a candidate into a PSV receipt." (line 258). |
| 4 | `/issuer/policy-review/[requestId]` | `apps/web/app/issuer/policy-review/[requestId]/page.tsx` | Policy acceptance gate. Six policy actions: `accept_candidate`, `reject`, `request_more_info`, `request_release`, `reroute`, `mark_conflict_review`. Dry-run accept outcome shown (lines 314-328). `applyPolicyReviewDecision` invoked with `recordedBy: 'demo'` (line 134). | "Submitting on this page does not write an audit event and does not finalize verification. A PSV receipt candidate is not a global PSV receipt." (lines 293-296). |
| 5 | `/issuer/psv-receipt/[requestId]` | `apps/web/app/issuer/psv-receipt/[requestId]/page.tsx` | PSV receipt promotion. Decision outcome, source basis, responder attribution, promotion state (blocked or promoted), scope, limitations, TTL, audit metadata. `auditMetadata.eventState: 'pending_not_written'` (line 282). | "This page does not write a real audit-event row. Audit metadata stays in pending_not_written." (lines 298-300). |
| 6 | `/issuer/psv-reuse/[receiptId]` | `apps/web/app/issuer/psv-reuse/[receiptId]/page.tsx` | Receipt reuse + revocation gate. Receipt summary, freshness window, modeled revocation state, supersession state, six reuse actions. `recordedBy: 'demo'` (line 162). | "Submitting on this page does not write an audit event ... VitalCV records revocations and supersessions when reported; it does not poll source systems." (lines 342-345). |
| 7 | `/issuer/persistence-adapter/[requestId]` | `apps/web/app/issuer/persistence-adapter/[requestId]/page.tsx` | Persistence adapter decision. Default adapter: `noop`. Repository adapter marked `unavailable`. Capability matrix (`noop`, `demo`, `repository_candidate`, `repository_enabled`, `unavailable`). | "Repository persistence is disabled unless explicitly configured and confirmed by a writer ... no client-safe repository writer exists yet." (lines 135-137, 197). |
| 8 | `/issuer/audit-boundary/[requestId]` | `apps/web/app/issuer/audit-boundary/[requestId]/page.tsx` | Audit persistence boundary. Six audit event records (`consent_recorded`, `manual_link_generated`, `copied_by_requester`, `sent_by_requester`, `viewed_by_issuer`, `response_received`). `createNoopIssuerAuditWriter({ mode: 'demo' })` (line 130); events marked `demo_not_persisted` (line 202). | "The no-op writer is wired by default. No database, network, or external call is made by this page." (line 184). |
| 9 | `/issuer/backend-persistence/[requestId]` | `apps/web/app/issuer/backend-persistence/[requestId]/page.tsx` | Backend persistence readiness. Default decision (`defer`, no capabilities satisfied) via `buildBackendPersistenceDeferDecision` (line 33). Hypothetical-ready decision rendered for comparison. | "Backend persistence is not active unless a server-side writer confirms the write ... Repository compatibility alone is not an audit trail." (lines 161-163). |

### Forward-navigation status

A `grep` for `<Link` and `href=` across the nine files turns up zero forward-direction links. The pages are conceptually a chain (request → verify → review → policy-review → psv-receipt → psv-reuse, with persistence-adapter / audit-boundary / backend-persistence as parallel transparency surfaces) but each page ends with a disclaimer block, no sibling link, and no breadcrumb back to a verifier index.

### Five-gate sequence (verification)

`apps/web/lib/issuer-verification/policyReview.ts:67-122` runs gates in this literal order:

1. `action !== 'accept_candidate'` → `refusalGate: 'action_does_not_create_candidate'` (line 67).
2. `responseStatus === 'wrong_office'` → `refusalGate: 'wrong_office_cannot_create_candidate'` (line 76).
3. `responseStatus === 'unable_to_verify'` → `refusalGate: 'unable_to_verify_cannot_create_candidate'` (line 85).
4. `reviewState === 'conflict_review_required'` → `refusalGate: 'conflict_review_unresolved'` (line 94).
5. `reviewState !== 'ready_for_policy_review'` → `refusalGate: 'review_state_not_ready'` (line 103).
6. `responseStatus === 'legally_only' && !limitationNote` → `refusalGate: 'legally_only_requires_limitation_note'` (line 112).

The gates are correct. The contract phrasing groups them as "action → wrong_office → unable_to_verify → conflict_review → ready state → legally_only-needs-limitation-note", which matches the code 1:1 once the reader understands gate 5 is `review_state !== ready_for_policy_review` (i.e., "ready state" is the *required* state, not the gate name). Recommend tightening contract phrasing to match the literal `refusalGate` labels emitted.

### Refusal-gate visibility gap

`PolicyReviewOutcome.refusalGate` (a string union of the six values above) is part of the helper output but is not rendered on `/issuer/policy-review/[requestId]/page.tsx`. A reviewer sees the dry-run accept outcome only; if their action is *rejected*, the surface does not show *which* gate refused them.

## Receipt taxonomy (PR3C truth contract, here for cross-reference)

```
ReceiptCandidate
  decisionGrade: false                 (literal)
  proofTier:     'receipt_candidate'   (literal)
  responseStatus: IssuerResponseStatus (issuer's reply)
  reviewState:    ReceiptCandidateReviewState (set by intake mapping)

  → on accept_candidate (gate 5 satisfied) →

PSVReceiptCandidate
  decisionGrade: false                     (literal, same)
  proofTier:     'psv_receipt_candidate'   (literal, distinct)
  acceptedAt:    ISO timestamp
  acceptedBy:    PolicyReviewActor

  → promotion to global PSVReceipt is a separate gated wave (ISSUER-4) →
```

The `/issuer/psv-receipt/[requestId]` surface today is a demo render of *what would happen* on promotion; persistence is `pending_not_written`.

## Employer flow

### Route inventory

| Route | File | Wired? | What user sees | Action destination |
|---|---|---|---|---|
| `/employer/dashboard` | `apps/web/app/employer/dashboard/page.tsx:1-50` | Demo | Static cards: 12 new, 5 under review, 3 waiting, 8 approved, 2 rejected; workflow bottlenecks (4.2 day avg); missing-data requests (App #1029, #1030). Hard-coded counts (lines 18-22). | None. No "View worklist" link. |
| `/employer/worklist` | `apps/web/app/employer/worklist/page.tsx:1-51` | Demo | `<WorklistPanel>` with three sample items (NPI 1003000126, 1234567893, 1999999984). Status (`pending`, `in_review`, `info_requested`), proofTier (`receipt_candidate`, `psv_sourced`, `self_attested`). `SAMPLE_WORKLIST_ITEMS` constant (lines 5-24); "Live DB integration is planned" (line 42). | Row click fires `onSelect(item)` callback (`WorklistPanel.tsx:111-173`); no `href`. |
| `/employer/review/[applicationId]` | `apps/web/app/employer/review/[applicationId]/page.tsx:1-57` | Demo | Identity snapshot, lane states (Identity CHECKED, Sanctions CLEAR, Licensure ACCESS REQUIRED, Enrollment ENROLLED), three CTAs ("Accept as head start", "Request missing info", "Reject"). | CTAs render (lines 48-52) but are visual only; "has no persisted decision outcome in this shell" (line 36). |
| `/employer/decision/[applicationId]` | `apps/web/app/employer/decision/[applicationId]/page.tsx:1-47` | Planned | Read-only outcome area: "Application [applicationId] has no persisted decision outcome in this shell" (line 39). | "Decision recording is planned for the production workflow." (line 31). |
| `/employers/page.tsx` | `apps/web/app/employers/page.tsx:1-22` | Redirect alias | Redirects to `/pilot`. | Bounces to a different intent (pilot intake). |

### Employer flow chain (intended vs actual)

```
/employer/dashboard → ?  (no link to worklist)
/employer/worklist  → onSelect callback (no href)
/employer/review/[applicationId] → CTAs visual only
/employer/decision/[applicationId] → planned
```

Four pages, four breaks. An employer cannot click from dashboard to worklist to review to decision.

## Three-reviews disambiguation

| Route | Audience | Status | Drift risk |
|---|---|---|---|
| `/review/[entityId]` | Public wedge / employer entrypoint | Partially wired. Links to `/review/request` and `/passport` via `ReviewPageClient` (lines 46, 52). | LOW once `/review/request` and `/passport` remain stable. |
| `/employer/review/[applicationId]` | Internal authenticated employer | Demo only (above). | HIGH. Same word "review", different audience and ID shape. |
| `/issuer/review/[requestId]` | Verifier-side receipt-candidate review | Demo only. | HIGH. Same word "review", different surface, different state machine. |

The three surfaces are semantically distinct and should remain separate. The drift risk is in copy and analytics: "review pageview" rolls up three different intents under one verb. Recommend disambiguating in copy and instrumentation:

- "Public review (entity context)"
- "Employer application review"
- "Issuer receipt-candidate review"

## Dossier continuity

The dossier is the trail of recorded events for a given request. Five components implement parts of it; none has a route entrypoint:

| Component | File |
|---|---|
| `AuditProofViewer` | `apps/web/components/verifier/AuditProofViewer.tsx` |
| `AuditBundlePreview` | `apps/web/components/decision/AuditBundlePreview.tsx` |
| `AuditTrailTimeline` | `apps/web/components/trust-state/AuditTrailTimeline.tsx` |
| `AuditTerminal` | `apps/web/components/employer/AuditTerminal.tsx` |
| `AuditScrapbook` | `apps/web/components/clinician/AuditScrapbook.tsx` |

The only audit-shaped surface a verifier can navigate to is `/issuer/audit-boundary/[requestId]`, which renders `createNoopIssuerAuditWriter` events as `demo_not_persisted`. There is no `/dossier/[requestId]` or `/passport/[id]/dossier` entrypoint that mounts `AuditTrailTimeline` for a given subject.

## Decision continuity (employer)

`apps/web/components/review/EmployerNextBestAction.tsx:12-121` renders a recommendation (action type: `PROCEED`, `ESCALATE`, `REQUEST_DATA`, `REVERIFY`, `HOLD`) plus a reason and source-coverage indicator. The button at line 109-117 fires `onActionClick(nba.action)`. The parent (`ReviewClient` / `EmployerDecisionConsole`) does not appear to wire this callback to a destination; the click changes local state but does not navigate or persist. `apps/web/components/decision/DecisionCard.tsx:173-186` exposes "Execute Recommendation" and "Defer Signal" — both callbacks, no `href`.

There is no place in the employer surface where clicking a recommendation lands the employer on the next surface (e.g., on `/employer/decision/[applicationId]`).

## Demo-vs-wired matrix

| Surface | Status | Evidence |
|---|---|---|
| `/issuer/request/[requestId]` | Demo | Line 378 disclaimer; `recordedBy: 'demo'` (line 107). |
| `/issuer/verify/[requestId]` | Demo | Line 159 disclaimer. |
| `/issuer/review/[requestId]` | Demo | Line 258 disclaimer; `recordedBy: 'demo'` (line 107). |
| `/issuer/policy-review/[requestId]` | Demo | Lines 293-296 disclaimer; dry-run only (line 125). |
| `/issuer/psv-receipt/[requestId]` | Demo | Lines 298-300 disclaimer; `pending_not_written`. |
| `/issuer/psv-reuse/[receiptId]` | Demo | Lines 342-345 disclaimer; modeled revocation only. |
| `/issuer/persistence-adapter/[requestId]` | Demo / deferred | Default `noop`; repository writer not implemented (line 197). |
| `/issuer/audit-boundary/[requestId]` | Demo | `noop` writer (line 130); events `demo_not_persisted` (line 202). |
| `/issuer/backend-persistence/[requestId]` | Deferred by design | Default decision is `defer`; reference: `docs/architecture/vitalcv-backend-persistence-defer-decision.md`. |
| `/employer/dashboard` | Demo | Hard-coded counts (lines 18-22). |
| `/employer/worklist` | Demo | `SAMPLE_WORKLIST_ITEMS`; "Live DB integration is planned" (line 42). |
| `/employer/review/[applicationId]` | Demo | CTAs visual only; `"has no persisted decision outcome in this shell"` (line 36). |
| `/employer/decision/[applicationId]` | Planned | `"Decision recording is planned for the production workflow"` (line 31). |
| `/review/[entityId]` | Partially wired | `ReviewPageClient` links to `/review/request` and `/passport`. |
| `/review/request` | Wired (entry) | Public form; entrypoint to a review request flow. |

## Verifier dead-end register

| ID | Surface | Evidence | Severity | Required alignment |
|---|---|---|---|---|
| V-DE-1 | Issuer chain forward navigation | None of the nine `apps/web/app/issuer/*/page.tsx` files contains a `<Link>` to a sibling. | P0 | Add forward links between adjacent demo pages so the demo chain can be traversed end-to-end. The disclaimers cover the linkage. |
| V-DE-2 | Refusal-gate visibility | `PolicyReviewOutcome.refusalGate` is emitted by `policyReview.ts` but not rendered on `/issuer/policy-review/[requestId]/page.tsx`. | P0 | Render the `refusalGate` label inline when the dry-run shows refusal. |
| V-DE-3 | Worklist row → review handoff | `WorklistPanel.tsx:111-173` rows fire `onSelect(item)` only; `apps/web/app/employer/worklist/page.tsx` does not wire `onSelect` to navigation. | P0 | Wire `onSelect(item)` to push `/employer/review/[item.applicationId]`. |
| V-DE-4 | Employer review CTAs not wired | `apps/web/app/employer/review/[applicationId]/page.tsx:36,48-52` ships three buttons that are visual only. | P0 | Either wire to `/employer/decision/[applicationId]` (capture intent then persist when ISSUER-4 lands) or render disabled with explanatory copy. |
| V-DE-5 | Employer dashboard → worklist | `apps/web/app/employer/dashboard/page.tsx` static cards have no links. | P1 | Add a "View applications" link to `/employer/worklist`. |
| V-DE-6 | `/employers` redirect alias | `apps/web/app/employers/page.tsx` redirects to `/pilot`; both paths share the noun. | P2 | Either remove `/employers` or replace with a link to `/employer/dashboard`. |
| V-DE-7 | Dossier entrypoint | Five audit components exist; none has a route. | P1 | Add `/passport/[id]/dossier` (clinician-readable) and `/issuer/dossier/[requestId]` (verifier-readable) routes that mount `AuditTrailTimeline`. Keep demo disclaimers. |
| V-DE-8 | Three reviews drift risk | `/review/[entityId]`, `/employer/review/[applicationId]`, `/issuer/review/[requestId]` share the verb. | P2 | Disambiguate in copy and analytics; do not unify the routes. |

## State-machine visibility gaps (verifier-facing)

| Gap | Evidence | Severity |
|---|---|---|
| `ReceiptCandidateReviewState` not shown to clinician | `apps/web/lib/issuer-verification/types.ts:127`. Eight values (`review_required`, `ready_for_policy_review`, `conflict_review_required`, `release_required`, `reroute_required`, `unable_to_verify`, `expired`, `canceled`); only the policy-review surface sees them. | HIGH. The clinician sees `pending` on the passport while the candidate is silently in `review_required` because the issuer gave a `partially_confirmed` reply. |
| `PolicyReviewDecisionStatus` not surfaced beyond the demo | `apps/web/lib/issuer-verification/types.ts:292`. Nine values; `accepted_as_psv_candidate` is the only path forward. | HIGH. A reviewer's decision is not persisted; the status is set on a transient object. |
| `refusalGate` not rendered | See V-DE-2. | HIGH. |
| `TrustBand` (`GREEN | YELLOW | RED`) backend-only | `packages/trust-state/contracts.ts:4`. Used internally; never rendered. | LOW. By design; flagged for awareness. |

## Out of scope

- No backend persistence wiring. The verifier chain remains demo-only until ISSUER-3/ISSUER-4.
- No truth-contract changes.
- No copy rewrites; PR3C language alignment is assumed.

## See also

- `w2-pr3d-product-coherence-review.md`
- `w2-pr3d-workflow-fragmentation-register.md`
- `docs/architecture/vitalcv-knowledge-trust-graph.md` (boundary 1-28).

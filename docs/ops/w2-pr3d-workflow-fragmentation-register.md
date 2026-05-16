# W2-PR3D - Workflow Fragmentation Register

**Wave:** W2-PR3D - Workflow + Product Coherence
**Date:** 2026-05-08
**Status:** Docs-only. Prioritized register of workflow fragmentation findings. No product code changed.
**Risk class:** SAFE.

## Purpose

Single, sortable list of every fragmentation issue PR3D found, with file:line evidence, severity, and the smallest required alignment. Each row is intended to be a candidate PR. Severity P0 means a user goal is blocked today; P1 means a discoverability or coherence failure; P2 means low-traffic / safe-to-defer.

## Severity legend

| Tier | Meaning |
|---|---|
| P0 | Blocks the user from completing an obvious next action; or a label means two different things in two layers and the remediation differs. |
| P1 | Forces the user to find the next step elsewhere; multiplies attention surfaces; increases drift risk. |
| P2 | Low-traffic, isolated, or already documented as planned/deferred. |

## Onboarding fragmentation (FR-O)

| ID | Surface | Evidence | Severity | Required alignment |
|---|---|---|---|---|
| FR-O-1 | Broken onboarding step chain | `apps/web/app/onboarding/identity/page.tsx:4`, `fetching/page.tsx:4`, `readiness/page.tsx:4`, `success/page.tsx:4` each `export default () => redirect('/')`. | P0 | Replace with real step pages, OR delete and update `apps/web/app/onboarding/page.tsx` to point users to `/clinician/onboarding`. |
| FR-O-2 | Two onboarding entry points | `apps/web/app/onboarding/page.tsx` (foundation copy) and `apps/web/app/clinician/onboarding/page.tsx` (real entry). | P1 | Pick one canonical entry. Either redirect `/onboarding` → `/clinician/onboarding` or merge content into a single route. |
| FR-O-3 | "Open profile" CTA lands on read-only shell | `apps/web/app/clinician/onboarding/page.tsx:77-89` → `apps/web/app/clinician/profile/page.tsx:208,226`. | P0 | Either ship the editing flow (out of PR3D scope) or change CTA copy from "Open profile" to "Open profile (read-only foundation)" until editing lands. |
| FR-O-4 | "Import from existing sources" CTA lands on unwired card grid | `apps/web/app/clinician/onboarding/page.tsx:77-89` → `apps/web/app/clinician/import/page.tsx:19-71` (8 cards, none wired). | P1 | Hide unwired cards behind a feature flag, OR label each card "Planned, not yet available" inline. |
| FR-O-5 | No onboarding → passport handoff | No link from `/clinician/onboarding` or `/clinician/profile` to `/passport`. | P1 | Add an explicit "View your passport at …" hand-off card on a successful onboarding submit. |
| FR-O-6 | Three sign-up paths | `apps/web/app/sign-up/`, `apps/web/app/signup/`, plus auth/sign-in. | P2 | Audit and pick the canonical sign-up; redirect or remove the others. |

## Clinician hub fragmentation (FR-C)

| ID | Surface | Evidence | Severity | Required alignment |
|---|---|---|---|---|
| FR-C-1 | Three potential clinician homes | `/clinician/profile` (read-only shell), `/clinician/profile-layers` (foundation doc), `/holder/home` (the only one with action wiring; `apps/web/components/mobile/ClinicianHomeSurface.tsx`). | P1 | Pick one canonical clinician home. Likely rename `/holder/home` → `/clinician/home` or add an explicit redirect. |
| FR-C-2 | `/clinician/profile` is read-only foundation | `apps/web/app/clinician/profile/page.tsx:136-138,208,226`. Completion summary hard-coded `0/0`; inputs `readOnly`; explicit "foundation shell" disclaimer. | P0 | See FR-O-3. |
| FR-C-3 | Orphan `/clinician/mobile-capture`, `/clinician/device-security`, `/mobile/native-readiness` | All three marked planned: `mobile-capture/page.tsx:30`, `device-security/page.tsx:28`, `mobile/native-readiness/page.tsx:30`. | P2 | Hide from sitemap and global nav until activated. |
| FR-C-4 | Knowledge inbox dismiss / add buttons unwired | `apps/web/components/knowledge-inbox/KnowledgeInboxPanel.tsx:123-135`. No `href`, no `onClick`. | P0 | Bind handlers OR render the buttons disabled with an explanatory hint. |
| FR-C-5 | `clinician/NextBestAction.tsx` unwired | `apps/web/components/clinician/NextBestAction.tsx:15-40`. `action.onClick` callback only. | P0 | Add an `href` field on the action contract; render `<Link>` when present, render disabled when not. |
| FR-C-6 | Readiness explainability gap (no per-lane breakdown) | `apps/web/app/passport/page.tsx:671-712`, `apps/web/components/mobile/ClinicianHomeSurface.tsx:283-315`. | P1 | Add a per-lane breakdown panel under the readiness score showing each lane's `TrustUiStatus` and the missing/blocking lane(s). |
| FR-C-7 | `CalibratedDecisionState` modulator inputs hidden | `apps/api/backend/src/services/decision/confidenceEngine.ts:23`. UI shows "Blocked — Confident" but not why. | P1 | Show the dominant input(s) (`evidenceStrength`, `freshnessScore`, `issuerTrustLevel`, `outcomeHistoryStrength`) underneath the badge so the user can attribute uncertainty. |

## Verifier (issuer) fragmentation (FR-V)

| ID | Surface | Evidence | Severity | Required alignment |
|---|---|---|---|---|
| FR-V-1 | Issuer chain has no forward navigation | None of `apps/web/app/issuer/{request,verify,review,policy-review,psv-receipt,psv-reuse,persistence-adapter,audit-boundary,backend-persistence}/[…]/page.tsx` link to siblings. | P0 | Add forward links between adjacent demo pages. Disclaimers already cover the linkage. |
| FR-V-2 | `refusalGate` not rendered on policy-review surface | `apps/web/lib/issuer-verification/policyReview.ts:67-122` emits `refusalGate`. `apps/web/app/issuer/policy-review/[requestId]/page.tsx` does not render it. | P0 | Render the `refusalGate` label inline when the dry-run shows refusal. |
| FR-V-3 | `ReceiptCandidateReviewState` invisible to clinician | `apps/web/lib/issuer-verification/types.ts:127`. Eight values; only policy-review surface sees them. | P1 | Render the reviewState inline on the passport for the affected lane (e.g., "Issuer responded with `partially_confirmed` — awaiting policy review"). |
| FR-V-4 | All issuer pages disclaim persistence | Demo disclaimers on lines 378, 159, 258, 293-296, 298-300, 342-345, 135-137/197, 184/202, 161-163. | P0 | Out of PR3D scope; ISSUER-3/ISSUER-4 backend persistence wave. PR3D notes the dependency. |
| FR-V-5 | Truth-contract gate naming vs literal labels | Contract phrasing "ready state" vs literal `refusalGate: 'review_state_not_ready'`. | P2 | Tighten contract phrasing to match literal labels. |

## Employer fragmentation (FR-E)

| ID | Surface | Evidence | Severity | Required alignment |
|---|---|---|---|---|
| FR-E-1 | Worklist row → review handoff broken | `apps/web/components/verifier/WorklistPanel.tsx:111-173` fires `onSelect(item)` only. `apps/web/app/employer/worklist/page.tsx:1-51` does not wire `onSelect` to navigation. | P0 | Wire `onSelect(item)` to push `/employer/review/[item.applicationId]`. |
| FR-E-2 | Employer review CTAs not wired | `apps/web/app/employer/review/[applicationId]/page.tsx:36,48-52`. Three buttons visual only; `"has no persisted decision outcome in this shell"`. | P0 | Either wire to `/employer/decision/[applicationId]` capture-intent flow, or render disabled with explanatory copy. |
| FR-E-3 | Dashboard → worklist link missing | `apps/web/app/employer/dashboard/page.tsx:18-22`. Static cards, no links. | P1 | Add "View applications" link to `/employer/worklist`. |
| FR-E-4 | `/employers` redirect alias | `apps/web/app/employers/page.tsx:1-22` redirects to `/pilot`. | P2 | Either remove `/employers` or replace with link to `/employer/dashboard`. |
| FR-E-5 | `EmployerNextBestAction` callback-only | `apps/web/components/review/EmployerNextBestAction.tsx:109-117`. `onActionClick` only. | P0 | Add `href` to the `nba` contract; navigate where appropriate. |
| FR-E-6 | `DecisionCard` / `DecisionQueue` callback-only | `apps/web/components/decision/DecisionCard.tsx:173-186`, `DecisionQueue.tsx:30-117`. | P0 | Add `href`; "Execute Recommendation" should land on the actual surface that captures the decision. |

## Three-reviews drift (FR-R)

| ID | Surface | Evidence | Severity | Required alignment |
|---|---|---|---|---|
| FR-R-1 | Verb collision across audiences | `/review/[entityId]` (public), `/employer/review/[applicationId]` (internal employer), `/issuer/review/[requestId]` (verifier). | P2 | Disambiguate in copy and instrumentation. Do not unify the routes. |

## Dossier fragmentation (FR-D)

| ID | Surface | Evidence | Severity | Required alignment |
|---|---|---|---|---|
| FR-D-1 | No dossier entrypoint | Five components exist (`AuditProofViewer`, `AuditBundlePreview`, `AuditTrailTimeline`, `AuditTerminal`, `AuditScrapbook`); zero routes mount the timeline as a per-subject page. | P1 | Add `/passport/[id]/dossier` (clinician-readable) and `/issuer/dossier/[requestId]` (verifier-readable) routes that mount `AuditTrailTimeline`. Keep demo disclaimers; do not wire persistence in this PR. |
| FR-D-2 | Audit boundary surface is the only audit-shaped destination | `/issuer/audit-boundary/[requestId]` is demo non-persisting (`noop` writer; `demo_not_persisted` events). | P1 | Once FR-D-1 lands, link to it from `/issuer/audit-boundary/[requestId]` as the user-facing dossier entrypoint. |

## Trust-state name collisions (FR-S)

| ID | Word / state | Collision evidence | Severity | Required alignment |
|---|---|---|---|---|
| FR-S-1 | `review_required` | `packages/trust-state/sourceCoverage.ts:14,164` (`reviewRequired` / `review_required`) vs `apps/web/lib/issuer-verification/types.ts:127` (`ReceiptCandidateReviewState.review_required`) vs `apps/web/lib/knowledge-inbox/types.ts:29` (`needs_review`). | P0 | Rename `ReceiptCandidateReviewState.review_required` → `issuer_response_incomplete` (preferred). Alternatively, namespace badge copy: "Source review required" vs "Issuer review required". |
| FR-S-2 | `verified` | `packages/trust-state/sourceCoverage.ts:164` (`TrustUiStatus.verified`, rendered) vs `apps/web/lib/knowledge-inbox/types.ts:70` (`KnowledgeInboxVerificationStatus.source_verified`, never rendered). | P1 | Either render `source_verified` consistently in the inbox UI when it is set, or rename the inbox status to `external_source_check_passed`. |
| FR-S-3 | `ready` | `apps/web/lib/issuer-verification/types.ts:127` (`ready_for_policy_review`) vs `packages/trust-state/sourceCoverage.ts:689` (`ReadinessState.DECISION_GRADE` is the closest analog; the literal word "ready" is not used). | P2 | Tighten "ready" copy on the policy-review surface so it cannot be misread as passport readiness. |
| FR-S-4 | `pending` | `packages/trust-state/sourceCoverage.ts` (`CanonicalSourceCoverageState.pending`) vs `apps/web/lib/issuer-verification/types.ts:292` (`PolicyReviewDecisionStatus.pending_review`). | P2 | Document the layered meaning. Rendering of `pending_review` is internal today, so collision risk is latent. |
| FR-S-5 | `ReadinessState` invisible | `packages/trust-state/sourceCoverage.ts:689`. Four values (`CHECKING`, `PARTIAL`, `DECISION_GRADE`, `BLOCKED`); never rendered. | P1 | Surface the readiness state name underneath the score so the user understands the lane-level posture. |
| FR-S-6 | `TrustBand` backend-only | `packages/trust-state/contracts.ts:4` (`GREEN`, `YELLOW`, `RED`); used internally only. | P2 | By design. Document for awareness. |

## Inbox / next-step fragmentation (FR-N)

| ID | Surface | Evidence | Severity | Required alignment |
|---|---|---|---|---|
| FR-N-1 | `KnowledgeInboxPanel` buttons unwired | `apps/web/components/knowledge-inbox/KnowledgeInboxPanel.tsx:123-135`. | P0 | See FR-C-4. |
| FR-N-2 | `DecisionCard` / `DecisionQueue` callback-only | `apps/web/components/decision/DecisionCard.tsx:173-186`, `DecisionQueue.tsx:30-117`. | P0 | See FR-E-6. |
| FR-N-3 | `EmployerNextBestAction` callback-only | `apps/web/components/review/EmployerNextBestAction.tsx:109-117`. | P0 | See FR-E-5. |
| FR-N-4 | `clinician/NextBestAction.tsx` callback-only | `apps/web/components/clinician/NextBestAction.tsx:15-40`. | P0 | See FR-C-5. |
| FR-N-5 | `WorklistPanel` row callback-only | `apps/web/components/verifier/WorklistPanel.tsx:111-173`. | P0 | See FR-E-1. |
| FR-N-6 | Multiple parallel inboxes for the same user | Clinician sees: `KnowledgeInboxPanel`, `ClinicianHomeSurface.primaryAction` + blockers, `DecisionQueue` (where rendered), `WhatsNextPanel` (where rendered). Employer sees: `WorklistPanel`, dashboard cards, `EmployerNextBestAction`. | P1 | Decide on a single canonical "do this next" surface per role; demote the others to detail panels. |
| FR-N-7 | `Workspace/NextBestAction.tsx` is the only emitter with `href` | `apps/web/components/workspace/NextBestAction.tsx:31-56`, line 41 uses `<Link href={…}>`. | (reference) | Adopt this pattern in every other emitter. This is the single highest-leverage repair. |

## Suggested PR sequencing

The repairs collapse to a small number of mechanical PRs. Each is in scope for a single Codex SAFE review.

| PR # | Title | Closes |
|---|---|---|
| 1 | Onboarding chain repair | FR-O-1, FR-O-2, FR-O-5 |
| 2 | Adopt `href` pattern on next-step emitters | FR-N-1, FR-N-2, FR-N-3, FR-N-4, FR-N-5 |
| 3 | Disambiguate `review_required` | FR-S-1 |
| 4 | Render `refusalGate` on policy-review surface | FR-V-2 |
| 5 | Add forward links between issuer demo pages | FR-V-1 |
| 6 | Wire worklist → employer review handoff | FR-E-1, FR-E-2, FR-E-3 |
| 7 | Add dossier entrypoint route | FR-D-1, FR-D-2 |
| 8 | Surface readiness lane breakdown | FR-C-6, FR-S-5 |
| 9 | CTA-copy fixes for read-only shells | FR-O-3, FR-C-2, FR-O-4 |
| 10 | Surface multiplicity cleanup | FR-C-1, FR-O-6, FR-C-3, FR-E-4, FR-R-1 |

PRs 1, 2, 3 carry the largest user-visible coherence improvement. PR 2 alone closes more dead ends than any other single change.

## Out of scope for PR3D

- No backend persistence wiring. Dependency on ISSUER-3 / ISSUER-4.
- No truth-contract changes. ReceiptCandidate / PSVReceiptCandidate semantics unchanged.
- No copy rewrite. PR3C language alignment assumed.
- No mobile / device-security activation.

## See also

- `w2-pr3d-product-coherence-review.md`
- `w2-pr3d-clinician-workflow-map.md`
- `w2-pr3d-verifier-workflow-map.md`

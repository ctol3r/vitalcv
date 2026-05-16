# W2-PR4D - Workflow Friction Register

**Wave:** W2-PR4D - Workflow Continuity + Operator Coherence
**Date:** 2026-05-08
**Status:** Docs-only. Sortable, prioritized friction register. No product code changed.
**Risk class:** SAFE.

## Purpose

Single, sortable list of every workflow-friction finding PR4D raised — extending PR3D's fragmentation register with: handoff-seam analysis, transition-graph evidence, operator-understanding axes, and the post-PR3D additions (LaneHealthMount, /status). Each row is a candidate single-PR repair with file:line evidence, severity, and the smallest required change.

## Severity legend

| Tier | Meaning |
|---|---|
| P0 | Blocks the user from completing an obvious next action; or operator cannot attribute a refusal/error. Must repair before pilot. |
| P1 | Forces the user to find the next step elsewhere; multiplies attention surfaces; increases drift risk. Repair before scale. |
| P2 | Low-traffic, isolated, or already documented as planned/deferred. Defer or accept. |

## Friction class legend

- **DE** — dead-end (advertised CTA reaches non-functional destination).
- **MS** — missing seam (no link offered between adjacent surfaces).
- **DR** — drifted destination (link exists but lands at wrong audience/intent).
- **HS** — hidden state (system has a state, operator cannot see it).
- **HG** — hidden gate (system refuses, operator cannot see why).
- **HM** — hidden modulator (derived value visible, inputs invisible).
- **DC** — duplicate concept (same label, different state machine).
- **OB** — observability gap (replay/audit not reachable for a subject).

## Onboarding friction (FR-O)

| ID | Class | Surface | Evidence | Severity | Required alignment |
|---|---|---|---|---|---|
| FR-O-1 | DE | `/onboarding/{identity,fetching,readiness,success}` | All four `apps/web/app/onboarding/{...}/page.tsx:4` are `export default () => redirect('/')`. | P0 | Replace with real step pages OR delete and update `/onboarding/page.tsx` to point users to `/clinician/onboarding`. (Carries forward from PR3D FR-O-1.) |
| FR-O-2 | MS | Sign-up → in-app continuation | `apps/web/app/sign-up/[[...sign-up]]/page.tsx:16-35` mounts Clerk `<SignUp>`; post-signup redirect is set in Clerk dashboard config, not in the app. | P1 | Document the Clerk redirect target. Set it explicitly to `/clinician/onboarding`. Add an in-app fallback page that handles unauthenticated returns. |
| FR-O-3 | MS | Onboarding → passport handoff | No link from `/clinician/onboarding` or `/clinician/profile` to `/passport`. | P1 | Add explicit "View your passport at …" hand-off card on a successful onboarding submit. (Carries forward from PR3D FR-O-5.) |
| FR-O-4 | DR | `/employers` redirect alias | `apps/web/app/employers/page.tsx:1-22` redirects to `/pilot` (a clinician-pilot signup, not an employer surface). | P2 | Either remove `/employers` or replace with link to `/employer/dashboard`. (Carries forward from PR3D FR-E-4.) |

## Passport friction (FR-P)

| ID | Class | Surface | Evidence | Severity | Required alignment |
|---|---|---|---|---|---|
| FR-P-1 | MS | Passport-lane → issuer-request entry | `apps/web/app/passport/[id]/PassportEntityClient.tsx:77-111` mounts `KnowledgeInboxPanel`; its buttons are unwired (`KnowledgeInboxPanel.tsx:123-135`). No "Request issuer verification" button exists on a `review_required` lane. | P0 | Add a single "Request issuer verification" button on a `TrustUiStatus.review_required` lane that routes to `/issuer/request/[requestId]` with a fresh requestId. Keep demo disclaimer. |
| FR-P-2 | OB | Passport-lane dossier missing | `/passport/[id]/dossier` does not exist. `AuditTrailTimeline` is mounted only inside components, not as a route. | P1 | Add `/passport/[id]/dossier` route that mounts `AuditTrailTimeline` for that subject. Demo OK. (Carries forward from PR3D FR-D-1.) |
| FR-P-3 | HS | Lane-health → compliance/`/status` cross-link | `LaneHealthMount` mounted on `/passport/[id]`; `/status` page shows compliance/adapter foundation. No link between them. | P2 | Add a "view compliance posture" link from lane-health section to `/status`. |
| FR-P-4 | HS | Lane-health transition history absent | `LaneHealthSection.tsx:17-79` renders current state only. No "this lane has been UNAVAILABLE for 3 days" or chronic-failure indicator. | P2 | Add a small "since" timestamp beneath each lane state. Out of immediate critical path. |

## Verifier (issuer chain) friction (FR-V)

| ID | Class | Surface | Evidence | Severity | Required alignment |
|---|---|---|---|---|---|
| FR-V-1 | MS | Issuer chain has zero forward links | None of `apps/web/app/issuer/{request,verify,review,policy-review,psv-receipt,psv-reuse,persistence-adapter,audit-boundary,backend-persistence}/[…]/page.tsx` links to a sibling. | P0 | Add forward links between adjacent demo pages (`request → verify → review → policy-review → psv-receipt → psv-reuse`). Disclaimers cover the linkage. (Carries forward from PR3D FR-V-1.) |
| FR-V-2 | HG | `refusalGate` not rendered | `apps/web/lib/issuer-verification/policyReview.ts:67-122` emits a six-value `refusalGate`. `apps/web/app/issuer/policy-review/[requestId]/page.tsx` does not render it. | **P0 (single largest operator ambiguity)** | Render the `refusalGate` label inline when the dry-run shows refusal. One-line UI; closes the largest operator ambiguity. |
| FR-V-3 | HS | `ReceiptCandidateReviewState` invisible to clinician | `apps/web/lib/issuer-verification/types.ts:127`. Eight values; only the policy-review surface sees them. | P1 | Render the reviewState inline on the passport for the affected lane (e.g., "Issuer responded with `partially_confirmed` — awaiting policy review"). |
| FR-V-4 | DE | Receipt-candidate `review_required` has no advance UI | `receiptCandidate.ts:32-48` maps `partially_confirmed` and `legally_only` (no limitationNote) to `review_required`. No UI button "request follow-up from issuer" exists on the receipt-candidate review surface. | P0 | Render explicit "request follow-up" / "supply release form" / "mark unverifiable" actions when reviewState ∈ {`review_required`, `release_required`, `reroute_required`, `unable_to_verify`}. Demo stubs OK. |
| FR-V-5 | MS | Policy-review decision → passport update | Even if `accept_candidate` succeeds (demo), no mechanism propagates lane status back to `/passport/[id]`. Data flow is one-way. | P1 | Out of immediate PR4D scope; depends on TRUST-PERSIST-1 phases 3a-3c. Document the dependency. |
| FR-V-6 | DC | Truth-contract phrasing vs literal labels | Contract phrase "ready state" vs literal `refusalGate: 'review_state_not_ready'`. | P2 | Tighten contract phrasing to match the literal label. |

## Employer friction (FR-E)

| ID | Class | Surface | Evidence | Severity | Required alignment |
|---|---|---|---|---|---|
| FR-E-1 | MS | Dashboard → worklist | `apps/web/app/employer/dashboard/page.tsx:18-22` static cards have no links. | P1 | Add "View applications" link to `/employer/worklist`. (Carries forward from PR3D FR-E-3.) |
| FR-E-2 | DE | Worklist row → review handoff | `apps/web/components/verifier/WorklistPanel.tsx:111-173` fires `onSelect(item)` only. `apps/web/app/employer/worklist/page.tsx:1-51` does not wire `onSelect`. | P0 | Wire `onSelect(item)` to push `/employer/review/[item.applicationId]`. (Carries forward from PR3D FR-E-1.) |
| FR-E-3 | DE | Employer review CTAs visual only | `apps/web/app/employer/review/[applicationId]/page.tsx:36,48-52`. Three buttons visual only; "has no persisted decision outcome in this shell". | P0 | Either wire to `/employer/decision/[applicationId]` capture-intent flow, or render disabled with explanatory copy. (Carries forward from PR3D FR-E-2.) |
| FR-E-4 | HM | Employer score factors hidden | `apps/web/components/employer/ScoreExplainabilityBlock.tsx:1-145` exists. No route mounts it. | P0 | Mount `ScoreExplainabilityBlock` on `/employer/review/[applicationId]`. Component already exists; this is a single import + render. |
| FR-E-5 | DE | `EmployerNextBestAction` callback-only | `apps/web/components/review/EmployerNextBestAction.tsx:109-117`. | P0 | Add `href` to the `nba` contract; navigate where appropriate. (Carries forward from PR3D FR-E-5.) |
| FR-E-6 | DE | `DecisionCard` / `DecisionQueue` callback-only | `apps/web/components/decision/DecisionCard.tsx:173-186`, `DecisionQueue.tsx:30-117`. | P0 | Add `href`; "Execute Recommendation" should land on the actual surface that captures the decision. (Carries forward from PR3D FR-E-6.) |

## Inbox / next-step friction (FR-N)

| ID | Class | Surface | Evidence | Severity | Required alignment |
|---|---|---|---|---|---|
| FR-N-1 | DE | `KnowledgeInboxPanel` "Dismiss" / "Add as profile context" unwired | `apps/web/components/knowledge-inbox/KnowledgeInboxPanel.tsx:123-135`. No `href`, no `onClick`. | P0 | Adopt `Workspace/NextBestAction.tsx`'s `href` pattern. (Carries forward from PR3D FR-C-4.) |
| FR-N-2 | DE | `clinician/NextBestAction.tsx` callback-only | `apps/web/components/clinician/NextBestAction.tsx:15-40`. | P0 | Add `href` field on the action contract; render `<Link>` when present. (Carries forward from PR3D FR-C-5.) |
| FR-N-3 | DE | `KnowledgeInboxPanel.nextAction` is text-only | `apps/web/lib/knowledge-inbox/classifyInboxItem.ts` emits a `nextAction` string field. No href. Inbox renders the text, no button. | P0 | Either emit an `href` alongside `nextAction` in the inbox classifier, or render a disabled hint when no destination is available. |
| FR-N-4 | DE | `WorklistPanel` row callback-only | `apps/web/components/verifier/WorklistPanel.tsx:111-173`. | P0 | Wire `onSelect` to a route. |
| FR-N-5 | OB | Multiple parallel inboxes per role | Clinician sees: `KnowledgeInboxPanel` + `ClinicianHomeSurface.primaryAction` + `DecisionQueue` + `WhatsNextPanel`. Employer sees: `WorklistPanel` + dashboard cards + `EmployerNextBestAction`. | P1 | Decide on a single canonical "do this next" surface per role; demote others to detail panels. |
| FR-N-6 | (reference) | `Workspace/NextBestAction.tsx` is the only emitter using `<Link href={…}>` | `apps/web/components/workspace/NextBestAction.tsx:31-56`, line 41. | reference | Adopt this pattern in every other emitter. Single highest-leverage repair (carried from PR3D FR-N-7). |

## Trust-state collisions (FR-S)

| ID | Class | Word / state | Collision evidence | Severity | Required alignment |
|---|---|---|---|---|---|
| FR-S-1 | DC | `review_required` | `packages/trust-state/sourceCoverage.ts:14,164` (`reviewRequired`) vs `apps/web/lib/issuer-verification/types.ts:127` (`ReceiptCandidateReviewState.review_required`) vs `apps/web/lib/knowledge-inbox/types.ts:29` (`needs_review`). Same label, different remediations. | P0 | Rename `ReceiptCandidateReviewState.review_required` → `issuer_response_incomplete` (preferred). (Carries forward from PR3D FR-S-1.) |
| FR-S-2 | DC | `verified` | `TrustUiStatus.verified` (rendered) vs `KnowledgeInboxVerificationStatus.source_verified` (never rendered). | P1 | Either render `source_verified` consistently or rename. |
| FR-S-3 | HS | `ReadinessState` invisible | `packages/trust-state/sourceCoverage.ts:682-717`. Four values; never rendered as enum. | P1 | Surface the active value beneath the readiness score (e.g., "Posture: PARTIAL"). |
| FR-S-4 | HM | `CalibratedDecisionState` modulators hidden | `apps/api/backend/src/services/decision/confidenceEngine.ts:23`. Four modulators; only `issuerTrustLevel` rendered (`AcceptancePanel.tsx`). | P0 | Surface 3 of 4 modulators (`evidenceStrength`, `freshnessScore`, `outcomeHistoryStrength`) inline beneath `ConfidenceMeter`. |
| FR-S-5 | DC | `pending` | `CanonicalSourceCoverageState.pending` vs `PolicyReviewDecisionStatus.pending_review`. | P2 | Document the layered meaning. Render is internal today, latent risk. |

## Dossier / replay friction (FR-D)

| ID | Class | Surface | Evidence | Severity | Required alignment |
|---|---|---|---|---|---|
| FR-D-1 | OB | No per-subject dossier route | Five audit components exist; none has a per-subject route entry (`/passport/[id]/dossier`, `/issuer/dossier/[requestId]`, `/employer/dossier/[applicationId]`). | P1 | Add `/passport/[id]/dossier` and `/issuer/dossier/[requestId]` mounting `AuditTrailTimeline`. (Carries forward from PR3D FR-D-1, FR-D-2.) |
| FR-D-2 | OB | Lifecycle replay only on demo audit-boundary | `/issuer/audit-boundary/[requestId]` is the only operator-reachable replay (demo, `noop` writer). | P1 | Once FR-D-1 lands, link to it from `/issuer/audit-boundary/[requestId]` as the user-facing dossier entrypoint. |
| FR-D-3 | OB | `AuditScrapbook` has no entrypoint | Component exists; no route or component mount located. | P2 | Either delete or mount in a clinician-readable route. |

## Three-reviews drift (FR-R)

| ID | Class | Surface | Evidence | Severity | Required alignment |
|---|---|---|---|---|---|
| FR-R-1 | DC | Three "review" routes | `/review/[entityId]` (public), `/employer/review/[applicationId]` (internal employer), `/issuer/review/[requestId]` (verifier). | P2 | Disambiguate in copy and instrumentation. Do not unify. (Carries forward from PR3D FR-R-1.) |

## Cross-surface continuity (FR-X) — new in PR4D

| ID | Class | Surface | Evidence | Severity | Required alignment |
|---|---|---|---|---|---|
| FR-X-1 | MS | Lane health (`/passport/[id]`) and compliance evidence (`/status`) do not cross-link | `PassportEntityClient.tsx:84-86` mounts `LaneHealthMount`. `/status` exposes adapter / compliance state. Neither links to the other. | P2 | Add cross-links once cross-surface navigation is established. |
| FR-X-2 | OB | `/status` not linked from operational surfaces | `/status` linked only from `/docs` (anchor "Status preview"). Sitemap priority `0.4`. Not linked from passport, issuer, employer surfaces. | P2 | Add a "Platform status" link in the global footer. |
| FR-X-3 | MS | `issuerSurfaceFactory.ts` unused | `apps/web/lib/issuer-verification/issuerSurfaceFactory.ts` (untracked). Zero imports. | P2 | Either consume it (e.g., to seed a single demo flow with a shared requestId across the chain) or delete. |

## Recommended PR sequencing (PR4D-FIX series)

The repairs collapse to a small number of mechanical PRs. Each is in scope for a single Codex SAFE review.

| PR # | Title | Closes | Notes |
|---|---|---|---|
| 1 | Render `refusalGate` on policy-review surface | FR-V-2 | Single line of UI; largest single operator-readability gain. |
| 2 | Adopt `href` pattern on next-step emitters | FR-N-1, FR-N-2, FR-N-3, FR-N-4, FR-E-5, FR-E-6 | Carries forward from PR3D PR2. |
| 3 | Wire passport-lane → issuer-request entry | FR-P-1 | Closes the verifier-chain entry break. |
| 4 | Mount `ScoreExplainabilityBlock` on employer review | FR-E-4 | Component already exists. |
| 5 | Surface `ReadinessState` literal beneath readiness score | FR-S-3 | One line of UI. |
| 6 | Surface 3 of 4 confidence modulators beneath `ConfidenceMeter` | FR-S-4 | Three small chips. |
| 7 | Disambiguate `review_required` (rename `ReceiptCandidateReviewState.review_required` → `issuer_response_incomplete`) | FR-S-1 | Type-level rename + audit copy. |
| 8 | Add forward links between adjacent issuer demo pages | FR-V-1 | Carries forward from PR3D PR5. |
| 9 | Wire worklist → employer review → decision handoff | FR-E-1, FR-E-2, FR-E-3 | Carries forward from PR3D PR6. |
| 10 | Add `/passport/[id]/dossier` and `/issuer/dossier/[requestId]` routes | FR-D-1, FR-D-2 | Carries forward from PR3D PR7. |
| 11 | Onboarding chain repair | FR-O-1, FR-O-3 | Carries forward from PR3D PR1. |
| 12 | Wire receipt-candidate `review_required` advance actions | FR-V-4 | Demo stubs OK. |

PRs 1, 2, 3, 4 carry the largest user-visible coherence improvement in the smallest amount of code.

## Severity rollup

| Severity | Count | Notes |
|---|---|---|
| P0 | 13 | Concentrated in inbox/action wiring (FR-N-1..4), employer review (FR-E-2..6), issuer chain (FR-V-1, FR-V-2, FR-V-4), passport entry (FR-P-1), trust-state collision (FR-S-1, FR-S-4). |
| P1 | 10 | Onboarding handoffs, dossier routes, employer dashboard, lane→compliance cross-links. |
| P2 | 9 | Drift aliases, label-collision documentation, sitemap visibility. |

## What changed since PR3D

| Item | PR3D status | PR4D status | Delta |
|---|---|---|---|
| Lane health on `/passport/[id]` | not present | mounted (PR #220) | +continuity (closes part of FR-C-6, FR-S-5) |
| `/status` compliance evidence | not present | wired (DOCS-STATUS-1) | +operator surface; isolated |
| Backend persistence | absent | schema landed (TRUST-PERSIST-1) | no operator-visible change yet |
| `KnowledgeInboxPanel` buttons | unwired | unwired | no change |
| `refusalGate` render | not rendered | not rendered | no change |
| Issuer-chain forward links | absent | absent | no change |
| Employer review CTAs | visual-only | visual-only | no change |

Net delta: +2 surfaces; -0 surfaces; introduces 2 new MS items (FR-X-1, FR-X-2). Continuity score per role rose modestly (clinician 35% → 43%; operator-understandability 25% → ~32%); verifier and employer continuity unchanged.

## Out of scope for PR4D

- No backend persistence wiring (TRUST-PERSIST-1 phases 3a-3c).
- No truth-contract changes.
- No copy rewrite.
- No mobile / device-security activation.
- No new state machines.

## See also

- `w2-pr4d-workflow-coherence.md`
- `w2-pr4d-operator-understanding.md`
- `w2-pr4d-trust-state-continuity.md`
- `w2-pr3d-workflow-fragmentation-register.md` (PR3D predecessor)

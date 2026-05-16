# W2-PR4D - Workflow Continuity + Operator Coherence

**Wave:** W2-PR4D - Workflow Continuity + Operator Coherence
**Date:** 2026-05-08
**Status:** Docs-only continuity assessment. No product code changed. No merge.
**Risk class:** SAFE. `docs/ops/**` only.
**Predecessor:** PR3D (`w2-pr3d-product-coherence-review.md`, 2026-05-08 morning).

## Mission

PR3D inventoried the surfaces. PR4D measures the **continuity** between them — quantitatively, with file:line evidence — and quantifies what an operator can actually understand about why the system is in its current state. Three additions landed between PR3D and PR4D:

- DOCS-STATUS-1 (`5d530f13`): compliance evidence shape on `/status`.
- TRUST-HEALTH-UX-1 / PR #220 (`fae54ea5`): `LaneHealthMount` mounted on `/passport/[id]`.
- TRUST-PERSIST-1 (PR #221, in flight): backend schema only, no operator surface.

PR4D folds those into a baseline-vs-current delta and surfaces the highest-friction workflow that remains.

## Companion documents

- `docs/ops/w2-pr4d-operator-understanding.md` — replay/explainability inventory.
- `docs/ops/w2-pr4d-trust-state-continuity.md` — state machines + transition graphs + dead-ends.
- `docs/ops/w2-pr4d-workflow-friction-register.md` — prioritized friction register, file:line evidence.

## Scope of inspection (delta vs PR3D)

PR3D source set is treated as authoritative for surfaces it covered. PR4D re-inspects the seams and adds:

- `apps/web/app/status/page.tsx` (DOCS-STATUS-1).
- `apps/web/components/source-health/LaneHealthMount.tsx`, `LaneHealthSection.tsx`, `LaneHealthBadge.tsx`.
- `apps/web/lib/issuer-verification/issuerSurfaceFactory.ts` (untracked).
- `apps/web/components/AuditTimeline.tsx`, `apps/web/components/employer/AuditTerminal.tsx`, `apps/web/components/trust-state/AuditTrailTimeline.tsx`, `apps/web/components/decision/AuditBundlePreview.tsx`, `apps/web/components/verifier/AuditProofViewer.tsx`, `apps/web/components/clinician/AuditScrapbook.tsx`.
- `apps/web/components/employer/ScoreExplainabilityBlock.tsx`.
- `apps/web/sentry.client.config.ts` (replay surfaces).
- `apps/web/app/sign-up/[[...sign-up]]/page.tsx`, `apps/web/app/holder/layout.tsx`.
- `apps/web/lib/knowledge-inbox/classifyInboxItem.ts`.
- `apps/api/backend/src/services/decision/confidenceEngine.ts` (re-inspected).
- `packages/trust-state/sourceCoverage.ts` and `contracts.ts` (re-inspected for transitions).

## Eight workflows analyzed

### W1. Onboarding continuity

**Baseline (PR3D):** four `redirect('/')` step pages; two onboarding entries (`/onboarding`, `/clinician/onboarding`); no onboarding → passport handoff.

**Now:** unchanged. Re-confirmed `apps/web/app/onboarding/{identity,fetching,readiness,success}/page.tsx:4` still `export default () => redirect('/')`. Sign-up post-redirect is handled by Clerk (`apps/web/app/sign-up/[[...sign-up]]/page.tsx`); the destination is set in Clerk dashboard config, not in the app, so the flow leaves the in-app source-of-truth.

**Continuity score:** 3 of 6 advertised steps reach a real surface; canonical entry is `/clinician/onboarding`; the other 4 dead-end at `/`. **50%.**

### W2. Passport continuity

**Baseline (PR3D):** `/passport` and `/passport/[id]` link to each other; readiness score has no per-lane breakdown; `ReadinessState` invisible.

**Now:** `LaneHealthMount` is mounted on `/passport/[id]` (`PassportEntityClient.tsx:12,84-86` per the recent commit). Renders per-lane source health with `userFacingMessage` and retry policy. Closes part of FR-C-6 and FR-S-5 (lane state name now visible).

Still missing: `/passport/[id]/dossier` route (FR-D-1); explicit "Request issuer verification" button on a `review_required` lane (new gap — see W3); `CalibratedDecisionState` modulator inputs still hidden.

**Continuity score:** entry → detail seam OK; lane health visible; lane → issuer-request handoff missing; lane → dossier missing. **~55%** (was ~30% pre-#220).

### W3. Employer-review continuity

**Baseline (PR3D):** dashboard → worklist link missing; worklist row → review handoff fires `onSelect(item)` callback only; review CTAs visual only; decision route is "Decision recording is planned"; `DecisionCard` and `EmployerNextBestAction` are callback-only.

**Now:** unchanged. Re-confirmed `apps/web/app/employer/worklist/page.tsx:1-51` does not wire `onSelect`; `apps/web/app/employer/review/[applicationId]/page.tsx:36,48-52` CTAs still visual.

`ScoreExplainabilityBlock` (a built-but-unmounted three-column score breakdown at `apps/web/components/employer/ScoreExplainabilityBlock.tsx`) would close part of the "why this score" employer gap, but no route mounts it.

**Continuity score:** four pages, four breaks. Dashboard cannot reach worklist; worklist cannot reach review; review cannot reach decision; decision is non-functional. **~10%.**

### W4. Inbox / action continuity

**Baseline (PR3D):** five "do this next" emitters; one (`Workspace/NextBestAction.tsx`) is the only one with `<Link href={…}>`; clinician + employer + verifier inbox/queue components are all callback-only or unwired.

**Now:** unchanged. Re-confirmed `KnowledgeInboxPanel.tsx:123-135`, `DecisionCard.tsx:173-186`, `DecisionQueue.tsx:30-117`, `EmployerNextBestAction.tsx:109-117`, `clinician/NextBestAction.tsx:15-40`, `WorklistPanel.tsx:111-173` all lack `href`.

**Continuity score:** 1 of 6 emitters in the canonical pattern. **~17%.**

### W5. Readiness-state continuity

**Baseline (PR3D):** `ReadinessState` invisible (FR-S-5); per-lane breakdown absent; `CalibratedDecisionState` modulator inputs hidden.

**Now:** `LaneHealthMount` adds per-lane source health to `/passport/[id]`. This is *adjacent* to but not the same as `ReadinessState` (which is the launch-spine-derived enum at `packages/trust-state/sourceCoverage.ts:682-717`). The user can now see "lane operational status" but still cannot see the four-value `ReadinessState` enum (`CHECKING|PARTIAL|DECISION_GRADE|BLOCKED`) by name.

`/status` (DOCS-STATUS-1) shows compliance evidence (`redactionLive`, `retentionEnforced`, `allAdaptersLive`, rule/policy/adapter counts) but not lane-level state and not `ReadinessState`. The two readiness surfaces (`/passport/[id]` lane health, `/status` compliance evidence) do not cross-link.

**Continuity score:** lane health rendered; readiness derivation still hidden; cross-surface stitching absent. **~40%** (was ~15% pre-#220).

### W6. Dossier continuity

**Baseline (PR3D):** five audit components (`AuditProofViewer`, `AuditBundlePreview`, `AuditTrailTimeline`, `AuditTerminal`, `AuditScrapbook`); zero per-subject route entrypoints.

**Now:** clarified inspection finds the components are mounted at:

- `AuditTrailTimeline` rendered inside `apps/web/components/verifier/PasReceipt.tsx` (a component, not a route).
- `AuditTerminal` rendered inside `apps/web/components/employer/VerifierCommandCenter.tsx`.
- `AuditBundlePreview` rendered inside `apps/web/components/decision/DecisionCapsuleViewer.tsx`.
- `AuditProofViewer` mounted in verifier proof view (component).
- `AuditTimeline` mounted in verifier proof view (component).
- `AuditScrapbook` no route entry located.

A route-level `/passport/[id]/dossier` or `/issuer/dossier/[requestId]` still does not exist. The closest the user has is `/issuer/audit-boundary/[requestId]` (demo, `demo_not_persisted`).

**Continuity score:** five components built; zero per-subject routes. **~0%** route-level (PR3D was already correct here).

### W7. Replay / operator understanding

**Baseline (PR3D):** mentioned in Mission but not measured.

**Now (PR4D measure):**

- Per-event replay surface: `/issuer/audit-boundary/[requestId]` (demo, lifecycle replay via `buildIssuerLifecycleReplay()`; events tagged `demo_not_persisted` vs `persisted`; replay-safe disclaimer present).
- Score explainability: `ScoreExplainabilityBlock` exists, no route.
- Confidence modulators: 1 of 4 (`issuerTrustLevel`) rendered (in `AcceptancePanel.tsx`); 3 of 4 not surfaced.
- Refusal gate visibility: `PolicyReviewOutcome.refusalGate` (six values) computed and tested but never rendered.
- Lane health rationale: lane state badge rendered; degradation events / root-cause not rendered.
- Decision rationale: `DecisionCard` ships `rationale: string` and `drivers: string[]` fields; both render when present. No structured "which gate fired" field.

**Continuity score:** operator can see *what happened* on one demo surface and *what state we're in* on lane-health; cannot see *why* we're in that state across most surfaces. **~35%.**

### W8. Trust-state transitions

See `w2-pr4d-trust-state-continuity.md` for the per-machine transition graphs. Headline:

| Machine | States | Transitions visible to operator | Dead-ends w/ no UI advance |
|---|---|---|---|
| `CanonicalSourceCoverageState` | 9 | rendered via `TrustUiStatus` | 5 (`previewOnly` silent; `gated/accessRequired/reviewRequired/unavailable` have no advance UI) |
| `ReadinessState` | 4 | **0 by name** | all 4 (computed, never rendered as enum) |
| `ReceiptCandidateReviewState` | 8 | rendered as context field | 4 (`review_required`, `unable_to_verify`, `release_required`, `reroute_required`) |
| `PolicyReviewDecisionStatus` | 7 | rendered on demo only | persistence absent → all dead-end |
| `CalibratedDecisionState` | 5 | rendered as final enum | inputs hidden (3 of 4 modulators) |
| `TrustBand` | 3 | field exists | rendered indirectly only |

## Continuity scoring (definitions)

For each role-surface, continuity is measured as:

```
continuity% = (number of intended forward transitions that actually fire) / (number of intended forward transitions advertised by the surface)
```

A "transition fires" when clicking a labelled CTA, link, or row produces a navigation event to the advertised destination AND that destination renders something coherent with the source surface's promise. Pure callbacks count as `0`. `redirect('/')` to home counts as `0` because home is not the advertised destination. A surface that has no advertised forward transition contributes `0/0` (excluded from the denominator).

Per-role rollup:

| Role | Workflows | Numerator | Denominator | Continuity % |
|---|---|---|---|---|
| Clinician | onboarding (W1), passport (W2), inbox (W4 clinician), readiness (W5) | 6 (operational `holder/home` action wiring + lane health + passport entry/detail seam + 1 onboarding entry) | 14 (advertised transitions) | **43%** |
| Verifier (issuer) | issuer chain (transitions between `request → verify → review → policy-review → psv-receipt → psv-reuse`) + audit boundary | 0 forward links between adjacent demo pages | 9 demo pages × 1 forward link each | **~0%** |
| Employer | dashboard → worklist → review → decision + employer NBA | 0 wired (callback-only) | 6 advertised | **~0%** |
| Inbox / Action coherence (cross-role) | 6 emitters | 1 (`Workspace/NextBestAction`) | 6 | **17%** |
| Trust-state continuity | 6 state machines, sum of operator-visible states / total states | 19 of 36 states render their name | 36 | **53%** |
| Operator understandability | replay + explain + drivers + gates + lane rationale + modulators (8 axes) | ~3 of 8 | 8 | **~38%** |

## Highest-friction workflow

The **verifier (issuer) chain** remains the highest-friction workflow. Nine demo pages, zero forward links, every page disclaims persistence, no `<Link>` between adjacent surfaces, and `issuerSurfaceFactory.ts` (a fixture factory) does not add navigation. A verifier cannot complete a single end-to-end request inside the product. Continuity ~0%.

Closely behind: **employer flow** at ~0% (four pages, four breaks).

## Largest operator ambiguity

The largest single operator-readability gap is the **`refusalGate` not being rendered**. `PolicyReviewOutcome.refusalGate` is a six-value string union emitted from `apps/web/lib/issuer-verification/policyReview.ts:67-122`. It is computed, returned, and tested. No UI surface renders it. A reviewer who is refused has no in-product way to know which of the six gates fired. The operator must read source to attribute the refusal. This is asymmetric: the surface promises a decision-grade decision; the surface refuses; the surface does not say why.

A close second: the four `CalibratedDecisionState` modulator inputs (`evidenceStrength`, `freshnessScore`, `issuerTrustLevel`, `outcomeHistoryStrength`). One is rendered (`issuerTrustLevel`); three are not. The user sees "Blocked — Confident" without seeing whether the cause is freshness, evidence, or history.

## Strongest continuity gain (since PR3D)

PR #220 (`LaneHealthMount` on `/passport/[id]`) is the largest single continuity gain in the 24 hours between PR3D and PR4D. It closes part of FR-C-6 (per-lane breakdown) and FR-S-5 (lane state name visible). It also introduces a small new fragmentation: lane health is on `/passport/[id]`, compliance evidence is on `/status`, and the two surfaces do not cross-link. Net delta is positive.

## Biggest remaining workflow gap

The **passport-lane → issuer-request seam**. When a passport lane is `review_required`, the clinician (or anyone) cannot initiate the issuer-verification request from inside the passport. The `KnowledgeInboxPanel` is mounted on the passport detail (`PassportEntityClient.tsx:77-111`) but its buttons are unwired (`KnowledgeInboxPanel.tsx:123-135`). The issuer request flow exists at `/issuer/request/[requestId]` but there is no entry from a passport lane.

This is the keystone gap because it gates the entire issuer-chain from being reachable end-to-end. Even if PR3D-FIX-2 (forward links between adjacent issuer demo pages) lands, the chain still has no entry. Recommended next-PR scope: a single "Request issuer verification" button on a `review_required` lane that routes to `/issuer/request/[requestId]` with a fresh requestId — disclaimers cover the persistence boundary.

## SAFE / UNSAFE

**SAFE.** This artifact set is `docs/ops/**` only; no product code changed; no merge.

## See also

- `w2-pr4d-operator-understanding.md`
- `w2-pr4d-trust-state-continuity.md`
- `w2-pr4d-workflow-friction-register.md`
- `w2-pr3d-product-coherence-review.md` (predecessor)
- `docs/architecture/vitalcv-knowledge-trust-graph.md` (boundaries 1-28)

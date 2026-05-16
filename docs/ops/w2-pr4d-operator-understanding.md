# W2-PR4D - Operator Understanding

**Wave:** W2-PR4D - Workflow Continuity + Operator Coherence
**Date:** 2026-05-08
**Status:** Docs-only inventory of replay, explainability, and "why" surfaces. No product code changed.
**Risk class:** SAFE.

## Mission

Quantify what an operator (clinician, employer, verifier, support, admin) can actually understand about why the system is in its current state. PR3D measured *where the user dead-ends*. PR4D measures *how much the user can reconstruct of the why*.

## Definitions

- **Operator:** any human who needs to attribute a system state to a cause. Includes the four roles plus support/admin/auditor.
- **Replay surface:** any surface that lists past events for a subject (request, application, lane, receipt) in chronological order with actor + timestamp.
- **Explainability surface:** any surface that decomposes a derived value (score, confidence, recommendation) into its inputs.
- **Rationale field:** a free-text "why" string attached to a single decision/recommendation.
- **Refusal field:** a labelled enum or string that names which gate refused a request.

## Surface inventory

### Replay / audit timeline components

| Component | File | Mounted? | Renders | Operator can attribute? |
|---|---|---|---|---|
| `AuditTimeline` | `apps/web/components/AuditTimeline.tsx` | Yes (verifier proof view, component-level) | Event type, timestamp, actor, signer, hash, ordering | Partial — what + when + who, no "why" field |
| `AuditTrailTimeline` | `apps/web/components/trust-state/AuditTrailTimeline.tsx` | Yes (inside `verifier/PasReceipt.tsx`, component-level) | Trust state mutation timeline, timestamps, ordering | Partial — state transitions visible, transition cause not surfaced |
| `AuditTerminal` | `apps/web/components/employer/AuditTerminal.tsx` | Yes (inside `employer/VerifierCommandCenter.tsx`) | Typed `AuditLogEntry` (status/actor/timestamp), chronological log | Partial — same as above |
| `AuditBundlePreview` | `apps/web/components/decision/AuditBundlePreview.tsx` | Yes (inside `DecisionCapsuleViewer.tsx`) | Bundle id, NPI, signature status, size, timestamp | Low — bundle-level only, no per-event ordering |
| `AuditProofViewer` | `apps/web/components/verifier/AuditProofViewer.tsx` | Yes (verifier proof view, component-level) | Evidence id, type, source, timestamp, signature, document hash; cryptographic proof chain | Partial — proof shape visible, decision logic not |
| `AuditScrapbook` | `apps/web/components/clinician/AuditScrapbook.tsx` | No route entrypoint located | Unknown | n/a |

**Per-subject route entrypoint:** `/passport/[id]/dossier` and `/issuer/dossier/[requestId]` do not exist. The closest reachable surface is `/issuer/audit-boundary/[requestId]` (demo, `demo_not_persisted`).

### Lifecycle replay surface (the one operator-reachable replay)

| Surface | File | Status |
|---|---|---|
| `/issuer/audit-boundary/[requestId]` | `apps/web/app/issuer/audit-boundary/[requestId]/page.tsx` | Demo. Renders six lifecycle events (`consent_recorded`, `manual_link_generated`, `copied_by_requester`, `sent_by_requester`, `viewed_by_issuer`, `response_received`) via `buildIssuerLifecycleReplay()`. Events tagged `demo_not_persisted` (line 202). `noop` writer. Disclaimer: replay-safe is not legal proof. |

This is the only operator-reachable surface where you can read a per-subject event timeline today. It is a demo. There is no equivalent for clinician (`/passport/[id]/dossier`), employer (`/employer/dossier/[applicationId]`), or PSV receipt (`/issuer/dossier/[receiptId]`).

### Explainability components

| Component | File | Mounted? | Decomposes |
|---|---|---|---|
| `ScoreExplainabilityBlock` | `apps/web/components/employer/ScoreExplainabilityBlock.tsx` | **No route entrypoint** | CRS score breakdown: three columns (Helping / Hurting / Ceiling effects); factor labels + detail + source + impact (+/−). |
| `DecisionCard` | `apps/web/components/decision/DecisionCard.tsx` | Yes (inside `DecisionQueue` and review surfaces) | Action, entity, priority, **confidence** (number → `ConfidenceMeter`), **rationale** (string), **drivers** (string array, expandable). Rationale and drivers are optional. Lines 173-186 emit "Execute Recommendation" / "Defer Signal" callbacks (no `href`). |
| `EvidenceViewer` | `apps/web/components/evidence/EvidenceViewer.tsx` | Yes | Evidence summary by source, average confidence, corroboration count. No per-evidence "why" field. |
| `EmployerNextBestAction` | `apps/web/components/review/EmployerNextBestAction.tsx` | Yes (inside `EmployerDecisionConsole.tsx`) | Action type (`PROCEED|ESCALATE|REQUEST_DATA|REVERIFY|HOLD`), reason, source-coverage indicator. Button at line 109-117 is `onActionClick(nba.action)` — callback only. |
| `clinician/NextBestAction` | `apps/web/components/clinician/NextBestAction.tsx` | Yes (mobile) | Title, description, action label. No "why" field beyond the title/description. |
| `Workspace/NextBestAction` | `apps/web/components/workspace/NextBestAction.tsx` | Yes | Action with `<Link href={…}>` (line 41). Reference implementation. No structured "why" field. |
| `LaneHealthSection` / `LaneHealthBadge` | `apps/web/components/source-health/*` | Yes (`/passport/[id]`) | Per-lane source state badge + `userFacingMessage` + retry policy. State name visible; transition history and root-cause not visible. |

### Confidence calibration explainability

`apps/api/backend/src/services/decision/confidenceEngine.ts:23` defines `CalibratedDecisionState` modulated by four inputs:

| Input | Surface | Status |
|---|---|---|
| `evidenceStrength` | none | **Computed but not surfaced** |
| `freshnessScore` | none | **Computed but not surfaced** |
| `issuerTrustLevel` | `AcceptancePanel.tsx` | Rendered as colored badge (single surface) |
| `outcomeHistoryStrength` | none | **Computed but not surfaced** |

`ConfidenceMeter` shows a visual gauge but not the input components. A user seeing `BLOCKED_CONFIDENT` cannot tell whether the cause is freshness, evidence, or history. The remediation differs by cause; the UI does not differentiate.

### Refusal-gate visibility

`PolicyReviewOutcome.refusalGate` is a string union of six values defined in `apps/web/lib/issuer-verification/policyReview.ts:67-122`:

1. `action_does_not_create_candidate`
2. `wrong_office_cannot_create_candidate`
3. `unable_to_verify_cannot_create_candidate`
4. `conflict_review_unresolved`
5. `review_state_not_ready`
6. `legally_only_requires_limitation_note`

**Renders:** zero. The value is computed, returned in `PolicyReviewOutcome`, asserted in tests (`apps/web/__tests__/issuer-policy-review.test.ts`), and not bound to any UI on `/issuer/policy-review/[requestId]/page.tsx`.

A reviewer who attempts `accept_candidate` and gets refused sees the dry-run output but does not see which of the six gates refused. They must read source.

### Admin / ops surfaces

| Route | File | Operator-readable content | Cross-links |
|---|---|---|---|
| `/status` | `apps/web/app/status/page.tsx:1-90` | Foundation status preview. Compliance evidence (`redactionLive`, `retentionEnforced`, `allAdaptersLive`); rule/policy/adapter counts; machine-readable pointer to `/api/compliance/evidence`. **Not yet wired:** incident notices, public changelogs (line 38). | Linked from `/docs` (anchor "Status preview"); priority `0.4` in sitemap. |
| `/analytics-foundation` | `apps/web/app/analytics-foundation/page.tsx` | Not inspected for this PR4D. | n/a |
| `/admin/demo-reset` | `apps/web/app/admin/demo-reset/page.tsx` | Not inspected for this PR4D. | n/a |

### Replay infrastructure (non-operator)

| Surface | Use |
|---|---|
| Sentry replay (`apps/web/sentry.client.config.ts`) | Error-triggered session replay; production only; not operator-accessible inside the product. |

## Operator-coverage scoring (per axis)

```
operator_coverage% = (number of "why" axes the surface answers) / (number of "why" axes the surface promises)
```

Eight axes are tracked:

| Axis | What the operator wants to know | Today |
|---|---|---|
| A1. What happened | Per-subject event list with actor + time | **Partial.** `/issuer/audit-boundary/[requestId]` (demo). No clinician/employer per-subject route. |
| A2. Why this state | Cause attribution (which input flipped the state) | **Low.** Lane state name visible; cause not surfaced. |
| A3. Why this score | Score factor breakdown | **Low.** `ScoreExplainabilityBlock` exists, no route. |
| A4. Why this confidence | Confidence modulator inputs | **Low.** 1 of 4 modulators rendered. |
| A5. Why this recommendation | Drivers + rationale for next-best action | **Mixed.** `DecisionCard` ships rationale + drivers fields; not all emitters use them. `KnowledgeInboxPanel.nextAction` is text only. |
| A6. Why this refusal | Refusal-gate label | **None.** `refusalGate` computed, never rendered. |
| A7. What changed since last view | Recent-changes feed for a subject | **Partial.** `ClinicianHomeSurface` shows recent-changes block; per-subject (passport/application) feed not surfaced. |
| A8. Compliance posture | Adapter live state, retention, redaction | **Partial.** `/status` covers foundation level, no per-subject mapping. |

Aggregated:

| Axis | Coverage |
|---|---|
| A1 | ~30% (demo only, single role) |
| A2 | ~25% |
| A3 | ~10% (built unmounted) |
| A4 | ~25% (1 of 4) |
| A5 | ~50% (rationale exists; not all surfaces honor it) |
| A6 | ~0% |
| A7 | ~40% |
| A8 | ~50% (foundation visible, per-subject not) |

**Operator understandability rollup:** ~32% (mean of A1-A8).

## What an operator can actually do today

A clinician, on a passport lane in `review_required`, can:

- Read the lane state name (post-#220 `LaneHealthMount`).
- Read a `userFacingMessage` and retry policy on the lane.
- See a readiness score and a confidence label.
- See "do this next" copy in `KnowledgeInboxPanel`.

A clinician, on a passport lane in `review_required`, **cannot**:

- Click anything to initiate an issuer verification request.
- See which inputs are driving the score / confidence.
- Read a per-subject event timeline.
- See which gate has refused (if a candidate has been refused upstream).
- See `ReadinessState` by name.

A verifier, on `/issuer/policy-review/[requestId]`, can:

- See the dry-run accept outcome.
- See six possible policy actions.
- Submit a (demo) decision.

A verifier, on `/issuer/policy-review/[requestId]`, **cannot**:

- See which `refusalGate` (of six) refused if their action does not produce a candidate.
- See the `ReceiptCandidateReviewState` history.
- Click forward to `/issuer/psv-receipt/[requestId]`.

An employer, on `/employer/review/[applicationId]`, can:

- See the application identity snapshot.
- See lane states (Identity CHECKED, Sanctions CLEAR, etc.).
- Click visual-only CTAs.

An employer, on `/employer/review/[applicationId]`, **cannot**:

- Have any decision recorded (visual only; "no persisted decision outcome in this shell").
- See the score factor breakdown (`ScoreExplainabilityBlock` not mounted).
- Reach `/employer/decision/[applicationId]` from the review surface (no link, and the destination is itself non-functional).

## Highest-leverage repairs

In rank order of "operator understanding gain per PR":

1. **Render `refusalGate` on `/issuer/policy-review/[requestId]`.** Single line of UI; closes A6. Surface the literal label as a small chip beneath the rejected action with explanatory copy.
2. **Mount `ScoreExplainabilityBlock` on `/employer/review/[applicationId]`.** Closes A3. Component already exists.
3. **Surface 3 of 4 confidence modulators (`evidenceStrength`, `freshnessScore`, `outcomeHistoryStrength`) underneath the existing `ConfidenceMeter`.** Closes A4.
4. **Add `/passport/[id]/dossier` and `/issuer/dossier/[requestId]` routes that mount `AuditTrailTimeline`.** Closes A1 for clinician + verifier.
5. **Adopt `Workspace/NextBestAction.tsx`'s `href` pattern in `KnowledgeInboxPanel`, `DecisionCard`, `EmployerNextBestAction`, `WorklistPanel`, `clinician/NextBestAction`.** Closes A5.

Each is a single small PR.

## Out of scope

- No backend persistence. TRUST-PERSIST-1 covers schema; subsequent waves cover writers.
- No copy rewrite. PR3C language alignment is the truth contract.
- No new state machines.

## See also

- `w2-pr4d-workflow-coherence.md`
- `w2-pr4d-trust-state-continuity.md`
- `w2-pr4d-workflow-friction-register.md`

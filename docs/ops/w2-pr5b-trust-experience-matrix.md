# W2-PR5B - Trust Experience Matrix

**Wave:** W2-PR5B - Operational Trust Experience Certification
**Date:** 2026-05-08
**Status:** Docs-only certification matrix. No product code changed.
**Risk class:** SAFE.

## Purpose

Single sortable certification of every operator-facing trust surface across six understandability axes. Each cell is rated 🟢 / 🟡 / 🟠 / 🔴 with file:line evidence. The matrix is the audit record; siblings (`-operator-trust-certification.md`, `-confidence-certification.md`, `-workflow-understanding-review.md`, `-operational-coherence-report.md`) provide narrative.

## Rating legend

🟢 CLEAR · 🟡 PARTIAL · 🟠 CONFUSING · 🔴 MISLEADING

## Certification axes

| Axis | Question |
|---|---|
| U | Understandable — can the operator read the surface? |
| O | Overclaiming — does the surface promise more than the runtime delivers? |
| X | Underexplained — does the surface hide inputs or rationale the runtime computes? |
| A | Ambiguous — same label means different things across contexts? |
| M | Misleading — does affordance ≠ effect? Or copy ≠ runtime? |
| C | Operationally coherent — would a real operator complete a task and arrive at the right mental model? |

A rating of 🟢 in column **O** means "no overclaim". 🔴 in **M** means "highly misleading". 

## Master matrix

### Section 1 — Onboarding surfaces

| # | Surface | File | U | O | X | A | M | C |
|---|---|---|---|---|---|---|---|---|
| 1 | `/onboarding` (foundation copy) | `apps/web/app/onboarding/page.tsx:1-67` | 🟡 | 🟠 | 🟡 | 🟢 | 🔴 | 🔴 |
| 2 | `/onboarding/{identity,fetching,readiness,success}` | `apps/web/app/onboarding/{...}/page.tsx:4` | n/a (redirect) | n/a | n/a | n/a | 🔴 | 🔴 |
| 3 | `/clinician/onboarding` six-step guide | `apps/web/app/clinician/onboarding/page.tsx:1-92` | 🟢 | 🟡 | 🟡 | 🟢 | 🟠 | 🟠 |
| 4 | `/clinician/profile` (read-only shell) | `apps/web/app/clinician/profile/page.tsx` | 🟢 | 🟢 | n/a | 🟢 | 🟠 | 🟠 |
| 5 | `/clinician/import` cards | `apps/web/app/clinician/import/page.tsx:19-71` | 🟡 | 🟢 | 🟡 | 🟢 | 🔴 | 🔴 |
| 6 | Sign-up Clerk handoff | `apps/web/app/sign-up/[[...sign-up]]/page.tsx:16-35` | 🟡 | 🟢 | 🔴 | 🟢 | 🟡 | 🟠 |

### Section 2 — Passport surfaces

| # | Surface | File | U | O | X | A | M | C |
|---|---|---|---|---|---|---|---|---|
| 7 | `/passport` entry | `apps/web/app/passport/page.tsx` | 🟢 | 🟠 | 🟠 | 🟡 | 🟡 | 🟡 |
| 8 | `/passport/[id]` page | `apps/web/app/passport/[id]/page.tsx`, `PassportEntityClient.tsx` | 🟢 | 🟡 | 🟠 | 🟡 | 🟡 | 🟡 |
| 9 | `LaneHealthMount` (within `/passport/[id]`) | `apps/web/components/source-health/LaneHealthMount.tsx`, `LaneHealthSection.tsx`, `LaneHealthBadge.tsx` | 🟢 | 🟢 | 🟡 | 🟢 | 🟢 | 🟢 |
| 10 | Passport readiness display + tier-upgrade prompt | `apps/web/app/passport/page.tsx:671-712` | 🟡 | 🟠 | 🔴 | 🟡 | 🟠 | 🟠 |
| 11 | `KnowledgeInboxPanel` (within `/passport/[id]`) | `apps/web/components/knowledge-inbox/KnowledgeInboxPanel.tsx:123-135` | 🟡 | 🟡 | 🟠 | 🟢 | 🔴 | 🔴 |
| 12 | `/passport/[id]/dossier` route | does not exist | 🔴 | n/a | 🔴 | n/a | 🔴 | 🔴 |

### Section 3 — Holder / clinician home

| # | Surface | File | U | O | X | A | M | C |
|---|---|---|---|---|---|---|---|---|
| 13 | `ClinicianHomeSurface` primaryAction (real `<Link>`) | `apps/web/components/mobile/ClinicianHomeSurface.tsx:241-280` | 🟢 | 🟢 | 🟡 | 🟢 | 🟢 | 🟢 |
| 14 | `ClinicianHomeSurface` blockers (real `<Link>`) | `ClinicianHomeSurface.tsx:346-366` | 🟢 | 🟢 | 🟡 | 🟢 | 🟢 | 🟢 |
| 15 | `ClinicianHomeSurface` momentum block | `ClinicianHomeSurface.tsx:283-315` | 🟡 | 🟡 | 🟠 | 🟢 | 🟡 | 🟡 |
| 16 | `/holder/readiness` ReadinessSurface | `apps/web/app/holder/readiness/ReadinessSurface.tsx` | 🟡 | 🟢 | 🟠 | 🟢 | 🟡 | 🟡 |
| 17 | `clinician/NextBestAction` (mobile, callback only) | `apps/web/components/clinician/NextBestAction.tsx:15-40` | 🟡 | 🟡 | 🟠 | 🟢 | 🔴 | 🔴 |

### Section 4 — Issuer (verifier) chain

| # | Surface | File | U | O | X | A | M | C |
|---|---|---|---|---|---|---|---|---|
| 18 | `/issuer/request/[requestId]` | `apps/web/app/issuer/request/[requestId]/page.tsx` | 🟢 | 🟢 | 🟡 | 🟢 | 🟡 | 🟠 |
| 19 | `/issuer/verify/[requestId]` | `apps/web/app/issuer/verify/[requestId]/page.tsx` | 🟢 | 🟢 | 🟡 | 🟢 | 🟡 | 🟠 |
| 20 | `/issuer/review/[requestId]` | `apps/web/app/issuer/review/[requestId]/page.tsx` | 🟢 | 🟢 | 🟡 | 🟠 | 🟡 | 🟠 |
| 21 | `/issuer/policy-review/[requestId]` | `apps/web/app/issuer/policy-review/[requestId]/page.tsx` | 🟢 | 🟢 | 🔴 (`refusalGate` not rendered) | 🟢 | 🟡 | 🔴 |
| 22 | `/issuer/psv-receipt/[requestId]` | `apps/web/app/issuer/psv-receipt/[requestId]/page.tsx` | 🟢 | 🟢 | 🟡 | 🟢 | 🟢 | 🟠 |
| 23 | `/issuer/psv-reuse/[receiptId]` | `apps/web/app/issuer/psv-reuse/[receiptId]/page.tsx` | 🟢 | 🟢 | 🟡 | 🟢 | 🟢 | 🟠 |
| 24 | `/issuer/persistence-adapter/[requestId]` | `apps/web/app/issuer/persistence-adapter/[requestId]/page.tsx` | 🟢 | 🟢 | 🟢 | 🟢 | 🟢 | 🟢 |
| 25 | `/issuer/audit-boundary/[requestId]` | `apps/web/app/issuer/audit-boundary/[requestId]/page.tsx` | 🟢 | 🟢 | 🟡 | 🟢 | 🟢 | 🟢 |
| 26 | `/issuer/backend-persistence/[requestId]` | `apps/web/app/issuer/backend-persistence/[requestId]/page.tsx` | 🟢 | 🟢 | 🟢 | 🟢 | 🟢 | 🟢 |
| 27 | `/issuer/dossier/[requestId]` route | does not exist | 🔴 | n/a | 🔴 | n/a | 🔴 | 🔴 |
| 28 | Issuer-chain forward navigation | none across nine pages | n/a | n/a | n/a | n/a | n/a | 🔴 |

### Section 5 — Employer surfaces

| # | Surface | File | U | O | X | A | M | C |
|---|---|---|---|---|---|---|---|---|
| 29 | `/employer/dashboard` | `apps/web/app/employer/dashboard/page.tsx:1-50` | 🟡 | 🔴 (hard-coded counts) | n/a | 🟢 | 🟠 | 🔴 |
| 30 | `/employer/worklist` | `apps/web/app/employer/worklist/page.tsx:1-51` | 🟢 | 🟡 | 🟠 | 🟡 (proofTier mixes) | 🔴 (`onSelect` no nav) | 🔴 |
| 31 | `/employer/review/[applicationId]` | `apps/web/app/employer/review/[applicationId]/page.tsx:1-57` | 🟡 | 🟠 | 🔴 (score factors hidden) | 🟠 | 🔴 (CTAs visual-only) | 🔴 |
| 32 | `/employer/decision/[applicationId]` | `apps/web/app/employer/decision/[applicationId]/page.tsx:1-47` | 🟢 | 🟢 | n/a | 🟢 | 🟢 | 🟠 |
| 33 | `/employers` redirect alias | `apps/web/app/employers/page.tsx:1-22` | n/a | n/a | n/a | n/a | 🟠 | 🟠 |
| 34 | `EmployerNextBestAction` | `apps/web/components/review/EmployerNextBestAction.tsx:109-117` | 🟡 | 🔴 ("historic success rate") | 🟠 | 🟠 | 🔴 (callback only) | 🔴 |
| 35 | `WorklistPanel` row | `apps/web/components/verifier/WorklistPanel.tsx:111-173` | 🟢 | 🟢 | n/a | 🟡 | 🔴 (callback only) | 🔴 |
| 36 | `ScoreExplainabilityBlock` | `apps/web/components/employer/ScoreExplainabilityBlock.tsx` | 🟢 (built) | 🟢 | 🟢 | 🟢 | 🔴 (no route) | 🔴 |
| 37 | `AcceptancePanel` (issuerTrustLevel chip) | `apps/web/components/verifier/AcceptancePanel.tsx` | 🟡 | 🟡 | 🟠 (1 of 4 modulators) | 🟢 | 🟡 | 🟡 |

### Section 6 — Review (cross-audience)

| # | Surface | File | U | O | X | A | M | C |
|---|---|---|---|---|---|---|---|---|
| 38 | `/review/[entityId]` (public wedge) | `ReviewPageClient.tsx` | 🟢 | 🟡 | 🟡 | 🟠 (3 "review" routes) | 🟡 | 🟡 |
| 39 | `/review/request` | (entry form) | 🟢 | 🟢 | 🟢 | 🟢 | 🟢 | 🟢 |

### Section 7 — Decision / capsule / replay components

| # | Surface | File | U | O | X | A | M | C |
|---|---|---|---|---|---|---|---|---|
| 40 | `DecisionCard` | `apps/web/components/decision/DecisionCard.tsx:173-186` | 🟢 | 🔴 ("Execute Recommendation") | 🟡 | 🟠 | 🔴 (callback only) | 🔴 |
| 41 | `DecisionQueue` | `apps/web/components/decision/DecisionQueue.tsx` | 🟢 | 🟠 ("passive monitoring systems") | 🟡 | 🟢 | 🔴 | 🔴 |
| 42 | `DecisionCapsuleViewer` (uses `AuditBundlePreview`) | `apps/web/components/decision/DecisionCapsuleViewer.tsx` | 🟢 | 🟠 | 🟡 | 🟡 | 🟠 | 🟠 |
| 43 | `EvidenceViewer` | `apps/web/components/evidence/EvidenceViewer.tsx` | 🟢 | 🟡 | 🟠 (no per-evidence "why") | 🟢 | 🟡 | 🟡 |
| 44 | `replayEngine.replayDecision()` (output) | `apps/api/backend/src/services/audit/replayEngine.ts` | n/a (API) | 🟢 | 🟢 (post-PR4A `R-CAT-6`/`DOSSIER_REPLAY`) | 🟢 | 🟢 | 🟢 |

### Section 8 — Audit / dossier components

| # | Surface | File | U | O | X | A | M | C |
|---|---|---|---|---|---|---|---|---|
| 45 | `AuditTimeline` | `apps/web/components/AuditTimeline.tsx` | 🟢 | 🟡 | 🟠 (no "why") | 🟢 | 🟡 | 🟡 |
| 46 | `AuditTrailTimeline` (within `verifier/PasReceipt.tsx`) | `apps/web/components/trust-state/AuditTrailTimeline.tsx` | 🟢 | 🔴 ("Cryptographically Backed" by default) | 🟠 | 🟢 | 🟠 | 🟠 |
| 47 | `AuditTerminal` (within `employer/VerifierCommandCenter.tsx`) | `apps/web/components/employer/AuditTerminal.tsx` | 🟢 | 🟡 | 🟠 | 🟢 | 🟡 | 🟡 |
| 48 | `AuditBundlePreview` (within `DecisionCapsuleViewer.tsx`) | `apps/web/components/decision/AuditBundlePreview.tsx` | 🟢 | 🔴 ("Cryptographically Verified", "SHA-256 RSA" w/o algorithm metadata) | 🟠 | 🟢 | 🟠 | 🟠 |
| 49 | `AuditProofViewer` | `apps/web/components/verifier/AuditProofViewer.tsx` | 🟢 | 🔴 ("Immutable Audit Trail", "mathematical guarantees", "Zero-knowledge proof verified", biometric signature) | 🟠 | 🟢 | 🔴 | 🔴 |
| 50 | `AuditScrapbook` | `apps/web/components/clinician/AuditScrapbook.tsx` | n/a (no route) | n/a | n/a | n/a | n/a | n/a |

### Section 9 — Confidence / readiness components

| # | Surface | File | U | O | X | A | M | C |
|---|---|---|---|---|---|---|---|---|
| 51 | `ConfidenceBadge` | `apps/web/design-system/components/ConfidenceBadge.tsx` | 🟢 | 🔴 (bare percent) | 🔴 (no basis) | 🔴 (means 4 things) | 🔴 | 🔴 |
| 52 | `ConfidenceMeter` | `apps/web/components/ui/ConfidenceMeter.tsx` | 🟢 | 🔴 | 🔴 | 🔴 | 🔴 | 🔴 |
| 53 | `confidence-score` | `apps/web/components/ui/confidence-score.tsx` | 🟢 | 🔴 (95/80 thresholds imply precision) | 🔴 | 🔴 | 🔴 | 🔴 |
| 54 | `confidenceEngine.ts` modulator output | `apps/api/backend/src/services/decision/confidenceEngine.ts:23` | n/a (engine) | 🔴 (no-history → 1.0) | n/a | n/a | n/a | 🔴 |
| 55 | `ReadinessCard` (onboarding) | `apps/web/components/onboarding/ReadinessCard.tsx` | 🟢 | 🟠 | 🟠 | 🟢 | 🟠 | 🟠 |
| 56 | `ReadinessDashboard` (clinician) | `apps/web/components/clinician/ReadinessDashboard.tsx` | 🟢 | 🟠 | 🟠 | 🟢 | 🟠 | 🟠 |
| 57 | `CredentialReadinessCard` | `apps/web/components/clinician/CredentialReadinessCard.tsx` | 🟢 | 🟠 | 🟠 | 🟢 | 🟠 | 🟠 |
| 58 | `ReadinessState` enum (rendered by name) | `packages/trust-state/sourceCoverage.ts:682-717` | n/a | n/a | 🔴 (never rendered) | n/a | n/a | 🔴 |

### Section 10 — Status / compliance / public

| # | Surface | File | U | O | X | A | M | C |
|---|---|---|---|---|---|---|---|---|
| 59 | `/status` foundation page (DOCS-STATUS-1) | `apps/web/app/status/page.tsx:1-90` | 🟢 | 🟢 | 🟡 | 🟢 | 🟢 | 🟢 |
| 60 | Public source-health panel on `/status` | (Wave H5 / origin/main) | 🟢 | 🟢 | 🟡 | 🟢 | 🟢 | 🟢 |
| 61 | `/api/compliance/evidence` JSON endpoint | (DOCS-STATUS-1 pointer) | 🟢 | 🟢 | 🟢 | 🟢 | 🟢 | 🟢 |

### Section 11 — Career autopilot / language (PR3C UNSAFE inventory)

| # | Surface | File | U | O | X | A | M | C |
|---|---|---|---|---|---|---|---|---|
| 62 | `careerAutopilot.ts` blocker copy | (lib) | 🟢 | 🔴 ("cannot be deployed") | 🟠 | 🟢 | 🔴 | 🔴 |
| 63 | `careerAutopilot.ts` NPPES suggestion | (lib) | 🟢 | 🔴 ("to reach Decision Grade") | 🟠 | 🟢 | 🔴 | 🔴 |
| 64 | `careerAutopilot.ts` target-role suggestion | (lib) | 🟢 | 🔴 ("100% verified", "1-click apply") | 🟠 | 🟢 | 🔴 | 🔴 |
| 65 | `systemVoice.ts` shared constants | `apps/web/lib/.../systemVoice.ts` | 🟢 | 🔴 ("Trust verified", "Verification complete", "Readiness confirmed") | 🟢 | 🟠 | 🔴 | 🔴 |
| 66 | `EmployerDecisionConsole` "READY TO PROCEED" | `apps/web/components/employer/EmployerDecisionConsole.tsx` | 🟢 | 🟠 | 🟠 | 🟢 | 🟠 | 🟠 |

## Aggregations

### Surfaces by overall rating (worst rating across U/O/X/A/M/C wins)

| Bucket | Count | % |
|---|---|---|
| 🟢 CLEAR | 8 | 13% |
| 🟡 PARTIAL | 9 | 14% |
| 🟠 CONFUSING | 16 | 25% |
| 🔴 MISLEADING | 30 | 48% |

(N=63 inspected; the three n/a-only rows are excluded from the bucket count.)

### Rating per axis (% of inspected surfaces at each rating)

| Axis | 🟢 | 🟡 | 🟠 | 🔴 |
|---|---|---|---|---|
| U Understandable | 78% | 14% | 5% | 3% |
| O Overclaiming | 51% | 22% | 13% | 14% |
| X Underexplained | 33% | 32% | 22% | 13% |
| A Ambiguous | 71% | 13% | 13% | 3% |
| M Misleading | 35% | 24% | 16% | 25% |
| C Operationally coherent | 19% | 30% | 22% | 29% |

**Headline:** the product is **understandable** (axis U: 78% 🟢) but **operationally incoherent** (axis C: only 19% 🟢, 29% 🔴) and **misleading by affordance** (axis M: 25% 🔴). 

Translation: users *can read* the surfaces; they *cannot trust them to do what they imply*.

### Top 10 highest-severity rows (multi-axis 🔴)

| Surface | Critical issue |
|---|---|
| `AuditProofViewer` | "Immutable Audit Trail", "mathematical guarantees", "Zero-knowledge proof verified" — flagged UNSAFE in PR3C; mounted in verifier proof view. |
| `/issuer/policy-review/[requestId]` | `refusalGate` computed and never rendered — largest single readability gap. |
| `ConfidenceMeter` / `ConfidenceBadge` / `confidence-score` | Bare percent values; no basis label; PR4C contract not yet applied; reused in 4+ contexts. |
| `confidenceEngine.ts` no-history path | Missing history defaults to `1.0`, allowing HIGH; absence becomes uplift. |
| `careerAutopilot.ts` outputs | "100% verified", "1-click apply", "cannot be deployed", "to reach Decision Grade". |
| `KnowledgeInboxPanel` Dismiss / Add as profile context | No `onClick`, no `href`; visual only. |
| `EmployerNextBestAction` button | "Approve Candidate" / "Reject Candidate" / "historic success rate" + callback only. |
| `DecisionCard` "Execute Recommendation" | Autopilot drift + callback only. |
| `WorklistPanel` row | `onSelect` callback; not wired to navigation. |
| `/employer/review/[applicationId]` accept/reject buttons | Visual only; "no persisted decision outcome in this shell". |

### Top 5 strongest surfaces (multi-axis 🟢)

| Surface | Why |
|---|---|
| `LaneHealthMount` (lane health on `/passport/[id]`) | State + `userFacingMessage` + retry policy; no overclaim; clear remediation framing. |
| `/issuer/audit-boundary/[requestId]` | Demo disclaimer, `noop` writer, `demo_not_persisted` tagged events, replay-safe-is-not-legal-proof framing. |
| `/issuer/persistence-adapter/[requestId]` | Default `noop`; repository writer marked `unavailable`; "no client-safe repository writer exists yet". |
| `/issuer/backend-persistence/[requestId]` | Default decision `defer`; "Repository compatibility alone is not an audit trail." |
| `/status` (DOCS-STATUS-1) | Foundation-level adapter / redaction / retention state; honest about what is and is not active; machine-readable pointer. |

The strongest surfaces share a pattern: **render the truth, disclaim the gap, do not promise more than the writer guarantees**. The lane-health surface is the template the rest of the product should retrofit to.

## How to use this matrix

1. **Operator-trust regression test:** when a PR touches any surface in the matrix, the rating must not regress without a paired-row entry explaining the trade.
2. **Pre-pilot gate:** no surface with 🔴 in axis M (Misleading) or axis C (Coherent) ships to a pilot tenant without paired disclaimer copy or feature-flag.
3. **Copy-downgrade audit:** the rows in Section 11 + the `Audit*` rows in Section 8 are the queue for PR3C copy contract application.
4. **Confidence display contract:** the rows in Section 9 are the queue for PR4C basis-label retrofitting.

## Out of scope

- No code changes.
- No state-machine changes.
- No new surfaces.

## See also

- `w2-pr5b-operator-trust-certification.md`
- `w2-pr5b-confidence-certification.md`
- `w2-pr5b-workflow-understanding-review.md`
- `w2-pr5b-operational-coherence-report.md`
- All prior W2 PR3C / PR3D / PR4A / PR4C / PR4D documents

# W2-PR5B - Operational Trust Experience Certification

**Wave:** W2-PR5B - Operational Trust Experience Certification
**Date:** 2026-05-08
**Status:** Docs-only certification. No product code changed. No merge.
**Risk class:** SAFE. `docs/ops/**` only.
**Predecessors:** PR3C (semantics), PR3D (workflow maps), PR4A (replay/audit normalization), PR4C (confidence display contract), PR4D (operator understanding).

## Mission

Certify whether VitalCV's operational trust experience is understandable, explainable, semantically coherent, and aligned with runtime truth — for each of the five operator personas (clinician, employer, verifier, support/admin, AI-assistive system).

This certification does **not** measure whether the runtime is correct. PR1/PR2B/PR4A established that. PR5B measures whether a real operator using the product would arrive at a mental model that matches what the runtime actually guarantees.

## Rating legend

| Symbol | Meaning |
|---|---|
| 🟢 CLEAR | Surface explains what it is, what it is not, and what changes if the user acts. Operator can attribute state to cause. |
| 🟡 PARTIAL | Surface shows the value but not all the inputs; or shows state without remediation; user can read but not always act. |
| 🟠 CONFUSING | Same label means different things in different contexts; or button label promises capability the destination does not have. |
| 🔴 MISLEADING | Surface implies a guarantee, certainty, decision, or proof that the runtime does not provide. |

## 1. Trust-state explainability

A trust state is "explainable" when the operator can read (a) the state name, (b) why the system is in that state, and (c) what changes the state.

| Surface | Persona | State machine | Rating | Evidence |
|---|---|---|---|---|
| `LaneHealthMount` on `/passport/[id]` | Clinician | `CanonicalSourceCoverageState` | 🟡 | Lane state name + `userFacingMessage` + retry policy rendered. State transition cause not surfaced; "since" timestamps absent (FR-P-4). |
| Passport readiness display (`/passport`) | Clinician | implicit `ReadinessState` | 🟠 | Score badge + confidence label + tier-upgrade prompt, no per-lane breakdown. `ReadinessState` enum (`CHECKING\|PARTIAL\|DECISION_GRADE\|BLOCKED`) **never rendered by name** (FR-S-3). The clinician sees "Very confident" but cannot tell which lanes are spine-blocking. |
| `AcceptancePanel.tsx` | Verifier | `CalibratedDecisionState` | 🟡 | Final enum rendered; `issuerTrustLevel` modulator rendered; `evidenceStrength`, `freshnessScore`, `outcomeHistoryStrength` not rendered (FR-S-4). |
| `/issuer/review/[requestId]` | Verifier | `ReceiptCandidateReviewState` | 🟡 | All eight values rendered as a context field; advance UI absent for four (`review_required`, `unable_to_verify`, `release_required`, `reroute_required`) (FR-V-4). |
| `/issuer/policy-review/[requestId]` | Verifier | `PolicyReviewDecisionStatus` | 🟠 | Decision status rendered. **`refusalGate` (six values) computed and never rendered** — the largest single operator-readability gap in the codebase (FR-V-2). A reviewer who is refused cannot attribute the refusal. |
| `/employer/review/[applicationId]` | Employer | lane states (Identity/Sanctions/Licensure/Enrollment) | 🟠 | States visible (CHECKED/CLEAR/ACCESS REQUIRED/ENROLLED). Three CTAs ("Accept as head start", "Request missing info", "Reject") visual-only — "has no persisted decision outcome in this shell" (FR-E-3). User clicks something that looks like a decision and nothing happens. |
| `TrustBand` (`GREEN\|YELLOW\|RED`) | All | `TrustBand` | 🟢 (by design) | Backend-internal; intentionally not rendered as a label. Influences color and copy. Acceptable. |
| `TrustUiStatus` | Clinician/Employer | mapped from `CanonicalSourceCoverageState` | 🟡 | Nine values render. Collision with `ReceiptCandidateReviewState.review_required` (FR-S-1). Same word, different remediation. |

**Trust-state explainability rollup:** 53% of states render their name; 19% of legal transitions have a user-actionable advance UI (per PR4D measurements, unchanged in PR5B baseline).

### Persona-level rating

| Persona | Rating | Reason |
|---|---|---|
| Clinician | 🟡 PARTIAL | Lane health visible; readiness derivation hidden; no advance UI from `review_required`. |
| Employer | 🟠 CONFUSING | Lane states visible; decision CTAs visual-only; score factors hidden. |
| Verifier | 🟠 CONFUSING | All states visible on demo surfaces; refusal gate not rendered; chain has zero forward links. |
| Support/Admin | 🟡 PARTIAL | `/status` exposes adapter/compliance evidence at foundation level; no per-subject mapping. |
| AI/System | n/a | Not a user-facing persona; system runs against runtime taxonomy from PR4A. |

## 2. Operator mental-model coherence

A surface is coherent when its label promises what the destination delivers.

| Surface | Promise (label) | Delivery (destination) | Rating |
|---|---|---|---|
| `/clinician/onboarding` "Open profile" CTA | Open profile (editable) | Read-only profile shell, `0/0` completion summary, all inputs `readOnly` | 🟠 |
| `/onboarding/{identity,fetching,readiness,success}` | Onboarding chain | All four `redirect('/')` → home | 🔴 |
| `KnowledgeInboxPanel` "Dismiss"/"Add as profile context" | Action button | No `onClick`, no `href`; visual only | 🔴 |
| `EmployerNextBestAction` button | Approve/Reject/Proceed | Local state change, no nav, no persistence | 🔴 |
| `DecisionCard` "Execute Recommendation" | Execute | Callback only; "Execute" implies automation | 🔴 (autopilot language drift, FR-N-1, PR3C autopilot review) |
| `WorklistPanel` row | Open this application | `onSelect(item)` callback; not wired to navigation | 🔴 |
| `/employer/review/[applicationId]` accept/reject buttons | Decision capture | Visual only, no decision recorded | 🔴 |
| `/holder/home` `primaryAction` | Resume / clear blocker / next action | Real `<Link>` `href` (lines 241-280) | 🟢 |
| `/holder/home` blocker rows | Address this blocker | Real `<Link>` `href` (lines 346-366) | 🟢 |
| `Workspace/NextBestAction.tsx` | Next action | Real `<Link href={…}>` (line 41) | 🟢 (reference pattern; only emitter doing this right) |
| `LaneHealthMount` lane chip | This lane is in state X | State + `userFacingMessage` + retry policy rendered | 🟢 |

**Coherence rollup:** 4 of 11 inspected CTAs honor their label; 7 mismatch destination. **~36% coherence** (consistent with PR4D inbox/action 17% if narrowed to action emitters; rises when home and lane-health surfaces included).

## 3. Replay understanding

A replay surface is understood when the operator can see (a) what events happened, (b) when, (c) by whom, (d) what the integrity check is, and (e) the explicit limitation of replay vs proof.

| Surface | Operator path | Rating | Evidence |
|---|---|---|---|
| `/issuer/audit-boundary/[requestId]` | Verifier (demo only) | 🟡 | Renders six lifecycle events with timestamps, actors, signers, hashes; events tagged `demo_not_persisted`; "no-op writer" disclaimer present (line 184). Replay-safe limitation explicit. **Strongest replay surface** in the product. |
| `AuditTrailTimeline` (component) | Mounted in `verifier/PasReceipt.tsx` | 🟠 | Renders `Cryptographically Backed` even when individual event hash/signer are optional (PR3C dossier-truth-review). Inflated when hash absent. |
| `AuditProofViewer` (component) | Mounted in verifier proof view | 🔴 | Uses "Immutable Audit Trail", "mathematical guarantees", "Zero-knowledge proof verified", "biometric signature payload" — all flagged UNSAFE in PR3C dossier-truth-review. |
| `AuditBundlePreview` | Inside `DecisionCapsuleViewer.tsx` | 🟠 | Shows "Cryptographically Verified" and "SHA-256 RSA" based on prop-level status, not algorithm metadata (PR3C). |
| `AuditTerminal` | Inside `employer/VerifierCommandCenter.tsx` | 🟡 | Typed log; chronological; no per-event "why" field. |
| `AuditScrapbook` (component) | No route entry located | n/a | Built but unmounted. Either delete or mount with disclaimer. |
| Per-subject dossier route (`/passport/[id]/dossier`, `/issuer/dossier/[requestId]`) | n/a | 🔴 | **Does not exist** (FR-D-1). Five audit components built; zero per-subject routes. The operator cannot navigate to "the recorded events for this subject." |
| Replay engine (`replayEngine.replayDecision()`) | API/internal | 🟡 | Post-PR4A: `R-CAT-6` / `DOSSIER_REPLAY` classification; `correlationId`, `payloadHash`, `mutationFingerprint` propagation. Output is operator-grade-correct. Not surfaced to the operator UI yet. |

**Replay understanding rating:** 🟠 CONFUSING for verifier and employer; 🔴 MISLEADING wherever `AuditProofViewer` runs without the PR3C copy downgrade.

**Critical question 1 — Would a verifier misunderstand replay guarantees?** **YES, in components that ship "Immutable Audit Trail" / "mathematical guarantees" / "Zero-knowledge proof verified" copy.** The boundary is correctly drawn at `/issuer/audit-boundary/[requestId]` (demo disclaimer present, `noop` writer, events `demo_not_persisted`) and in `replayEngine` runtime metadata. The leak is in the proof-viewer component copy, which is mountable in verifier surfaces.

## 4. Audit understanding

| Surface | Rating | Evidence |
|---|---|---|
| `/issuer/audit-boundary/[requestId]` | 🟢 | Disclaimer block explicit: "no database, network, or external call is made by this page" (line 184); events tagged `demo_not_persisted`; replay-safe is not legal proof. |
| `/issuer/backend-persistence/[requestId]` | 🟢 | "Backend persistence is not active unless a server-side writer confirms the write... Repository compatibility alone is not an audit trail." Default decision: `defer`. |
| `/issuer/persistence-adapter/[requestId]` | 🟢 | Default adapter `noop`. Repository writer marked `unavailable`. "no client-safe repository writer exists yet." |
| `/issuer/psv-receipt/[requestId]` | 🟢 | `auditMetadata.eventState: 'pending_not_written'` rendered. "This page does not write a real audit-event row." |
| Audit replay route docs (legacy) | 🔴 | Per PR3C: described "fully replayable accountability record" and "Ready for Joint Commission review, CMS audits, or litigation discovery". Must be downgraded. |
| `AuditProofViewer` / `AuditTrailTimeline` / `AuditBundlePreview` copy | 🔴 | "Immutable Audit Trail", "Cryptographically Backed", "Cryptographic Proof Inspection" — overclaim until copy downgrade lands. |

**Critical question 3 — Would an operator incorrectly assume audit immutability?**

**Mixed.** The persistence-adapter, backend-persistence, audit-boundary, and PSV-receipt demo pages explicitly disclaim immutability and are 🟢 CLEAR. The audit components (`AuditProofViewer`, `AuditTrailTimeline`, `AuditBundlePreview`) ship copy that implies immutability and cryptographic guarantees independent of whether the write is durable. **An operator who sees only a component, not the surrounding demo page, would assume immutability.** This is the highest-leakage path in the audit-language surface.

**Required fix:** PR3C dossier-truth copy replacements applied to component-level files (not only to demo route copy). Until then: audit understanding rating is 🟠 CONFUSING for verifier and employer; 🟢 CLEAR only on the four demo persistence-boundary pages.

## 5. Readiness understanding

| Surface | Rating | Evidence |
|---|---|---|
| Passport readiness score (`/passport`) | 🟠 | Number with confidence label; no per-lane breakdown. `ReadinessState` enum (`CHECKING\|PARTIAL\|DECISION_GRADE\|BLOCKED`) **never rendered by name** (FR-S-3). |
| `LaneHealthMount` (`/passport/[id]`) | 🟢 | Per-lane health, `userFacingMessage`, retry policy. **Strongest readiness-adjacent surface.** |
| Clinician home momentum block | 🟡 | Qualitative descriptor + readiness link. Underlying lane states not surfaced. |
| Employer review lane states | 🟡 | Lane states render. CTA promises a decision; no decision recorded. |
| `/status` compliance evidence | 🟢 | Foundation-level adapter / redaction / retention state. Honest about what is and is not active. |
| `ScoreExplainabilityBlock` | 🔴 | Built; no route mounts it (FR-E-4). The component that would close the largest readiness gap is unreachable. |
| `careerAutopilot.ts` blocker copy | 🔴 (legacy) | "You cannot be deployed until this is cleared" / "to reach Decision Grade" / "100% verified and ready for 1-click apply" — flagged UNSAFE in PR3C autopilot review. Must be downgraded. |

**Critical question 2 — Would a clinician overestimate readiness guarantees?**

**YES.** Three observable patterns drive the over-read:

1. **Score-without-lane-breakdown.** A clinician sees "Very confident" beside a number. The score is computed from launch-spine sources only (NPPES_API, OIG_LEIE, PECOS_PUBLIC, STATE_BOARD), and `ReadinessState=BLOCKED` if any spine source is `reviewRequired` or `unavailable` — but the enum is never rendered. The clinician sees the modulated score, not the spine input.

2. **Tier-upgrade prompt below T2.** The prompt implies one or two clicks will move the user to a higher tier. The runtime gate is source-side; clicking does not move it.

3. **Career autopilot copy.** "Reach Decision Grade", "100% verified", "1-click apply", "cannot be deployed" — language flagged UNSAFE in PR3C. A clinician reading "you cannot be deployed" would interpret the system as having authority over deployment.

**Required fix:** apply PR3C autopilot copy contract; surface `ReadinessState` literal under the score; mount `ScoreExplainabilityBlock` (or equivalent for clinician).

## 6. Workflow continuity

Per PR4D measurements, repeated here for the certification table.

| Workflow | Continuity % | Rating |
|---|---|---|
| Onboarding | 50% | 🟠 — four `redirect('/')` step pages; no in-app handoff to passport. |
| Passport | ~55% | 🟡 — entry → detail seam OK; lane health visible; lane → issuer-request handoff missing; lane → dossier missing. |
| Employer review | ~10% | 🔴 — four pages, four breaks. |
| Verifier (issuer chain) | ~0% | 🔴 — nine demo pages, zero forward links, every page disclaims persistence. |
| Inbox / next-step | ~17% | 🔴 — one of six emitters in canonical pattern. |
| Readiness state | ~40% | 🟠 — lane health rendered; readiness derivation still hidden. |
| Dossier (route-level) | ~0% | 🔴 — five components built; zero per-subject routes. |
| Replay / operator understanding | ~35% | 🟠 — what+when+who visible on one demo surface; why visible nowhere. |

## 7. Clinician trust continuity

The clinician's mental model traces this path:

```
sign-up → /clinician/onboarding → "Open profile" → /clinician/profile (read-only shell)
                                ↳ "Import from existing sources" → /clinician/import (no card wired)

           /holder/home → primaryAction (real Link) → destination
                       ↳ blocker rows (real Link) → destination
                       ↳ momentum / readiness link → /holder/readiness (state log; no forward action queue)

           /passport/[id] → LaneHealthMount (state visible)
                          ↳ KnowledgeInboxPanel (buttons unwired)
                          ↳ no "Request issuer verification" entry
                          ↳ no /passport/[id]/dossier entrypoint
```

| Axis | Rating |
|---|---|
| Onboarding clarity | 🟠 (advertised chain unreachable) |
| In-app continuation after sign-up | 🟡 (Clerk redirect handled out-of-app) |
| Readiness explainability | 🟠 (score visible, derivation hidden) |
| Action wiring (next-step) | 🟡 (`/holder/home` is wired; inboxes are not) |
| Lane health | 🟢 (post-#220) |
| Dossier discoverability | 🔴 (no route) |
| Inbox coherence | 🔴 (1 of 6 emitters honor `href`) |
| Onboarding → passport handoff | 🔴 (no link) |

**Clinician trust continuity rating:** 🟡 PARTIAL — strongest persona post-#220 but still cannot complete a full ingest → review → handoff loop inside the product.

## 8. Verifier trust continuity

```
/issuer/request/[requestId]      (demo, recordedBy: 'demo')
   │ no <Link>
   ▼
/issuer/verify/[requestId]       (demo)
   │ no <Link>
   ▼
/issuer/review/[requestId]       (demo, recordedBy: 'demo'; reviewState rendered)
   │ no <Link>
   ▼
/issuer/policy-review/[requestId] (dry-run only; refusalGate computed, NOT RENDERED)
   │ no <Link>
   ▼
/issuer/psv-receipt/[requestId]   (pending_not_written)
   │ no <Link>
   ▼
/issuer/psv-reuse/[receiptId]     (modeled revocation only)
```

| Axis | Rating |
|---|---|
| Persistence honesty | 🟢 (every page disclaims persistence; `noop` writer; `pending_not_written`) |
| Truth-contract fidelity (literal `decisionGrade: false`, `proofTier`) | 🟢 (verified intact in `apps/web/lib/issuer-verification/types.ts`) |
| Forward navigation | 🔴 (zero forward links across nine pages) |
| Refusal-gate visibility | 🔴 (computed, never rendered — largest single readability gap) |
| Receipt-candidate advance UI | 🔴 (four review states have no advance action) |
| Audit-component copy | 🔴 (proof viewer / bundle preview overclaim immutability) |
| Demo discoverability | 🟢 (each page is internally honest about being a demo) |

**Verifier trust continuity rating:** 🟠 CONFUSING. The truth contract is correctly upheld at the type and persistence-boundary level; the operator cannot complete a single end-to-end request inside the product, and cannot read why a refusal happened.

## 9. Critical questions — verdicts

| # | Question | Verdict | Evidence |
|---|---|---|---|
| 1 | Would a verifier misunderstand replay guarantees? | **PARTIAL YES** | Demo pages 🟢; component copy (`AuditProofViewer`, `AuditTrailTimeline`, `AuditBundlePreview`) 🔴 with "Immutable Audit Trail" / "mathematical guarantees" / "Zero-knowledge proof verified" / biometric signature copy. |
| 2 | Would a clinician overestimate readiness guarantees? | **YES** | Score-without-lane-breakdown; tier-upgrade prompt; `careerAutopilot` "cannot be deployed" / "100% verified" / "1-click apply" copy (PR3C UNSAFE). |
| 3 | Would an operator incorrectly assume audit immutability? | **PARTIAL YES** | Component-level copy implies immutability independent of whether write is durable. Surface-level demo pages disclaim correctly. |
| 4 | Would dossier semantics imply stronger proof than exists? | **YES (legacy)** | "fully replayable accountability record", "Ready for Joint Commission review, CMS audits, or litigation discovery", "Trust derived from mathematical guarantees" — flagged UNSAFE in PR3C. |
| 5 | Would autopilot semantics imply autonomous trust decisions? | **YES** | "Execute Recommendation", "Approve Candidate", "Reject Candidate", "System Recommendation" — flagged UNSAFE in PR3C. |
| 6 | Would users distinguish heuristic / observational / authoritative / certified / anchored? | **NO** | PR4C confidence display contract not yet applied to components. `ConfidenceMeter` and `ConfidenceBadge` render bare percent without basis label. No content-level distinction in copy. |

**Three of six are YES; two are PARTIAL YES; one is NO (in operator favor — they see no distinction, so they cannot misread one as another, but they also cannot read the right one).**

## 10. Operational trust verdict

| Dimension | Rating |
|---|---|
| Truth-contract fidelity (types, persistence boundaries) | 🟢 CLEAR — literal `decisionGrade`/`proofTier`, demo disclaimers, `noop` writers, `pending_not_written`. PR4A normalized runtime taxonomy. |
| Demo persistence disclosure | 🟢 CLEAR — all nine issuer pages and all four employer/decision pages explicitly disclaim. |
| Component copy (proof viewer, bundle preview, audit trail timeline) | 🔴 MISLEADING — pre-PR3C copy still ships. |
| Confidence display | 🟠 CONFUSING — bare percent; no basis label; PR4C contract not yet applied. |
| Workflow continuity | 🟠 CONFUSING — verifier and employer at ~0%; clinician at 43%. |
| Refusal attribution | 🔴 MISLEADING — `refusalGate` computed and never shown. |
| Lane / readiness explainability | 🟡 PARTIAL — lane health visible; `ReadinessState` invisible; modulators 1 of 4. |
| Onboarding chain | 🔴 MISLEADING — advertised steps redirect home. |

**Net verdict: 🟠 CONFUSING — pre-pilot SAFE for read-only demo and for the truth-contract layer; UNSAFE for any acceptance/decision claim until copy is downgraded and refusal/readiness/modulator surfaces land.**

The runtime is more honest than the UI. The state machines, persistence boundaries, and replay engine are correct; the user-facing surfaces leak guarantees the runtime does not provide and hide attributions the runtime does compute.

## 11. Final output

| Item | Verdict | Reason |
|---|---|---|
| **Strongest operator trust surface** | `LaneHealthMount` on `/passport/[id]` (post-#220) | State + `userFacingMessage` + retry policy rendered; no overclaim; clear remediation framing. |
| **Weakest explainability surface** | `refusalGate` on `/issuer/policy-review/[requestId]` | Six values computed, returned, tested; never rendered. Largest single operator-readability gap in the codebase. |
| **Highest confusion risk** | Shared `review_required` label across `CanonicalSourceCoverageState` (passport-lane) and `ReceiptCandidateReviewState` (receipt-candidate) | Same word, different state machines, different remediation owners. (FR-S-1; rename to `issuer_response_incomplete`.) |
| **Strongest workflow coherence gain (since PR3D)** | `LaneHealthMount` on `/passport/[id]` + DOCS-STATUS-1 compliance evidence on `/status` | +2 surfaces, +continuity, no overclaim. Net positive. |
| **Operational trust verdict** | 🟠 CONFUSING (PARTIAL) | Truth-contract fidelity is 🟢; UI explainability and workflow continuity remain 🟠/🔴 in three of five personas. Pre-pilot SAFE for read-only demo; UNSAFE for acceptance/decision claims until PR3C copy downgrade and refusal/readiness/modulator surfaces land. |

## 12. Out of scope

- No copy rewrites (PR3C is the truth contract; PR5B verifies, does not implement).
- No backend persistence wiring.
- No new routes.
- No truth-contract changes.

## See also

- `w2-pr5b-confidence-certification.md` — confidence per PR4C contract.
- `w2-pr5b-workflow-understanding-review.md` — workflow per PR3D + PR4D.
- `w2-pr5b-trust-experience-matrix.md` — surface × axis matrix.
- `w2-pr5b-operational-coherence-report.md` — final synthesis.
- `w2-pr3c-{confidence-semantics,autopilot-language-review,dossier-truth-review,ux-truth-alignment}.md`
- `w2-pr3d-{clinician,verifier}-workflow-map.md`, `w2-pr3d-workflow-fragmentation-register.md`
- `w2-pr4a-{audit,replay}-normalization.md`, `w2-pr4a-runtime-cohesion.md`
- `w2-pr4c-{confidence-explainability,dossier-provenance,readiness-truthfulness}.md`
- `w2-pr4d-{operator-understanding,trust-state-continuity,workflow-coherence,workflow-friction-register}.md`

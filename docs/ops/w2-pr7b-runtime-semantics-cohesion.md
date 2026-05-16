# W2-PR7B — Runtime Semantics Cohesion

**Wave:** W2-PR7B — Trust-State Operational Cohesion
**Date:** 2026-05-08
**Status:** Review-only. No code changes, no merges.
**Risk class:** SAFE (read-only synthesis).
**Companion to:** [w2-pr7b-trust-state-topology.md](w2-pr7b-trust-state-topology.md).

---

## Question

Do four runtime semantic systems — UI, audit, replay, and runtime — agree on what each state *means*, or are they running on subtly different definitions?

## Method

For each state family in the topology, walk the four channels and look for: same name / same shape, same name / different shape, different name / same shape, and outright trust inflation.

## Channel inventory

| Channel | Where it lives | Authoritative source |
|---|---|---|
| **UI semantics** | passport, issuer review, policy review, status, employer dashboard | `statusCopy.ts`, `LaneHealthBadge.tsx`, `live-path/contracts.ts`, `passport/page.tsx`, `status/page.tsx` |
| **Audit semantics** | `AuditEvent` rows, denial rows, outbox events | `auditEventTypes.ts`, `employerReviewActions.ts`, `auditPersistence.ts` |
| **Replay semantics** | `DecisionReplay` output, `replayMetadata` | `replayEngine.ts`, `runtimeTrustCohesion.ts` |
| **Runtime semantics** | request handlers, route gates, service-level mutation calls | `employerActions.ts`, `policyReview.ts`, `psvReceipt.ts`, `runtimeTrustCohesion.ts` |

## State-family alignment

### Confidence (receipt candidate → PSV receipt candidate → PSV receipt)

| Channel | Representation |
|---|---|
| UI | `proofTier` rendered as descriptive copy (e.g., "Pending policy review", "Accepted as PSV receipt candidate", `statusCopy.ts:171-209`); never bare "Verified" |
| Audit | `proofTier` literal carried in candidate / decision / receipt payload; audit metadata default `pending_not_written` |
| Replay | not directly emitted; `trustStateAtDecision` is a separate snapshot |
| Runtime | literal types (`'receipt_candidate' \| 'psv_receipt_candidate' \| 'psv_receipt'`); `decisionGrade` is `false` literal except on `PSVReceipt` |

**Verdict: cohesive.** The literal types in `domain-common` flow unchanged through audit and runtime; UI labels are 1:1 mapped from the same enums. No inflation.

### Readiness

| Channel | Representation |
|---|---|
| UI | `ReadinessStatus` (`DECISION_GRADE / CHECKING / BLOCKED / PARTIAL`) → resolved via `resolveLivePathReadinessStatus()` to `VdsTrustStatus` (`checked / pending / blocked`) + numeric score |
| Audit | not directly recorded as a discrete event; flows through trust-state-engine artifacts |
| Replay | surfaces as `trustStateAtDecision.readinessLevel \| trustBand` (with `'UNKNOWN'` fallback at `replayEngine.ts:354`) |
| Runtime | computed by source-coverage logic; gate condition for employer-review acceptance (`PassportState.readiness === READY`) |

**Verdict: partially cohesive.** Three concerns:
1. UI compresses 4 states into 3 visual buckets — `BLOCKED` and `CHECKING` are distinct in code but `CHECKING` and `PARTIAL` both render as `pending`. The compression is intentional but loses fidelity.
2. The status badge can be **score-driven** when no explicit status is set (`passport/page.tsx:673-677`): score ≥ 70 → green, ≥ 40 → yellow. A `BLOCKED` status with high score still receives a yellow visual — code is correct but composed.
3. Acceptance gate uses `READY` (a derived enum value), while replay carries the raw `readinessLevel`. They are aligned today but live in different files; a future widening of one without the other is a real risk.

### Provenance / lane health

| Channel | Representation |
|---|---|
| UI | `SourceHealthState` 1:1 with badge label and color (`LaneHealthBadge.tsx:18-40`) |
| Audit | not emitted as state-transition events; only `MONITORING_STATUS_CHANGE` (information-only) per `auditEventTypes.ts:18` |
| Replay | not present; replay records evidence and trust-state at decision, not source health at decision |
| Runtime | per-source snapshots queried at request time |

**Verdict: cohesive in UI, decoupled elsewhere.** Lane health is intentionally not a trust-state input; this is the right call (operational health is not provenance). The decoupling is honest, not a fragmentation.

### Mutation / runtime trust

| Channel | Representation |
|---|---|
| UI | none (operator surfaces don't show R-CAT or `RuntimeMutationClassification`) |
| Audit | normalized via `runtimeTrustCohesion.ts`: `replayCategory`, `mutationClassification`, `correlationId`, `payloadHash`, `mutationFingerprint` written into every employer-review mutation row |
| Replay | preserves upstream `correlationId / payloadHash / mutationFingerprint`; replays always emit R-CAT-6 / `DOSSIER_REPLAY` |
| Runtime | shared helper invoked by both route handlers and service writers (per W2-PR4A) |

**Verdict: cohesive across audit, replay, runtime; absent in UI.** This is the strongest cohesion gain in W2: one taxonomy, one helper, one replay-stable hash. The absence in UI is appropriate — operators don't need R-CAT codes — but the lack of any user-facing replay surface means the cohesion is invisible to the operator.

### Audit-write status

| Channel | Representation |
|---|---|
| UI | not surfaced |
| Audit | every event row carries `eventState` / write-status; `pending_not_written` is the default |
| Replay | replay reads from whatever rows exist — no separate write-status awareness |
| Runtime | adapter selection (`noop / repository_enabled / external`) decides whether to write |

**Verdict: cohesive in code, invisible to operator.** Per [knowledge graph](../architecture/vitalcv-knowledge-trust-graph.md) nodes 72–75 and 82–84, the default decision is `defer_until_contract_aligned`; the system honors this. But an operator looking at any UI today cannot tell whether a given trust event was actually persisted. This is a continuity gap, not a contract violation.

### Denial

| Channel | Representation |
|---|---|
| UI | none yet (no operator surface for denial inspection) |
| Audit | unified event type `EMPLOYER_REVIEW_MUTATION_DENIED` with three `denial_reason` payload values |
| Replay | denials are normal audit rows; `replayMetadata.outcome === 'denied'` distinguishes |
| Runtime | three gates in `employerActions.ts` map to the three denial reasons |

**Verdict: cohesive at the audit row, granularity-collapsed at the event-type level.** A denial-count metric grouped by `event.type` reads `EMPLOYER_REVIEW_MUTATION_DENIED = N` — the three reasons are inside the row, not in the type. This is intentional (one taxonomy) but biases reporting toward generic denial counts unless aggregators always group by reason.

## Cross-cutting findings

### Semantic mismatches

1. **"Review" overloaded.** `EMPLOYER_REVIEW_ROUTED_TO_REVIEW` (push to HITL queue) vs `ReceiptCandidateReviewState='review_required'` (candidate-side gate). UI copy in `statusCopy.ts` distinguishes them, but a fast scan of audit logs without channel context conflates the two.
2. **Two refusal vocabularies.** Issuer side: `refusalGate` literal (`action_does_not_create_candidate / wrong_office_cannot_create_candidate / unable_to_verify_cannot_create_candidate / conflict_review_unresolved / review_state_not_ready / legally_only_requires_limitation_note`). Employer side: `denial_reason` (`already_accepted / passport_unavailable / acceptance_blocked`). Same operational shape (gate-fired refusal), no unified namespace.
3. **`unable_to_verify` is both a response and a state.** As `IssuerResponseStatus` it is what the issuer said. As `ReceiptCandidateReviewState` it is a terminal candidate state. Code distinguishes; copy sometimes blurs them.

### Trust inflation

Re-checked the CLAUDE.md banned-strings list against current copy across `statusCopy.ts`, `LaneHealthBadge.tsx`, `passport/page.tsx`, `status/page.tsx`, `claim-badge.tsx`, employer review surfaces:

- `automatically verified` — not present
- `guaranteed verification` — not present
- `complete credentialing` — not present
- `instant credentialing` — not present
- `legally accepted` — not present
- `risk transferred` — not present
- `final verification without review` — not present
- `source confirmed before response` — not present
- `certified compliant` — not present
- `HIPAA compliant` — not present
- `SOC2 certified` — not present
- bare `Verified` as status label — not present (the `case "Verified"` in `passport/page.tsx:152` resolves to internal `surfaceState`, not user-facing copy)

**No trust inflation observed.** Two adjacent terms are scoped properly: `Electronically Verified` and `Primary Source Verified` are claim-classification labels (`claim-badge.tsx`), `PSV Verified` in `WalletDashboard.tsx` is correctly scoped to PSV.

### Ambiguity vectors

1. **Composed status badge** (`passport/page.tsx:673-677`). Score and status independently drive color; a high score on a `BLOCKED` status produces a yellow badge. Engineering-correct, operator-confusing.
2. **`pending_not_written` vs `demo_not_persisted`.** Both read as "not durable" to an operator, but they mean different things (no writer attempted vs writer ran in demo mode). Surface today: none. Risk: when a UI is added, copy must distinguish.
3. **Replay metadata always carries R-CAT-6.** Reading replay output, the `replayCategory` field on the replay envelope is unconditionally R-CAT-6, while inside the replayed action's recorded metadata you'll find R-CAT-1…5. A consumer that doesn't notice the nesting will mis-classify everything as dossier replay.

### Explainability gaps

1. **No surface explains "what is recorded vs reconstructed."** A replay output mixes both. An operator asking "did anyone record this lab three months ago, or did the engine derive it?" has no UI answer.
2. **No surface explains audit-write status.** "Did this audit event actually get persisted?" is a critical operator question and there is no answer in any current screen.
3. **No surface explains denial granularity.** "Why was this acceptance denied?" can only be answered by reading the audit row payload directly.

These three gaps are the natural unfinished-edge of W2: the cohesion plumbing is in place, but there is no operator UI for the plumbing yet.

## Verdict

UI / audit / replay / runtime are **structurally aligned** — the same literal types flow through them, the runtime trust cohesion service unifies mutation taxonomy, and no banned-string violations leaked in. The fragmentation is **at the workflow seam** (issuer-verification ↔ employer-review run as parallel state machines with two refusal vocabularies and no shared "review" word) and **at the operator surface** (replay, audit-write status, and denial granularity have no UI today).

This is a healthy posture for the W2 wave — code-level cohesion ahead of operator-surface cohesion is the right ordering. The next surface-side wave should expose the things this wave wired up.

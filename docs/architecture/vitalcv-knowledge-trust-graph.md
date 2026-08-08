# VitalCV Knowledge Trust Graph

The conceptual graph defining how truth moves through VitalCV.

## Nodes
1. **Clinician**: The human professional.
2. **NPI**: National Provider Identifier (the anchor point).
3. **Identity Claim**: Assertion of who the person is (e.g. from NPPES).
4. **Credential Claim**: Assertion of a specific capability or status (e.g. State Medical License).
5. **Source**: The authoritative origin of truth (e.g. OIG LEIE, State Board).
6. **Source Check**: A discrete execution of verification against a Source.
7. **PSV Receipt**: The immutable record of a successful Source Check.
8. **Source Coverage State**: Aggregate view of what Sources have been checked.
9. **Freshness Window**: TTL (Time-To-Live) determining if a PSV Receipt is still valid.
10. **Limitation Note**: Explicit bounding of a claim (e.g., "Federal exclusions only").
11. **Credential Readiness Score (CRS)**: Derived metric summarizing readiness.
12. **Passport**: The clinician's internal aggregate profile.
13. **Proof Pack**: The exported, verifier-facing subset of the Passport.
14. **Trust Container**: The backend abstraction layer for Verifiable Credentials.
15. **Credential Envelope**: The specific verifiable payload wrapped by the Trust Container.
16. **Employer Review**: The verifier session evaluating the Proof Pack.
17. **Reviewer Action**: A discrete decision made by the verifier (e.g. Accept, Request Info).
18. **Audit Event**: An immutable system record tracking state changes and data exports.
19. **Pilot KPI Event**: Derived metric for operational tracking.
20. **Start Outcome**: The ultimate result (e.g. Clinician starts work).
21. **Knowledge Inbox**: Staging area for unverified, user-provided evidence.
22. **Knowledge Inbox Item**: A discrete piece of captured knowledge before classification.
23. **Classification Suggestion**: The AI-derived intent of an inbox item.
24. **Profile Update Suggestion**: A proposed change to the clinician passport based on an inbox item.
25. **Uploaded Evidence**: Raw documents or text provided by the clinician.
26. **Issuer Verification Request**: A request sent to a source or issuer; the request itself is not verification.
27. **Issuer Response**: A response from an issuer or contracted agent that may become a receipt candidate after review.
28. **Verification Partner**: A recommended routing option; recommendation does not imply an active integration.
29. **Receipt Candidate**: A non-global proof candidate awaiting attribution and policy review.
30. **Contracted Agent**: A third party acting for a source or issuer; agent identity must stay distinct from the source.
31. **Receipt Candidate Review**: The policy-level review step a receipt candidate must clear before it can become a PSV receipt.
32. **Attributed Responder**: The named party VitalCV believes provided an issuer response — recorded explicitly, separate from the source itself.
33. **Source Basis**: The source-of-record a response speaks for, plus any contracted-agent layer between VitalCV and that source.
34. **Policy Review Decision**: The accept-or-reject outcome of a receipt-candidate review; only this outcome can convert a candidate into a PSV receipt.
35. **Policy Review Actor**: The named reviewer (policy reviewer, credentialing committee, or compliance officer) recorded against a policy review decision.
36. **Policy Review Action**: The discrete action chosen by the reviewer — accept_candidate, reject_candidate, request_more_info, request_release, reroute, mark_conflict_review, or cancel.
37. **PSV Receipt Candidate**: The output of an accepted policy review. Still candidate-grade — not a global PSV receipt, not decision-grade, and not automatically reusable credential proof.
38. **Conflict Review**: The dedicated review step that resolves a corrected-issuer-response conflict before any candidate is accepted.
39. **Review Outcome**: The structured result of a policy review decision, including whether a PSVReceiptCandidate was produced and the gate that blocked when it was not.
40. **Corrected Issuer Response**: An issuer response that returns corrected detail; it triggers a conflict review and never directly creates proof.
41. **PSV Receipt Promotion**: The discrete promotion step from a PSVReceiptCandidate to a scoped PSVReceipt; only an accepted policy review may produce one.
42. **PSV Receipt Scope**: The narrative bounds of a PSV receipt — what claim type it covers, what it does not cover, and the source-of-record it speaks for.
43. **PSV Receipt Limitation**: An explicit limitation that travels with a PSV receipt (legally_only, partial_confirmation, contracted_agent, access_required, jurisdictional_scope, or other).
44. **Audit Metadata**: Structured metadata anchored to a PSV receipt indicating whether a real audit-event row was written; defaults to pending_not_written on demo surfaces.
45. **Freshness Policy**: The TTL window for a PSV receipt — issuance time, ttlDays, and the absolute timestamp at which the receipt becomes stale.
46. **PSV Receipt Reuse Decision**: A reviewer-facing decision that evaluates whether a scoped PSV receipt may be reused as scoped evidence for a new purpose; checks freshness, revocation, supersession, scope, and limitations.
47. **PSV Receipt Reuse Request**: The verifier ask to reuse a receipt (target receipt + reuse scope + caller-controlled clock); does not imply automatic acceptance.
48. **PSV Receipt Freshness Window**: The derived freshness reading for a receipt at a given clock — fresh / needs_refresh / expired plus daysRemaining.
49. **PSV Receipt Revocation State**: Modeled revocation status for a receipt — VitalCV records revocations when reported; it does not actively poll sources.
50. **PSV Receipt Supersession**: Modeled state when a newer receipt replaces an older one for the same source/claim.
51. **Reuse Policy**: The rules that govern how a `PSVReceiptReuseDecision` is computed (freshness threshold, scope match, limitation policy, revocation/supersession handling).
52. **Source Recheck Request**: A request to perform a fresh source check when reuse cannot be supported; the request itself is not verification.
53. **Scoped Evidence**: How a reused PSV receipt is presented to a verifier — bounded by the receipt's scope, limitations, and freshness; not a guarantee of acceptance or current source truth.
54. **Consent Requirement**: Whether a clinician release is required for a given claim type and the scope under which the issuer is asked to act.
55. **Consent Artifact Summary**: A stable summary of a recorded consent artifact — id, scope, status, timestamps, optional release-form pointer.
56. **Manual Issuer Send Link**: A URL the requester copies and sends to the issuer manually. VitalCV does not send the email or SMS; generation is not delivery.
57. **Issuer Request Timeline**: The ordered sequence of lifecycle events recorded against an issuer verification request.
58. **Issuer Request Lifecycle Event**: A single event on the timeline (status, actor, source, occurredAt, optional notes).
59. **Issuer Request Delivery State**: Whether a manual link has been copied or sent — requester-attested unless a delivery integration exists.
60. **Requester Action**: A discrete action the requester took (copy, mark-sent, etc.) — attested provenance, not observation.
61. **Issuer View Event**: An observed event recorded when the verification surface sees the issuer open the request — does not mean the claim is verified.
62. **Issuer Audit Event Record**: The structured record VitalCV would persist for an issuer-flow action (consent recorded, link generated, viewed, etc.). Carries persistence status, mode, payload hash, correlation, and replay-safe flag.
63. **Issuer Audit Writer**: The interface that turns a record into a persistence outcome. The reference no-op writer never persists; a repository writer is a future wave.
64. **Issuer Audit Persistence Mode**: Which writer is wired in this environment — `none`, `demo`, `noop`, `repository`, or `external`. Only `repository` and `external` may produce a `persisted` status.
65. **Issuer Lifecycle Replay**: The replay surface that gathers audit event records for a request. Replay shows recorded workflow context; it is not legal proof.
66. **Issuer Audit Correlation**: The grouping (correlationId + requestId + optional subjectId) that threads lifecycle events into a single replay.
67. **Payload Hash**: Optional cryptographic anchoring for an audit event payload. Empty placeholder by default; only fabricated by a writer with anchoring support (future wave).
68. **Replay-Safe Event**: An audit event record marked safe to include in a lifecycle replay. Replay-safe is context, not proof.
69. **Issuer Audit Persistence Adapter**: The decision boundary that selects which writer kind (`noop` / `demo` / `repository_candidate` / `repository_enabled` / `unavailable`) to use for an audit event record. Default is `noop`.
70. **Repository Audit Adapter**: A type-safe stub that describes what a repository-backed writer would persist. This slice does not import the existing backend repository — it documents the deferred bridge.
71. **Persistence Adapter Decision**: The structured outcome of an adapter selection (kind, resultMode, reason, capabilities, optional wiring description).
72. **Repository Capability**: A specific capability an adapter is designed to support — `write_audit_event`, `write_psv_receipt`, `replay_lifecycle`, `hash_payload`, `preserve_limitations`, `preserve_source_basis`, `preserve_responder_attribution`.
73. **Persisted Audit Record**: An audit event record whose write was confirmed by a repository or external writer. Only `repository_enabled` adapters may produce one.
74. **Persistence Configuration**: The caller-supplied input that drives the adapter decision. There are no environment lookups, no implicit feature flags — the operator must explicitly opt in to repository writes.
75. **Backend Persistence Decision**: The structured outcome of `evaluateBackendPersistenceReadiness` — status (implement_now / defer_until_contract_aligned / unavailable / unsafe / needs_backend_adapter), implied adapter kind, capability checks, blockers, recommendation. Default is defer.
76. **Backend Persistence Capability Check**: A single capability the backend repository must offer before persistence is enabled (stores scoped PSV receipt, preserves limitation notes / source basis / responder attribution / freshness scope, distinguishes candidate vs receipt, supports audit event persistence, exposes server-only writer, has test coverage).
77. **Backend Persistence Blocker**: A discrete reason persistence is blocked (contract shape mismatch, missing limitations / source basis / responder attribution / freshness scope, no writer confirmation, client/server boundary violation, untested repository, migration required).
78. **Server Repository Audit Adapter**: A future server-only writer that confirms each row. Does NOT exist in this slice; named in the graph so the deferred bridge has a target.
79. **Writer Confirmation**: The signal a writer emits when a real row was persisted. Required before any record's `persistenceStatus` may be `'persisted'`.
80. **Contract Alignment**: The shape-compatibility precondition between the legacy backend repository and the issuer-verification truth contract. Must be satisfied before a server adapter may be wired.
81. **Server PSV Receipt Writer**: BACKEND-2's writer-boundary contract. Defines `ServerPsvReceiptWriter`, `ServerPsvReceiptWriteInput`, `ServerPsvReceiptWriteResult`, and `ServerPsvReceiptWriterConfirmation`. The default deferred writer NEVER persists; a future repository-backed writer is required to flip `persisted=true`.
82. **Dry-Run Persistence Attempt**: A write-attempt result with `status: 'dry_run'` and `persisted: false`. Used to validate input shape without writing.
83. **Failed Persistence Attempt**: A write-attempt result with `status: 'failed'` and `persisted: false`. Set when input is malformed, when the writer rejected the row, or when the boundary downgraded a buggy writer claim.
84. **Deferred Persistence Attempt**: A write-attempt result with `status: 'deferred'` and `persisted: false`. The BACKEND-2 default; signals that contract alignment is incomplete and the writer cannot run safely.


## Edges
* `Clinician` HAS_NPI `NPI`
* `NPI` RESOLVES_IDENTITY `Identity Claim`
* `Credential Claim` SUPPORTED_BY `Source Check`
* `Source Check` PRODUCES `PSV Receipt`
* `PSV Receipt` HAS_FRESHNESS `Freshness Window`
* `Source Check` HAS_COVERAGE_STATE `Source Coverage State`
* `Credential Claim` HAS_LIMITATION `Limitation Note`
* `Passport` CONTAINS `Credential Claim`
* `Proof Pack` EXPORTS `Passport`
* `Trust Container` WRAPS `Credential Envelope`
* `Credential Envelope` REFERENCES `Proof Pack`
* `Employer Review` REVIEWS `Proof Pack`
* `Reviewer Action` WRITES `Audit Event`
* `Pilot KPI Event` MEASURES `Reviewer Action`
* `Start Outcome` CLOSES_LOOP `Employer Review`
* `Clinician` SUBMITS `Knowledge Inbox Item`
* `Knowledge Inbox Item` CLASSIFIED_AS `Classification Suggestion`
* `Knowledge Inbox Item` SUGGESTS `Profile Update Suggestion`
* `Knowledge Inbox Item` MAPS_TO `Graph Node`
* `Uploaded Evidence` SUPPORTS `Credential Claim`
* `Credential Claim` NEEDS_SOURCE_CHECK `Source Check`
* `Credential Claim` NEEDS_ISSUER_VERIFICATION `Issuer Verification Request`
* `Issuer Verification Request` MAY_ROUTE_TO `Verification Partner`
* `Issuer Verification Request` ROUTES_TO `Source`
* `Issuer` RESPONDS_WITH `Issuer Response`
* `Issuer Response` PRODUCES `Receipt Candidate`
* `Receipt Candidate` REQUIRES `Receipt Candidate Review`
* `Receipt Candidate Review` MAY_CREATE `PSV Receipt`
* `Attributed Responder` ATTESTS_RESPONSE `Issuer Response`
* `Issuer Response` HAS_SOURCE_BASIS `Source Basis`
* `Policy Review Decision` ACCEPTS_OR_REJECTS `Receipt Candidate`
* `Receipt Candidate` REQUIRES `Policy Review Decision`
* `Policy Review Decision` ACCEPTS `Receipt Candidate`
* `Policy Review Decision` REJECTS `Receipt Candidate`
* `Policy Review Decision` REQUESTS_MORE_INFO `Issuer Verification Request`
* `Policy Review Decision` MAY_CREATE `PSV Receipt Candidate`
* `PSV Receipt Candidate` MAY_BECOME `PSV Receipt`
* `Policy Review Actor` PERFORMS `Policy Review Action`
* `Policy Review Action` RECORDED_BY `Policy Review Decision`
* `Policy Review Decision` PRODUCES `Review Outcome`
* `Conflict Review` RESOLVES `Corrected Issuer Response`
* `PSV Receipt Candidate` MAY_PROMOTE_TO `PSV Receipt`
* `PSV Receipt Promotion` REQUIRES `Policy Review Decision`
* `PSV Receipt` HAS_SCOPE `PSV Receipt Scope`
* `PSV Receipt` HAS_LIMITATION `PSV Receipt Limitation`
* `PSV Receipt` REFERENCES `Issuer Response`
* `PSV Receipt` REFERENCES `Source Basis`
* `PSV Receipt` MAY_ANCHOR `Audit Metadata`
* `PSV Receipt` BOUND_BY `Freshness Policy`
* `PSV Receipt` MAY_BE_REUSED_AS `Scoped Evidence`
* `PSV Receipt Reuse Decision` EVALUATES `PSV Receipt`
* `PSV Receipt Reuse Decision` CHECKS `PSV Receipt Freshness Window`
* `PSV Receipt Reuse Decision` CHECKS `PSV Receipt Revocation State`
* `PSV Receipt Reuse Decision` CHECKS `PSV Receipt Scope`
* `PSV Receipt Reuse Decision` MAY_REQUIRE `Source Recheck Request`
* `PSV Receipt Supersession` REPLACES `PSV Receipt`
* `PSV Receipt Reuse Request` TARGETS `PSV Receipt`
* `Reuse Policy` GOVERNS `PSV Receipt Reuse Decision`
* `Issuer Verification Request` REQUIRES `Consent Requirement`
* `Holder` PROVIDES `Consent Artifact Summary`
* `Consent Artifact Summary` ENABLES `Manual Issuer Send Link`
* `Requester Action` COPIES `Manual Issuer Send Link`
* `Requester Action` MARKS_SENT `Issuer Verification Request`
* `Issuer View Event` OBSERVES `Issuer Verification Request`
* `Issuer Response` ADVANCES `Issuer Request Timeline`
* `Issuer Request Timeline` MAY_CREATE `Receipt Candidate`
* `Issuer Request Lifecycle Event` RECORDED_ON `Issuer Request Timeline`
* `Issuer Request Delivery State` ATTESTED_BY `Requester Action`
* `Issuer Request Timeline` MAY_PRODUCE `Issuer Audit Event Record`
* `Issuer Audit Writer` PERSISTS `Issuer Audit Event Record`
* `Issuer Lifecycle Replay` REPLAYS `Issuer Audit Event Record`
* `Issuer Audit Event Record` REFERENCES `Related Artifact`
* `Payload Hash` BINDS `Issuer Audit Event Record`
* `Issuer Audit Correlation` GROUPS `Issuer Request Lifecycle Event`
* `Issuer Audit Event Record` HAS_MODE `Issuer Audit Persistence Mode`
* `Replay-Safe Event` MAY_BE_INCLUDED_IN `Issuer Lifecycle Replay`
* `Issuer Audit Writer` MAY_USE `Issuer Audit Persistence Adapter`
* `Issuer Audit Persistence Adapter` EVALUATES `Repository Capability`
* `Repository Audit Adapter` MAY_WRITE `Persisted Audit Record`
* `Persistence Adapter Decision` SELECTS `Issuer Audit Persistence Mode`
* `Persisted Audit Record` REQUIRES `Writer Confirmation`
* `Persistence Configuration` DRIVES `Persistence Adapter Decision`
* `Backend Persistence Decision` EVALUATES `Repository Audit Adapter`
* `Repository Audit Adapter` REQUIRES `Contract Alignment`
* `Writer Confirmation` REQUIRED_FOR `Persisted Audit Record`
* `Backend Persistence Blocker` BLOCKS `Persistence Adapter Decision`
* `Backend Persistence Capability Check` GATES `Backend Persistence Decision`
* `Server Repository Audit Adapter` MAY_PRODUCE `Persisted Audit Record`
* `Contract Alignment` PRECEDES `Server Repository Audit Adapter`
* `Server PSV Receipt Writer` MAY_PRODUCE `Persisted Audit Record`
* `Server PSV Receipt Writer` EMITS `Writer Confirmation`
* `Dry-Run Persistence Attempt` DOES_NOT_PRODUCE `Persisted Audit Record`
* `Failed Persistence Attempt` DOES_NOT_PRODUCE `Persisted Audit Record`
* `Deferred Persistence Attempt` DOES_NOT_PRODUCE `Persisted Audit Record`
* `Contract Alignment` PRECEDES `Server PSV Receipt Writer`
* `Issuer Audit Persistence Adapter` EMITS `Persistence Adapter Decision`
* `Contracted Agent` ACTS_FOR `Source`


## Trust Rules & Invariants
1. **NPPES is Identity, not Authority**: An NPPES match confirms identity/enumeration but does NOT serve as licensure proof.
2. **OIG/LEIE Scope**: A "Clear" status on OIG LEIE means *federal* exclusions only, and does not inherently clear state Medicaid exclusion lists.
3. **PECOS Scope**: PECOS public data reflects public enrollment posture, not real-time Medicare portal eligibility.
4. **Access Awareness**: State board, Nursys, and FSMB checks must remain aware of access constraints (e.g., institutional agreements).
5. **Partial Preservation**: A partial proof stays partial. No container, envelope, or export process can upgrade a partial proof to decision-grade.
6. **Container Nuance**: The Trust Container does *not* upgrade the proof tier. It merely wraps the existing evidence immutably.
7. **Audit Truth**: Audit events prove action history (who exported what, when), but do not replace clinical truth (what the state board says).
8. **Derivative Scoring**: The Credential Readiness Score (CRS) is a derivative metric based on evidence; it is not evidence itself.
9. **Provenance Hierarchy**: Claims resolve according to explicit provenance constraints: `VERIFIED` > `USER_ENTERED` > `INFERRED` > `UNKNOWN`. A conflict between multiple sources is explicitly labeled `CONFLICT` and never silently discarded.
10. **Inbox Classification != Verification**: Categorizing an uploaded document or text string does not make it verified. It remains `USER_ENTERED` or `INFERRED` until backed by a PSV receipt.
11. **Suggestion Acceptance Boundaries**: Accepting an inbox suggestion updates the profile context, but it cannot upgrade the proof tier of the overall artifact.
12. **Evidence Requires Review**: Uploaded evidence requires human review or automated source verification before it can ever be marked `VERIFIED`.
13. **Issuer Request Boundary**: Sending or viewing an issuer request is not verification.
14. **Partner Routing Boundary**: Partner routing is a recommendation only and does not imply an active partner integration.
15. **Receipt Candidate Boundary**: A confirmed issuer response creates a receipt candidate only; it does not create global proof.
16. **Limited Response Boundary**: `legally_only` maps to `review_required`; `wrong_office` reroutes without confirming the claim; `requires_release` pauses the request.
17. **Contracted Agent Boundary**: Contracted agent responses must preserve both the agent identity and the original source basis.
18. **Receipt Candidate Boundary II**: A receipt candidate is not a final PSV receipt. Only a policy review decision can convert a candidate into a PSV receipt.
19. **Conflict Review Boundary**: A corrected response creates a conflict review, not proof.
20. **Legally-Only Boundary**: A `legally_only` response does not create full proof — it remains review_required even on an otherwise confirmed-style outcome.
21. **Source Basis Retention**: The contracted-agent / source distinction must be retained on the receipt candidate; the agent and the source are never collapsed into one identity.
22. **Policy Review Acceptance Boundary**: Only the `accept_candidate` action under policy review may produce a `PSVReceiptCandidate`. `reject_candidate`, `request_more_info`, `request_release`, `reroute`, `mark_conflict_review`, and `cancel` never produce one.
23. **Acceptance Precondition Boundary**: `accept_candidate` requires the receipt candidate to be in `ready_for_policy_review`. `review_required`, `conflict_review_required`, `release_required`, `reroute_required`, `unable_to_verify`, `expired`, and `canceled` cannot produce a `PSVReceiptCandidate`.
24. **Refused-Response Acceptance Boundary**: `wrong_office` and `unable_to_verify` responses cannot produce a `PSVReceiptCandidate` even if their review state is somehow misrouted; the builder refuses by response status.
25. **Legally-Only Limitation Boundary**: A `legally_only` response may only produce a `PSVReceiptCandidate` if an explicit limitation note travels with the candidate.
26. **Evidence Preservation Boundary**: Rejection and other refusals preserve the original `IssuerResponse` and `ReceiptCandidate` audit metadata; the underlying evidence is never deleted by a policy review decision.
27. **PSVReceiptCandidate Boundary**: A `PSVReceiptCandidate` is candidate-grade output (`decisionGrade: false`, `proofTier: 'psv_receipt_candidate'`). It is not a global PSV receipt and is not automatically reusable credential proof; promotion to `PSV Receipt` is gated by a separate review.
28. **Audit Honesty Boundary**: The policy review surface does not write a real audit-event row. Audit metadata recorded on the demo surface is explicitly labeled `recordedBy: 'demo'` and copy on the page does not claim the action was logged to an audit trail.
29. **PSV Receipt Scope Boundary**: A `PSVReceipt` is scoped evidence, not global credential truth. `globalCredentialTruth` is the literal `false`; the receipt's `scope`, `limitations`, and `freshness` window remain controlling for any downstream credential claim.
30. **PSV Receipt Promotion Boundary**: Promotion to `PSVReceipt` requires `policyReviewDecision.status === 'accepted_as_psv_candidate'`. Reject, request_more_info, reroute, request_release, conflict_review_required, and any pending decision cannot promote.
31. **PSV Receipt Origin Refusal Boundary**: `wrong_office` and `unable_to_verify` origin response statuses cannot promote, even if the candidate somehow reached this surface.
32. **PSV Receipt Limitation Retention Boundary**: `legally_only` origin responses require at least one explicit `PSVReceiptLimitation` entry before promotion. Contracted-agent responses always emit at least one limitation describing the agent / source layer.
33. **PSV Receipt Audit Honesty Boundary**: `PSVReceipt.auditMetadata.eventState` defaults to `'pending_not_written'` and stays there until a real audit service writes a row. UI copy may not claim a real audit event was written until that wiring exists.
34. **PSV Receipt Reuse Boundary**: Reuse of a `PSVReceipt` is not automatic verifier acceptance; "reusable" means may-be-considered as scoped evidence within the receipt's scope, limitations, and freshness window. A reuse decision does NOT upgrade `globalCredentialTruth`, which remains the literal `false`.
35. **No Live Monitoring Boundary**: VitalCV does not actively poll source systems for revocation or change. A receipt's revocation/supersession state is **modeled** — recorded when reported. Absence of a recorded revocation is not a guarantee of current source truth.
36. **Reuse Refusal Boundary**: Expired, revoked, or superseded receipts cannot be reused. Scope mismatch (different claim type or different source organization) blocks reuse. Limitations on a receipt can block reuse for purposes the limitation does not cover (e.g., legally_only receipts cannot back clinical-scope reuse).
37. **Reuse Audit Honesty Boundary**: `PSVReceiptReuseDecision.auditMetadata.eventState` defaults to `'pending_not_written'`. The reuse review surface does not write a real audit-event row and does not call source APIs.
38. **Consent Enables, Does Not Verify Boundary**: Holder consent is the precondition for generating a manual send link. Consent is NOT verification; it does not, on its own, advance the truth tier of any claim.
39. **Manual Send Boundary**: VitalCV does not send email, SMS, or webhooks from the lifecycle module. Manual link generation is not delivery; a generated link only enables the requester to copy and send manually.
40. **Attested vs Observed Boundary**: `copied_by_requester` and `sent_by_requester` are requester-attested (`source: 'attested'`). `viewed_by_issuer` and `response_received` require an observed event (`source: 'observed'`) from the verification surface. Requester attestation is never sufficient to satisfy the observed-event gate.
41. **Lifecycle Audit Honesty Boundary**: `IssuerRequestLifecycleAuditMetadata.eventState` defaults to `'pending_not_written'`. UI may not claim a real audit-event row was written until a real audit service is wired.
42. **No Lifecycle Truth Crossing Boundary**: No issuer request lifecycle status creates global credential truth. `psv_receipt_promoted` reflects the ISSUER-4 promotion outcome (scoped evidence with `globalCredentialTruth: false`); it does not, by being on the timeline, upgrade any claim's truth tier.
43. **Audit Persistence Boundary**: An audit event record's `persistenceStatus` is `pending_not_written` by default. Only an `IssuerAuditWriter` whose `mode` is `'repository'` or `'external'` can produce `persisted`. Demo / no-op writers cannot — the boundary downgrades any false `persisted: true` claim to `demo_not_persisted` defensively.
44. **Audit Records Are Action History Boundary**: Audit event records describe action history (who did what, when), not clinical truth. They never change a claim's proof tier and never set `globalCredentialTruth=true`.
45. **Replay-Safe Is Not Legal Proof Boundary**: `replaySafe` means an event MAY be included in a timeline replay for context. It does NOT mean legal proof; the replay disclaimer makes this explicit.
46. **No Fake Persistence Boundary**: Demo, no-op, and `none` writers cannot return `persisted: true`. The boundary helper enforces this at runtime regardless of what the writer claims.
47. **Payload Hash Honesty Boundary**: `payloadHash` is an empty-string placeholder by default. A non-empty hash is fabricated only by a writer with cryptographic anchoring; this slice does not ship one.
48. **Persistence Adapter Default Boundary**: The default adapter is `noop`. There are no environment lookups, no implicit feature flags — turning real persistence on requires explicit operator configuration.
49. **Repository Candidate Boundary**: `repository_candidate` is NOT active persistence. It documents that a repository-shaped writer could be wired and provides type-safe payload mapping; it does not invoke a writer and cannot return `persisted: true`.
50. **Operator Opt-In Boundary**: `enableRepositoryWrites: true` is necessary but not sufficient. Even with the operator flag set, this slice keeps the adapter `unavailable` until a client-safe writer is wired (a future wave).
51. **No Backend Bundle Crossing Boundary**: The web layer must not import a backend DB writer (Prisma client) into the client bundle. The repository adapter stub documents the deferred bridge and refuses to import any backend module.
52. **Adapter Cannot Upgrade Truth Tier Boundary**: An adapter never sets `decisionGrade=true`, never changes `proofTier`, and never sets `globalCredentialTruth=true`. The audit boundary's role is action-history persistence — clinical truth invariants live in ISSUER-2/3/4/5.
53. **Backend Compatibility Is Not Persistence Boundary**: Whether the backend repository can structurally accept a row is independent of whether VitalCV persisted one. Only a writer's confirmation makes a record persisted.
54. **Defer Is The Default Boundary**: `evaluateBackendPersistenceReadiness` returns `defer_until_contract_aligned` by default. Every capability check must be explicitly satisfied before the decision flips to `implement_now`.
55. **Server-Only Writer Boundary**: No client-side path may write audit records. A writer is server-only by construction; client code may invoke it only through a Next.js server action / RPC route, never via direct repository import.
56. **Capability-Gated Implementation Boundary**: The nine `BackendPersistenceCapabilityCheck` capabilities are independent gates. A blocker on any one of them prevents `implement_now`, regardless of how many others are satisfied.
57. **Writer Boundary Boundary**: The `ServerPsvReceiptWriter` interface defines the writer contract. The default deferred writer NEVER returns `persisted=true`. Replacing the deferred writer with a repository-backed writer is the load-bearing transition for real persistence.
58. **Confirmation Required Boundary**: A `ServerPsvReceiptWriteResult` may carry `status: 'persisted'` ONLY if the writer also emits a `ServerPsvReceiptWriterConfirmation` with `writerMode in {repository, external}`. The boundary's `writePsvReceiptWithConfirmation` orchestrator defensively downgrades any persisted claim that lacks a valid confirmation.
59. **No Client-Persisted-Flag Boundary**: `canUseServerPsvReceiptWriter` refuses input that carries a client-supplied `persisted` or `confirmation` field. Only a real writer may emit a confirmation; clients cannot self-report persistence.
60. **No Forbidden Truth Tier Boundary**: `ServerPsvReceiptWriteInput` does not type `decisionGrade`/`proofTier`/`globalCredentialTruth`, AND the boundary refuses input that smuggles them in at runtime. The writer cannot upgrade a claim's truth tier under any circumstance.

61. **Start Agent Truth Consumption Boundary**: The Start Agent (`apps/web/lib/agent/`) consumes truth from canonical services and never manufactures it. Plans are produced by the deterministic, versioned `start-policy-v1`; no LLM determines credential truth, identity ownership, employer approval, or start readiness. The model layer explains structured plans and a narrative that references unknown actions or unsupported claims is dropped, never repaired.
62. **Start Agent State Non-Collapse Boundary**: NPI resolution, profile saved, ownership verified, employer reviewed, and start readiness are independent canonical states in `StartAgentContext`. No agent inference derives one from another: resolution is a public-registry fact carrying no ownership meaning; an opened packet is not a review; a review is not an approval; `ready_to_start` is unrepresentable without a canonical determination (`determinedBy: 'canonical'`), and the policy has no code path that writes it.
63. **Start Agent Execution Ceiling Boundary**: A0 executes nothing above Level 2 (prepare). `execute_with_consent` (Level 3) exists only as representation with status `awaiting_consent` and a named consent scope; the tool registry throws on any attempt to run Level 3+, `human_only` capabilities are never executable, and consent is never assumed (`consent_assumed` is a fatal truth violation).
64. **Start Agent Plan Fail-Closed Boundary**: `generateStartPlan` re-audits its own output against the truth contract (structure + forbidden claims + provenance gates) and THROWS on any violation — a plan that collapses a truth boundary is unrepresentable as policy output. START-Bench runs the same audit over all 25 scenarios plus a validating narrative and byte-identical regeneration.
65. **Agent Consent Ledger Boundary**: Agent consent is an append-only ledger of granted/revoked events (`agent_consent_events`), never a boolean flag and never inferred. Current state is a fold over the latest event per (subject, scope); revocation is a state, never a deletion; re-grant after revoke is a new event. Every write pairs an AuditEvent in the same transaction, and a write that does not persist reports failure — an authorization is never assumed to exist.
66. **Consent Verified At Execution Boundary**: A `ConsentProof` is minted only by the consent store re-reading the ledger AT EXECUTION TIME, and is the only object the tool registry accepts for Level 3. A proof is evidence the ledger said yes moments ago, not a transferable capability: proofs are never accepted from clients, the proof's scope must match the invoked scope, and a revocation landing after plan generation is honored — the plan does not authorize, the ledger does.
67. **Server-Derived Execution Boundary**: `POST /api/agent/execute-action` accepts only an action id. The subject comes from the session, the context is reassembled from canonical services, and the plan is REGENERATED server-side, so a stale or forged client plan cannot authorize anything. Execution runs only VitalCV-owned actions with a wired capability; a canonical service that refuses (including the apply-share ownership authz refusal) is recorded as a failure, never a success.
68. **Server-Derived Consent Scope Boundary**: A client approves an ACTION, never a scope. `POST /api/agent/consent` regenerates the plan server-side, requires the named action to be `execute_with_consent` and VitalCV-owned, and derives the recorded scope from that canonical action. A client-supplied scope, plan, subject, or proof is rejected outright, and revocation resolves its scope from a live action or a server-issued reference — so the authorization namespace can never be authored by the browser through either surface.
69. **Serialized Consent Boundary**: Consent state is the highest-`seq` event per (subject, scope) under a DB unique constraint on (subject_ref, scope, seq) — never the newest timestamp (ms ties are real) or a uuid tiebreak (arbitrary). Racing transitions cannot both land; the loser rolls back whole, audit row included, and retries against the new head. A failed write creates neither an authorization nor a partial audit row.
70. **Presentation Is Not Acceptance Boundary**: `agent_action_presented` is recorded only by the view layer when a recommendation is actually shown. Execution records `agent_action_accepted`. An action appearing in a generated plan is neither presented nor accepted — collapsing these would mark every planned action as accepted and destroy the funnel's ability to measure whether a recommendation helped.
71. **Actor Boundary**: `actor` (clinician_session | system_scheduler) is an axis orthogonal to `permission`: permission asks what kind of action this is, actor asks who is driving. The tool registry is bound to one actor and refuses any tool that actor may not invoke BEFORE considering permission. `system_scheduler` may never execute an `execute_with_consent` tool regardless of what the tool declares — the agent may do work in the background but may not disclose in the background. No credential that can act as an arbitrary clinician is ever created to work around this.
72. **Unknown Is Not Absent**: An ownership state of `unknown` means the canonical record was not readable in this context. It is neither `none` nor verified: it raises no ownership blocker (inventing one for a clinician who verified months ago is a false alarm) and clears nothing (work presupposing verified ownership is not derived at all). Collapsing "we could not look" into "there is nothing there" is forbidden.
73. **Reduced Context Boundary**: A context assembled without inputs that were structurally out of reach for its actor is marked `reduced`, and that mark rides onto the plan. A reduced plan drives background work and change detection only — it is never served on an interactive surface, and it may only be compared against another plan of the same completeness, or a diff reports the gap between what two actors can see as though it were a change in the world. An ordinary read failure is a gap, not a reduction.
74. **Claim-Before-Work Boundary**: A scheduled subject is claimed by moving its due time FORWARD in a compare-and-set before any work begins, claimed iff exactly one row changed. A retried or concurrent tick therefore finds nothing to claim rather than running a subject twice, and a tick that crashes mid-run leaves the subject scheduled for its next interval rather than immediately re-claimable — a crash loop that re-runs one subject forever is worse than a skipped cycle.
75. **Enrollment Is The Cohort**: A background run may only reach a subject who has an explicit enrollment row. No predicate ("everyone with a verified NPI", a percentage) may select subjects for autonomous work, because a predicate silently widens the cohort as data changes. Disabling pauses without forgetting.
76. **Shadow Is Structural**: In an observation wave the agent has no executor wired at all; `mode: 'shadow'` on the run row is a record of that fact, not the mechanism enforcing it. An unreadable operator kill switch is never treated as a kill — an ops outage must not silently render the loop inert when nobody is watching; bounded batches and the absent executor are the safety.
77. **Decision Fingerprint Boundary**: Change detection may never use `contextFingerprint` or `planId`. Both hash the whole context including the collection clock, so both change on every run even when nothing meaningful moved — a detector built on them reports a change every tick and is wrong every tick. Comparison runs over a decision-relevant projection only: blocker ids and types, action ids with status and executability, the top-ranked action, and lane statuses. Never timestamps, never evidence `observedAt`, never the context fingerprint.
78. **Materiality Boundary**: Every plan delta is recorded; only some are material. `observation_refreshed_no_change` — a source re-read that found nothing new — is the most common delta there will ever be, and exists as an explicit non-material kind precisely so it is recorded for the learning loop and never surfaced to a human. A top-action change is material only when the new top differs in type or owner; re-ranking between two steps of the same kind owned by the same party is churn, not news.
79. **Comparability Boundary**: Two plans may be diffed only when their actor could see the same things. Diffing across `completeness` reports the gap between two viewpoints as though it were a change in the world, so it is refused outright. A refusal is a suppressed delta, never a fabricated one — and "no prior run" is a refusal, never "no changes detected", for the same reason an empty monitoring plan is not an all-clear.
80. **Deadline Provenance Boundary**: A deadline is a claim about the world and is never separable from who set it. `source_set` (the authority published it) and `employer_set` may be stated as fact; `vitalcv_policy` is our own freshness preference and may only ever be phrased as ours; `estimated` must carry its qualifier inside the rendered value. "Your license expires in 12 days" and "our preferred freshness window closes in 12 days" are different sentences and only one is about the clinician's credential. A source-set deadline is never inferred from a field that conflates published and computed expiry.
81. **Deadline Is Not A Blocker**: A deadline never creates a blocker; it changes the urgency of an existing one. This keeps the blocker model free of a generic "deadline" bucket — the same mistake as a generic `incomplete` flag — and means the blocker set is identical with and without a deadline attached.
82. **Urgency Ranks Within A Tier**: Urgency is an intra-tier tiebreak, never a tier of its own. A deadline makes a piece of work more pressing; it does not change who owns it or what kind of work it is, which is what the tiers encode. Urgent optional enrichment must never outrank work that blocks a start.
83. **One Cadence Table**: Scheduled reads are governed by `SOURCE_REGISTRY` and nothing else. Three unreconciled cadence tables exist (`SOURCE_REGISTRY`, the backend `SOURCE_POLL_CONFIGS`, and `continuousMonitor`'s env crons); the agent commits to one explicitly rather than adding a fourth. A lane the registry does not know gets NO default cadence — asserting how often an authority we have never asked changes is the same class of error as inventing an expiry date.
84. **Defer, Never Queue**: When a per-source budget is spent or a source is unavailable, a scheduled read defers and says which. It is never queued: a queue that grows faster than its window drains turns a polite scheduler into a thundering herd the moment the window resets. Every skip carries a named reason, so a tick that read nothing can be told apart from a tick where everything was already fresh.
85. **Shared Budget Boundary**: The refresh budget is shared across every subject in a tick, not held per subject. Sources are shared, so the cap must be too — a per-subject budget lets a large batch hammer one authority while each subject stays politely under its own limit. Budget is the LAST gate checked, so work skipped for a free reason never consumes quota it did not use.

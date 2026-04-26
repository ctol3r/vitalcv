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


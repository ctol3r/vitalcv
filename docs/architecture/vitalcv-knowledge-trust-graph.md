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


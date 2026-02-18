# VitalCV YC Positioning

## 1. One-Sentence Definition
VitalCV is an enterprise trust platform that verifies clinician credentials with deterministic proof artifacts, tenant isolation, and audit-ready transparency records to support high-volume credential decisions at payer, health-system, and workforce exchanges.

## 2. Three-Line Problem Statement
1) Clinical and staffing decisions still depend on static checks with inconsistent source refresh and weak evidence retention.  
2) Verifiers cannot prove what was checked, when, or by which policy without manual spreadsheets and disconnected logs.  
3) Trust is still fragmented by environment because lifecycle, federation, and revocation evidence are not linked in one deterministic engine.

## 3. Three-Line Solution Statement
1) VitalCV continuously recomputes credential state from source refresh, lifecycle status, and revocation signals into one deterministic artifact.  
2) Every artifact transition is append-only and can be verified through Merkle proofs and transparency ledger history.  
3) Verifier and issuer controls share the same policy baseline so cross-tenant and cross-system checks are enforced consistently.

## 4. Why Now
- Federal and payer programs are requiring stronger credential governance and auditable provenance for practitioner access decisions.
- Organizations face immediate operational risk from stale source data and unverifiable refresh behavior.
- VitalCV is positioned as the compliance-ready layer where provenance, federation, and lifecycle governance are first-class, not adjunct tooling.

## 5. Moat Definition
- Deterministic policy runtime that ties source checks, lifecycle transitions, and evidence trails into one deterministic pipeline.
- Shared governance utilities (hashing, Merkle derivation, HAIP enforcement, and trust resolution) reduce drift and prevent bypass through edge integrations.
- Tenant-scoped evidence model with explicit federation decision logic that is difficult to replicate in lightweight credential stores.

## 6. Pilot Wedge Definition
- Start with payer credential verification teams and staffing vendors that already issue/consume licenses and checks.
- Validate in a single tenant first with mandatory artifact checks, then open to one external verifier partner through explicit federation trust link.
- Expand only after cross-tenant deny/allow matrix and cross-check bundle consistency remain stable for at least 30 days.

## 7. Revenue Model
- Base platform access per active verifier org (monthly subscription).
- Usage tiers by number of verified artifacts and proof requests.
- Add-on enterprise modules for trust governance, federation audit exports, and transparency bundle APIs.
- Implementation and compliance onboarding fee for first 90-day pilots, with automatic policy hardening milestones.

## 8. Competitive Contrast
### Medallion-style compliance
- Similar on paper for process controls, but typically lacks deterministic artifact linkage across lifecycle and verification evidence.

### Verifiable-credential-focused stacks
- Usually optimize format and key handling; VitalCV focuses on operational policy, tenant enforcement, and evidence continuity in production workflows.

### Manual compliance tooling
- Higher operational overhead, no cryptographically anchored state transitions, and weak revocation/refresh traceability.

## 90-Second YC Narrative
VitalCV reduces trust risk in staffing and provider identity workflows by turning every verification into a reproducible, auditable state decision. It does not sell “just another credential format” — it enforces production-grade policy (strict mode, HAIP posture, federation controls), while preserving straightforward integration for existing verifier systems.

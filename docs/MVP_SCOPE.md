# MVP Scope: YC Demo Boundaries

## What Is In YC MVP

The YC MVP demonstrates the canonical path: Recognition → Acceptance → Start

### Implemented Features

**Clinician Onboarding:**
- NPI entry via web onboarding page
- Backend mock NPI lookup (`/lookup/npi/:npi`)
- Single-step onboarding (no wizard, no optional steps)

**Domain Primitives:**
- `employmentContracts.ts` - Type-safe canonical path definitions
- `employmentGuards.ts` - Runtime validation with compile-time enforcement
- `psvContracts.ts` - PSV evidence and policy types
- `psvPolicy.ts` - Deterministic policy evaluation engine

**Employment Verification Path:**
- RecognitionEvent: Employer acknowledges offer
- EmployerAcceptance: Mutual agreement with PSV requirement
- StartAttestation: Employer attests employment commenced
- Branded type `VerifiedCanonicalPath` prevents bypass

**PSV Foundation:**
- PSV check result types
- Policy evaluation (CLEAR / REVIEW / BLOCK decisions)
- Freshness rules and expiry handling
- Deterministic source ordering
- PSV demo script (`pnpm psv:demo --npi <npi>`)

**Compliance Scaffolding:**
- NCQA CR1-CR5 requirements documented
- CMS CoP §482.12 mapped to code
- Negligent credentialing liability protections
- PSV requirement enforced at acceptance

**Read-Only Demos:**
- PSV demo UI and API route (`/demo/psv`, `apps/web/app/api/psv/route.ts`)
- Employer/clinician/issuer marketing pages

### Test Coverage

- Domain-common PSV policy and guards are coverage-gated
- Demo tests validate deterministic PSV output

## What Is Explicitly Out

The following are intentionally excluded from YC MVP to maintain scope:

### Not Yet Implemented

**Live PSV Source Integrations:**
- ❌ NPDB direct API integration
- ❌ State medical board APIs
- ❌ DEA validation service
- ❌ ABMS board certification checks
- ❌ OIG/SAM sanctions screening

*Why Excluded:* API integration complexity, vendor contracts required, rate limits. MVP uses mock data to demonstrate policy engine.

**Digital Credential Issuance:**
- ❌ W3C Verifiable Credential generation
- ❌ DID-based holder binding
- ❌ Cryptographic signature creation
- ❌ Selective disclosure support

*Why Excluded:* Requires DID infrastructure, wallet integration, issuer-api completion. MVP demonstrates acceptance flow without full crypto stack.

**Blockchain Anchoring:**
- ❌ Substrate chain integration
- ❌ On-chain hash anchoring
- ❌ Merkle proof generation
- ❌ Cross-chain interop

*Why Excluded:* Blockchain adds deployment complexity without changing core demo. MVP proves canonical path enforcement first.

**Multi-Facility Support:**
- ❌ Organization management
- ❌ Multi-site credentialing
- ❌ Facility privilege delegation runtime (contracts exist only)
- ❌ Cross-organization acceptance

*Why Excluded:* Adds data model complexity. MVP focuses on single employer→clinician path.

**Production Infrastructure:**
- ❌ OAuth/OIDC authentication
- ❌ Role-based access control
- ❌ Audit logging service
- ❌ Monitoring and alerting
- ❌ Backup and disaster recovery

*Why Excluded:* Not required to demonstrate canonical path. MVP prioritizes correctness over ops.

**Advanced UX Features:**
- ❌ Multi-step wizards
- ❌ Dashboard analytics
- ❌ Notification system
- ❌ Real-time updates
- ❌ Mobile apps

*Why Excluded:* Violates antigravity principle. MVP shows minimal blocking UX only.

## Why Scope Is Constrained

### YC Demo Objective

Prove the canonical path works:
1. Clinician onboards with NPI verification
2. VitalCV issues recognition
3. Employer accepts with PSV requirement enforced
4. Employment proceeds without re-verification

**Success Metric:** Demo shows compile-time prevention of canonical path violation.

### Constraints

**Time:** YC application deadline drives MVP scope
**Complexity:** Infrastructure must work before scaling
**Regulatory:** Compliance foundation before production deployment
**Antigravity:** No features that don't remove blocking friction

## Scope Decisions

### Included Decisions

1. **NPI-Only Onboarding:** NPI lookup is mocked to keep the demo deterministic
2. **PSV Policy Engine:** Core value prop is evidence evaluation, must demonstrate decisioning logic
3. **Type-Safe Canonical Path:** Compile-time enforcement is the innovation, must be in MVP
4. **Antigravity Compliance:** Removing friction is the product, UX must demonstrate this

### Excluded Decisions

1. **Multi-Credential Types:** MVP proves path with one credential, extensibility designed but not implemented
2. **Real-Time PSV:** Policy engine works with any evidence source, real APIs deferred
3. **Blockchain:** Immutability proof valuable but not blocking for canonical path demo
4. **Enterprise Features:** Auth, RBAC, multi-tenancy are operational concerns, defer until path proven

## What Gets Added Next

Post-YC priorities if canonical path is validated:

### Phase 1: Production-Ready PSV
- Integrate NPDB API
- Add state medical board connectors
- Implement DEA validation
- Enable real-time sanctions screening

### Phase 2: Digital Credentials
- Complete issuer-api implementation
- Add W3C VC issuance
- Integrate DID infrastructure
- Build wallet presentation flow

### Phase 3: Scale Infrastructure
- Multi-facility support
- Organization management
- Production auth and RBAC
- Monitoring and audit logging

### Phase 4: Regulatory Compliance
- NCQA accreditation preparation
- HIPAA compliance audit
- CMS CoP validation
- Legal review for all 50 states

## Scope Guardrails

### Never Add:
- Features that violate antigravity principle
- Parallel workflows or optional steps
- Manual data entry for verified facts
- Dashboards outside blocking moments
- Integration that doesn't replace friction

### Only Add If:
- Removes blocking friction from hiring workflow
- Enforces canonical path requirement
- Provides regulatory compliance evidence
- Scales to all healthcare employers

## Current State Summary

**What Works:**
- Canonical path type enforcement
- PSV policy evaluation engine
- Mock NPI lookup flow
- PSV demo API + UI

**What's Missing:**
- Live PSV source integrations
- Cryptographic credential issuance
- Blockchain anchoring
- Production deployment
- Enterprise features

**What's Proven:**
- Canonical path is type-safe
- PSV policy is deterministic
- Antigravity compliance is possible
- Regulatory requirements are addressable

## MVP Success Criteria

The YC MVP is successful if it demonstrates:

1. ✅ Canonical path cannot be bypassed (compile-time enforcement)
2. ✅ PSV requirement is mandatory at acceptance (type-level proof)
3. ✅ Antigravity principle holds (no added workflow friction)
4. ✅ Regulatory compliance is designed in (NCQA/CMS requirements mapped)

Everything else is deferred until these four are validated.

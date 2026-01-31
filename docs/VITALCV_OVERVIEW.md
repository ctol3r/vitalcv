# VitalCV Overview

## What VitalCV Is

VitalCV is a trust infrastructure system that enables healthcare employers to accept verified professional credentials without re-verification.

It replaces credentialing friction with a single irreversible action:

> Clinician presents verified authority → Employer accepts → Employment proceeds

## What Problem It Solves

Healthcare credentialing creates workflow paralysis:

**Current State:**
- Employers demand credentials at every hire
- Clinicians re-submit the same documents repeatedly
- Manual verification delays every start date
- Verification committees create 45-90 day credentialing cycles
- No employer trusts another employer's verification work

**Root Cause:**
Employers rely on **inferred trust** (collecting documents and hoping they're real) instead of **issued trust** (accepting cryptographic proofs from authoritative sources).

**VitalCV Solution:**
Replace document collection with verification acceptance. Employers accept proofs issued by authoritative sources (NPPES, state medical boards, NPDB) instead of re-verifying documents.

## Who It Is For

### Primary Users
- **Healthcare Employers** (hospitals, health systems, locum agencies) who need to verify and start clinicians
- **Healthcare Clinicians** (physicians, nurses, allied health professionals) who need to prove their authority to practice

### Supported Roles
- **Credentialing Professionals**: Medical staff services, privileging coordinators
- **Hiring Managers**: Department heads, recruitment teams
- **Compliance Officers**: Risk management, regulatory affairs

## What Exists Now

### Core Infrastructure (Production-Ready)

**Domain Primitives:**
- `employmentContracts.ts` - Canonical path types (Recognition → Acceptance → Start)
- `employmentGuards.ts` - Compile-time enforcement of canonical path
- `psvContracts.ts` - Primary Source Verification evidence types
- `psvPolicy.ts` - Policy evaluation engine for PSV decisions

**Services:**
- NPI synchronization with NPPES registry
- PSV policy evaluation
- Employment verification path enforcement

**Compliance Foundation:**
- NCQA CR1-CR5 requirements documented
- CMS Conditions of Participation mapped
- Negligent credentialing liability protections

### MVP Scope (YC Demo)

**Implemented:**
- Clinician onboarding via NPI verification
- Recognition event issuance
- Employer acceptance with PSV requirement
- Read-only credential snapshots

**Not Yet Implemented:**
- Live PSV source integrations (NPDB, state boards)
- Digital credential issuance
- Blockchain anchoring
- Multi-facility support

See [MVP_SCOPE.md](./MVP_SCOPE.md) for detailed boundaries.

## Architecture

```
VitalCV Trust Infrastructure

┌─────────────────────────────────────────────────────────┐
│  Authoritative Sources (Primary Sources)                │
│  NPPES · State Medical Boards · NPDB · DEA · ABMS       │
└────────────────────┬────────────────────────────────────┘
                     │ PSV Evidence
                     ▼
┌─────────────────────────────────────────────────────────┐
│  VitalCV PSV Engine                                      │
│  • Evaluate evidence against policy                      │
│  • Issue decisions (CLEAR / REVIEW / BLOCK)             │
│  • Anchor to immutable storage                          │
└────────────────────┬────────────────────────────────────┘
                     │ Verified Authority
                     ▼
┌─────────────────────────────────────────────────────────┐
│  Canonical Path Enforcement                              │
│  Recognition → Acceptance → Start                        │
│  (TypeScript type system enforces at compile time)       │
└────────────────────┬────────────────────────────────────┘
                     │ Employment Start
                     ▼
┌─────────────────────────────────────────────────────────┐
│  Employer Action                                         │
│  Clinician granted privileges without re-verification    │
└─────────────────────────────────────────────────────────┘
```

## Key Principles

1. **Antigravity Compliance** - VitalCV only appears at blocking moments, never as optional workflow
2. **Evidence-First** - All claims backed by cryptographic proof from primary sources
3. **Canonical Path** - Exactly one valid sequence: Recognition → Acceptance → Start
4. **Type-Safe Enforcement** - TypeScript compiler enforces legal requirements
5. **Regulatory Defensibility** - NCQA + CMS compliance by design

## Current Status

- **Codebase**: Monorepo with domain primitives, test coverage 100%
- **Deployment**: Development environment only
- **Compliance**: Foundation in place, full audit pending
- **YC Demo**: Scoped to recognition + acceptance flow

## Next Steps

See:
- [TRUST_LOOP.md](./TRUST_LOOP.md) - How the system proves trust
- [CRED0_DOCTRINE.md](./CRED0_DOCTRINE.md) - Why inferred trust fails
- [MVP_SCOPE.md](./MVP_SCOPE.md) - What's in and what's out

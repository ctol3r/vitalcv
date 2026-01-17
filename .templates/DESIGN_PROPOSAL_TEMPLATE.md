# VitalCV Design Proposal: [Feature/Fix Name]

**Proposal ID**: `DP-YYYY-MM-DD-short-name`
**Author**: @github-username
**Date**: YYYY-MM-DD
**Status**: `DRAFT` | `REVIEW` | `APPROVED` | `IMPLEMENTED` | `REJECTED`
**Related P0 Gap**: (if applicable, e.g., P0-01)
**Domain Owner**: @team-lead

---

## Problem Statement

### Current Situation

[Describe what exists today. Be specific with file paths and line numbers.]

Example:

> The verifier currently returns `{ valid: true }` for credentials from unknown issuers (verifyCredential.ts:131-140), bypassing all cryptographic verification.

### Issues with Current Implementation

[List specific problems, bugs, or limitations]

- **Issue 1**: [description]

  - Impact: [security/performance/compliance/UX]
  - Evidence: [file paths, error logs, test failures]

- **Issue 2**: [description]
  - Impact: [...]
  - Evidence: [...]

### Root Cause Analysis

[Why does this problem exist? Technical debt? Missing requirement? Stub implementation?]

---

## Success Criteria

Define measurable outcomes that indicate the problem is solved.

### Functional Requirements

- [ ] **FR-1**: [Specific functionality that must work]

  - Test: [How to verify this works]

- [ ] **FR-2**: [Another requirement]
  - Test: [Verification method]

### Non-Functional Requirements

- [ ] **NFR-1**: Performance (e.g., "Verification latency < 100ms p99")

  - Metric: [How to measure]

- [ ] **NFR-2**: Security (e.g., "Unauthorized access returns HTTP 403")

  - Test: [Security test case]

- [ ] **NFR-3**: Compliance (e.g., "W3C VC Data Model 2.0 compliant")
  - Validation: [Compliance check method]

### Acceptance Criteria

[Boolean criteria that must all be true for this to be "done"]

- [ ] All integration tests pass
- [ ] Code review approved by @domain-owner
- [ ] Security review passed (if security-related)
- [ ] Documentation updated
- [ ] Deployed to staging and validated
- [ ] Launch-readiness checklist completed

---

## Architecture Changes

### Current Architecture

[Diagram or description of current system]

```text
[Component A] --> [Component B] --> [Component C]
```

**Components**:

- **Component A** (`/path/to/file.ts`): [Description]
- **Component B** (`/path/to/file.ts`): [Description]

**Current Flow**:

1. Step 1
2. Step 2
3. Step 3

### Proposed Architecture

[Diagram or description of new system]

```text
[Component A] --> [New Component X] --> [Component B] --> [Component C]
                       |
                       v
                  [New Component Y]
```

**New Components**:

- **Component X** (`/proposed/path/to/file.ts`): [Description & responsibility]
- **Component Y** (`/proposed/path/to/file.ts`): [Description & responsibility]

**Proposed Flow**:

1. Step 1
2. **NEW**: Step 1.5 (Component X validates...)
3. Step 2
4. **CHANGED**: Step 3 now includes Y

### Changes to Existing Components

| Component   | File Path       | Change Type | Description                     |
| ----------- | --------------- | ----------- | ------------------------------- |
| Component A | `/path/to/a.ts` | MODIFY      | Add validation logic at line 42 |
| Component B | `/path/to/b.ts` | REFACTOR    | Extract method for testability  |
| Component C | `/path/to/c.ts` | DELETE      | Remove deprecated endpoint      |

---

## Data Model Changes

### Current Schema

[Show relevant Prisma models, database tables, or data structures]

```prisma
model Credential {
  id        String   @id @default(uuid())
  userId    String
  type      String
  data      Json
  createdAt DateTime @default(now())
}
```

### Proposed Schema

[Show new/modified schema]

```prisma
model Credential {
  id        String   @id @default(uuid())
  userId    String
  type      String
  data      Json
  issuerDid String   // NEW FIELD
  status    CredentialStatus @default(ACTIVE) // NEW FIELD
  createdAt DateTime @default(now())
  revokedAt DateTime? // NEW FIELD

  @@index([issuerDid]) // NEW INDEX
  @@index([status])     // NEW INDEX
}

enum CredentialStatus { // NEW ENUM
  ACTIVE
  REVOKED
  EXPIRED
}
```

### Migration Plan

[How to migrate existing data]

1. **Add new fields** as nullable first
2. **Backfill data** for existing records:

   ```sql
   UPDATE Credential SET issuerDid = 'did:web:issuer.vitalcv.com', status = 'ACTIVE' WHERE issuerDid IS NULL;
   ```

3. **Make fields required** in schema
4. **Deploy** new schema

**Rollback Plan**:

- Revert migration: `pnpm prisma migrate rollback`
- Fields added are nullable, so rollback is safe

---

## API Contracts

### New Endpoints

#### `POST /api/credentials/verify`

**Purpose**: Verify a credential's authenticity

**Request**:

```typescript
{
  credential: string; // JWT or JSON-LD VC
  options?: {
    checkRevocation?: boolean;
    trustedIssuers?: string[]; // DIDs
  }
}
```

**Response (Success - 200)**:

```typescript
{
  valid: boolean;
  issuer: {
    did: string;
    trusted: boolean;
  }
  checks: {
    signatureValid: boolean;
    notExpired: boolean;
    notRevoked: boolean;
  }
  verifiedAt: string; // ISO 8601 timestamp
}
```

**Response (Error - 401)**:

```typescript
{
  error: 'unknown_issuer' | 'invalid_signature' | 'expired' | 'revoked';
  error_description: string;
}
```

**Security**:

- Rate limit: 100 requests/minute per IP
- DPoP required: YES / NO
- Authentication: None required (public endpoint)

### Modified Endpoints

#### `GET /api/credentials/:id` (CHANGED)

**What changed**: Added revocation status to response

**New Response Field**:

```typescript
{
  // ... existing fields ...
  status: "active" | "revoked" | "expired"; // NEW
  revokedAt?: string; // NEW (ISO 8601)
  revokedReason?: string; // NEW
}
```

**Backward Compatibility**: Fully backward compatible (added fields only)

### Deprecated Endpoints

#### `POST /api/verify` (DEPRECATED)

**Reason**: Replaced by `/api/credentials/verify`
**Timeline**: Remove in v2.0 (6 months)
**Migration Path**: Update clients to use new endpoint

---

## Trust Implications

### Trust Model Changes

**Current Trust Assumption**:

> All issuers are trusted (no verification)

**New Trust Model**:

> Only issuers in whitelist are trusted, with cryptographic verification

### Cryptographic Operations

| Operation              | Algorithm       | Key Material                  | Location                                        |
| ---------------------- | --------------- | ----------------------------- | ----------------------------------------------- |
| Credential Signing     | EdDSA (Ed25519) | Issuer private key            | `/services/identity/signingKeyProvider`         |
| Signature Verification | EdDSA (Ed25519) | Issuer public key (from JWKS) | `/apps/verifier-api/src/crypto/verify.ts`       |
| DID Resolution         | N/A             | Public DID documents          | `/packages/domain-identity/src/did/resolver.ts` |

### Trust Anchors

1. **Issuer Whitelist** (`TRUSTED_ISSUERS` env var)

   - Source of truth: Configuration file
   - Update process: Manual review + deployment
   - Fallback: Reject all unknown issuers

2. **DID Document Resolution**

   - Source: DNS (did:web) or blockchain (did:ethr)
   - Caching: 15 minutes TTL
   - Failure mode: Fail-closed (reject if cannot resolve)

3. **Revocation Status**
   - Source: PostgreSQL database
   - Replication: Primary + read replica
   - Failure mode: Fail-closed (reject if status API down)

### Security Boundaries

**Before**:

```text
[External Wallet] --no verification--> [Verifier API] --accepts all--> [Database]
```

**After**:

```text
[External Wallet] --presents VC--> [Verifier API] --checks:
                                        |  1. Signature (crypto)
                                        |  2. Issuer (whitelist)
                                        |  3. Revocation (DB)
                                        v
                                   [Accept/Reject] --> [Database (if accept)]
```

**New Attack Surface**:

- DID resolution (DNS hijacking for did:web)
- Revocation database compromise
- Key material theft

**Mitigations**:

- DNSSEC for did:web resolution
- Database encryption at rest
- HSM for key storage (future)

---

## Compliance Considerations

### Regulatory Impact

#### HIPAA

- **Requirement**: Audit trail for all credential verifications
- **Implementation**: Add audit logging to verification endpoint
- **Evidence**: Prisma `AuditEvent` model entries

#### W3C VC Data Model 2.0

- **Current Compliance**: 6/8 requirements
- **New Compliance**: 8/8 requirements (adds proof + credentialStatus)
- **Changes**:
  - Add `proof` field to all VCs
  - Add `credentialStatus` field linking to StatusList2021

#### OIDC4VCI Specification

- **Current Compliance**: 4/9 requirements
- **New Compliance**: 7/9 requirements (adds DPoP, metadata, JWKS)
- **Gaps Remaining**: Authorization server metadata, PAR support

### Privacy Impact

**PII Handling**:

- Credentials contain: Name, NPI, medical license number
- Storage: Encrypted at rest (database-level encryption)
- Transmission: TLS 1.3 required
- Retention: 7 years (regulatory requirement)

**Right to Erasure** (GDPR):

- On-chain data: Only hashes stored (not PII)
- Off-chain data: Can be deleted from database
- Implementation: Set `isDeleted = true`, keep audit trail

**Consent Management**:

- User must consent to credential issuance
- Consent stored in `ConsentRecord` table
- Withdrawal: User can revoke consent (triggers credential revocation)

---

## Explicit Non-Goals

What this proposal intentionally does NOT include:

### Out of Scope for This Proposal

1. **Blockchain Integration**

   - Reason: P0-08 is separate effort, can use database audit trail for MVP
   - Future: Add blockchain anchoring in v2.0

2. **Biometric Authentication**

   - Reason: Not launch-blocking, adds complexity
   - Future: Add in v1.2 after launch

3. **Mobile Wallet**

   - Reason: Web wallet sufficient for MVP
   - Future: React Native app in roadmap

4. **International License Support**

   - Reason: US-only for pilot program
   - Future: Add EU/Canada support in v1.5

5. **Batch Credential Issuance**
   - Reason: Single credential flow sufficient for MVP
   - Future: Add batch API when customer requests it

### Deferred to Future Releases

| Feature                        | Reason                       | Target Release |
| ------------------------------ | ---------------------------- | -------------- |
| Hardware Security Module (HSM) | Cost, not required for pilot | v2.0           |
| Post-Quantum Cryptography      | Standards not finalized      | v3.0           |
| Zero-Knowledge Proofs          | Complex, niche use case      | TBD            |

### Will NOT Implement

| Feature                  | Reason                     |
| ------------------------ | -------------------------- |
| Credential marketplace   | Not core to platform       |
| AI credential validation | Unreliable, liability risk |
| Cryptocurrency payments  | Regulatory uncertainty     |

---

## Implementation Plan

### Phase 1: Preparation (Days 1-2)

**Goal**: Set up infrastructure and dependencies

- [ ] Create feature branch: `feature/[short-name]`
- [ ] Update Prisma schema (if needed)
- [ ] Run migrations on dev database
- [ ] Install any new dependencies
- [ ] Update environment variables template

### Phase 2: Core Implementation (Days 3-7)

**Goal**: Implement main functionality

**Week 1 Tasks**:

- [ ] Implement Component X (`/path/to/x.ts`)
- [ ] Modify Component A for integration
- [ ] Write unit tests for new components
- [ ] Update API routes

**Code Review Checkpoint**: Informal review with @domain-owner

### Phase 3: Integration (Days 8-10)

**Goal**: Connect all pieces, end-to-end testing

- [ ] Integration tests for full flow
- [ ] Error handling and edge cases
- [ ] Performance testing
- [ ] Security testing

**Code Review Checkpoint**: Formal review, PR opened

### Phase 4: Documentation & Deployment (Days 11-12)

**Goal**: Prepare for production

- [ ] Update API documentation (OpenAPI spec)
- [ ] Update README / developer docs
- [ ] Create deployment guide
- [ ] Deploy to staging
- [ ] Validation testing in staging
- [ ] Deploy to production (after approval)

### Rollback Plan

If issues discovered after deployment:

1. **Immediate**: Revert deployment (git revert + redeploy)
2. **Database**: Run rollback migration if schema changed
3. **Configuration**: Restore previous env vars
4. **Monitoring**: Check all systems green after rollback
5. **Post-mortem**: Document what went wrong, update plan

---

## Dependencies & Blockers

### Upstream Dependencies

[What must be completed before this can start?]

- **P0-04**: Signing Key Provider must be implemented first
- **P0-11**: Production database must be configured

### Downstream Dependencies

[What is blocked by this?]

- **P0-10**: W3C VC Compliance depends on this for proof generation
- **Future Feature X**: Depends on this for...

### External Dependencies

[Third-party services, APIs, or tools]

- **DID Resolution**: Requires universal-resolver library
- **KMS**: Requires AWS KMS access (if using cloud HSM)
- **Monitoring**: Requires Datadog API key for metrics

### Resource Requirements

| Resource            | Quantity         | Purpose             |
| ------------------- | ---------------- | ------------------- |
| Engineer (Backend)  | 1 FTE, 2 weeks   | Core implementation |
| Engineer (Security) | 0.5 FTE, 1 week  | Security review     |
| DevOps Engineer     | 0.25 FTE, 2 days | Deployment + infra  |
| QA Engineer         | 0.5 FTE, 1 week  | Integration testing |

---

## Testing Strategy

### Unit Tests

**Coverage Target**: 90% for new code

```typescript
// Example test structure
describe('CredentialVerifier', () => {
  describe('verifySignature', () => {
    it('should accept valid Ed25519 signature', async () => {
      // ...
    });

    it('should reject invalid signature', async () => {
      // ...
    });

    it('should reject expired credentials', async () => {
      // ...
    });
  });
});
```

**Files to Test**:

- `/path/to/new/file.ts` (100% coverage)
- `/path/to/modified/file.ts` (cover new lines)

### Integration Tests

**Test Scenarios**:

1. **Happy Path**: Issue credential → verify → success
2. **Revoked Credential**: Issue → revoke → verify → reject
3. **Unknown Issuer**: Issue from untrusted → verify → reject
4. **Expired Credential**: Issue with exp in past → verify → reject

### Security Tests

- [ ] **Signature Forgery**: Tamper with credential signature → verify → reject
- [ ] **Issuer Impersonation**: Use wrong DID → verify → reject
- [ ] **Replay Attack**: Reuse DPoP proof → second request → reject
- [ ] **Authorization Bypass**: Call revocation endpoint without auth → HTTP 401

### Performance Tests

**Load Test**: 1000 concurrent credential verifications

- **Target**: < 200ms p99 latency
- **Tool**: k6 or Apache JMeter
- **Success Criteria**: 99.9% success rate

### Compliance Tests

- [ ] **W3C VC Validator**: Use official validator tool
- [ ] **OIDC4VCI Test Suite**: Run conformance tests
- [ ] **DPoP Compliance**: Verify RFC 9449 compliance

---

## Monitoring & Observability

### Metrics to Track

| Metric                                | Purpose            | Alert Threshold |
| ------------------------------------- | ------------------ | --------------- |
| `credential_verifications_total`      | Volume tracking    | N/A             |
| `credential_verifications_failed`     | Error rate         | > 5%            |
| `credential_verification_duration_ms` | Performance        | p99 > 200ms     |
| `did_resolution_failures`             | DID service health | > 1%            |
| `revocation_check_timeouts`           | Status API health  | > 0.1%          |

### Logs to Capture

```typescript
logger.info('Credential verification attempt', {
  credentialId: 'hash(id)', // privacy: hash PII
  issuerDid: credential.issuer,
  result: 'success' | 'failure',
  reason: 'expired' | 'revoked' | 'invalid_signature',
  durationMs: 45,
  requestId: req.id,
});
```

### Dashboards

1. **Verification Health Dashboard**

   - Success rate (last 24h)
   - p50/p95/p99 latency
   - Error breakdown (by reason)

2. **Security Dashboard**
   - Failed verification attempts (by issuer)
   - Unknown issuer rejections
   - Revocation events

### Alerts

| Alert                          | Condition              | Severity | Action                |
| ------------------------------ | ---------------------- | -------- | --------------------- |
| High Verification Failure Rate | > 5% for 5 min         | P1       | Page on-call engineer |
| DID Resolution Down            | > 10 failures          | P2       | Notify team Slack     |
| Revocation DB Unreachable      | Any connection failure | P0       | Immediate escalation  |

---

## Risk Assessment

### Technical Risks

| Risk                             | Likelihood | Impact   | Mitigation                                                   |
| -------------------------------- | ---------- | -------- | ------------------------------------------------------------ |
| DID resolution service outage    | Medium     | High     | Implement caching (15 min TTL) + fallback to last known good |
| Key compromise                   | Low        | Critical | Use HSM, implement key rotation, monitor for anomalies       |
| Database performance degradation | Medium     | Medium   | Add indexes, connection pooling, read replicas               |

### Business Risks

| Risk                      | Likelihood | Impact   | Mitigation                                          |
| ------------------------- | ---------- | -------- | --------------------------------------------------- |
| Regulatory non-compliance | Low        | Critical | Regular compliance audits, engage legal counsel     |
| Customer adoption delay   | Medium     | Medium   | Pilot program with early customers, gather feedback |

### Security Risks

| Risk                 | CVSS           | Mitigation                                          |
| -------------------- | -------------- | --------------------------------------------------- |
| Issuer impersonation | 9.1 (Critical) | DID-based verification + issuer whitelist           |
| Credential forgery   | 8.8 (High)     | Ed25519 signatures + verification                   |
| Revocation bypass    | 7.5 (High)     | Persistent revocation DB + fail-closed verification |

---

## Open Questions

[Questions that need answers before or during implementation]

1. **Q**: Should we support multiple credential formats (JWT + JSON-LD)?

   - **Owner**: @standards-lead
   - **Deadline**: Day 2
   - **Blocking**: No (can start with JWT only)

2. **Q**: What is the revocation status cache TTL?

   - **Owner**: @backend-lead
   - **Deadline**: Day 1
   - **Blocking**: Yes (affects architecture)
   - **Options**: 5 min, 15 min, or 1 hour

3. **Q**: Do we need a staging environment for blockchain integration?
   - **Owner**: @blockchain-lead
   - **Deadline**: Before Phase 4
   - **Blocking**: No (can defer blockchain to v2)

---

## Approval

### Required Reviewers

- [ ] **Technical Review**: @backend-lead
- [ ] **Security Review**: @security-lead
- [ ] **Compliance Review**: @compliance-lead (if compliance impact)
- [ ] **Architecture Review**: @cto (if significant architecture change)

### Approval Status

| Reviewer       | Status  | Date | Comments |
| -------------- | ------- | ---- | -------- |
| @backend-lead  | PENDING | -    | -        |
| @security-lead | PENDING | -    | -        |

**Final Approval**: @domain-owner

---

## References

### Related Documents

- [P0 Gap Analysis](./P0_GAP_ANALYSIS.md)
- [Trust Flow Analysis](./TRUST_FLOW_ANALYSIS.md)
- [Architecture Map](./VITALCV_ARCHITECTURE.md)

### External Standards

- [W3C Verifiable Credentials Data Model 2.0](https://www.w3.org/TR/vc-data-model-2.0/)
- [OIDC4VCI Specification](https://openid.net/specs/openid-4-verifiable-credential-issuance-1_0.html)
- [RFC 9449: DPoP](https://datatracker.ietf.org/doc/rfc9449/)
- [StatusList2021](https://w3c-ccg.github.io/vc-status-list-2021/)

### Code Examples

- [DPoP Implementation](../apps/issuer-api/src/middleware/dpopGuard.ts)
- [Ed25519 Signing](../packages/domain-identity/src/crypto/ed25519.ts)

---

**Template Version**: 1.0
**Last Updated**: 2026-01-09
**Maintained By**: @engineering-lead
**Author**: @github-username
**Date**: YYYY-MM-DD
**Status**: `DRAFT` | `REVIEW` | `APPROVED` | `IMPLEMENTED` | `REJECTED`
**Related P0 Gap**: (if applicable, e.g., P0-01)
**Domain Owner**: @team-lead

---

## Problem Statement

### Current Situation

[Describe what exists today. Be specific with file paths and line numbers.]

Example:

> The verifier currently returns `{ valid: true }` for credentials from unknown issuers (verifyCredential.ts:131-140), bypassing all cryptographic verification.

### Issues with Current Implementation

[List specific problems, bugs, or limitations]

- **Issue 1**: [description]

  - Impact: [security/performance/compliance/UX]
  - Evidence: [file paths, error logs, test failures]

- **Issue 2**: [description]
  - Impact: [...]
  - Evidence: [...]

### Root Cause Analysis

[Why does this problem exist? Technical debt? Missing requirement? Stub implementation?]

---

## Success Criteria

Define measurable outcomes that indicate the problem is solved.

### Functional Requirements

- [ ] **FR-1**: [Specific functionality that must work]

  - Test: [How to verify this works]

- [ ] **FR-2**: [Another requirement]
  - Test: [Verification method]

### Non-Functional Requirements

- [ ] **NFR-1**: Performance (e.g., "Verification latency < 100ms p99")

  - Metric: [How to measure]

- [ ] **NFR-2**: Security (e.g., "Unauthorized access returns HTTP 403")

  - Test: [Security test case]

- [ ] **NFR-3**: Compliance (e.g., "W3C VC Data Model 2.0 compliant")
  - Validation: [Compliance check method]

### Acceptance Criteria

[Boolean criteria that must all be true for this to be "done"]

- [ ] All integration tests pass
- [ ] Code review approved by @domain-owner
- [ ] Security review passed (if security-related)
- [ ] Documentation updated
- [ ] Deployed to staging and validated
- [ ] Launch-readiness checklist completed

---

## Architecture Changes

### Current Architecture

[Diagram or description of current system]

```text
[Component A] --> [Component B] --> [Component C]
```

**Components**:

- **Component A** (`/path/to/file.ts`): [Description]
- **Component B** (`/path/to/file.ts`): [Description]

**Current Flow**:

1. Step 1
2. Step 2
3. Step 3

### Proposed Architecture

[Diagram or description of new system]

```text
[Component A] --> [New Component X] --> [Component B] --> [Component C]
                       |
                       v
                  [New Component Y]
```

**New Components**:

- **Component X** (`/proposed/path/to/file.ts`): [Description & responsibility]
- **Component Y** (`/proposed/path/to/file.ts`): [Description & responsibility]

**Proposed Flow**:

1. Step 1
2. **NEW**: Step 1.5 (Component X validates...)
3. Step 2
4. **CHANGED**: Step 3 now includes Y

### Changes to Existing Components

| Component   | File Path       | Change Type | Description                     |
| ----------- | --------------- | ----------- | ------------------------------- |
| Component A | `/path/to/a.ts` | MODIFY      | Add validation logic at line 42 |
| Component B | `/path/to/b.ts` | REFACTOR    | Extract method for testability  |
| Component C | `/path/to/c.ts` | DELETE      | Remove deprecated endpoint      |

---

## Data Model Changes

### Current Schema

[Show relevant Prisma models, database tables, or data structures]

```prisma
model Credential {
  id        String   @id @default(uuid())
  userId    String
  type      String
  data      Json
  createdAt DateTime @default(now())
}
```

### Proposed Schema

[Show new/modified schema]

```prisma
model Credential {
  id        String   @id @default(uuid())
  userId    String
  type      String
  data      Json
  issuerDid String   // NEW FIELD
  status    CredentialStatus @default(ACTIVE) // NEW FIELD
  createdAt DateTime @default(now())
  revokedAt DateTime? // NEW FIELD

  @@index([issuerDid]) // NEW INDEX
  @@index([status])     // NEW INDEX
}

enum CredentialStatus { // NEW ENUM
  ACTIVE
  REVOKED
  EXPIRED
}
```

### Migration Plan

[How to migrate existing data]

1. **Add new fields** as nullable first
2. **Backfill data** for existing records:

   ```sql
   UPDATE Credential SET issuerDid = 'did:web:issuer.vitalcv.com', status = 'ACTIVE' WHERE issuerDid IS NULL;
   ```

3. **Make fields required** in schema
4. **Deploy** new schema

**Rollback Plan**:

- Revert migration: `pnpm prisma migrate rollback`
- Fields added are nullable, so rollback is safe

---

## API Contracts

### New Endpoints

#### `POST /api/credentials/verify`

**Purpose**: Verify a credential's authenticity

**Request**:

```typescript
{
  credential: string; // JWT or JSON-LD VC
  options?: {
    checkRevocation?: boolean;
    trustedIssuers?: string[]; // DIDs
  }
}
```

**Response (Success - 200)**:

```typescript
{
  valid: boolean;
  issuer: {
    did: string;
    trusted: boolean;
  }
  checks: {
    signatureValid: boolean;
    notExpired: boolean;
    notRevoked: boolean;
  }
  verifiedAt: string; // ISO 8601 timestamp
}
```

**Response (Error - 401)**:

```typescript
{
  error: 'unknown_issuer' | 'invalid_signature' | 'expired' | 'revoked';
  error_description: string;
}
```

**Security**:

- Rate limit: 100 requests/minute per IP
- DPoP required: YES / NO
- Authentication: None required (public endpoint)

### Modified Endpoints

#### `GET /api/credentials/:id` (CHANGED)

**What changed**: Added revocation status to response

**New Response Field**:

```typescript
{
  // ... existing fields ...
  status: "active" | "revoked" | "expired"; // NEW
  revokedAt?: string; // NEW (ISO 8601)
  revokedReason?: string; // NEW
}
```

**Backward Compatibility**: Fully backward compatible (added fields only)

### Deprecated Endpoints

#### `POST /api/verify` (DEPRECATED)

**Reason**: Replaced by `/api/credentials/verify`
**Timeline**: Remove in v2.0 (6 months)
**Migration Path**: Update clients to use new endpoint

---

## Trust Implications

### Trust Model Changes

**Current Trust Assumption**:

> All issuers are trusted (no verification)

**New Trust Model**:

> Only issuers in whitelist are trusted, with cryptographic verification

### Cryptographic Operations

| Operation              | Algorithm       | Key Material                  | Location                                        |
| ---------------------- | --------------- | ----------------------------- | ----------------------------------------------- |
| Credential Signing     | EdDSA (Ed25519) | Issuer private key            | `/services/identity/signingKeyProvider`         |
| Signature Verification | EdDSA (Ed25519) | Issuer public key (from JWKS) | `/apps/verifier-api/src/crypto/verify.ts`       |
| DID Resolution         | N/A             | Public DID documents          | `/packages/domain-identity/src/did/resolver.ts` |

### Trust Anchors

1. **Issuer Whitelist** (`TRUSTED_ISSUERS` env var)

   - Source of truth: Configuration file
   - Update process: Manual review + deployment
   - Fallback: Reject all unknown issuers

2. **DID Document Resolution**

   - Source: DNS (did:web) or blockchain (did:ethr)
   - Caching: 15 minutes TTL
   - Failure mode: Fail-closed (reject if cannot resolve)

3. **Revocation Status**
   - Source: PostgreSQL database
   - Replication: Primary + read replica
   - Failure mode: Fail-closed (reject if status API down)

### Security Boundaries

**Before**:

```text
[External Wallet] --no verification--> [Verifier API] --accepts all--> [Database]
```

**After**:

```text
[External Wallet] --presents VC--> [Verifier API] --checks:
                                        |  1. Signature (crypto)
                                        |  2. Issuer (whitelist)
                                        |  3. Revocation (DB)
                                        v
                                   [Accept/Reject] --> [Database (if accept)]
```

**New Attack Surface**:

- DID resolution (DNS hijacking for did:web)
- Revocation database compromise
- Key material theft

**Mitigations**:

- DNSSEC for did:web resolution
- Database encryption at rest
- HSM for key storage (future)

---

## Compliance Considerations

### Regulatory Impact

#### HIPAA

- **Requirement**: Audit trail for all credential verifications
- **Implementation**: Add audit logging to verification endpoint
- **Evidence**: Prisma `AuditEvent` model entries

#### W3C VC Data Model 2.0

- **Current Compliance**: 6/8 requirements
- **New Compliance**: 8/8 requirements (adds proof + credentialStatus)
- **Changes**:
  - Add `proof` field to all VCs
  - Add `credentialStatus` field linking to StatusList2021

#### OIDC4VCI Specification

- **Current Compliance**: 4/9 requirements
- **New Compliance**: 7/9 requirements (adds DPoP, metadata, JWKS)
- **Gaps Remaining**: Authorization server metadata, PAR support

### Privacy Impact

**PII Handling**:

- Credentials contain: Name, NPI, medical license number
- Storage: Encrypted at rest (database-level encryption)
- Transmission: TLS 1.3 required
- Retention: 7 years (regulatory requirement)

**Right to Erasure** (GDPR):

- On-chain data: Only hashes stored (not PII)
- Off-chain data: Can be deleted from database
- Implementation: Set `isDeleted = true`, keep audit trail

**Consent Management**:

- User must consent to credential issuance
- Consent stored in `ConsentRecord` table
- Withdrawal: User can revoke consent (triggers credential revocation)

---

## Explicit Non-Goals

What this proposal intentionally does NOT include:

### Out of Scope for This Proposal

1. **Blockchain Integration**

   - Reason: P0-08 is separate effort, can use database audit trail for MVP
   - Future: Add blockchain anchoring in v2.0

2. **Biometric Authentication**

   - Reason: Not launch-blocking, adds complexity
   - Future: Add in v1.2 after launch

3. **Mobile Wallet**

   - Reason: Web wallet sufficient for MVP
   - Future: React Native app in roadmap

4. **International License Support**

   - Reason: US-only for pilot program
   - Future: Add EU/Canada support in v1.5

5. **Batch Credential Issuance**
   - Reason: Single credential flow sufficient for MVP
   - Future: Add batch API when customer requests it

### Deferred to Future Releases

| Feature                        | Reason                       | Target Release |
| ------------------------------ | ---------------------------- | -------------- |
| Hardware Security Module (HSM) | Cost, not required for pilot | v2.0           |
| Post-Quantum Cryptography      | Standards not finalized      | v3.0           |
| Zero-Knowledge Proofs          | Complex, niche use case      | TBD            |

### Will NOT Implement

| Feature                  | Reason                     |
| ------------------------ | -------------------------- |
| Credential marketplace   | Not core to platform       |
| AI credential validation | Unreliable, liability risk |
| Cryptocurrency payments  | Regulatory uncertainty     |

---

## Implementation Plan

### Phase 1: Preparation (Days 1-2)

**Goal**: Set up infrastructure and dependencies

- [ ] Create feature branch: `feature/[short-name]`
- [ ] Update Prisma schema (if needed)
- [ ] Run migrations on dev database
- [ ] Install any new dependencies
- [ ] Update environment variables template

### Phase 2: Core Implementation (Days 3-7)

**Goal**: Implement main functionality

**Week 1 Tasks**:

- [ ] Implement Component X (`/path/to/x.ts`)
- [ ] Modify Component A for integration
- [ ] Write unit tests for new components
- [ ] Update API routes

**Code Review Checkpoint**: Informal review with @domain-owner

### Phase 3: Integration (Days 8-10)

**Goal**: Connect all pieces, end-to-end testing

- [ ] Integration tests for full flow
- [ ] Error handling and edge cases
- [ ] Performance testing
- [ ] Security testing

**Code Review Checkpoint**: Formal review, PR opened

### Phase 4: Documentation & Deployment (Days 11-12)

**Goal**: Prepare for production

- [ ] Update API documentation (OpenAPI spec)
- [ ] Update README / developer docs
- [ ] Create deployment guide
- [ ] Deploy to staging
- [ ] Validation testing in staging
- [ ] Deploy to production (after approval)

### Rollback Plan

If issues discovered after deployment:

1. **Immediate**: Revert deployment (git revert + redeploy)
2. **Database**: Run rollback migration if schema changed
3. **Configuration**: Restore previous env vars
4. **Monitoring**: Check all systems green after rollback
5. **Post-mortem**: Document what went wrong, update plan

---

## Dependencies & Blockers

### Upstream Dependencies

[What must be completed before this can start?]

- **P0-04**: Signing Key Provider must be implemented first
- **P0-11**: Production database must be configured

### Downstream Dependencies

[What is blocked by this?]

- **P0-10**: W3C VC Compliance depends on this for proof generation
- **Future Feature X**: Depends on this for...

### External Dependencies

[Third-party services, APIs, or tools]

- **DID Resolution**: Requires universal-resolver library
- **KMS**: Requires AWS KMS access (if using cloud HSM)
- **Monitoring**: Requires Datadog API key for metrics

### Resource Requirements

| Resource            | Quantity         | Purpose             |
| ------------------- | ---------------- | ------------------- |
| Engineer (Backend)  | 1 FTE, 2 weeks   | Core implementation |
| Engineer (Security) | 0.5 FTE, 1 week  | Security review     |
| DevOps Engineer     | 0.25 FTE, 2 days | Deployment + infra  |
| QA Engineer         | 0.5 FTE, 1 week  | Integration testing |

---

## Testing Strategy

### Unit Tests

**Coverage Target**: 90% for new code

```typescript
// Example test structure
describe('CredentialVerifier', () => {
  describe('verifySignature', () => {
    it('should accept valid Ed25519 signature', async () => {
      // ...
    });

    it('should reject invalid signature', async () => {
      // ...
    });

    it('should reject expired credentials', async () => {
      // ...
    });
  });
});
```

**Files to Test**:

- `/path/to/new/file.ts` (100% coverage)
- `/path/to/modified/file.ts` (cover new lines)

### Integration Tests

**Test Scenarios**:

1. **Happy Path**: Issue credential → verify → success
2. **Revoked Credential**: Issue → revoke → verify → reject
3. **Unknown Issuer**: Issue from untrusted → verify → reject
4. **Expired Credential**: Issue with exp in past → verify → reject

### Security Tests

- [ ] **Signature Forgery**: Tamper with credential signature → verify → reject
- [ ] **Issuer Impersonation**: Use wrong DID → verify → reject
- [ ] **Replay Attack**: Reuse DPoP proof → second request → reject
- [ ] **Authorization Bypass**: Call revocation endpoint without auth → HTTP 401

### Performance Tests

**Load Test**: 1000 concurrent credential verifications

- **Target**: < 200ms p99 latency
- **Tool**: k6 or Apache JMeter
- **Success Criteria**: 99.9% success rate

### Compliance Tests

- [ ] **W3C VC Validator**: Use official validator tool
- [ ] **OIDC4VCI Test Suite**: Run conformance tests
- [ ] **DPoP Compliance**: Verify RFC 9449 compliance

---

## Monitoring & Observability

### Metrics to Track

| Metric                                | Purpose            | Alert Threshold |
| ------------------------------------- | ------------------ | --------------- |
| `credential_verifications_total`      | Volume tracking    | N/A             |
| `credential_verifications_failed`     | Error rate         | > 5%            |
| `credential_verification_duration_ms` | Performance        | p99 > 200ms     |
| `did_resolution_failures`             | DID service health | > 1%            |
| `revocation_check_timeouts`           | Status API health  | > 0.1%          |

### Logs to Capture

```typescript
logger.info('Credential verification attempt', {
  credentialId: 'hash(id)', // privacy: hash PII
  issuerDid: credential.issuer,
  result: 'success' | 'failure',
  reason: 'expired' | 'revoked' | 'invalid_signature',
  durationMs: 45,
  requestId: req.id,
});
```

### Dashboards

1. **Verification Health Dashboard**

   - Success rate (last 24h)
   - p50/p95/p99 latency
   - Error breakdown (by reason)

2. **Security Dashboard**
   - Failed verification attempts (by issuer)
   - Unknown issuer rejections
   - Revocation events

### Alerts

| Alert                          | Condition              | Severity | Action                |
| ------------------------------ | ---------------------- | -------- | --------------------- |
| High Verification Failure Rate | > 5% for 5 min         | P1       | Page on-call engineer |
| DID Resolution Down            | > 10 failures          | P2       | Notify team Slack     |
| Revocation DB Unreachable      | Any connection failure | P0       | Immediate escalation  |

---

## Risk Assessment

### Technical Risks

| Risk                             | Likelihood | Impact   | Mitigation                                                   |
| -------------------------------- | ---------- | -------- | ------------------------------------------------------------ |
| DID resolution service outage    | Medium     | High     | Implement caching (15 min TTL) + fallback to last known good |
| Key compromise                   | Low        | Critical | Use HSM, implement key rotation, monitor for anomalies       |
| Database performance degradation | Medium     | Medium   | Add indexes, connection pooling, read replicas               |

### Business Risks

| Risk                      | Likelihood | Impact   | Mitigation                                          |
| ------------------------- | ---------- | -------- | --------------------------------------------------- |
| Regulatory non-compliance | Low        | Critical | Regular compliance audits, engage legal counsel     |
| Customer adoption delay   | Medium     | Medium   | Pilot program with early customers, gather feedback |

### Security Risks

| Risk                 | CVSS           | Mitigation                                          |
| -------------------- | -------------- | --------------------------------------------------- |
| Issuer impersonation | 9.1 (Critical) | DID-based verification + issuer whitelist           |
| Credential forgery   | 8.8 (High)     | Ed25519 signatures + verification                   |
| Revocation bypass    | 7.5 (High)     | Persistent revocation DB + fail-closed verification |

---

## Open Questions

[Questions that need answers before or during implementation]

1. **Q**: Should we support multiple credential formats (JWT + JSON-LD)?

   - **Owner**: @standards-lead
   - **Deadline**: Day 2
   - **Blocking**: No (can start with JWT only)

2. **Q**: What is the revocation status cache TTL?

   - **Owner**: @backend-lead
   - **Deadline**: Day 1
   - **Blocking**: Yes (affects architecture)
   - **Options**: 5 min, 15 min, or 1 hour

3. **Q**: Do we need a staging environment for blockchain integration?
   - **Owner**: @blockchain-lead
   - **Deadline**: Before Phase 4
   - **Blocking**: No (can defer blockchain to v2)

---

## Approval

### Required Reviewers

- [ ] **Technical Review**: @backend-lead
- [ ] **Security Review**: @security-lead
- [ ] **Compliance Review**: @compliance-lead (if compliance impact)
- [ ] **Architecture Review**: @cto (if significant architecture change)

### Approval Status

| Reviewer       | Status  | Date | Comments |
| -------------- | ------- | ---- | -------- |
| @backend-lead  | PENDING | -    | -        |
| @security-lead | PENDING | -    | -        |

**Final Approval**: @domain-owner

---

## References

### Related Documents

- [P0 Gap Analysis](./P0_GAP_ANALYSIS.md)
- [Trust Flow Analysis](./TRUST_FLOW_ANALYSIS.md)
- [Architecture Map](./VITALCV_ARCHITECTURE.md)

### External Standards

- [W3C Verifiable Credentials Data Model 2.0](https://www.w3.org/TR/vc-data-model-2.0/)
- [OIDC4VCI Specification](https://openid.net/specs/openid-4-verifiable-credential-issuance-1_0.html)
- [RFC 9449: DPoP](https://datatracker.ietf.org/doc/rfc9449/)
- [StatusList2021](https://w3c-ccg.github.io/vc-status-list-2021/)

### Code Examples

- [DPoP Implementation](../apps/issuer-api/src/middleware/dpopGuard.ts)
- [Ed25519 Signing](../packages/domain-identity/src/crypto/ed25519.ts)

---

**Template Version**: 1.0
**Last Updated**: 2026-01-09
**Maintained By**: @engineering-lead

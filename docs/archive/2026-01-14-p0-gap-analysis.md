# VitalCV P0 Gap Analysis

## Launch-Blocking Gaps Only

**Date**: 2026-01-09
**Branch**: codex/wave-04
**Analysis Sources**:

- Architecture Map (repo-map)
- Implementation Status (current-state)
- Trust Flow Analysis (flow-trace)

---

## Executive Summary

**Total P0 Gaps**: 12
**Domain Breakdown**:

- Trust/Security: 5 gaps
- Core Credential Lifecycle: 3 gaps
- Infrastructure: 2 gaps
- Compliance: 2 gaps

**Risk Assessment**: 🔴 **CANNOT LAUNCH** - Critical security vulnerabilities and missing core functionality would result in:

- Credential forgery (untrusted issuers accepted)
- Universal credential revocation by attackers
- Data loss on server restart
- W3C VC non-compliance
- HIPAA audit failures

---

## P0 Gap Index

| ID    | Gap                                | Domain Owner     | Days to Fix |
| ----- | ---------------------------------- | ---------------- | ----------- |
| P0-01 | Unknown Issuer Bypass              | @security-lead   | 0.1         |
| P0-02 | Unauthenticated Revocation         | @security-lead   | 0.5         |
| P0-03 | Non-Persistent Revocation          | @backend-lead    | 1           |
| P0-04 | Missing Signing Key Provider       | @infra-lead      | 3           |
| P0-05 | Missing VC Signing Logic           | @backend-lead    | 2           |
| P0-06 | Missing DID Resolution             | @identity-lead   | 5           |
| P0-07 | Missing VP Verification            | @verifier-lead   | 8           |
| P0-08 | Broken Blockchain Integration      | @blockchain-lead | 10          |
| P0-09 | Missing OIDC4VCI Token Endpoint    | @issuer-lead     | 4           |
| P0-10 | Incomplete W3C VC Compliance       | @standards-lead  | 6           |
| P0-11 | Missing Production Database Config | @infra-lead      | 2           |
| P0-12 | Missing Audit Anchoring            | @compliance-lead | 7           |

**Total Effort**: 48.6 days sequential, ~15 days with parallelization

---

## P0-01: Unknown Issuer Bypass

### P0-01 Problem Statement

**File**: `/apps/verifier-api/src/routes/verifyCredential.ts:131-140`

Verifier returns `{ valid: true }` for credentials from **unknown/untrusted issuers**, bypassing cryptographic verification entirely.

```typescript
// CURRENT CODE (BROKEN)
return res.json({
  valid: true, // ❌ WRONG!
  reason: 'Issuer not trusted. Signature not verified.',
  warning: 'This verification is incomplete...',
});
```

### P0-01 Impact

- **Security**: Any attacker can issue credentials accepted as valid
- **Compliance**: W3C VC proof verification requirement violated
- **Trust**: Entire credential ecosystem is untrustworthy
- **CVSS**: 9.8 (Critical) - Authentication bypass

### P0-01 Evidence from Analysis

- **current-state**: Verification endpoints marked PARTIALLY_IMPLEMENTED
- **flow-trace**: Identified as CRITICAL VULNERABILITY #1
- **repo-map**: Verifier API has minimal implementation

### P0-01 Domain Owner

**@security-lead** + **@verifier-lead**

### P0-01 Resolution Path

#### P0-01 Option A: Fail-Closed Verification (Recommended)

1. Change `valid: true` → `valid: false` (line 131)
2. Return HTTP 401 for unknown issuers
3. Implement `TRUSTED_ISSUERS` whitelist from env/config
4. Add audit logging for verification failures
5. **Effort**: 1 hour

#### P0-01 Option B: Cryptographic Verification (Complete fix)

1. Implement Option A
2. Add issuer DID resolution (see P0-06)
3. Fetch public key from JWKS endpoint
4. Verify credential signature
5. **Effort**: Depends on P0-06 completion

**Recommended**: Option A immediately, then Option B after P0-06

### P0-01 Dependencies

- None (can fix immediately)
- Full fix requires P0-06 (DID Resolution)

### P0-01 Acceptance Criteria

- [ ] Unknown issuer returns `valid: false` and HTTP 401
- [ ] Trusted issuer whitelist enforced
- [ ] Audit log entry created for each verification attempt
- [ ] Integration test: unknown issuer rejected
- [ ] Integration test: trusted issuer accepted (when signature valid)

---

## P0-02: Unauthenticated Revocation Endpoint

### P0-02 Problem Statement

**File**: `/apps/status-api/src/routes/statusList.ts:113`

The `/status-list/revoke` endpoint has **zero authentication**. Anyone can revoke any credential by POSTing a credential ID.

```typescript
// CURRENT CODE (BROKEN)
export function revokeCredential(req: Request, res: Response): void {
  const { credential_id, reason } = req.body;
  // ❌ NO AUTHENTICATION CHECK!
  statusList.set(credential_id, { revoked: true, ... });
}
```

### P0-02 Impact

- **Security**: Denial-of-Service attack (revoke all credentials)
- **Trust**: Legitimate credentials can be invalidated by attackers
- **Compliance**: Audit trail incomplete (no identity of revoker)
- **CVSS**: 8.6 (High) - Unauthorized modification

### P0-02 Evidence from Analysis

- **current-state**: Revocation endpoints marked STUBBED
- **flow-trace**: Identified as CRITICAL VULNERABILITY #2
- **repo-map**: Status API exists but minimal security

### P0-02 Domain Owner

**@security-lead** + **@backend-lead**

### P0-02 Resolution Path

#### P0-02 Option A: DPoP Authentication (Recommended)

1. Add `dpopGuard` middleware to revocation endpoint
2. Extract issuer DID from DPoP proof
3. Verify credential ownership: `credential.issuer === issuerDid`
4. Add audit log: `{ action: 'revoke', issuerDid, credentialId, timestamp }`
5. **Effort**: 2-4 hours

#### P0-02 Option B: Bearer Token + RBAC

1. Require JWT with `credential:revoke` permission
2. Validate token signature
3. Check user has issuer role for this credential
4. Add audit logging
5. **Effort**: 4-6 hours

**Recommended**: Option A (DPoP already implemented elsewhere)

### P0-02 Dependencies

- DPoP middleware already exists (`dpopGuard.ts`)
- Requires Prisma schema update for audit log

### P0-02 Acceptance Criteria

- [ ] Revocation requires valid DPoP proof
- [ ] Only credential issuer can revoke their credentials
- [ ] Attempt by non-issuer returns HTTP 403
- [ ] Audit log records: issuerDid, credentialId, reason, timestamp
- [ ] Integration test: unauthorized revocation rejected
- [ ] Integration test: authorized revocation succeeds

---

## P0-03: Non-Persistent Revocation Status

### P0-03 Problem Statement

**File**: `/apps/status-api/src/routes/statusList.ts:29`

Revocation status stored in **in-memory Map**. All revocation data lost on server restart/crash/redeploy.

```typescript
// CURRENT CODE (BROKEN)
const statusList = new Map<string, StatusListEntry>();
```

### P0-03 Impact

- **Data Loss**: All revocation history lost on restart
- **Security**: Revoked credentials become valid again
- **Compliance**: Cannot prove credential was ever revoked
- **Availability**: No high-availability deployment possible
- **CVSS**: 7.4 (High) - Availability + data integrity

### P0-03 Evidence from Analysis

- **current-state**: Status storage not in Prisma schema
- **flow-trace**: Identified as CRITICAL VULNERABILITY #3
- **repo-map**: No database integration in status-api

### P0-03 Domain Owner

**@backend-lead** + **@infra-lead**

### P0-03 Resolution Path

#### P0-03 Option A: Prisma Database (Recommended)

1. Update Prisma schema with `CredentialStatusList` model:

   ```prisma
   model CredentialStatusList {
     id            String   @id @default(uuid())
     credentialId  String   @unique
     issuerDid     String
     revoked       Boolean  @default(false)
     revokedAt     DateTime?
     reason        String?
     createdAt     DateTime @default(now())
     updatedAt     DateTime @updatedAt
   }
   ```

2. Replace Map with Prisma queries:

   - `statusList.set()` → `prisma.credentialStatusList.upsert()`
   - `statusList.get()` → `prisma.credentialStatusList.findUnique()`

3. Add database indexes on `credentialId`, `issuerDid`
4. Implement transaction logging for audit trail
5. **Effort**: 1 day

#### P0-03 Option B: Redis Cache + Database

1. Implement Option A
2. Add Redis caching layer for hot revocation checks
3. Cache TTL: 5 minutes
4. **Effort**: 2 days

**Recommended**: Option A for MVP, Option B for scale

### P0-03 Dependencies

- Prisma schema update
- Database migration
- Production database configuration (see P0-11)

### P0-03 Acceptance Criteria

- [ ] Revocation status persisted in database
- [ ] Server restart preserves all revocation data
- [ ] Query performance: <50ms p99 for status check
- [ ] Integration test: revoke, restart server, verify still revoked
- [ ] Migration script for any existing in-memory data

---

## P0-04: Missing Signing Key Provider

### P0-04 Problem Statement

**File**: `/apps/issuer-api/src/services/clinicianIdentityIssuer.ts:10`

Credential issuance imports `signingKeyProvider` from non-existent file:

```typescript
import { signingKeyProvider } from '@/services/identity/signingKeyProvider';
// ❌ FILE DOES NOT EXIST
```

No implementation of key management, rotation, or storage.

### P0-04 Impact

- **Broken**: Credential issuance likely throws module not found error
- **Security**: No key rotation strategy
- **Compliance**: Cannot prove which key signed which credential
- **Recovery**: No key backup/recovery mechanism
- **CVSS**: 8.2 (High) - Key management failure

### P0-04 Evidence from Analysis

- **current-state**: Cryptographic operations marked PARTIALLY_IMPLEMENTED
- **flow-trace**: Identified as CRITICAL VULNERABILITY #4
- **repo-map**: Missing infrastructure for key management

### P0-04 Domain Owner

**@infra-lead** + **@security-lead**

### P0-04 Resolution Path

#### P0-04 Option A: Environment Variable Keys (Quick Fix)

1. Create `/apps/issuer-api/src/services/identity/signingKeyProvider.ts`
2. Load private key from `ISSUER_PRIVATE_KEY_JWK` env var
3. Implement `getSigningKey()` returning Ed25519 private key
4. Implement `getPublicJwksPayload()` returning public JWK Set
5. Add key ID (kid) generation from JWK thumbprint
6. **Effort**: 4 hours

#### P0-04 Option B: KMS Integration (Production-Ready)

1. Integrate AWS KMS / Google Cloud KMS / HashiCorp Vault
2. Store key references in KMS
3. Implement key rotation with versioning
4. Add key usage auditing
5. Support multiple active keys (old + new during rotation)
6. **Effort**: 1 week

#### P0-04 Option C: Hardware Security Module (HSM) (Enterprise)

1. Integrate YubiHSM / Thales Luna HSM
2. FIPS 140-2 Level 3 compliance
3. **Effort**: 2-3 weeks

**Recommended**: Option A for MVP, plan Option B for production

### P0-04 Dependencies

- None for Option A
- Infrastructure provisioning for Options B/C

### P0-04 Acceptance Criteria

- [ ] `signingKeyProvider` module exists and exports required functions
- [ ] Private key loaded securely (not hardcoded)
- [ ] Public JWKS endpoint returns all valid public keys
- [ ] Key ID (kid) included in all JWTs
- [ ] Documentation for key rotation procedure
- [ ] Unit test: key loading and signing
- [ ] Integration test: issued credential has valid kid

---

## P0-05: Missing VC Signing Logic

### P0-05 Problem Statement

**File**: `/apps/api/backend/src/controllers/credential_controller.ts:65`

Credential controller has explicit TODO for VC signing:

```typescript
// TODO: integrate actual VC signing logic here
```

Credentials issued without cryptographic signatures.

### P0-05 Impact

- **Trust**: Credentials cannot be verified
- **Compliance**: W3C VC requires proof field
- **Security**: Credentials can be tampered without detection
- **CVSS**: 8.8 (High) - Lack of integrity protection

### P0-05 Evidence from Analysis

- **current-state**: Credential issuance marked PARTIALLY_IMPLEMENTED
- **flow-trace**: Signature verification cannot work without signatures
- **repo-map**: Backend controller is stub implementation

### P0-05 Domain Owner

**@backend-lead** + **@standards-lead**

### P0-05 Resolution Path

#### P0-05 Option A: JWT-Based VC (Quickest)

1. Use existing Ed25519 signing from `packages/domain-identity`
2. Create VC JWT payload:

   ```typescript
   const vcPayload = {
     iss: ISSUER_DID,
     sub: subjectDid,
     vc: {
       '@context': ['https://www.w3.org/2018/credentials/v1'],
       type: ['VerifiableCredential', 'PhysicianCredential'],
       credentialSubject: { id: subjectDid, ...claims },
     },
     exp: expirationTimestamp,
     nbf: issuanceTimestamp,
   };
   ```

3. Sign with `signingKeyProvider` (see P0-04)
4. Return JWT as credential
5. **Effort**: 2 days (depends on P0-04)

#### P0-05 Option B: JSON-LD with Linked Data Proofs

1. Implement LD-Signature proof suite
2. Use Ed25519Signature2020
3. Canonicalize with URDNA2015
4. Add proof field with verification method
5. **Effort**: 1 week

**Recommended**: Option A (JWT) for MVP

### P0-05 Dependencies

- **BLOCKED BY**: P0-04 (Signing Key Provider)
- Requires W3C VC context loading

### P0-05 Acceptance Criteria

- [ ] Issued credentials include cryptographic signature
- [ ] Signature algorithm: EdDSA with Ed25519 curve
- [ ] JWT includes kid header pointing to public key
- [ ] Credential payload includes all required W3C VC fields
- [ ] Integration test: issue credential, verify signature valid
- [ ] Integration test: tampered credential fails verification

---

## P0-06: Missing DID Resolution

### P0-06 Problem Statement

**File**: `/packages/domain-identity/src/did/cachedResolver.ts:29-44`

DID resolver only supports hardcoded test DIDs:

```typescript
if (did.startsWith('did:example:')) {
  // Hardcoded test keys only
  return mockDidDocument;
}
throw new Error('Unsupported DID method');
```

Cannot resolve real issuer DIDs for signature verification.

### P0-06 Impact

- **Trust**: Cannot verify issuer identity
- **Interoperability**: Cannot accept external issuers
- **Compliance**: OIDC4VCI requires DID resolution
- **CVSS**: 8.6 (High) - Identity verification failure

### P0-06 Evidence from Analysis

- **current-state**: DID resolution marked PARTIALLY_IMPLEMENTED
- **flow-trace**: Identified as CRITICAL VULNERABILITY #8
- **repo-map**: Multiple DID resolver libraries installed but not integrated

### P0-06 Domain Owner

**@identity-lead** + **@backend-lead**

### P0-06 Resolution Path

#### P0-06 Option A: Multi-Method Resolver (Recommended)

1. Integrate existing dependencies:

   - `did-resolver` (universal resolver)
   - `web-did-resolver` (did:web)
   - `key-did-resolver` (did:key)
   - `ethr-did-resolver` (did:ethr)

2. Implement resolution logic:

   ```typescript
   const resolver = new Resolver({
     ...webDidResolver.getResolver(),
     ...keyDidResolver.getResolver(),
     ...ethrDidResolver.getResolver(),
   });
   ```

3. Add result caching (15 min TTL)
4. Extract verification method from DID document
5. **Effort**: 5 days

#### P0-06 Option B: did:web Only (Quickest)

1. Only implement did:web (DNS-based)
2. Fetch `https://domain.com/.well-known/did.json`
3. Validate DID document structure
4. Cache results
5. **Effort**: 2 days

**Recommended**: Option A for interoperability

### P0-06 Dependencies

- None (dependencies already installed)
- Should integrate with cachedResolver.ts existing cache

### P0-06 Acceptance Criteria

- [ ] Supports did:web resolution
- [ ] Supports did:key resolution
- [ ] Supports did:ethr resolution (if needed)
- [ ] Caches DID documents with configurable TTL
- [ ] Extracts public key from verification method
- [ ] Error handling for network failures
- [ ] Unit test: resolve each DID method type
- [ ] Integration test: resolve issuer DID, verify credential

---

## P0-07: Missing VP Verification

### P0-07 Problem Statement

**File**: `/apps/verifier-api/src/oidc4vp/routes.ts`

OIDC4VP presentation verification has placeholder:

```typescript
// TODO: Implement actual VP verification
```

Verifiable Presentations not validated at all.

### P0-07 Impact

- **Trust**: Cannot verify presented credentials
- **Security**: Accept any presentation without validation
- **Compliance**: OIDC4VP specification violation
- **CVSS**: 8.2 (High) - Presentation bypass

### P0-07 Evidence from Analysis

- **current-state**: VP verification marked MISSING
- **flow-trace**: Identified as CRITICAL VULNERABILITY #7
- **repo-map**: OIDC4VP routes exist but incomplete

### P0-07 Domain Owner

**@verifier-lead** + **@standards-lead**

### P0-07 Resolution Path

#### P0-07 Option A: Full OIDC4VP Implementation (Recommended)

1. Parse presentation_submission matching presentation_definition
2. Validate VP structure (W3C VP Data Model)
3. Extract credentials from VP
4. For each credential:

   - Verify signature (requires P0-06)
   - Check expiration (exp claim)
   - Check not-before (nbf claim)
   - Check revocation status
   - Validate against policy

5. Verify holder binding (sub claim or holder property)
6. Check presentation proof
7. **Effort**: 8 days

#### P0-07 Option B: Basic VP Validation (Quickest)

1. Validate VP structure only
2. Extract credentials
3. Verify each credential individually (reuse verifyCredential logic)
4. Skip presentation proof for MVP
5. **Effort**: 3 days

**Recommended**: Option B for MVP, then Option A

### P0-07 Dependencies

- **BLOCKED BY**: P0-06 (DID Resolution) for full verification
- **BLOCKED BY**: P0-05 (VC Signing) for testable implementation

### P0-07 Acceptance Criteria

- [ ] VP structure validated against W3C VP Data Model
- [ ] All credentials in VP individually verified
- [ ] Presentation matches requested presentation_definition
- [ ] Holder binding verified
- [ ] Revocation status checked for all credentials
- [ ] Integration test: valid VP accepted
- [ ] Integration test: invalid VP rejected
- [ ] Integration test: expired credential in VP rejected

---

## P0-08: Broken Blockchain Integration

### P0-08 Problem Statement

**Files**:

- `/apps/api/backend/src/blockchain/polkadot_service.ts`
- `/apps/api/backend/src/blockchain/blockchain_integration.ts`

All blockchain services are stubs with no actual chain interaction:

```typescript
// "placeholder for actual interaction"
// TODO: Integrate with actual Polkadot
```

### P0-08 Impact

- **Immutability**: No audit trail anchoring
- **Revocation**: On-chain revocation registry not functional
- **Trust**: Cannot prove credential provenance
- **Compliance**: Blockchain-based compliance claims invalid
- **CVSS**: 6.5 (Medium) - Feature not working, but workarounds exist

### P0-08 Evidence from Analysis

- **current-state**: Blockchain integration marked STUBBED to BROKEN
- **flow-trace**: Blockchain anchoring marked MISSING
- **repo-map**: Substrate pallets exist but no runtime integration

### P0-08 Domain Owner

**@blockchain-lead** + **@infra-lead**

### P0-08 Resolution Path

#### P0-08 Option A: Substrate Runtime Integration (Complete Solution)

1. Create runtime.rs integrating all pallets:

   - credential pallet
   - status-list-bitstring pallet
   - audit-scrapbook pallet

2. Build node binary
3. Create chainspec.json for VitalCV chain
4. Deploy validator nodes (3+ for consensus)
5. Implement transaction submission from backend:

   ```typescript
   const api = await ApiPromise.create({ provider });
   const tx = api.tx.credential.issueCredential(credentialHash, metadata);
   await tx.signAndSend(issuerAccount);
   ```

6. Implement event listening for confirmations
7. **Effort**: 2-3 weeks

#### P0-08 Option B: Public Chain Anchoring (Quickest)

1. Use existing public chain (Polkadot, Ethereum, or Solana)
2. Deploy smart contract for credential registry
3. Anchor hashes only (not full credentials)
4. Implement Merkle tree for batch anchoring
5. **Effort**: 1 week

#### P0-08 Option C: Defer to Post-Launch (MVP Approach)

1. Log anchoring attempts to database
2. Implement off-chain audit trail
3. Plan blockchain integration for v2
4. **Effort**: 2 days

**Recommended**: Option C for MVP, Option B for v1.1, Option A for v2

### P0-08 Dependencies

- Infrastructure: validator nodes, RPC endpoints
- Key management for transaction signing
- Monitoring for chain health

### P0-08 Acceptance Criteria

#### P0-08 Acceptance Criteria for Option C (MVP)

- [ ] Audit events logged to database with timestamps
- [ ] Events include: action, resourceId, actor, metadata
- [ ] Query API for audit trail retrieval
- [ ] Tamper-evident log (append-only, signed entries)

#### P0-08 Acceptance Criteria for Options A/B (Future)

- [ ] Transaction successfully submitted to chain
- [ ] Confirmation received (3+ blocks deep)
- [ ] Event emitted from chain with credential hash
- [ ] Receipt includes: blockNumber, txHash, eventIndex
- [ ] Query endpoint for on-chain verification

---

## P0-09: Missing OIDC4VCI Token Endpoint

### P0-09 Problem Statement

**File**: `/apps/issuer-api/src/oidc4vci/routes.ts`

OIDC4VCI metadata declares token endpoint but implementation missing:

```json
{
  "token_endpoint": "https://issuer.vitalcv.com/token"
}
```

No actual `/token` route handler.

### P0-09 Impact

- **Compliance**: OIDC4VCI specification violation
- **Interoperability**: External wallets cannot request credentials
- **Flow**: Pre-authorized code flow broken
- **CVSS**: 5.5 (Medium) - Standards compliance

### P0-09 Evidence from Analysis

- **current-state**: OIDC4VCI marked PARTIALLY_IMPLEMENTED
- **flow-trace**: Token endpoint declared but not implemented
- **repo-map**: Issuer API has credential endpoint but no token endpoint

### P0-09 Domain Owner

**@issuer-lead** + **@standards-lead**

### P0-09 Resolution Path

#### P0-09 Option A: Full OAuth 2.0 Token Endpoint (Recommended)

1. Implement `/token` POST endpoint
2. Support grant types:

   - `authorization_code` (standard OAuth flow)
   - `urn:ietf:params:oauth:grant-type:pre-authorized_code` (OIDC4VCI)

3. Validate pre-authorized code
4. Issue access token (JWT)
5. Return response:

   ```json
   {
     "access_token": "...",
     "token_type": "DPoP",
     "expires_in": 3600,
     "c_nonce": "...",
     "c_nonce_expires_in": 300
   }
   ```

6. Integrate with DPoP (require DPoP-bound tokens)
7. **Effort**: 4 days

#### P0-09 Option B: Pre-Authorized Code Only (Quickest)

1. Only support pre-authorized_code grant
2. Skip authorization_code flow
3. Simple code validation from database
4. Issue access token
5. **Effort**: 2 days

**Recommended**: Option B for MVP

### P0-09 Dependencies

- Database table for pre-authorized codes
- Token signing key (reuse from P0-04)
- DPoP integration

### P0-09 Acceptance Criteria

- [ ] POST /token endpoint exists
- [ ] Supports urn:ietf:params:oauth:grant-type:pre-authorized_code
- [ ] Validates pre-authorized code from database
- [ ] Issues DPoP-bound access token
- [ ] Returns c_nonce for credential request
- [ ] c_nonce expires after 5 minutes
- [ ] Invalid code returns HTTP 400
- [ ] Integration test: full pre-authorized code flow

---

## P0-10: Incomplete W3C VC Compliance

### P0-10 Problem Statement

**Multiple Files**: Credential generation throughout codebase

Current credentials missing required W3C VC fields:

- No `credentialStatus` field (revocation mechanism)
- No `proof` field (cryptographic signature)
- Inconsistent `@context` values
- Missing `issuanceDate` / `expirationDate` in LD format

### P0-10 Impact

- **Interoperability**: External verifiers reject credentials
- **Standards**: W3C VC 2.0 compliance failure
- **Trust**: Cannot verify credential authenticity
- **CVSS**: 5.0 (Medium) - Standards compliance

### P0-10 Evidence from Analysis

- **current-state**: W3C VC compliance marked PARTIALLY_IMPLEMENTED
- **flow-trace**: W3C VC Data Model 6/8 requirements met
- **repo-map**: Multiple credential types with inconsistent structure

### P0-10 Domain Owner

**@standards-lead** + **@backend-lead**

### P0-10 Resolution Path

#### P0-10 Option A: Full W3C VC 2.0 Compliance (Recommended)

1. Add required fields to all credentials:

   ```json
   {
     "@context": [
       "https://www.w3.org/2018/credentials/v1",
       "https://w3id.org/security/suites/ed25519-2020/v1"
     ],
     "type": ["VerifiableCredential", "PhysicianCredential"],
     "issuer": "did:web:issuer.vitalcv.com",
     "issuanceDate": "2026-01-09T12:00:00Z",
     "expirationDate": "2027-01-09T12:00:00Z",
     "credentialSubject": { "id": "did:web:...", ... },
     "credentialStatus": {
       "id": "https://status.vitalcv.com/status-list/1#94567",
       "type": "StatusList2021Entry",
       "statusPurpose": "revocation",
       "statusListIndex": "94567",
       "statusListCredential": "https://status.vitalcv.com/status-list/1"
     },
     "proof": {
       "type": "Ed25519Signature2020",
       "created": "2026-01-09T12:00:00Z",
       "verificationMethod": "did:web:issuer.vitalcv.com#key-1",
       "proofPurpose": "assertionMethod",
       "proofValue": "z..."
     }
   }
   ```

2. Implement credential status generation (StatusList2021)
3. Add proof generation (see P0-05)
4. Validate all credentials against W3C VC JSON Schema
5. **Effort**: 6 days

#### P0-10 Option B: JWT-VC Only (Quickest)

1. Use JWT format exclusively (skips proof/credentialStatus in JSON)
2. Include equivalent claims in JWT payload
3. Defer LD-Signature to v2
4. **Effort**: 3 days (part of P0-05)

**Recommended**: Option B for MVP, Option A for full compliance

### P0-10 Dependencies

- **BLOCKED BY**: P0-05 (VC Signing)
- **BLOCKED BY**: P0-03 (Persistent Revocation) for credentialStatus
- W3C context loading

### P0-10 Acceptance Criteria

- [ ] All issued credentials include @context array
- [ ] type field includes VerifiableCredential
- [ ] issuer field uses DID format
- [ ] issuanceDate in ISO 8601 format
- [ ] credentialSubject.id is DID
- [ ] credentialStatus field included (or omitted if JWT)
- [ ] proof field included (or JWT signature if JWT format)
- [ ] Validation against W3C VC JSON Schema passes
- [ ] Integration test: credential validates with external verifier

---

## P0-11: Missing Production Database Config

### P0-11 Problem Statement

**Files**:

- `/apps/api/backend/prisma/schema.prisma` (uses SQLite)
- No production connection configuration

Current database: SQLite dev.db (57KB) unsuitable for production.

### P0-11 Impact

- **Scalability**: SQLite cannot handle concurrent writes
- **Reliability**: No replication or backup
- **Performance**: Slow for large datasets
- **Deployment**: Cannot run multiple backend instances
- **CVSS**: 6.0 (Medium) - Availability/scalability

### P0-11 Evidence from Analysis

- **current-state**: Database connections marked PARTIALLY_IMPLEMENTED
- **flow-trace**: No production database mentioned
- **repo-map**: Only dev.db found

### P0-11 Domain Owner

**@infra-lead** + **@backend-lead**

### P0-11 Resolution Path

#### P0-11 Option A: PostgreSQL on AWS RDS (Recommended)

1. Provision AWS RDS PostgreSQL instance
2. Update Prisma schema:

   ```prisma
   datasource db {
     provider = "postgresql"
     url      = env("DATABASE_URL")
   }
   ```

3. Configure connection pooling (PgBouncer)
4. Set up read replicas
5. Configure automated backups
6. Update environment variables:

   ```env
   DATABASE_URL="postgresql://user:pass@rds-endpoint:5432/vitalcv?schema=public&connection_limit=10"
   ```

7. Run migrations: `pnpm prisma migrate deploy`
8. **Effort**: 2 days

#### P0-11 Option B: Managed PostgreSQL (Supabase/Neon) (Quickest)

1. Create Supabase project
2. Get connection string
3. Update schema provider to postgresql
4. Run migrations
5. **Effort**: 1 day

**Recommended**: Option B for MVP, Option A for production scale

### P0-11 Dependencies

- Infrastructure provisioning
- Secrets management (connection strings)
- Monitoring setup

### P0-11 Acceptance Criteria

- [ ] PostgreSQL database provisioned
- [ ] Connection pooling configured
- [ ] All Prisma migrations applied successfully
- [ ] Connection string in env vars (not hardcoded)
- [ ] Automated daily backups enabled
- [ ] Point-in-time recovery (PITR) configured
- [ ] Monitoring: connection count, query latency, errors
- [ ] Load test: 100 concurrent connections
- [ ] Integration test: backend connects successfully

---

## P0-12: Missing Audit Anchoring

### P0-12 Problem Statement

**Files**:

- `/apps/api/backend/src/blockchain/audit_scrapbook.ts` (stub)
- `/blockchain/substrate/pallets/audit-scrapbook/` (not integrated)

Audit events logged but not anchored to immutable storage.

### P0-12 Impact

- **Compliance**: Cannot prove audit logs unaltered
- **Legal**: Audit trail not admissible as evidence
- **Trust**: Logs could be tampered post-incident
- **CVSS**: 5.5 (Medium) - Integrity of audit trail

### P0-12 Evidence from Analysis

- **current-state**: Audit logging marked PARTIALLY_IMPLEMENTED
- **flow-trace**: Audit anchoring flow marked MISSING
- **repo-map**: Audit scrapbook pallet exists but not functional

### P0-12 Domain Owner

**@compliance-lead** + **@blockchain-lead**

### P0-12 Resolution Path

#### P0-12 Option A: Merkle Tree Anchoring (Recommended)

1. Batch audit events into hourly batches
2. Build Merkle tree from event hashes
3. Anchor Merkle root to blockchain (or timestamping service)
4. Store Merkle proof for each event
5. Provide verification endpoint:

   ```http
   GET /audit/verify/:eventId
   Returns: { valid: true, proof: [...], root: "0x...", blockNumber: 12345 }
   ```

6. **Effort**: 1 week

#### P0-12 Option B: Signed Append-Only Log (Quickest)

1. Sign each audit event with server private key
2. Store signature with event in database
3. Implement verification: check signature chain
4. Periodic backup to immutable storage (S3 Glacier)
5. **Effort**: 3 days

#### P0-12 Option C: OpenTimestamps (Cheapest)

1. Integrate OpenTimestamps.org
2. Timestamp audit log hashes to Bitcoin blockchain
3. Store OTS proof with events
4. Verify with `ots verify`
5. **Effort**: 2 days

**Recommended**: Option B for MVP, Option A for full compliance

### P0-12 Dependencies

- Signing key for audit logs (separate from credential signing)
- Storage for Merkle proofs (if Option A)
- Blockchain integration (if Option A or C)

### P0-12 Acceptance Criteria

- [ ] All audit events signed/timestamped
- [ ] Verification endpoint returns proof of integrity
- [ ] Tampered event detected by verification
- [ ] Periodic anchoring to blockchain (if applicable)
- [ ] Query API: get all events with proofs
- [ ] Integration test: create event, verify proof
- [ ] Integration test: tamper with event, verification fails
- [ ] Documentation: how to verify audit trail externally

---

## P0 Gap Summary by Domain

### Security Team (@security-lead)

- P0-01: Unknown Issuer Bypass (0.1 days)
- P0-02: Unauthenticated Revocation (0.5 days)
- P0-04: Signing Key Provider (co-owner, 3 days)

**Total**: 3.6 days

### Backend Team (@backend-lead)

- P0-03: Non-Persistent Revocation (1 day)
- P0-05: VC Signing Logic (2 days)
- P0-06: DID Resolution (co-owner, 5 days)
- P0-10: W3C VC Compliance (co-owner, 6 days)

**Total**: 14 days

### Infrastructure Team (@infra-lead)

- P0-04: Signing Key Provider (3 days)
- P0-11: Production Database (2 days)
- P0-08: Blockchain Integration (co-owner, 10 days)

**Total**: 15 days

### Identity Team (@identity-lead)

- P0-06: DID Resolution (5 days)

**Total**: 5 days

### Verifier Team (@verifier-lead)

- P0-01: Unknown Issuer Bypass (co-owner, 0.1 days)
- P0-07: VP Verification (8 days)

**Total**: 8.1 days

### Issuer Team (@issuer-lead)

- P0-09: OIDC4VCI Token Endpoint (4 days)

**Total**: 4 days

### Standards Team (@standards-lead)

- P0-05: VC Signing Logic (co-owner, 2 days)
- P0-07: VP Verification (co-owner, 8 days)
- P0-09: Token Endpoint (co-owner, 4 days)
- P0-10: W3C VC Compliance (6 days)

**Total**: 20 days

### Blockchain Team (@blockchain-lead)

- P0-08: Blockchain Integration (10 days)
- P0-12: Audit Anchoring (co-owner, 7 days)

**Total**: 17 days

### Compliance Team (@compliance-lead)

- P0-12: Audit Anchoring (7 days)

**Total**: 7 days

---

## Recommended Execution Plan

### Phase 1: Critical Security (Week 1)

**Goal**: Stop active vulnerabilities

| Day | Tasks                         | Owner          | Dependencies |
| --- | ----------------------------- | -------------- | ------------ |
| 1   | P0-01 (Unknown Issuer Bypass) | @security-lead | None         |
| 1   | P0-02 (Revocation Auth)       | @security-lead | None         |
| 1-2 | P0-03 (Persistent Revocation) | @backend-lead  | Database     |
| 1-2 | P0-11 (Production Database)   | @infra-lead    | None         |

### Phase 2: Core Functionality (Week 2-3)

**Goal**: Enable end-to-end credential flow

| Days  | Tasks                        | Owner          | Dependencies |
| ----- | ---------------------------- | -------------- | ------------ |
| 3-5   | P0-04 (Signing Key Provider) | @infra-lead    | None         |
| 6-7   | P0-05 (VC Signing)           | @backend-lead  | P0-04        |
| 8-12  | P0-06 (DID Resolution)       | @identity-lead | None         |
| 10-13 | P0-09 (Token Endpoint)       | @issuer-lead   | P0-04        |

### Phase 3: Verification & Compliance (Week 3-4)

**Goal**: Complete verification flow and standards

| Days  | Tasks                     | Owner            | Dependencies |
| ----- | ------------------------- | ---------------- | ------------ |
| 13-20 | P0-07 (VP Verification)   | @verifier-lead   | P0-06, P0-05 |
| 14-19 | P0-10 (W3C VC Compliance) | @standards-lead  | P0-05, P0-03 |
| 14-20 | P0-12 (Audit Anchoring)   | @compliance-lead | None         |

### Phase 4: Infrastructure (Week 4-6)

**Goal**: Complete infrastructure (optional for MVP)

| Days  | Tasks                          | Owner            | Dependencies |
| ----- | ------------------------------ | ---------------- | ------------ |
| 21-30 | P0-08 (Blockchain Integration) | @blockchain-lead | Infra setup  |

**Note**: P0-08 can be deferred to post-launch with Option C (database audit trail).

---

## Launch Readiness Criteria

Platform can launch when:

- [x] **Repository Mapped** (completed)
- [x] **Implementation Status Known** (completed)
- [x] **Trust Flow Analyzed** (completed)
- [ ] **P0-01 through P0-07**: FIXED (security + core flow)
- [ ] **P0-09, P0-10**: FIXED (OIDC4VCI + W3C VC compliance)
- [ ] **P0-11, P0-12**: FIXED (production database + audit)
- [ ] **P0-08**: Option C implemented (database audit) OR full blockchain integration
- [ ] **Integration Tests**: All acceptance criteria passing
- [ ] **Security Review**: External audit of P0 fixes
- [ ] **Load Testing**: 1000 credentials issued/verified successfully
- [ ] **Documentation**: All APIs documented, deployment guide complete

**Estimated Time to Launch-Ready**: 4-6 weeks with full team

---

## Next Steps

1. **Review this gap analysis** with engineering leadership
2. **Assign domain owners** to each P0 gap
3. **Create GitHub issues** for each gap (link to this doc)
4. **Establish sprint plan** following recommended execution plan
5. **Daily standups** tracking P0 progress
6. **Weekly security review** of completed P0 fixes
7. **Launch readiness meeting** when all P0s resolved

---

**Document Generated**: 2026-01-09
**Author**: Claude Code Analysis
**Related Documents**:

- Architecture Map (generated)
- Implementation Status (current-state analysis)
- Trust Flow Analysis (flow-trace report)

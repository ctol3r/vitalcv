# VitalCV Design Proposal: Trust Layer Resurrection

**Proposal ID**: `DP-2026-01-09-trust-layer-resurrection`
**Author**: @security-lead
**Date**: 2026-01-09
**Status**: `DRAFT`
**Related P0 Gaps**: P0-01, P0-02, P0-03, P0-04, P0-05, P0-06
**Domain Owner**: @security-lead

---

## Problem Statement

### Current Situation (Wave 0 Failure Modes)

The VitalCV credential platform has **8 critical trust layer failures** discovered in flow-trace analysis:

1. **Unknown Issuer Bypass** (`verifyCredential.ts:131-140`)

   - Returns `{ valid: true }` for credentials from unverified issuers
   - No cryptographic verification performed
   - Any attacker can issue credentials accepted as valid

2. **Unauthenticated Revocation** (`statusList.ts:113`)

   - Revocation endpoint has zero authentication
   - Anyone can revoke any credential via POST request
   - Enables denial-of-service attack

3. **Non-Persistent Revocation** (`statusList.ts:29`)

   - Revocation status stored in in-memory Map
   - All data lost on server restart/crash
   - Revoked credentials become valid again after restart

4. **Missing Signing Key Provider** (`clinicianIdentityIssuer.ts:10`)

   - Imports from non-existent file `/services/identity/signingKeyProvider.ts`
   - No key management infrastructure
   - Cannot issue signed credentials

5. **Missing VC Signing Logic** (`credential_controller.ts:65`)

   - Explicit TODO comment: "integrate actual VC signing logic here"
   - Credentials issued without cryptographic proofs
   - Cannot be verified

6. **Missing DID Resolution** (`cachedResolver.ts:29-44`)
   - Only resolves hardcoded test DIDs (`did:example:`)
   - Cannot verify real issuer identities
   - Fails for all production DIDs

**Evidence Files**:

- `/apps/verifier-api/src/routes/verifyCredential.ts` (BROKEN)
- `/apps/status-api/src/routes/statusList.ts` (BROKEN)
- `/apps/issuer-api/src/services/clinicianIdentityIssuer.ts` (BROKEN)
- `/apps/api/backend/src/controllers/credential_controller.ts` (STUBBED)
- `/packages/domain-identity/src/did/cachedResolver.ts` (STUBBED)

### Issues with Current Implementation

- **Issue 1**: No cryptographic trust chain

  - Impact: Security - any attacker can forge credentials
  - Evidence: P0-01, P0-05, P0-06 gaps

- **Issue 2**: Revocation system completely broken

  - Impact: Security + Data Loss - revoked credentials still valid
  - Evidence: P0-02, P0-03 gaps

- **Issue 3**: Key management missing
  - Impact: Operational - cannot issue credentials in production
  - Evidence: P0-04 gap

### Root Cause Analysis

**Why does this problem exist?**

- Platform built with stubs/placeholders for demo purposes
- Trust layer was deferred to "later"
- No end-to-end cryptographic validation before Wave 0
- Blockchain integration planned but not started (P0-08)

**Current Risk**: 🔴 **CANNOT LAUNCH** - No cryptographic security

---

## Success Criteria

### Functional Requirements

- [ ] **FR-1**: Credential issuance produces cryptographically signed VCs

  - Test: Issue credential → extract signature → verify with public key → succeeds

- [ ] **FR-2**: Verification rejects credentials from unknown issuers

  - Test: Submit credential from unlisted issuer → returns `valid: false` and HTTP 401

- [ ] **FR-3**: Verification accepts credentials from trusted issuers with valid signatures

  - Test: Submit credential from whitelisted issuer → signature verification passes → returns `valid: true`

- [ ] **FR-4**: Revocation endpoint requires authentication

  - Test: POST to /status-list/revoke without DPoP → HTTP 401

- [ ] **FR-5**: Only issuer can revoke their own credentials

  - Test: Issuer A tries to revoke issuer B's credential → HTTP 403

- [ ] **FR-6**: Revocation status persists across restarts

  - Test: Revoke credential → restart server → verify still revoked

- [ ] **FR-7**: DID resolution works for did:web and did:key
  - Test: Resolve did:web:issuer.vitalcv.com → returns DID document with public key

### Non-Functional Requirements

- [ ] **NFR-1**: Signature verification latency < 100ms p99

  - Metric: Monitor `credential_verification_duration_ms` metric

- [ ] **NFR-2**: Revocation check latency < 50ms p99

  - Metric: Monitor `revocation_check_duration_ms` metric

- [ ] **NFR-3**: Key rotation without downtime

  - Metric: Zero failed verifications during key rotation

- [ ] **NFR-4**: W3C VC Data Model 2.0 compliance

  - Validation: Pass W3C VC validator tool

- [ ] **NFR-5**: EdDSA with Ed25519 curve (FIPS 186-5 compliant)
  - Validation: Verify algorithm in JWT header

### Acceptance Criteria

- [ ] All 8 critical vulnerabilities fixed (P0-01 through P0-06)
- [ ] Integration tests pass for full issuance → verification → revocation flow
- [ ] Security review approved by @security-lead
- [ ] Performance benchmarks meet NFRs
- [ ] Code coverage >= 90% for new trust layer code
- [ ] Documentation complete (API docs, deployment guide, key management guide)
- [ ] Deployed to staging and validated end-to-end
- [ ] Launch-readiness checklist passed

---

## Architecture Changes

### Current Architecture (Broken)

```text
┌──────────────┐                    ┌─────────────┐
│ Issuer API   │ ─(no signing)────> │ Credential  │
└──────────────┘                    │ (unsigned)  │
                                    └─────────────┘
                                           │
                                           v
┌──────────────┐                    ┌─────────────┐
│ Verifier API │ <─(accepts all)─── │ Verifiable  │
│              │                    │ Presentation│
│ valid: true  │                    └─────────────┘
└──────────────┘
       │
       v (no auth)
┌──────────────┐                    ┌─────────────┐
│ Status API   │ ─(in-memory)────>  │ Map<string, │
│ (anyone can  │                    │ StatusEntry>│
│ revoke)      │                    └─────────────┘
└──────────────┘
```

**Problems**:

- No cryptographic signatures
- No issuer verification
- No authentication on revocation
- No persistence

### Proposed Architecture (Secure)

```text
┌──────────────┐           ┌──────────────────┐
│ Issuer API   │──────────>│ SigningKey       │
│              │           │ Provider         │
└──────────────┘           │ (new)            │
       │                   └──────────────────┘
       │                            │
       │ (signs with Ed25519)       │ loads keys
       v                            v
┌──────────────┐           ┌──────────────────┐
│ Credential   │           │ KMS / Env Vars   │
│ (JWT + sig)  │           │ (ISSUER_KEY_JWK) │
└──────────────┘           └──────────────────┘
       │
       v
┌──────────────┐           ┌──────────────────┐
│ Verifier API │──────────>│ DID Resolver     │
│              │           │ (universal)      │
│              │<──────────│ did:web, did:key │
└──────────────┘           └──────────────────┘
       │                            │
       │ (verifies signature)       │ fetches public key
       v                            v
┌──────────────┐           ┌──────────────────┐
│ Trusted      │           │ /.well-known/    │
│ Issuers List │           │ jwks.json        │
└──────────────┘           └──────────────────┘
       │
       v (check revocation with auth)
┌──────────────┐           ┌──────────────────┐
│ Status API   │──────────>│ PostgreSQL       │
│ + DPoP auth  │           │ CredentialStatus │
└──────────────┘           │ (persistent)     │
                           └──────────────────┘
                                    │
                                    v
                           ┌──────────────────┐
                           │ AuditScrapbook   │
                           │ (database logs)  │
                           └──────────────────┘
```

**New Flow**:

1. **Issuance**: Issuer API → loads key from SigningKeyProvider → signs VC with Ed25519 → returns JWT
2. **Verification**: Verifier API → resolves issuer DID → fetches public key → verifies signature → checks revocation → returns result
3. **Revocation**: Authenticated request with DPoP → validates issuer owns credential → updates PostgreSQL → audit log

### Changes to Existing Components

| Component    | File Path                                                    | Change Type | Description                                                 |
| ------------ | ------------------------------------------------------------ | ----------- | ----------------------------------------------------------- |
| Issuer API   | `/apps/issuer-api/src/services/clinicianIdentityIssuer.ts`   | MODIFY      | Integrate SigningKeyProvider, add VC signing                |
| Verifier API | `/apps/verifier-api/src/routes/verifyCredential.ts`          | MODIFY      | Add signature verification, fail-closed for unknown issuers |
| Status API   | `/apps/status-api/src/routes/statusList.ts`                  | MODIFY      | Add DPoP authentication, use database instead of Map        |
| Backend API  | `/apps/api/backend/src/controllers/credential_controller.ts` | MODIFY      | Implement VC signing logic (remove TODO)                    |
| DID Resolver | `/packages/domain-identity/src/did/cachedResolver.ts`        | MODIFY      | Add did:web and did:key resolution                          |

**New Components**:

- `SigningKeyProvider` (`/apps/issuer-api/src/services/identity/signingKeyProvider.ts`)
- `UniversalDIDResolver` (enhance existing `/packages/domain-identity/src/did/cachedResolver.ts`)
- `RevocationPersistence` (database-backed, replace in-memory Map)
- `AuditScrapbook` (database audit logging)

---

## Data Model Changes

### Current Schema

```prisma
model Credential {
  id        String   @id @default(uuid())
  userId    String
  type      String
  data      Json
  createdAt DateTime @default(now())
}
```

**Problem**: No revocation status, no issuer tracking

### Proposed Schema

```prisma
model Credential {
  id           String            @id @default(uuid())
  userId       String
  type         String
  data         Json
  issuerDid    String            // NEW: Track issuer
  status       CredentialStatus  @default(ACTIVE) // NEW: Status enum
  statusListId String?           // NEW: Link to status list
  createdAt    DateTime          @default(now())
  updatedAt    DateTime          @updatedAt
  revokedAt    DateTime?         // NEW: Revocation timestamp
  revokedBy    String?           // NEW: Who revoked (DID)
  revokedReason String?          // NEW: Why revoked

  statusList   StatusList?       @relation(fields: [statusListId], references: [id])

  @@index([issuerDid])
  @@index([status])
  @@index([userId])
}

enum CredentialStatus {
  ACTIVE
  REVOKED
  EXPIRED
  SUSPENDED
}

// NEW MODEL: Persistent revocation status
model StatusList {
  id               String   @id @default(uuid())
  issuerDid        String
  statusListIndex  Int
  purpose          String   @default("revocation") // "revocation" or "suspension"
  encodedList      String   // Bitstring encoded as base64
  createdAt        DateTime @default(now())
  updatedAt        DateTime @updatedAt

  credentials      Credential[]

  @@unique([issuerDid, statusListIndex])
  @@index([issuerDid])
}

// NEW MODEL: Audit trail for all credential operations
model CredentialAudit {
  id           String   @id @default(uuid())
  action       String   // "issue", "verify", "revoke", "present"
  credentialId String
  actorDid     String?  // Who performed the action
  issuerDid    String?  // Issuer of the credential
  metadata     Json?    // Additional context
  timestamp    DateTime @default(now())
  requestId    String?  // Correlation ID

  @@index([credentialId])
  @@index([actorDid])
  @@index([timestamp])
}

// NEW MODEL: Trusted issuers whitelist
model TrustedIssuer {
  id          String   @id @default(uuid())
  did         String   @unique
  name        String
  description String?
  jwksUrl     String?  // URL to issuer's JWKS endpoint
  active      Boolean  @default(true)
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt

  @@index([did])
  @@index([active])
}
```

### Migration Plan

1. **Add new fields to Credential** as nullable

   ```sql
   ALTER TABLE "Credential" ADD COLUMN "issuerDid" TEXT;
   ALTER TABLE "Credential" ADD COLUMN "status" TEXT DEFAULT 'ACTIVE';
   ALTER TABLE "Credential" ADD COLUMN "revokedAt" TIMESTAMP;
   ```

2. **Backfill data** for existing credentials

   ```sql
   UPDATE "Credential"
   SET "issuerDid" = 'did:web:issuer.vitalcv.com',
       "status" = 'ACTIVE'
   WHERE "issuerDid" IS NULL;
   ```

3. **Create new tables**

   ```sql
   CREATE TABLE "StatusList" (...);
   CREATE TABLE "CredentialAudit" (...);
   CREATE TABLE "TrustedIssuer" (...);
   ```

4. **Make fields required** in Prisma schema (remove `?`)

5. **Deploy** new schema to production

**Rollback Plan**:

```bash
pnpm prisma migrate rollback
# Reverts to previous schema
# New fields were nullable, so data is safe
```

---

## Correct Substrate Signing Architecture

### Current Problem

Substrate integration is completely stubbed:

- `polkadot_service.ts` is placeholder
- Pallets exist but not integrated into runtime
- No transaction submission
- No event listening

### Correct Architecture (Deferred to Post-MVP)

For MVP, **do NOT** use Substrate signing. Use off-chain signing with audit trail:

```text
┌──────────────┐
│ Issuer API   │
└──────────────┘
       │
       │ 1. Sign VC with Ed25519 (off-chain)
       v
┌──────────────┐
│ Signed VC    │
│ (JWT)        │
└──────────────┘
       │
       │ 2. Hash VC for audit
       v
┌──────────────┐
│ SHA-256 hash │
└──────────────┘
       │
       │ 3. Log to database (not blockchain yet)
       v
┌──────────────┐           Future: Submit to Substrate
│ CredentialAudit│ ─────> ┌──────────────────┐
│ (database)     │         │ audit-scrapbook  │
└──────────────┘          │ pallet (on-chain)│
                          └──────────────────┘
```

**Rationale**:

- Substrate integration is P0-08 (10 days effort)
- Can launch without blockchain (database audit trail sufficient for pilot)
- Add blockchain anchoring in v2.0

### Future Substrate Architecture (v2.0)

When implementing P0-08:

1. **Build Substrate runtime** integrating all pallets
2. **Deploy validator network** (3+ nodes)
3. **Implement transaction submission** from backend:

   ```typescript
   const api = await ApiPromise.create({ provider: wsProvider });
   const hash = sha256(vcPayload);
   const tx = api.tx.auditScrapbook.recordEvent(hash, metadata);
   const result = await tx.signAndSend(issuerAccount);
   ```

4. **Listen for events** to get confirmation
5. **Store receipt** with blockNumber, txHash, eventIndex

---

## Key Management Strategy (Issuer Keys)

### Requirements

- **Secure storage**: Keys not in source code or plaintext
- **Rotation**: Ability to rotate keys without downtime
- **Multi-key support**: Old keys valid during rotation
- **Audit**: All key usage logged
- **Recovery**: Backup/restore mechanism

### Option A: Environment Variable Keys (MVP)

**For MVP launch**:

1. **Generate Ed25519 keypair**:

   ```bash
   node -e "
   const { generateKeyPairSync } = require('crypto');
   const { publicKey, privateKey } = generateKeyPairSync('ed25519', {
     publicKeyEncoding: { type: 'spki', format: 'jwk' },
     privateKeyEncoding: { type: 'pkcs8', format: 'jwk' }
   });
   console.log('Public:', JSON.stringify(publicKey));
   console.log('Private:', JSON.stringify(privateKey));
   "
   ```

2. **Store in environment**:

   ```env
   ISSUER_DID=did:web:issuer.vitalcv.com
   ISSUER_PRIVATE_KEY_JWK='{"kty":"OKP","crv":"Ed25519","x":"...","d":"..."}'
   ISSUER_PUBLIC_KEY_JWK='{"kty":"OKP","crv":"Ed25519","x":"...","kid":"key-1"}'
   ```

3. **Implement SigningKeyProvider**:

   ```typescript
   // /apps/issuer-api/src/services/identity/signingKeyProvider.ts
   import { importJWK, SignJWT } from 'jose';

   export class SigningKeyProvider {
     private privateKey: CryptoKey;
     private publicKey: JsonWebKey;

     async initialize() {
       const privateJwk = JSON.parse(process.env.ISSUER_PRIVATE_KEY_JWK);
       this.privateKey = await importJWK(privateJwk, 'EdDSA');
       this.publicKey = JSON.parse(process.env.ISSUER_PUBLIC_KEY_JWK);
     }

     async signVC(payload: any): Promise<string> {
       const jwt = await new SignJWT(payload)
         .setProtectedHeader({ alg: 'EdDSA', kid: 'key-1' })
         .setIssuer(process.env.ISSUER_DID)
         .setExpirationTime('1y')
         .sign(this.privateKey);
       return jwt;
     }

     getPublicJwksPayload(): { keys: JsonWebKey[] } {
       return {
         keys: [this.publicKey],
       };
     }
   }
   ```

4. **Serve JWKS endpoint**:

   ```typescript
   // /apps/issuer-api/src/routes/wellKnown.ts
   app.get('/.well-known/jwks.json', (req, res) => {
     res.json(signingKeyProvider.getPublicJwksPayload());
   });
   ```

**Pros**:

- Simple to implement
- No external dependencies
- Sufficient for pilot

**Cons**:

- Keys in environment variables (less secure than HSM)
- Manual rotation process
- No hardware-backed security

### Option B: KMS Integration (Production)

**For production launch** (post-pilot):

1. **Use AWS KMS** (or Google Cloud KMS, Azure Key Vault):

   ```typescript
   import { KMSClient, SignCommand } from '@aws-sdk/client-kms';

   export class KMSSigningKeyProvider {
     private kmsClient: KMSClient;
     private keyId: string;

     constructor() {
       this.kmsClient = new KMSClient({ region: 'us-east-1' });
       this.keyId = process.env.KMS_KEY_ID; // ARN of signing key
     }

     async signVC(payload: any): Promise<string> {
       const message = Buffer.from(JSON.stringify(payload));
       const { Signature } = await this.kmsClient.send(
         new SignCommand({
           KeyId: this.keyId,
           Message: message,
           SigningAlgorithm: 'ECDSA_SHA_256', // Or EdDSA when KMS supports
         }),
       );
       // Construct JWT with signature
       return constructJWT(payload, Signature);
     }
   }
   ```

2. **Key rotation** handled by KMS:

   - Create new key version
   - Update `keyId` in configuration
   - Keep old key active for verification period (7 days)
   - Disable old key after rotation complete

**Pros**:

- Hardware-backed security
- Automatic key rotation
- Audit logging built-in
- FIPS 140-2 Level 3 compliant

**Cons**:

- Additional cost ($1/key/month + usage)
- More complex setup
- Vendor lock-in

### Recommended Approach

1. **MVP (Pilot)**: Option A (env vars) - 4 hours to implement
2. **Production**: Option B (KMS) - Plan for v1.1, 1 week to implement

---

## AuditScrapbook Anchoring Semantics

### Purpose

Create tamper-evident audit trail of all credential operations.

### What to Audit

| Event                | Data to Log                                     | When            |
| -------------------- | ----------------------------------------------- | --------------- |
| Credential Issued    | credentialId, issuerDid, subjectDid, type, hash | On issuance     |
| Credential Verified  | credentialId, verifierDid, result, timestamp    | On verification |
| Credential Revoked   | credentialId, issuerDid, reason, timestamp      | On revocation   |
| Credential Presented | credentialId, holderDid, verifierDid, claims    | On presentation |

### Audit Schema

```typescript
interface AuditEvent {
  id: string; // UUID
  action: 'issue' | 'verify' | 'revoke' | 'present';
  credentialId: string; // ID of credential
  actorDid?: string; // Who performed action
  issuerDid?: string; // Issuer of credential
  metadata: {
    hash: string; // SHA-256 of credential
    timestamp: string; // ISO 8601
    requestId: string; // Correlation ID
    result?: string; // For verify: "valid" or "invalid"
    reason?: string; // For revoke: reason
  };
  signature: string; // Signature of this audit event
}
```

### Anchoring Process (MVP)

**Without Blockchain (for MVP)**:

1. **On credential operation**, create audit event:

   ```typescript
   const auditEvent = {
     id: uuid(),
     action: 'issue',
     credentialId: credential.id,
     actorDid: issuerDid,
     metadata: {
       hash: sha256(credentialPayload),
       timestamp: new Date().toISOString(),
       requestId: req.id,
     },
   };
   ```

2. **Sign the audit event**:

   ```typescript
   const eventSignature = await auditKeyProvider.sign(JSON.stringify(auditEvent));
   auditEvent.signature = eventSignature;
   ```

3. **Store in database**:

   ```typescript
   await prisma.credentialAudit.create({
     data: auditEvent,
   });
   ```

4. **Return receipt** to caller:

   ```json
   {
     "credential": {...},
     "receipt": {
       "auditEventId": "uuid",
       "hash": "sha256...",
       "timestamp": "2026-01-09T12:00:00Z",
       "signature": "base64..."
     }
   }
   ```

### Anchoring Process (Future with Blockchain)

**With Substrate (v2.0)**:

1. **Create and store events** (same as MVP: create, sign, store locally)
2. **Batch events** (hourly):

   ```typescript
   const events = await prisma.credentialAudit.findMany({
     where: { anchored: false },
   });
   ```

3. **Build Merkle tree** from event hashes

   ```typescript
   const leaves = events.map((e) => sha256(JSON.stringify(e)));
   const merkleTree = buildMerkleTree(leaves);
   const root = merkleTree.getRoot();
   ```

4. **Submit Merkle root to blockchain**:

   ```typescript
   const tx = api.tx.auditScrapbook.anchorBatch(root, events.length);
   const result = await tx.signAndSend(auditorAccount);
   ```

5. **Store blockchain receipt**:

   ```typescript
   await prisma.credentialAudit.updateMany({
     where: { id: { in: events.map((e) => e.id) } },
     data: {
       anchored: true,
       blockNumber: result.blockNumber,
       txHash: result.txHash,
     },
   });
   ```

6. **Provide verification endpoint**:

   ```typescript
   GET /audit/verify/:eventId
   // Returns: Merkle proof + block number + tx hash
   ```

---

## Hash-Before-Anchor Guarantees

### Why Hash First?

**Privacy**: Blockchain is public, cannot store PII directly

**Efficiency**: Hashes are fixed-size (32 bytes) vs full credentials (KB)

**Integrity**: Tamper-evidence without revealing data

### Hashing Strategy

```typescript
function hashCredential(credential: VC): string {
  // 1. Canonicalize (deterministic serialization)
  const canonical = canonicalize(credential);

  // 2. Hash with SHA-256
  const hash = crypto.createHash('sha256').update(canonical).digest('hex');

  // 3. Return prefixed hash
  return `sha256:${hash}`;
}

// Canonicalization (JSON-LD or simple JSON sort)
function canonicalize(obj: any): string {
  if (typeof obj !== 'object' || obj === null) {
    return JSON.stringify(obj);
  }
  if (Array.isArray(obj)) {
    return '[' + obj.map(canonicalize).join(',') + ']';
  }
  const keys = Object.keys(obj).sort();
  const pairs = keys.map((key) => {
    return `"${key}":${canonicalize(obj[key])}`;
  });
  return '{' + pairs.join(',') + '}';
}
```

### Guarantees

| Property            | Guarantee                              | How Verified                             |
| ------------------- | -------------------------------------- | ---------------------------------------- |
| **Tamper-Evidence** | Any change to credential changes hash  | Recompute hash, compare to anchored hash |
| **Existence Proof** | Credential existed at timestamp T      | Check blockchain anchor timestamp        |
| **Non-Repudiation** | Issuer cannot deny creating credential | Signature + audit anchor both signed     |
| **Privacy**         | Credential data not on blockchain      | Only hash stored on-chain                |
| **Verifiability**   | Anyone can verify audit trail          | Merkle proof + blockchain transaction    |

### Verification Process

**To verify audit trail**:

1. **Client requests credential + receipt**:

   ```json
   {
     "credential": {...},
     "receipt": {
       "auditEventId": "uuid",
       "hash": "sha256:abc123...",
       "blockNumber": 12345,
       "merkleProof": ["hash1", "hash2", ...]
     }
   }
   ```

2. **Client verifies hash matches credential**:

   ```typescript
   const computedHash = hashCredential(credential);
   assert(computedHash === receipt.hash);
   ```

3. **Client verifies Merkle proof** (if blockchain anchored):

   ```typescript
   const merkleRoot = computeMerkleRoot(receipt.hash, receipt.merkleProof);
   const onChainRoot = await api.query.auditScrapbook.merkleRoots(receipt.blockNumber);
   assert(merkleRoot === onChainRoot);
   ```

4. **Client trusts credential** if all checks pass

---

## Issuance, Verification, and Revocation Lifecycle

### Issuance Lifecycle

```text
┌─────────────────────────────────────────────────────────────┐
│ 1. REQUEST                                                  │
│    Client → POST /credentials/issue                         │
│    { type: "PhysicianCredential", subject: { npi: "..." } } │
└─────────────────────────────────────────────────────────────┘
                          │
                          v
┌─────────────────────────────────────────────────────────────┐
│ 2. VALIDATION                                               │
│    - Authenticate requester (DPoP proof)                    │
│    - Authorize issuance (is requester allowed?)             │
│    - Validate subject data (NPI format, required fields)    │
└─────────────────────────────────────────────────────────────┘
                          │
                          v
┌─────────────────────────────────────────────────────────────┐
│ 3. CREDENTIAL CREATION                                      │
│    - Build VC payload:                                      │
│      {                                                      │
│        "@context": [...],                                   │
│        "type": ["VerifiableCredential", "PhysicianCred"],   │
│        "issuer": "did:web:issuer.vitalcv.com",              │
│        "issuanceDate": "2026-01-09T12:00:00Z",              │
│        "credentialSubject": { id: subjectDid, ... }         │
│      }                                                      │
└─────────────────────────────────────────────────────────────┘
                          │
                          v
┌─────────────────────────────────────────────────────────────┐
│ 4. CRYPTOGRAPHIC SIGNING                                    │
│    - Load private key from SigningKeyProvider               │
│    - Sign VC as JWT with EdDSA                              │
│    - Add kid (key ID) to JWT header                         │
│    const jwt = await signingKeyProvider.signVC(vcPayload);  │
└─────────────────────────────────────────────────────────────┘
                          │
                          v
┌─────────────────────────────────────────────────────────────┐
│ 5. HASH & AUDIT                                             │
│    - Compute hash: sha256(vcPayload)                        │
│    - Create audit event: { action: "issue", hash, ... }     │
│    - Sign audit event                                       │
│    - Store in CredentialAudit table                         │
└─────────────────────────────────────────────────────────────┘
                          │
                          v
┌─────────────────────────────────────────────────────────────┐
│ 6. PERSISTENCE                                              │
│    - Store credential in database:                          │
│      { id, userId, issuerDid, status: ACTIVE, ... }         │
│    - Link to status list (for future revocation)            │
└─────────────────────────────────────────────────────────────┘
                          │
                          v
┌─────────────────────────────────────────────────────────────┐
│ 7. RESPONSE                                                 │
│    - Return JWT + receipt:                                  │
│      {                                                      │
│        "credential": "eyJhbGc...",  // JWT                  │
│        "receipt": {                                         │
│          "auditEventId": "uuid",                            │
│          "hash": "sha256:...",                              │
│          "timestamp": "2026-01-09T12:00:00Z"                │
│        }                                                    │
│      }                                                      │
└─────────────────────────────────────────────────────────────┘
```

**Trust Anchors**:

- ✅ Private key signing (cryptographic proof of issuance)
- ✅ Audit event signature (non-repudiation)
- ✅ Database persistence (durability)
- 🔜 Blockchain anchor (future: immutability)

---

### Verification Lifecycle

```text
┌─────────────────────────────────────────────────────────────┐
│ 1. REQUEST                                                  │
│    Verifier → POST /credentials/verify                      │
│    { credential: "eyJhbGc..." }  // JWT                     │
└─────────────────────────────────────────────────────────────┘
                          │
                          v
┌─────────────────────────────────────────────────────────────┐
│ 2. JWT PARSING                                              │
│    - Decode JWT header + payload                            │
│    - Extract: iss (issuer DID), kid (key ID), exp, sub      │
│    - Validate JWT structure                                 │
└─────────────────────────────────────────────────────────────┘
                          │
                          v
┌─────────────────────────────────────────────────────────────┐
│ 3. ISSUER TRUST CHECK (NEW - fixes P0-01)                  │
│    - Query TrustedIssuer table:                             │
│      WHERE did = iss AND active = true                      │
│    - If NOT FOUND → return { valid: false, HTTP 401 }       │
│    - If FOUND → proceed                                     │
└─────────────────────────────────────────────────────────────┘
                          │
                          v
┌─────────────────────────────────────────────────────────────┐
│ 4. DID RESOLUTION (NEW - fixes P0-06)                      │
│    - Resolve issuer DID:                                    │
│      const didDoc = await didResolver.resolve(iss);         │
│    - Extract verification method (public key)               │
│    - If resolution fails → return { valid: false, HTTP 502 }│
└─────────────────────────────────────────────────────────────┘
                          │
                          v
┌─────────────────────────────────────────────────────────────┐
│ 5. SIGNATURE VERIFICATION (NEW - fixes P0-05)              │
│    - Fetch issuer JWKS: GET /.well-known/jwks.json          │
│    - Find key with kid matching JWT header                  │
│    - Verify JWT signature with public key:                  │
│      const { payload } = await jwtVerify(jwt, publicKey);   │
│    - If invalid → return { valid: false, reason: "sig" }    │
└─────────────────────────────────────────────────────────────┘
                          │
                          v
┌─────────────────────────────────────────────────────────────┐
│ 6. TEMPORAL VALIDATION                                      │
│    - Check exp (expiration): if exp < now → expired         │
│    - Check nbf (not before): if nbf > now → not yet valid   │
│    - If expired → return { valid: false, reason: "expired" }│
└─────────────────────────────────────────────────────────────┘
                          │
                          v
┌─────────────────────────────────────────────────────────────┐
│ 7. REVOCATION CHECK (NEW - fixes P0-02, P0-03)             │
│    - Query CredentialStatus:                                │
│      WHERE credentialId = payload.jti                       │
│    - If status = REVOKED → return { valid: false }          │
│    - If status API unreachable → FAIL CLOSED (reject)       │
└─────────────────────────────────────────────────────────────┘
                          │
                          v
┌─────────────────────────────────────────────────────────────┐
│ 8. AUDIT LOG                                                │
│    - Create audit event: { action: "verify", result, ... }  │
│    - Store in CredentialAudit                               │
└─────────────────────────────────────────────────────────────┘
                          │
                          v
┌─────────────────────────────────────────────────────────────┐
│ 9. RESPONSE                                                 │
│    - Return verification result:                            │
│      {                                                      │
│        "valid": true,                                       │
│        "issuer": { "did": "...", "trusted": true },         │
│        "checks": {                                          │
│          "signatureValid": true,                            │
│          "notExpired": true,                                │
│          "notRevoked": true                                 │
│        },                                                   │
│        "verifiedAt": "2026-01-09T12:05:00Z"                 │
│      }                                                      │
└─────────────────────────────────────────────────────────────┘
```

**Trust Proven**:

- ✅ Signature verification (cryptographic proof)
- ✅ Issuer whitelist (trust anchor)
- ✅ DID resolution (identity verification)
- ✅ Revocation check (status validation)

**Failure Modes**:

- Unknown issuer → HTTP 401 (fail-closed)
- DID resolution failure → HTTP 502 (fail-closed)
- Invalid signature → HTTP 401 (fail-closed)
- Revocation API down → REJECT (fail-closed)

---

### Revocation Lifecycle

```text
┌─────────────────────────────────────────────────────────────┐
│ 1. REQUEST                                                  │
│    Issuer → POST /status-list/revoke                        │
│    Headers: { "dpop": "..." }  // NEW - DPoP proof required │
│    Body: { credentialId: "...", reason: "..." }             │
└─────────────────────────────────────────────────────────────┘
                          │
                          v
┌─────────────────────────────────────────────────────────────┐
│ 2. AUTHENTICATION (NEW - fixes P0-02)                      │
│    - Validate DPoP proof (signature, nonce, expiry)         │
│    - Extract issuerDid from DPoP proof                      │
│    - If invalid → return HTTP 401                           │
└─────────────────────────────────────────────────────────────┘
                          │
                          v
┌─────────────────────────────────────────────────────────────┐
│ 3. AUTHORIZATION                                            │
│    - Fetch credential from database                         │
│    - Verify: credential.issuerDid === requestor.issuerDid   │
│    - If mismatch → return HTTP 403 (not your credential)    │
└─────────────────────────────────────────────────────────────┘
                          │
                          v
┌─────────────────────────────────────────────────────────────┐
│ 4. REVOCATION (NEW - fixes P0-03)                          │
│    - Update database (replaces in-memory Map):              │
│      await prisma.credential.update({                       │
│        where: { id: credentialId },                         │
│        data: {                                              │
│          status: 'REVOKED',                                 │
│          revokedAt: new Date(),                             │
│          revokedBy: issuerDid,                              │
│          revokedReason: reason                              │
│        }                                                    │
│      });                                                    │
└─────────────────────────────────────────────────────────────┘
                          │
                          v
┌─────────────────────────────────────────────────────────────┐
│ 5. STATUS LIST UPDATE                                       │
│    - Update StatusList bitstring:                           │
│      - Find status list for credential                      │
│      - Set bit at statusListIndex to 1 (revoked)            │
│      - Encode bitstring as base64                           │
│      - Store updated bitstring                              │
└─────────────────────────────────────────────────────────────┘
                          │
                          v
┌─────────────────────────────────────────────────────────────┐
│ 6. AUDIT LOG                                                │
│    - Create audit event:                                    │
│      {                                                      │
│        action: "revoke",                                    │
│        credentialId,                                        │
│        actorDid: issuerDid,                                 │
│        metadata: { reason, timestamp }                      │
│      }                                                      │
│    - Sign and store in CredentialAudit                      │
└─────────────────────────────────────────────────────────────┘
                          │
                          v
┌─────────────────────────────────────────────────────────────┐
│ 7. RESPONSE                                                 │
│    - Return success:                                        │
│      {                                                      │
│        "revoked": true,                                     │
│        "credentialId": "...",                               │
│        "revokedAt": "2026-01-09T12:10:00Z",                 │
│        "auditEventId": "uuid"                               │
│      }                                                      │
└─────────────────────────────────────────────────────────────┘
```

**Trust Proven**:

- ✅ DPoP authentication (only authenticated issuers)
- ✅ Authorization check (only owner can revoke)
- ✅ Database persistence (survives restart)
- ✅ Audit trail (non-repudiation)

**Guarantees**:

- Revocation persists across server restarts (database-backed)
- Only issuer can revoke their own credentials (authorization)
- All revocations audited (tamper-evident log)
- Verification immediately rejects revoked credentials (fail-closed)

---

## Failure Handling and Fallback Behavior

### Design Principle: Fail-Closed

**Rule**: When in doubt, REJECT. Never default to "valid" on error.

### Failure Scenarios

| Failure                      | Current Behavior        | New Behavior (Fail-Closed)  |
| ---------------------------- | ----------------------- | --------------------------- |
| Unknown issuer               | ✅ valid: true          | ❌ valid: false, HTTP 401   |
| DID resolution timeout       | N/A (not implemented)   | ❌ valid: false, HTTP 502   |
| Signature verification error | N/A (not implemented)   | ❌ valid: false, HTTP 401   |
| Revocation API unreachable   | ⚠️ treat as not revoked | ❌ valid: false, HTTP 503   |
| Database connection lost     | 💥 500 error            | ❌ HTTP 503, retry after    |
| Key loading failure          | 💥 crash                | ❌ HTTP 500, alert ops team |
| Expired credential           | ✅ accepts              | ❌ valid: false             |

### Error Handling Strategy

```typescript
async function verifyCredential(jwt: string): Promise<VerificationResult> {
  try {
    // 1. Parse JWT
    const { header, payload } = decodeJWT(jwt);

    // 2. Check issuer trust
    const issuer = await db.trustedIssuer.findUnique({
      where: { did: payload.iss, active: true },
    });
    if (!issuer) {
      logger.warn('Unknown issuer', { iss: payload.iss });
      return { valid: false, error: 'unknown_issuer', httpStatus: 401 };
    }

    // 3. Resolve DID with timeout
    const didDoc = await Promise.race([
      didResolver.resolve(payload.iss),
      timeout(5000), // 5 second timeout
    ]).catch((err) => {
      logger.error('DID resolution failed', { iss: payload.iss, error: err });
      return null;
    });

    if (!didDoc) {
      return { valid: false, error: 'did_resolution_failed', httpStatus: 502 };
    }

    // 4. Verify signature
    try {
      await jwtVerify(jwt, didDoc.verificationMethod[0].publicKeyJwk);
    } catch (err) {
      logger.error('Signature verification failed', { error: err });
      return { valid: false, error: 'invalid_signature', httpStatus: 401 };
    }

    // 5. Check revocation with timeout
    const revoked = await Promise.race([
      checkRevocationStatus(payload.jti),
      timeout(2000), // 2 second timeout
    ]).catch((err) => {
      logger.error('Revocation check failed', { error: err });
      // FAIL CLOSED: treat as revoked if cannot check
      return true;
    });

    if (revoked) {
      return { valid: false, error: 'revoked', httpStatus: 401 };
    }

    // 6. All checks passed
    return { valid: true, issuer, httpStatus: 200 };
  } catch (err) {
    // Unexpected error: log and reject
    logger.error('Verification error', { error: err });
    return { valid: false, error: 'internal_error', httpStatus: 500 };
  }
}
```

### Retry Logic

**For transient failures** (network, database):

```typescript
async function withRetry<T>(fn: () => Promise<T>, maxRetries = 3, backoff = 1000): Promise<T> {
  let lastError;
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await fn();
    } catch (err) {
      lastError = err;
      if (i < maxRetries - 1) {
        await sleep(backoff * (i + 1)); // Exponential backoff
      }
    }
  }
  throw lastError;
}

// Usage
const didDoc = await withRetry(() => didResolver.resolve(did));
```

### Circuit Breaker

**For repeated failures** (prevent cascading failures):

```typescript
class CircuitBreaker {
  private failureCount = 0;
  private state: 'closed' | 'open' | 'half-open' = 'closed';
  private lastFailureTime = 0;

  async execute<T>(fn: () => Promise<T>): Promise<T> {
    if (this.state === 'open') {
      // Check if timeout expired
      if (Date.now() - this.lastFailureTime > 60000) {
        this.state = 'half-open';
      } else {
        throw new Error('Circuit breaker open');
      }
    }

    try {
      const result = await fn();
      this.onSuccess();
      return result;
    } catch (err) {
      this.onFailure();
      throw err;
    }
  }

  private onSuccess() {
    this.failureCount = 0;
    this.state = 'closed';
  }

  private onFailure() {
    this.failureCount++;
    this.lastFailureTime = Date.now();
    if (this.failureCount >= 5) {
      this.state = 'open';
      logger.error('Circuit breaker opened', { failureCount: this.failureCount });
    }
  }
}

// Usage
const didResolverCircuit = new CircuitBreaker();
const didDoc = await didResolverCircuit.execute(() => didResolver.resolve(did));
```

### Graceful Degradation

**When non-critical services fail**:

```typescript
// Example: Audit logging failure should not block verification
try {
  await auditLog.record({ action: 'verify', ... });
} catch (err) {
  logger.error('Audit logging failed', { error: err });
  // Alert ops team but continue verification
  alertOpsTeam('audit-logging-failure', err);
}
```

---

## Explicit Non-Goals for This Wave

What this proposal **intentionally does NOT include**:

### Out of Scope

1. **Blockchain Integration (P0-08)**

   - Reason: Can launch with database audit trail, add blockchain later
   - Future: Wave 2 (v2.0)
   - Impact: No on-chain immutability yet, but database audit trail sufficient for pilot

2. **Hardware Security Module (HSM)**

   - Reason: Environment variable keys sufficient for pilot, KMS for production
   - Future: v1.1 (post-pilot)
   - Impact: Keys stored in env vars less secure than HSM, but acceptable for pilot

3. **Post-Quantum Cryptography**

   - Reason: Standards not finalized, Ed25519 sufficient for now
   - Future: v3.0 (when NIST finalizes PQC standards)
   - Impact: Vulnerable to future quantum computers, but not current threat

4. **Selective Disclosure (SD-JWT)**

   - Reason: Full credential disclosure sufficient for pilot
   - Future: Wave 3 (OIDC4VCI improvements)
   - Impact: Cannot hide individual claims, but not required for pilot

5. **Batch Credential Issuance**

   - Reason: Single credential flow sufficient, no customer request yet
   - Future: v1.2 (when customer needs it)
   - Impact: Slower for bulk operations, but not pilot use case

6. **OIDC4VP Complete Implementation**

   - Reason: Basic verification sufficient for pilot
   - Future: Wave 3 (full OIDC4VP spec)
   - Impact: Presentation flow not fully spec-compliant, but works for pilot

7. **Mobile Wallet App**

   - Reason: Web wallet sufficient for pilot
   - Future: v1.5 (React Native app)
   - Impact: No mobile experience, but web works

8. **Multi-Tenant Issuer Support**
   - Reason: Single issuer (VitalCV) for pilot
   - Future: v2.0 (if customers want to self-issue)
   - Impact: Only VitalCV can issue credentials

### Deferred to Future Releases

| Feature                     | Reason                        | Target Release |
| --------------------------- | ----------------------------- | -------------- |
| Blockchain anchoring        | Not launch-blocking           | v2.0           |
| KMS integration             | Environment keys OK for pilot | v1.1           |
| SD-JWT selective disclosure | Not required for pilot        | Wave 3         |
| OIDC4VP full spec           | Basic flow works              | Wave 3         |
| Batch operations            | No customer need yet          | v1.2           |

### Will NOT Implement

| Feature                   | Reason                          |
| ------------------------- | ------------------------------- |
| Credential marketplace    | Not core platform functionality |
| AI-powered verification   | Unreliable, liability risk      |
| Blockchain mining/staking | Not our business model          |
| Credential NFTs           | Unclear value proposition       |

---

## Implementation Plan

### Phase 1: Preparation (Day 1)

**Goal**: Set up infrastructure

- [ ] Create feature branch: `feature/trust-layer-resurrection`
- [ ] Update Prisma schema (add new models: StatusList, CredentialAudit, TrustedIssuer)
- [ ] Run migrations on dev database
- [ ] Generate Ed25519 keypair for issuer
- [ ] Set up environment variables

### Phase 2: Core Implementation (Days 2-7)

**Goal**: Fix P0 gaps

#### P0-04: Signing Key Provider (Day 2, 4h)

- [ ] Create `/apps/issuer-api/src/services/identity/signingKeyProvider.ts`
- [ ] Implement key loading from env vars
- [ ] Implement `signVC()` method
- [ ] Implement `getPublicJwksPayload()` method
- [ ] Add `/.well-known/jwks.json` endpoint
- [ ] Unit tests

#### P0-05: VC Signing Logic (Day 2-3, 8h)

- [ ] Update `credential_controller.ts` with signing logic
- [ ] Integrate SigningKeyProvider
- [ ] Generate JWT with EdDSA
- [ ] Include kid in JWT header
- [ ] Integration tests

#### P0-01: Unknown Issuer Bypass (Day 3, 1h)

- [ ] Change `verifyCredential.ts:131` to return `valid: false`
- [ ] Implement TrustedIssuer whitelist check
- [ ] Return HTTP 401 for unknown issuers
- [ ] Integration tests

#### P0-06: DID Resolution (Day 4-5, 12h)

- [ ] Enhance `cachedResolver.ts` with did:web support
- [ ] Add did:key support
- [ ] Implement caching (15 min TTL)
- [ ] Error handling for resolution failures
- [ ] Unit tests

#### P0-02: Revocation Authentication (Day 5, 4h)

- [ ] Add DPoP guard to revocation endpoint
- [ ] Extract issuer DID from DPoP proof
- [ ] Verify credential ownership
- [ ] Add audit logging
- [ ] Integration tests

#### P0-03: Revocation Persistence (Day 6, 8h)

- [ ] Replace in-memory Map with Prisma queries
- [ ] Implement StatusList bitstring encoding
- [ ] Add database indexes
- [ ] Migration script for existing data
- [ ] Integration tests

### Phase 3: Integration (Days 8-10)

**Goal**: End-to-end flow

- [ ] Integration test: full issuance flow
- [ ] Integration test: verification with all checks
- [ ] Integration test: revocation flow
- [ ] Performance testing (latency benchmarks)
- [ ] Security testing (signature forgery, replay attacks)

### Phase 4: Documentation & Deployment (Days 11-12)

**Goal**: Prepare for production

- [ ] Update API documentation
- [ ] Create key management guide
- [ ] Create deployment guide
- [ ] Deploy to staging
- [ ] Validation testing in staging
- [ ] Security review
- [ ] Deploy to production (after approval)

### Rollback Plan

If critical issues discovered:

1. **Immediate**: Revert deployment

   ```bash
   git revert <merge-commit-hash>
   git push origin main
   ```

2. **Database**: Rollback schema if needed

   ```bash
   pnpm prisma migrate rollback
   ```

3. **Configuration**: Restore previous env vars

4. **Verification**: Run health checks

   ```bash
   curl https://api.vitalcv.com/health
   npm run test:integration
   ```

---

## Dependencies & Blockers

### Upstream Dependencies

- None (this is foundational work)

### Downstream Dependencies

- **P0-07**: VP Verification (blocked by P0-06 DID Resolution)
- **P0-09**: OIDC4VCI Token Endpoint (blocked by P0-04 Signing Key Provider)
- **P0-10**: W3C VC Compliance (blocked by P0-05 VC Signing)
- **Wave 3**: OIDC4VCI/VP (blocked by all P0s)

### External Dependencies

- **PostgreSQL**: Production database must be configured (P0-11)
- **Environment Variables**: ISSUER_PRIVATE_KEY_JWK must be set
- **DNS**: For did:web resolution (if using did:web DIDs)

### Resource Requirements

| Resource          | Quantity         | Purpose                          |
| ----------------- | ---------------- | -------------------------------- |
| Backend Engineer  | 1 FTE, 2 weeks   | Core implementation              |
| Security Engineer | 0.5 FTE, 1 week  | Security review + key management |
| DevOps Engineer   | 0.25 FTE, 2 days | Database migration + deployment  |
| QA Engineer       | 0.5 FTE, 1 week  | Integration + security testing   |

---

## Testing Strategy

### Unit Tests (90% Coverage Target)

```typescript
// SigningKeyProvider
describe('SigningKeyProvider', () => {
  it('should load keys from environment', async () => {...});
  it('should sign VC and return valid JWT', async () => {...});
  it('should include kid in JWT header', async () => {...});
  it('should return public JWKS payload', async () => {...});
});

// VC Signing
describe('issueCredential', () => {
  it('should issue signed VC', async () => {...});
  it('should include required W3C VC fields', async () => {...});
  it('should create audit event', async () => {...});
});

// Verification
describe('verifyCredential', () => {
  it('should reject unknown issuer', async () => {...});
  it('should accept known issuer with valid signature', async () => {...});
  it('should reject invalid signature', async () => {...});
  it('should reject expired credential', async () => {...});
  it('should reject revoked credential', async () => {...});
});

// Revocation
describe('revokeCredential', () => {
  it('should reject unauthenticated request', async () => {...});
  it('should reject non-owner revocation', async () => {...});
  it('should revoke credential successfully', async () => {...});
  it('should persist revocation across restart', async () => {...});
});
```

### Integration Tests

**Test Scenarios**:

1. **Happy Path**: Issue → Verify → Revoke

   ```typescript
   test('full credential lifecycle', async () => {
     // Issue
     const { credential } = await POST('/credentials/issue', {...});

     // Verify (should be valid)
     const { valid } = await POST('/credentials/verify', { credential });
     expect(valid).toBe(true);

     // Revoke
     await POST('/status-list/revoke', { credentialId: ... }, { dpop: ... });

     // Verify again (should be invalid)
     const { valid: stillValid } = await POST('/credentials/verify', { credential });
     expect(stillValid).toBe(false);
   });
   ```

2. **Unknown Issuer Rejection**
3. **Signature Tampering Detection**
4. **Revocation Persistence Across Restart**
5. **DID Resolution Timeout Handling**

### Security Tests

- [ ] **Signature Forgery**: Tamper with signature → rejected
- [ ] **Issuer Impersonation**: Use wrong DID → rejected
- [ ] **Revocation Bypass**: Revoke, restart → still revoked
- [ ] **Replay Attack**: Reuse DPoP proof → rejected
- [ ] **Authorization Bypass**: Revoke other's credential → HTTP 403

### Performance Tests

```bash
# Load test: 1000 concurrent verifications
k6 run --vus 100 --duration 30s verification-load-test.js

# Targets:
# - p99 latency < 200ms
# - 99.9% success rate
# - No memory leaks
```

---

## Monitoring & Observability

### Metrics

```typescript
// Prometheus metrics
const credentialIssuanceTotal = new Counter({
  name: 'credential_issuance_total',
  help: 'Total credentials issued',
  labelNames: ['type', 'issuer'],
});

const credentialVerificationDuration = new Histogram({
  name: 'credential_verification_duration_ms',
  help: 'Verification latency',
  buckets: [10, 50, 100, 200, 500, 1000],
});

const verificationFailures = new Counter({
  name: 'verification_failures_total',
  help: 'Failed verifications',
  labelNames: ['reason'], // unknown_issuer, invalid_signature, revoked, expired
});
```

### Dashboards

1. **Issuance Health**

   - Credentials issued (per type)
   - Issuance errors
   - Signing latency

2. **Verification Health**

   - Verification success rate
   - Verification latency (p50, p95, p99)
   - Failure reasons breakdown

3. **Security Dashboard**
   - Unknown issuer attempts
   - Invalid signature attempts
   - Revocation events

### Alerts

| Alert                          | Condition       | Severity | Action               |
| ------------------------------ | --------------- | -------- | -------------------- |
| High Verification Failure Rate | > 5% for 5 min  | P1       | Page on-call         |
| DID Resolution Failures        | > 10 in 1 min   | P2       | Notify team          |
| Signing Key Load Failure       | Any failure     | P0       | Immediate escalation |
| Database Unreachable           | Connection lost | P0       | Auto-failover + page |

---

## Risk Assessment

### Technical Risks

| Risk                  | Likelihood | Impact   | Mitigation                                                               |
| --------------------- | ---------- | -------- | ------------------------------------------------------------------------ |
| Key compromise        | Low        | Critical | Use env vars (MVP), plan KMS (v1.1), monitor for anomalies               |
| DID resolution outage | Medium     | High     | Implement caching (15 min), circuit breaker, fallback to last known good |
| Database performance  | Medium     | Medium   | Add indexes, connection pooling, query optimization                      |
| Migration data loss   | Low        | Critical | Test migration on staging, backup before prod migration                  |

### Security Risks

| Risk                 | CVSS | Mitigation                                                  |
| -------------------- | ---- | ----------------------------------------------------------- |
| Issuer impersonation | 9.1  | DID-based verification + whitelist + signature verification |
| Credential forgery   | 8.8  | Ed25519 signatures + verification mandatory                 |
| Revocation bypass    | 7.5  | Persistent DB + fail-closed verification                    |
| Replay attack        | 7.0  | DPoP proof validation + nonce/jti checking                  |

---

## Open Questions

1. **Q**: Which DID method should we use for issuer?

   - **Options**: did:web (DNS-based) vs did:key (static)
   - **Owner**: @identity-lead
   - **Deadline**: Day 1
   - **Recommendation**: did:web for production (allows key rotation), did:key for testing

2. **Q**: What is the trusted issuer whitelist update process?

   - **Options**: Manual DB update vs admin API vs configuration file
   - **Owner**: @backend-lead
   - **Deadline**: Day 3
   - **Recommendation**: Start with manual DB, add admin API in v1.1

3. **Q**: Should we implement StatusList2021 bitstring or simple DB table?
   - **Options**: W3C StatusList2021 spec vs simple status column
   - **Owner**: @standards-lead
   - **Deadline**: Day 6
   - **Recommendation**: Simple status column for MVP, StatusList2021 for W3C compliance

---

## Approval

### Required Reviewers

- [ ] **Technical Review**: @backend-lead
- [ ] **Security Review**: @security-lead
- [ ] **Architecture Review**: @cto

### Approval Status

| Reviewer       | Status  | Date | Comments |
| -------------- | ------- | ---- | -------- |
| @backend-lead  | PENDING | -    | -        |
| @security-lead | PENDING | -    | -        |
| @cto           | PENDING | -    | -        |

**Final Approval**: @security-lead (domain owner)

---

## References

### Related Documents

- [P0 Gap Analysis](../P0_GAP_ANALYSIS.md) - All P0 gaps this fixes
- [Trust Flow Analysis](../TRUST_FLOW_ANALYSIS.md) - Detailed vulnerability analysis
- [Current State Assessment](../CURRENT_STATE_ASSESSMENT.md) - What's broken
- [Design Proposal Template](../.templates/DESIGN_PROPOSAL_TEMPLATE.md) - Template used

### External Standards

- [W3C Verifiable Credentials Data Model 2.0](https://www.w3.org/TR/vc-data-model-2.0/)
- [RFC 9449: DPoP](https://datatracker.ietf.org/doc/rfc9449/)
- [StatusList2021](https://w3c-ccg.github.io/vc-status-list-2021/)
- [DID Core](https://www.w3.org/TR/did-core/)
- [FIPS 186-5: Digital Signature Standard](https://csrc.nist.gov/publications/detail/fips/186/5/final)

### Code Examples

- [DPoP Implementation](../../apps/issuer-api/src/middleware/dpopGuard.ts) - Reference for auth
- [Ed25519 Signing](../../packages/domain-identity/src/crypto/ed25519.ts) - Crypto primitives

---

**Proposal Version**: 1.0
**Status**: DRAFT - Awaiting Review
**Next Steps**: Security review, then implementation via task bundler

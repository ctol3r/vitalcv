# VitalCV Platform: Comprehensive Trust Flow Trace

**Analysis Date**: January 9, 2026
**Branch**: codex/wave-04
**Thoroughness Level**: Very Thorough

---

## EXECUTIVE SUMMARY

The VitalCV trust architecture spans five major components with **critical gaps in key areas**:

| Component           | Trust Status     | Key Gaps                                            |
| ------------------- | ---------------- | --------------------------------------------------- |
| **Issuance**        | PARTIALLY PROVEN | Key material sourcing, issuer verification          |
| **Wallet Storage**  | PARTIALLY PROVEN | Device-level encryption not verified                |
| **Verification**    | PARTIALLY BROKEN | Untrusted issuer handoff, missing revocation checks |
| **Revocation**      | MOSTLY ASSUMED   | In-memory storage, no persistence                   |
| **Audit/Anchoring** | MOSTLY ASSUMED   | No blockchain integration implemented               |

---

## A. ISSUANCE FLOW ANALYSIS

## A.1 Issuer Authentication & Authorization

### A.1 Trust Proven

- **Location**: `/apps/issuer-api/src/middleware/dpopGuard.ts`
- **Mechanism**: DPoP (Demonstration of Proof-of-Possession) sender-constrained tokens
  - Lines 68-188: Comprehensive DPoP validation
  - JWK thumbprint verification (cnf.jkt)
  - Signature verification using jose library
  - Nonce replay protection via JTI cache (one-shot tokens)
  - Temporal validation (iat skew check: ±60 seconds)

**Code Evidence**:

```typescript
// Line 160: JWK thumbprint computation
const thumbprint = await calculateJwkThumbprint(jwk);

// Line 121-123: Signature verification
const verified = await jwtVerify(dpopHeader, publicKey, {
  algorithms: ALLOWED_ALGORITHMS,
});

// Line 155-156: Replay protection
if (checkAndStoreJti(payload.jti)) {
  return { valid: false, error: `jti reused: ${payload.jti} (replay attack detected)` };
}
```

### A.1 Trust Assumed

- **Issuer Identity Source**: Environment variables

  - `ISSUER_DID` (line 13 in clinicianIdentityIssuer.ts)
  - `PUBLIC_ISSUER_URL`
  - **Gap**: No verification that configured DID matches actual issuer

- **Tenant Configuration**: Via `x-tenant-id` header (dpopGuard.ts line 204)

  - **Gap**: No persistent tenant registry; mTLS config loaded from environment

- **Guard Middleware**: Via `@vitalcv/messaging-guard` package
  - Location: `/apps/issuer-api/src/middleware/guard.ts` lines 13-19
  - **Gap**: Requires `MESSAGING_GUARD_PUBLIC_KEY` from environment
  - **Gap**: Signature verification optional (`requireSignature` flag)

### A.1 Trust Broken

- **Line 9 in guard.ts**: TODO comment indicates audit service not implemented

  ```typescript
  // TODO: Emit to audit service
  ```

- **Line 15 in clinicianIdentityIssuer.ts**: Missing DID validation

  ```typescript
  const subjectDid = profile.did || `did:key:z${randomBytes(16).toString('base64url')}`;
  // BROKEN: Generated DIDs are not authenticated; just random values
  ```

---

## A.2 Credential Creation & Signing

### A.2 Trust Proven

- **Cryptographic Operation**: Ed25519 signatures via @noble/ed25519
  - Location: `/packages/domain-identity/src/crypto/ed25519.ts`
  - Lines 76-101: sign() function using Ed25519
  - Lines 142-157: verifyWithPublicKey() validation

**Code Evidence**:

```typescript
// Line 89: Actual signature operation
const signatureBytes = await ed.signAsync(messageBytes, secretKeyBytes);

// Lines 82-86: Key validation
const secretKeyBytes = Buffer.from(secretKey, 'hex');
if (secretKeyBytes.length !== 32) {
  throw new Error('Invalid Ed25519 secret key length (expected 32 bytes)');
}
```

- **Credential Structure**: W3C VC format with required fields

  - Location: `/apps/issuer-api/src/services/clinicianIdentityIssuer.ts` lines 79-93
  - Issues JWT-VC payload with:
    - @context, id, type, issuer, issuanceDate
    - credentialSubject with validated fields

- **JWT Signing**: Using jose library (SignJWT)
  - Location: lines 100-110 in clinicianIdentityIssuer.ts
  - Sets kid (key ID), algorithm, issuer claim
  - JTI (JWT ID) set to credential ID

### A.2 Trust Assumed

- **Key Material Source**: `getActiveSigningKey()`

  - Called at line 10: `import { getActiveSigningKey } from '../../../../services/identity/signingKeyProvider';`
  - **CRITICAL GAP**: This import path doesn't exist in scanned codebase
  - **MISSING FILE**: `/services/identity/signingKeyProvider` - implementation not found
  - Implies key rotation and storage is delegated to unverified external service

- **Algorithm Selection**:
  - Line 20: `const algorithm = (jwk.alg as string) || DEFAULT_SIGNING_ALG;`
  - **Gap**: Defaults to environment variable `ISSUER_SIGNING_ALG` with fallback to 'EdDSA'
  - No validation that algorithm is approved for credentials

### A.2 Trust Broken

- **Missing Key Material Validation**:

  - No verification that private key is actually controlled by issuer
  - No key rotation policy visible
  - No Key Derivation Function (KDF) used for seed-based keys

- **Subject DID Generation** (Line 75):

  ```typescript
  const subjectDid = profile.did || `did:key:z${randomBytes(16).toString('base64url')}`;
  ```

  - Generates random placeholder DIDs without subject authentication
  - No linkage to actual subject identity

---

## A.3 DID/Key Resolution for Issuer

### A.3 Trust Proven

- **DID Caching Layer**: Implemented with TTL
  - Location: `/packages/domain-identity/src/did/cachedResolver.ts`
  - Lines 49-181: CachedDIDResolver class
  - Separate positive/negative caches with configurable TTLs
  - Default: 300s positive, 60s negative (lines 60-61)

**Code Evidence**:

```typescript
// Lines 70-96: Resolution with caching
async resolve(did: string): Promise<DIDDocument | null> {
  const negativeEntry = this.getFromCache(this.negativeCache, did);
  if (negativeEntry === true) {
    this.metrics.negative.hits++;
    return null;
  }

  const cachedDoc = this.getFromCache(this.positiveCache, did);
  if (cachedDoc) {
    this.metrics.positive.hits++;
    return cachedDoc;
  }

  const resolved = await this.options.resolver(did);
  // ... cache result
}
```

### A.3 Trust Assumed

- **Default Resolver Implementation** (Lines 29-44):

  ```typescript
  function defaultResolver(did: string): Promise<DIDDocument | null> {
    if (did.startsWith('did:example:')) {
      return Promise.resolve({
        id: did,
        verificationMethod: [
          {
            id: `${did}#key-1`,
            type: 'Ed25519VerificationKey2020',
            controller: did,
            publicKeyMultibase: 'zH3C2AVvLMv6gmMNam3uVAjZpfkcJCwDwnZn6z3wXmqPV',
          },
        ],
      });
    }
    return Promise.resolve(null);
  }
  ```

  - **Gap**: Only resolves did:example: DIDs (test DIDs)
  - **Gap**: Returns hardcoded placeholder public keys
  - **Assumed**: Custom resolver provided at initialization (line 19 option)

- **No DID Method Support**: Missing implementation for:
  - did:web: (DNS-based)
  - did:key: (static cryptographic DIDs)
  - Blockchain-based DIDs (did:ethr, did:sol, etc.)

### A.3 Trust Broken

- **CRITICAL**: Verifier has no way to resolve real issuer DIDs

  - Location: `/apps/verifier-api/src/routes/verifyCredential.ts` lines 15-18

  ```typescript
  const TRUSTED_ISSUERS = (process.env.TRUSTED_ISSUERS || 'did:web:issuer.vitalcv.com')
    .split(',')
    .map((issuer) => issuer.trim())
    .filter(Boolean);
  ```

  - Issuer trust is hardcoded from environment variable
  - No dynamic DID resolution; static allowlist only

---

## A.4 Credential Metadata Generation

### A.4 Trust Proven

- **Temporal Metadata**: Timestamp and expiry

  - Location: clinicianIdentityIssuer.ts lines 78-86
  - Uses `new Date()` for issuanceDate
  - Sets `iat` and `exp` claims in JWT (lines 106-109)

- **Credential Uniqueness**: Random credential ID
  - Line 72: `const credentialId = randomBytes(16).toString('hex')`
  - Ensures each credential has unique identifier

### A.4 Trust Assumed

- **NPI Validation** (Lines 64-66):

  ```typescript
  if (!profile.npi || !/^[0-9]{10}$/.test(profile.npi)) {
    throw new Error('Valid 10-digit NPI is required');
  }
  ```

  - Only checks format; does not verify against NPDB
  - Assumes NPI already validated by upstream service

- **Clinician Profile Extraction** (Lines 45-50):

  ```typescript
  const profile: ClinicianProfile = {
    did: proof?.jwt ? extractDidFromProof(proof.jwt) : undefined,
    name: req.body.credential_subject?.name || 'Dr. Test Clinician',
    npi: req.body.credential_subject?.npi || '1234567890',
    specialty: req.body.credential_subject?.specialty || 'General Medicine',
  };
  ```

  - **Gap**: Defaults to test values if not provided
  - No validation that values match subject identity

### A.4 Trust Broken

- **extractDidFromProof()** (Lines 72-80):

  ```typescript
  function extractDidFromProof(proofJwt: string): string | undefined {
    try {
      const { decodeJwt } = require('jose');
      const decoded = decodeJwt(proofJwt);
      return (decoded.iss as string) || (decoded.sub as string);
    } catch {
      return undefined;
    }
  }
  ```

  - Decodes JWT without verification
  - **CRITICAL**: Takes unverified iss/sub claims as authoritative
  - No signature validation; susceptible to JWT substitution attacks

---

## A.5 Blockchain Anchoring (If Any)

### A.5 Trust Broken

- **No Credential Anchoring Implemented**

  - Issuance flow has zero blockchain calls
  - No Merkle tree commitment
  - No timestamp proof submission

- **Conditional Support via Backend**:

  - Location: `/apps/api/backend/src/blockchain/blockchain_integration.ts`
  - Lines 74-100: VerifierStakingService implements smart contract interaction
  - **Gap**: Only staking logic; no credential anchoring

- **Expected but Missing**:
  - No Substrate pallet integration visible
  - No Proof-of-Existence submission
  - No transaction receipt generation

---

## A.6 Storage & Persistence

### A.6 Trust Proven

- **JWT Serialization**: Compact format (`.` separated)
  - Returns JWS from issuance
  - Cryptographically bound to issuer key

### A.6 Trust Assumed

- **Delivery Channel**: Not specified in issuance endpoint
  - Assumes HTTPS transport
  - No message integrity verification specified

### A.6 Trust Broken

- **No Credential Storage**:
  - Issuer generates credential but doesn't store it
  - No credential record for later revocation
  - **CRITICAL GAP**: Revocation cannot be performed without credential registry

---

## A.7 Delivery to Subject

### A.7 Trust Assumed

- **OIDC4VCI Flow**: Returns credential in response
  - Location: Lines 56-59 in credential.ts
  - Assumes client will transport safely to wallet

### A.7 Trust Broken

- **No Binding to Subject Device**:
  - No device key verification
  - No holder binding enforcement
  - Credential could be intercepted in transit

---

## B. WALLET STORAGE FLOW ANALYSIS

## B.1 Credential Receipt Verification

### B.1 Trust Proven

- **Credential Signature Validation** (Optional):
  - Wallet can verify issuer signature before storage
  - Uses Jose library for signature checking
  - **Location**: Based on verifyClinicianIdentityVC() in clinicianIdentityIssuer.ts lines 121-138

**Code Evidence**:

```typescript
export async function verifyClinicianIdentityVC(jws: string): Promise<ClinicianIdentityVC> {
  const { jwtVerify } = await import('jose');

  const { jwk } = await getActiveSigningKey();
  const { d, ...publicJwk } = jwk;
  const publicKey = await importJWK(publicJwk as JWK, ...);

  const verified = await jwtVerify(jws, publicKey, {
    algorithms: [(jwk.alg as string) || DEFAULT_SIGNING_ALG],
    issuer: ISSUER_DID,
  });

  if (!verified.payload.vc) {
    throw new Error('Invalid VC: missing vc claim in JWT payload');
  }

  return verified.payload.vc as ClinicianIdentityVC;
}
```

### B.1 Trust Assumed

- **Device Challenge Protocol**: Implemented for wallet authentication
  - Location: `/services/wallet/deviceChallenge.ts` lines 42-178
  - Issues random nonce (UUID) with 5-minute TTL
  - Verifies DPoP proof matches stored device public key

**Code Evidence**:

```typescript
// Lines 50-68: Challenge issuance
issueChallenge(deviceId: string): IssuedDeviceChallenge {
  if (!deviceId) {
    throw new Error('deviceId is required to issue a challenge');
  }
  this.cleanup();

  const nonce = randomUUID();
  const expiresAtDate = new Date(Date.now() + this.ttlMs);

  this.challenges.set(deviceId, {
    nonce,
    expiresAt: expiresAtDate.getTime(),
  });

  return {
    nonce,
    expiresAt: expiresAtDate.toISOString(),
  };
}

// Lines 70-150: Challenge verification
async verifyChallenge({
  prisma,
  deviceId,
  proof,
  method,
  url,
}: VerifyDeviceChallengeOptions): Promise<VerifyDeviceChallengeResult> {
  const challenge = this.challenges.get(deviceId);
  if (!challenge || challenge.expiresAt < Date.now()) {
    this.challenges.delete(deviceId);
    throw new Error('challenge_expired');
  }

  const device = await prisma.walletDevice.findUnique({
    where: { deviceId },
  });

  // ... comprehensive JWK verification (lines 91-135)

  // Rotate challenge after successful verification
  this.challenges.delete(deviceId);
  const nextChallenge = this.issueChallenge(deviceId);
}
```

### B.1 Trust Broken

- **In-Memory Challenge Storage** (Line 44):

  ```typescript
  private readonly challenges = new Map<string, ChallengeState>();
  ```

  - Not persistent across application restarts
  - Lost on server crash
  - **Gap**: No database backup

- **Missing Device Binding**:
  - DPoP proves device ownership
  - But no cryptographic binding between credential and device
  - Could be transferred to different device

---

## B.2 Storage Encryption

### B.2 Trust Assumed

- **Database Encryption**: Prisma with SQLite

  - Location: `/apps/api/backend/prisma/dev.db`
  - **Gap**: No encryption at rest specified
  - SQLite database file is plaintext

- **Transport Encryption**: HTTPS assumed
  - No TLS verification in code
  - Trusts underlying Express/Node.js HTTPS

### B.2 Trust Broken

- **No End-to-End Encryption**:
  - Credentials stored as plaintext in database
  - Server has access to all credential data
  - No user-side encryption implemented

---

## B.3 Access Control

### B.3 Trust Proven

- **Device Authentication via Challenge**:

  - JWK comparison (line 133 in deviceChallenge.ts):

  ```typescript
  private areJwksEqual(a: WalletDeviceJwk, b: WalletDeviceJwk): boolean {
    const keys: Array<keyof WalletDeviceJwk> = ['kty', 'crv', 'x', 'y'];
    return keys.every((key) => a[key] === b[key]);
  }
  ```

  - Verifies device key hasn't changed

- **Nonce-Based Replay Protection**:
  - Line 103: `if (!payload.nonce || payload.nonce !== challenge.nonce)`
  - One-time nonce prevents reuse

### B.3 Trust Assumed

- **Wallet Device Registry**:
  - Credentials stored in Prisma DB
  - No visibility into access control policies
  - Assumes database has ACLs per user

### B.3 Trust Broken

- **No User Authentication**:
  - Verifyable credentials stored by device ID
  - No user identity verification required
  - No session management visible

---

## B.4 Presentation Generation

### B.4 Trust Broken

- **No Presentation Logic Found**:
  - VP (Verifiable Presentation) generation not implemented in scanned files
  - No selective disclosure
  - No DPoP binding for presentations

---

## B.5 Selective Disclosure

### B.5 Trust Broken

- **Zero Implementation**:
  - No SD-JWT support
  - No JSON-LD selective disclosure
  - Entire credential presented always

---

## C. VERIFICATION FLOW ANALYSIS

## C.1 Credential Presentation Request

### C.1 Trust Broken

- **No OIDC4VP Implementation**:
  - Location: `/apps/verifier-api/src/oidc4vp/routes.ts`
  - **Line comment**: `// TODO: Implement actual VP verification`
  - Routes defined but verification stub

---

## C.2 Proof Generation

### C.2 Trust Broken

- **No Proof Generation**:
  - Wallet doesn't generate DPoP proofs for presentations
  - No holder binding to credential

---

## C.3 Signature Verification

### C.3 Trust Proven

- **JWT Signature Verification**:
  - Location: `/apps/verifier-api/src/routes/verifyCredential.ts` lines 106-109

**Code Evidence**:

```typescript
if (isTrustedIssuer) {
  const JWKS = await ensureIssuerJwks(refreshRequested);
  await jwtVerify(credential, JWKS, {
    issuer,
  });
}
```

- Uses jose library for cryptographic verification
- Checks issuer claim matches trusted issuer

### C.3 Trust Assumed

- **JWKS Endpoint Access**:
  - Calls `getPublicJwksPayload()` (line 37)
  - **MISSING**: Implementation not found in scanned codebase
  - Assumes endpoint returns public keys in JWKS format

**Code Analysis**:

```typescript
// Lines 31-55: JWKS loading with refresh
async function ensureIssuerJwks(force = false) {
  const now = Date.now();
  if (!force && localIssuerJwks && now - lastJwksLoad < JWKS_REFRESH_INTERVAL_MS) {
    return localIssuerJwks;
  }

  const payload = await getPublicJwksPayload();
  if (!payload.keys.length) {
    throw new Error('Issuer JWKS is empty');
  }

  if (!force && localIssuerJwks && cachedJwksVersion === payload.version) {
    lastJwksLoad = now;
    return localIssuerJwks;
  }

  const sanitized = {
    keys: payload.keys.map(stripMetadata),
  };

  localIssuerJwks = createLocalJWKSet(sanitized);
  cachedJwksVersion = payload.version;
  lastJwksLoad = now;
  return localIssuerJwks;
}
```

- Caches keys for 60 seconds (default JWKS_REFRESH_INTERVAL_MS)
- Strips metadata (status, createdAt, rotatedAt) before use

### C.3 Trust Broken

- **Untrusted Issuer Handling** (Lines 110-141):

  ```typescript
  else {
    console.warn(`[VerifyCredential] Unknown issuer: ${issuer}. Attempting structure-only verification.`);

    const parts = credential.split('.');
    if (parts.length !== 3) {
      return res.json({
        valid: false,
        reason: 'Invalid JWS format: expected 3 parts'
      });
    }

    const header = JSON.parse(Buffer.from(parts[0], 'base64url').toString());
    const alg = header.alg;

    if (!alg) {
      return res.json({
        valid: false,
        reason: 'Missing algorithm in JWT header'
      });
    }

    console.warn(`[VerifyCredential] Skipping signature verification for untrusted issuer: ${issuer}.`);

    return res.json({
      valid: true,
      reason: 'Issuer not trusted. Signature not verified.',
      warning: 'This verification is incomplete. Signature was not cryptographically verified.',
      issuer,
      subject: decoded.sub,
      issuedAt: decoded.iat ? new Date(decoded.iat * 1000).toISOString() : undefined,
    });
  }
  ```

  - **CRITICAL VULNERABILITY**: Returns `valid: true` for credentials from unknown issuers
  - Skips signature verification entirely
  - Only checks JWT structure (has 3 parts)
  - Returns warning but still marks as valid

---

## C.4 Issuer DID Resolution

### C.4 Trust Broken

- **No Real DID Resolution**:
  - Verifier uses hardcoded TRUSTED_ISSUERS list (line 15-18)
  - No dynamic DID resolution
  - No blockchain validation
  - No web-of-trust establishment

---

## C.5 Revocation Status Check

### C.5 Trust Proven

- **Status Endpoint Validation**:
  - Location: `/apps/verifier-api/src/services/vcValidator.ts` lines 69-101

**Code Evidence**:

```typescript
async function checkVCStatus(
  vcId: string,
  statusEndpoint?: string,
): Promise<StatusCheckResult | null> {
  if (!statusEndpoint) {
    return null; // Status check is optional
  }

  try {
    const response = await fetch(`${statusEndpoint}?credential_id=${encodeURIComponent(vcId)}`, {
      method: 'GET',
      headers: {
        Accept: 'application/json',
      },
    });

    if (!response.ok) {
      // Status endpoint unavailable - treat as non-revoked
      return null;
    }

    const data = await response.json();
    return {
      revoked: data.revoked === true,
      reason: data.reason,
    };
  } catch (error) {
    // Status check failed - treat as non-revoked (fail open)
    console.warn('[VCValidator] Status check failed:', error);
    return null;
  }
}
```

### C.5 Trust Assumed

- **Status Endpoint Trust**:
  - Assumes status endpoint is controlled by credential issuer
  - No cryptographic verification of status response
  - No freshness validation

### C.5 Trust Broken

- **Fail-Open Revocation** (Lines 87-89, 96-99):

  - If status endpoint unreachable: treats credential as valid
  - If status fetch fails: treats credential as valid
  - **CRITICAL**: Allows revoked credentials through on network failure

- **No Status Proof**:
  - Status response is unsigned JSON
  - Could be MITM'd or cached stale value
  - No integrity verification

---

## C.6 Blockchain Anchor Verification

### C.6 Trust Broken

- **Not Implemented**:
  - No blockchain anchor checks
  - No Merkle proof validation
  - No timestamp verification

---

## C.7 Trust Establishment

### C.7 Trust Proven

- **JWT Algorithm Validation** (verifyCredential.ts):
  - Lines 121-122 in dpopGuard.ts validate allowed algorithms
  - ALLOWED_ALGORITHMS allowlist enforced

### C.7 Trust Broken

- **Return Value for Unknown Issuers**:
  - Lines 133-140: Returns `valid: true` despite warning
  - Trust establishment fails when issuer unknown

---

## D. REVOCATION FLOW ANALYSIS

## D.1 Revocation Authorization

### D.1 Trust Proven

- **HTTP Endpoint**: POST to `/status-list/revoke`
  - Location: `/apps/status-api/src/routes/statusList.ts` lines 113-138
  - Validates credentialId parameter required

**Code Evidence**:

```typescript
export function revokeCredential(req: Request, res: Response): void {
  const { credential_id, reason } = req.body;

  if (!credential_id) {
    return res.status(400).json({
      error: 'invalid_request',
      error_description: 'Missing credential_id',
    });
  }

  // Mark as revoked
  statusList.set(credential_id, {
    credentialId: credential_id,
    revoked: true,
    revokedAt: Date.now(),
    reason: reason || 'Revoked by issuer',
  });

  res.json({
    success: true,
    credential_id,
    revoked: true,
    revoked_at: new Date().toISOString(),
    reason: reason || 'Revoked by issuer',
  });
}
```

### D.1 Trust Assumed

- **Issuer Authorization**:
  - No authentication required on revocation endpoint
  - **CRITICAL GAP**: Any client can revoke any credential
  - No issuer identity verification

### D.1 Trust Broken

- **Missing Issuer Authentication**:
  - No DPoP requirement on revocation
  - No access control checks
  - No audit trail of who revoked what

---

## D.2 Status List Update

### D.2 Trust Proven

- **In-Memory Status List**:

  - Location: Line 29 in statusList.ts
  - `const statusList = new Map<string, StatusListEntry>();`
  - Instant updates to status map

- **Status List VC Generation** (Lines 83-105):
  - Generates StatusList2021Credential on demand
  - Includes bitstring encoding of revocation status
  - Computes SHA256 hash of encoded list

**Code Evidence**:

```typescript
function generateStatusListVC(issuer: string): any {
  const entries = Array.from(statusList.values());
  const bitstring = generateBitstring(entries);
  const listHash = createHash('sha256').update(bitstring).digest('hex');

  return {
    '@context': [
      'https://www.w3.org/2018/credentials/v1',
      'https://w3id.org/vc/status-list/2021/v1',
    ],
    id: `${STATUS_API_URL}/status-list/2021`,
    type: ['VerifiableCredential', 'StatusList2021Credential'],
    issuer,
    issuanceDate: new Date().toISOString(),
    credentialSubject: {
      id: `${STATUS_API_URL}/status-list/2021#list`,
      type: 'StatusList2021',
      statusPurpose: 'revocation',
      encodedList: bitstring,
      listHash,
    },
  };
}
```

- Bitstring encoding (Lines 35-53):
  - Each bit represents one credential
  - 1 = revoked, 0 = active
  - Base64url encoded

### D.2 Trust Broken

- **No Persistence**:

  - In-memory Map lost on server restart
  - No database storage
  - No transaction log

- **No Signature on Status List**:
  - StatusList2021Credential generated but not signed
  - Verifier receives unsigned response
  - Could be modified in transit

---

## D.3 Blockchain Registry Update

### D.3 Trust Broken

- **Not Implemented**:
  - No blockchain submission
  - No immutable revocation record
  - No Merkle tree update

---

## D.4 Notification/Propagation

### D.4 Trust Broken

- **Zero Notification System**:
  - No webhook notifications
  - No event broadcasting
  - Verifiers must actively poll status endpoint

---

## D.5 Verification Impact

### D.5 Trust Broken

- **Revoked Credentials Still Valid**:
  - If verifier queries status endpoint before revocation propagates
  - No cache invalidation mechanism
  - No subscription to revocation events

---

## E. AUDIT ANCHORING FLOW ANALYSIS

## E.1 Event Capture

### E.1 Trust Proven

- **Audit Event Structure**:
  - Location: `/apps/verifier-api/src/services/audit.ts`
  - Lines 9-17: AuditEventData interface

**Code Evidence**:

```typescript
interface AuditEventData {
  userId?: string;
  reason: string;
  path: string;
  method: string;
  headers?: Record<string, string | undefined>;
  timestamp: string;
  [key: string]: any;
}
```

- **Event Logging** (Lines 25-67):

  ```typescript
  export async function auditLog(
    eventType: string,
    data: AuditEventData
  ): Promise<void> {
    const auditEvent = {
      type: eventType,
      userId: data.userId || 'anonymous',
      data: {
        reason: data.reason,
        path: data.path,
        method: data.method,
        headers: data.headers,
        timestamp: data.timestamp,
        ...data,
      },
      createdAt: new Date(),
    };
  ```

### E.1 Trust Assumed

- **Database Storage**:
  - Attempts Prisma client creation (line 46)
  - Stores in `auditEvent` table if DB available
  - Falls back to console logging

### E.1 Trust Broken

- **Fallible Audit System** (Lines 43-67):
  - If Prisma unavailable, audit only goes to console
  - No guarantee of persistence
  - Could lose audit trail on startup

---

## E.2 Hash Generation

### E.2 Trust Proven

- **SHA256 Hashing**:
  - Location: `/apps/status-api/src/routes/statusList.ts` line 86
  - Uses Node.js crypto module

**Code Evidence**:

```typescript
const listHash = createHash('sha256').update(bitstring).digest('hex');
```

### E.2 Trust Assumed

- **Hash Purpose**: Detects changes to status list
- **Not for Anchoring**: Just metadata, not submitted anywhere

---

## E.3 Blockchain Submission

### E.3 Trust Broken

- **Not Implemented**:
  - No credential hashes submitted to blockchain
  - No Merkle tree construction
  - No immutability guarantees

---

## E.4 Receipt Generation

### E.4 Trust Broken

- **No Receipts Issued**:
  - No blockchain transaction IDs returned
  - No timestamp proof provided to users
  - No receipt format defined

---

## E.5 Immutability Guarantees

### E.5 Trust Broken

- **Entirely Missing**:
  - No cryptographic anchoring
  - No timestamping service
  - All data mutable in-memory or database

---

## CRITICAL TRUST GAPS SUMMARY

## Severity: CRITICAL

| Gap                                 | Location                      | Impact                                        | Mitigation                                         |
| ----------------------------------- | ----------------------------- | --------------------------------------------- | -------------------------------------------------- |
| Issuer identity unverified          | clinicianIdentityIssuer.ts:13 | Any endpoint can claim to be issuer           | Implement issuer registry with cryptographic proof |
| Unknown issuer bypass               | verifyCredential.ts:131-140   | Credentials from unknown issuers marked valid | Require issuer whitelist or DID validation         |
| Revocation endpoint unauthenticated | statusList.ts:113             | Anyone can revoke any credential              | Add DPoP/client authentication                     |
| Revocation not persistent           | statusList.ts:29              | Lost on restart                               | Use database backend                               |
| Untrusted DID resolution            | cachedResolver.ts:29-44       | Placeholder implementation only               | Implement did:web, did:key, blockchain DIDs        |
| Key material source missing         | clinicianIdentityIssuer.ts:10 | Cannot verify key origin                      | Implement signingKeyProvider with KMS              |
| VP verification missing             | oidc4vp/routes.ts             | Verifiable presentations not verified         | Implement full OIDC4VP flow                        |
| Fail-open revocation                | vcValidator.ts:88-99          | Revoked credentials valid on network error    | Fail-closed revocation checks                      |

## Severity: HIGH

| Gap                           | Location                      | Impact                               | Mitigation                               |
| ----------------------------- | ----------------------------- | ------------------------------------ | ---------------------------------------- |
| Status list unsigned          | statusList.ts:83-105          | Attacker can forge revocation status | Sign status lists with issuer key        |
| Device challenge in-memory    | deviceChallenge.ts:44         | Lost on restart                      | Use database for challenge storage       |
| No blockchain anchoring       | N/A                           | No immutable audit trail             | Integrate with Substrate/EVM chains      |
| Subject DID not authenticated | clinicianIdentityIssuer.ts:75 | Wrong identity in credential         | Bind credential to authenticated subject |
| Untrusted proof JWT           | credential.ts:72-80           | DID injection from unverified JWT    | Verify JWT signature before use          |
| JWKS endpoint missing         | verifyCredential.ts:37        | Cannot load issuer public keys       | Implement /.well-known/jwks.json         |

## Severity: MEDIUM

| Gap                      | Location                      | Impact                              | Mitigation                        |
| ------------------------ | ----------------------------- | ----------------------------------- | --------------------------------- |
| No end-to-end encryption | B.2                           | Server can see all credentials      | Implement user-side encryption    |
| No selective disclosure  | B.5                           | Full credential always leaked       | Add SD-JWT or JSON-LD SD support  |
| Algorithm not validated  | clinicianIdentityIssuer.ts:20 | Weak algorithms could be used       | Enforce strong algorithms only    |
| JWKS cache limited       | verifyCredential.ts:20        | Key compromise not detected quickly | Reduce cache TTL to 60 seconds    |
| Audit fallback unsafe    | audit.ts:58-66                | Console-only audit not persistent   | Remove fallback; require database |

---

## TRUST FLOW DIAGRAMS

## PROVEN Trust Flows

```text
ISSUANCE:
┌─────────────┐     DPoP+cnf.jkt        ┌──────────────┐
│   Client    ├──────────────────────>  │  Issuer API  │
│ (Wallet)    │                        └──────────────┘
└─────────────┘                                │
                                               ├─ Verify DPoP signature
                                               ├─ Verify cnf.jkt thumbprint
                                               ├─ Check replay (jti)
                                               │
                                               v
                                    ┌──────────────────┐
                                    │  Ed25519 Sign    │
                                    │  Credential      │
                                    └──────────────────┘
                                               │
                                               └─> JWT VC Returned
```

## BROKEN Trust Flows

```text
VERIFICATION (Unknown Issuer):
┌──────────────┐     Credential        ┌──────────────┐
│   Verifier   ├──────────────────────>│  Verifier API│
│              │                       └──────────────┘
└──────────────┘                              │
                                              ├─ Decode JWT (unverified)
                                              ├─ Extract issuer DID
                                              ├─ Check if trusted
                                              │
                                              v
                                    ┌─────────────────┐
                                    │ Issuer in list? │
                                    └────────┬────────┘
                                             │
                         ┌───────────────────┼───────────────────┐
                         │                   │                   │
                        YES                  NO              (BROKEN)
                         │                   │
                         v                   v
                   ┌──────────┐        ┌─────────────┐
                   │Verify JWT│        │Check JWT    │
                   │Signature │        │Structure    │
                   └──────────┘        │ONLY - NO    │
                         │             │VERIFICATION │
                         │             └──────┬──────┘
                         │                    │
                         └────────┬───────────┘
                                  │
                                  v
                           ┌────────────────┐
                           │ MARKED VALID   │
                           │ (INSECURE)     │
                           └────────────────┘
```

```text
REVOCATION (Broken):
┌─────────────────┐                ┌──────────────────┐
│  Any Client     │   No Auth      │ Status Endpoint  │
│ (Unauthenticated├────────────────> (Unprotected)    │
│  revoke request)│                 │  In-Memory Map   │
└─────────────────┘                 │ (Lost on Restart)│
                                    └──────────────────┘
                                             │
                              VULNERABLE TO: │
                              ├─ DDoS revocation
                              ├─ Unauthorized revocation
                              ├─ No audit trail
                              └─ Data loss
```

---

## AUTHENTICATION & AUTHORIZATION MATRIX

## Component: Issuer API

| Endpoint               | Method | Authentication | Authorization | Protection Strength      |
| ---------------------- | ------ | -------------- | ------------- | ------------------------ |
| /credential            | POST   | DPoP + Bearer  | cnf.jkt match | STRONG (verified)        |
| /metadata              | GET    | None           | Public        | ASSUMED (by config)      |
| /.well-known/jwks.json | GET    | None           | Public        | BROKEN (not implemented) |

## Component: Verifier API

| Endpoint           | Method | Authentication | Authorization       | Protection Strength   |
| ------------------ | ------ | -------------- | ------------------- | --------------------- |
| /verify/credential | POST   | None           | Trusted issuer list | WEAK (hardcoded list) |
| /status/{id}       | GET    | None           | Public              | BROKEN (fail-open)    |
| /oidc4vp/\*        | POST   | None (TODO)    | Unknown             | BROKEN (TODO)         |

## Component: Status API

| Endpoint            | Method | Authentication | Authorization | Protection Strength     |
| ------------------- | ------ | -------------- | ------------- | ----------------------- |
| /status-list/revoke | POST   | **NONE**       | **NONE**      | CRITICAL (open)         |
| /status-list/status | GET    | None           | Public        | ASSUMED (not persisted) |
| /status-list/2021   | GET    | None           | Public        | BROKEN (unsigned)       |

---

## KEY MATERIAL MANAGEMENT

## Issuer Signing Keys

**Source**: Unknown (missing implementation)

- Import location: Line 10 in clinicianIdentityIssuer.ts
- `import { getActiveSigningKey } from '../../../../services/identity/signingKeyProvider';`
- **MISSING FILE**: No signingKeyProvider found
- **Impact**: Cannot verify key origin, rotation, or secure storage

**Algorithm**: Ed25519 (via @noble/ed25519)

- **Validation**: Weak (defaults from env, no approval list)
- **Strength**: 256-bit (adequate)

**Rotation**: Unknown

- **Gap**: No rotation policy visible
- **Gap**: Cached JWKS has 60s TTL (reasonable)

**Storage**: Assumed KMS (not implemented)

- **Risk**: If stored in environment variables (common mistake)

## Device Keys (Wallet)

**Generation**: By wallet client (not in VitalCV code)

- **Assumption**: Client uses cryptographically secure RNG
- **Format**: JWK (OKP for Ed25519, EC for ECDSA)

**Binding**: Via DPoP thumbprint

- **Strength**: Proven (lines 160-174 in dpopGuard.ts)
- **Weakness**: Not bound to credential itself

**Storage**: Wallet device database

- **Location**: Prisma with `publicKeyJwk` field
- **Encryption**: Not specified (likely plaintext)

---

## NETWORK & TRANSPORT SECURITY

## TLS/HTTPS

**Assumption**: All HTTPS endpoints

- **Enforced**: No certificate pinning visible
- **Gap**: Man-in-the-middle possible

## DPoP Proof Structure

**Required Fields**:

```json
{
  "header": {
    "alg": "EdDSA|ES256",
    "typ": "dpop+jwt",
    "jwk": { ... },
    "kid": "required"
  },
  "payload": {
    "htm": "POST|GET",
    "htu": "exact_url",
    "iat": <current_timestamp>,
    "jti": "<uuid>",
    "nonce": "<challenge_nonce>"
  }
}
```

**Validation** (dpopGuard.ts):

- ✅ Signature verification
- ✅ Typ validation ('dpop+jwt')
- ✅ HTM/HTU matching
- ✅ IAT skew check (±60 seconds)
- ✅ JTI replay protection
- ✅ cnf.jkt binding
- ❌ No timestamp binding to credential
- ❌ Nonce tied to device, not credential

---

## CRYPTOGRAPHIC OPERATIONS INVENTORY

## Ed25519 Operations

| Operation          | Location           | Implementation             | Status   |
| ------------------ | ------------------ | -------------------------- | -------- |
| Key Generation     | ed25519.ts:46-54   | ed.utils.randomSecretKey() | Verified |
| Key Derivation     | ed25519.ts:59-71   | From seed (32 bytes)       | Verified |
| Signing            | ed25519.ts:76-101  | ed.signAsync()             | Verified |
| Verification       | ed25519.ts:106-137 | ed.verifyAsync()           | Verified |
| Token Creation     | ed25519.ts:171-201 | Custom JWT format          | Verified |
| Token Verification | ed25519.ts:206-245 | Checks alg, exp, signature | Verified |
| VC Signing         | ed25519.ts:291-312 | Canonical + sign + proof   | Verified |
| VC Verification    | ed25519.ts:317-350 | Check proof type + verify  | Verified |

## JOSE/JWT Operations

| Operation        | Location                | Implementation           | Status                      |
| ---------------- | ----------------------- | ------------------------ | --------------------------- |
| JWK Thumbprint   | dpopGuard.ts:160        | calculateJwkThumbprint() | Verified                    |
| JWT Verification | verifyCredential.ts:107 | jwtVerify()              | Verified (trusted issuer)   |
| JWT Decode       | verifyCredential.ts:76  | decodeJwt()              | **Vulnerable** (unverified) |
| JWT Decode       | dpopGuard.ts:86-88      | Manual base64 decode     | Verified                    |

## Symmetric Cryptography

| Operation          | Location           | Implementation        | Status   |
| ------------------ | ------------------ | --------------------- | -------- |
| SHA256 Hashing     | statusList.ts:86   | createHash('sha256')  | Verified |
| Base64url Encoding | ed25519.ts:250-256 | Custom implementation | Verified |
| Base64url Decoding | ed25519.ts:261-267 | Custom implementation | Verified |

---

## THREAT MODELS & MITIGATIONS

## Threat: Issuer Impersonation

**Attack Vector**:

- Attacker sets ISSUER_DID to attacker's DID
- Attacker signs credentials as legitimate issuer
- Verifier has no way to detect (hardcoded trust list)

**Current Mitigation**: None
**Required Mitigation**:

- Implement DID registry with cryptographic binding
- Perform issuer DID resolution
- Verify issuer DID against subject's trust anchors

---

## Threat: Credential Forgery (Untrusted Issuer)

**Attack Vector**:

- Attacker creates credential signed with attacker's key
- Submits to verifier with unknown issuer
- Verifier line 131 accepts as "valid" despite warning

**Current Mitigation**: Warning log (insufficient)
**Required Mitigation**:

- Fail-closed: reject unknown issuers
- Implement DID resolution for issuer verification
- Return 401 instead of 200 for unknown issuers

---

## Threat: Revocation Bypass (Universal Revocation)

**Attack Vector**:

- Attacker sends HTTP POST to /status-list/revoke
- No authentication required
- Can revoke any credential
- Issuer cannot prevent this

**Current Mitigation**: None
**Required Mitigation**:

- Add DPoP requirement to revocation endpoint
- Verify issuer identity (must own credential)
- Audit all revocations with issuer signature

---

## Threat: Revocation Data Loss

**Attack Vector**:

- Server restarts
- In-memory revocation status list cleared
- All revocations forgotten
- Revoked credentials become valid again

**Current Mitigation**: None
**Required Mitigation**:

- Move status list to persistent database
- Implement write-ahead logging
- Add periodic snapshots to blockchain

---

## Threat: Status List MITM

**Attack Vector**:

- Verifier requests revocation status
- Attacker intercepts response
- Attacker modifies status (set all to not-revoked)
- Verifier accepts modified status

**Current Mitigation**: HTTPS (assumed)
**Required Mitigation**:

- Sign status list VC with issuer key
- Verify signature in verifier
- Pin issuer certificate

---

## Threat: DID Resolution Poisoning

**Attack Vector**:

- Attacker compromises DNS for did:web resolution
- Returns attacker's public key for issuer DID
- Attacker's credential signatures verify
- Verifier trusts attacker's credentials

**Current Mitigation**: None (no DID resolution)
**Required Mitigation**:

- DNSSEC validation for did:web
- Blockchain resolution for did:ethr, did:sol
- Certificate pinning

---

## Threat: Key Rotation Not Detected

**Attack Vector**:

- Issuer rotates keys (old key compromised)
- Attacker uses old key to forge credentials
- Verifier JWKS cache has 60s TTL
- During cache window, forged credentials verify

**Current Mitigation**: 60-second cache TTL
**Required Mitigation**:

- Reduce TTL to 10 seconds
- Implement key binding with timestamps
- Revoke old keys immediately

---

## Threat: Credential Duplication

**Attack Vector**:

- Verifier receives same credential twice
- Both present at same time in presentation
- Verifier accepts (no duplicate check)
- Holder gets 2x value

**Current Mitigation**: None
**Required Mitigation**:

- Track credential IDs (jti) in verifier
- Reject if jti seen before in recent window
- Require presentation with all credentials distinct

---

## COMPLIANCE GAPS WITH STANDARDS

## W3C Verifiable Credentials Data Model 2.0

| Requirement                | Status | Location                         |
| -------------------------- | ------ | -------------------------------- |
| @context required          | ✅     | clinicianIdentityIssuer.ts:80-81 |
| id required                | ✅     | Line 83                          |
| type required              | ✅     | Line 84                          |
| issuer required            | ✅     | Line 85                          |
| issuanceDate required      | ✅     | Line 86                          |
| credentialSubject required | ✅     | Line 87-92                       |
| credentialStatus optional  | ❌     | Not included                     |
| expirationDate optional    | ❌     | Not included                     |
| proof required             | ❌     | Uses JWT instead of W3C proof    |

## OIDC4VCI (OpenID for Verifiable Credentials Issuance)

| Requirement                           | Status | Location             |
| ------------------------------------- | ------ | -------------------- |
| Credential endpoint (POST)            | ✅     | /credential endpoint |
| JWT_VC_JSON format                    | ✅     | lines 26-40          |
| DPoP support                          | ✅     | dpopGuard.ts         |
| Credential definition validation      | ✅     | Lines 34-40          |
| Metadata endpoint                     | ✅     | metadata.ts exists   |
| /.well-known/openid-credential-issuer | ❌     | Not implemented      |
| Authorization server interaction      | ❌     | Not implemented      |
| Token endpoint                        | ❌     | Not implemented      |

## OIDC4VP (OpenID for Verifiable Presentations)

| Requirement            | Status | Location                    |
| ---------------------- | ------ | --------------------------- |
| Authorization endpoint | ✅     | /oidc4vp/authz exists       |
| Presentation request   | ❌     | Not implemented             |
| VP verification        | ❌     | TODO at line 1 of routes.ts |
| Response signing       | ❌     | Not implemented             |

## RFC 9449 DPoP (OAuth 2.0 Demonstration of Proof-of-Possession)

| Requirement            | Status | Location           |
| ---------------------- | ------ | ------------------ |
| JWK in header          | ✅     | dpopGuard.ts:87    |
| typ=dpop+jwt           | ✅     | Line 108           |
| htm claim              | ✅     | Line 139           |
| htu claim              | ✅     | Line 134           |
| iat claim              | ✅     | Line 145           |
| jti claim              | ✅     | Line 150           |
| Signature verification | ✅     | Line 121           |
| Nonce binding          | ✅     | Line 103           |
| cnf.jkt in AT          | ✅     | Line 162-174       |
| Replay protection      | ✅     | Line 155           |
| One-shot JTI           | ✅     | checkAndStoreJti() |

## StatusList2021Credential

| Requirement                   | Status | Location                        |
| ----------------------------- | ------ | ------------------------------- |
| @context includes status-list | ✅     | statusList.ts:89-91             |
| credentialSubject.encodedList | ✅     | Line 101                        |
| statusPurpose: revocation     | ✅     | Line 100                        |
| bitstring encoding            | ✅     | generateBitstring() lines 35-53 |
| StatusList verification       | ❌     | No signature                    |
| Index binding                 | ❌     | Not used in credentials         |

---

## RECOMMENDATIONS

## IMMEDIATE (Critical - Do First)

1. **Implement Issuer Authentication**

   - Add issuer DID verification
   - Verify issuer owns signing keys
   - Implement key rotation policy

2. **Fix Revocation Endpoint Security**

   - Add DPoP requirement to POST /status-list/revoke
   - Verify issuer identity (DPoP proof must have issuer as subject)
   - Add audit logging with issuer signature
   - Remove unauthenticated endpoint

3. **Persist Revocation Status**

   - Move in-memory Map to database
   - Use Prisma for StatusListEntry storage
   - Implement transaction log for revocation changes
   - Add database snapshots

4. **Fix Unknown Issuer Handling**
   - Change line 131 from `valid: true` to `valid: false`
   - Return 401 instead of 200
   - Require issuer in TRUSTED_ISSUERS list

## HIGH PRIORITY (Do Within 1 Week)

1. **Implement JWKS Endpoint**

   - Create `/.well-known/jwks.json`
   - Export public keys from signingKeyProvider
   - Include key rotation metadata (createdAt, rotatedAt)
   - Implement getPublicJwksPayload() missing function

2. **Implement signingKeyProvider**

   - Define actual location/implementation
   - Support key rotation
   - Implement KMS integration
   - Return active key and all valid public keys

3. **Implement DID Resolution**

   - Support did:web: (via DNS)
   - Support did:key: (static crypto DIDs)
   - Add blockchain DID support (did:ethr, did:sol)
   - Cache results with TTL

4. **Sign Status List Credentials**

   - Add proof to StatusList2021Credential
   - Use issuer's private key
   - Include proof timestamp
   - Let verifier verify signature

5. **Implement Presentation Generation**

   - Add VP creation in wallet
   - Implement selective disclosure
   - Bind VP to device key (DPoP)
   - Add holder binding

6. **Complete OIDC4VP Flow**
   - Implement presentation request validation
   - Implement actual VP verification
   - Add policy-based verification
   - Return signed authorization response

## MEDIUM PRIORITY (Do Within 1 Month)

1. **Add End-to-End Encryption**

   - Encrypt credentials at storage
   - User controls encryption key
   - Server cannot read credential data

2. **Implement Selective Disclosure**

   - Add SD-JWT support
   - Or JSON-LD selective disclosure
   - Allow release of specific claims only

3. **Add Blockchain Anchoring**

   - Implement credential hash submission
   - Use Substrate pallet
   - Generate Merkle proofs
   - Return blockchain receipts

4. **Implement Notification System**

   - Webhook support for revocation notifications
   - Event subscriptions
   - Real-time verifier updates

5. **Add Compliance Auditing**
   - Implement full audit trail
   - Add digital signatures to audit events
   - Regular audit exports to blockchain
   - Tamper-evident logs

---

## APPENDIX: File Paths & Implementations

## Critical Files by Component

### Issuance

- `/apps/issuer-api/src/routes/oidc4vci/credential.ts` - Credential endpoint
- `/apps/issuer-api/src/services/clinicianIdentityIssuer.ts` - VC creation
- `/apps/issuer-api/src/middleware/dpopGuard.ts` - DPoP validation
- `/packages/domain-identity/src/crypto/ed25519.ts` - Cryptography
- **MISSING**: `/services/identity/signingKeyProvider.ts`

### Verification

- `/apps/verifier-api/src/routes/verifyCredential.ts` - Verification endpoint
- `/apps/verifier-api/src/services/vcValidator.ts` - Status checking
- `/apps/verifier-api/src/oidc4vp/routes.ts` - Presentation verification (TODO)
- **MISSING**: DID resolution, issuer JWKS endpoint

### Revocation

- `/apps/status-api/src/routes/statusList.ts` - Status management
- **BROKEN**: No authentication, in-memory only
- **MISSING**: Database backend

### Wallet

- `/services/wallet/deviceChallenge.ts` - Device authentication
- `/packages/domain-identity/src/did/cachedResolver.ts` - DID caching
- **MISSING**: Credential storage encryption

### Audit

- `/apps/verifier-api/src/services/audit.ts` - Event logging
- **BROKEN**: No persistence guarantee

---

### End of Trust Flow Trace Report

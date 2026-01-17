# VitalCV Trust Flow Analysis: Executive Summary

**Report Date**: January 9, 2026
**Analysis Scope**: Complete credential lifecycle (issuance → verification → revocation)
**Repository**: vitalcv (branch: codex/wave-04)
**Full Report**: See `TRUST_FLOW_ANALYSIS.md` (1537 lines)

---

## TLDR: Trust Scorecard

| Component                        | Trust Status | Risk Level |
| -------------------------------- | ------------ | ---------- |
| **Issuer Authentication (DPoP)** | PROVEN ✅    | Low        |
| **Credential Signing (Ed25519)** | PROVEN ✅    | Low        |
| **Issuer Authorization**         | BROKEN ❌    | CRITICAL   |
| **Issuer DID Resolution**        | BROKEN ❌    | CRITICAL   |
| **Unknown Issuer Verification**  | BROKEN ❌    | CRITICAL   |
| **Revocation Authentication**    | BROKEN ❌    | CRITICAL   |
| **Revocation Storage**           | BROKEN ❌    | CRITICAL   |
| **Status List Signing**          | BROKEN ❌    | HIGH       |
| **Wallet Device Binding**        | PROVEN ✅    | Low        |
| **Presentation Verification**    | MISSING ❌   | CRITICAL   |
| **Blockchain Anchoring**         | MISSING ❌   | HIGH       |
| **End-to-End Encryption**        | MISSING ❌   | MEDIUM     |

**Overall: 3/12 components working correctly. 8 critical gaps. 3 missing implementations.**

---

## 8 CRITICAL VULNERABILITIES

### 1. UNKNOWN ISSUER BYPASS (verifyCredential.ts:131-140)

**Risk**: Credentials from unverified issuers marked as valid
**Evidence**: Returns `{ valid: true, warning: "... not verified" }`
**Severity**: CRITICAL
**Exploitation**: Attacker creates any credential, submits to verifier, receives `valid: true`

### 2. REVOCATION ENDPOINT UNAUTHENTICATED (statusList.ts:113)

**Risk**: Anyone can revoke any credential
**Evidence**: No DPoP, no bearer token, no authentication check
**Severity**: CRITICAL
**Exploitation**: `POST /status-list/revoke` with any credentialId, no auth required

### 3. REVOCATION DATA NOT PERSISTENT (statusList.ts:29)

**Risk**: In-memory Map, lost on server restart
**Evidence**: `new Map<string, StatusListEntry>()`
**Severity**: CRITICAL
**Exploitation**: Revoke credential, restart server, credential becomes valid again

### 4. KEY MATERIAL SOURCE UNKNOWN (clinicianIdentityIssuer.ts:10)

**Risk**: Cannot verify key origin or rotation
**Evidence**: Import from non-existent `/services/identity/signingKeyProvider`
**Severity**: CRITICAL
**Exploitation**: If keys stored insecurely, attacker can forge credentials

### 5. FAIL-OPEN REVOCATION (vcValidator.ts:87-99)

**Risk**: Network outage enables revoked credentials
**Evidence**: "Status endpoint unavailable - treat as non-revoked"
**Severity**: CRITICAL
**Exploitation**: Take status endpoint offline, all revoked credentials become valid

### 6. ISSUER IDENTITY UNVERIFIED (clinicianIdentityIssuer.ts:13)

**Risk**: Any endpoint can claim to be the issuer
**Evidence**: `ISSUER_DID` from environment variable, no cryptographic proof
**Severity**: CRITICAL
**Exploitation**: Deploy to different server, change ISSUER_DID, issue forged credentials

### 7. VP VERIFICATION MISSING (oidc4vp/routes.ts)

**Risk**: Verifiable Presentations not verified
**Evidence**: `// TODO: Implement actual VP verification`
**Severity**: CRITICAL
**Exploitation**: Send any VP, verifier doesn't validate

### 8. DID RESOLUTION MISSING (cachedResolver.ts:29-44)

**Risk**: No way to verify issuer identity
**Evidence**: Only resolves `did:example:` with hardcoded public keys
**Severity**: CRITICAL
**Exploitation**: Cannot verify any real issuer DID

---

## WHAT'S WORKING (3 Components)

### ✅ DPoP Authentication (dpopGuard.ts)

- **Proven**: Signature verification, replay protection, nonce binding
- **Mechanisms**: JWK thumbprint, cnf.jkt matching, jti cache
- **Code Quality**: Comprehensive validation with 200+ lines of logic

### ✅ Credential Signing (ed25519.ts)

- **Proven**: Ed25519 signatures via @noble/ed25519
- **Mechanisms**: 256-bit keys, cryptographic signatures, proof generation
- **Code Quality**: Well-implemented with seed support and JWK export

### ✅ Device Challenge (deviceChallenge.ts)

- **Proven**: UUID nonces, JWK comparison, 5-minute expiry
- **Mechanisms**: Challenge-response protocol, device key binding
- **Code Quality**: Solid implementation with cleanup and challenge rotation

---

## HOW TO FIX (Priority Order)

### WEEK 1: Stop the Bleeding

1. **Fix Unknown Issuer Bypass** (5 lines)

   - Change line 131: `valid: false` instead of `valid: true`
   - Require `TRUSTED_ISSUERS` whitelist

2. **Authenticate Revocation Endpoint** (10 lines)

   - Add DPoP requirement to `/status-list/revoke`
   - Verify issuer can revoke their own credentials
   - Add audit logging

3. **Persist Revocation Status** (30 lines)
   - Move `statusList` Map to database
   - Use Prisma `StatusListEntry` table
   - Implement transaction log

### WEEK 2-3: Build Foundations

1. **Implement Issuer JWKS Endpoint** (50 lines)

   - Create `/.well-known/jwks.json`
   - Export public keys with metadata
   - Implement missing `getPublicJwksPayload()`

2. **Implement signingKeyProvider** (80 lines)

   - Define actual KMS integration
   - Support key rotation with timestamps
   - Return active + all valid public keys

3. **Implement DID Resolution** (150 lines)
   - Support did:web: (DNS resolution)
   - Support did:key: (static crypto DIDs)
   - Add blockchain DIDs (did:ethr, did:sol)
   - Cache with TTL

### WEEK 4-6: Complete Flows

1. **Sign Status Lists** (40 lines)

   - Add proof to StatusList2021Credential
   - Use issuer's private key
   - Verify signature in verifier

2. **Implement OIDC4VP Verification** (200 lines)
   - Verify presentation request format
   - Validate credential proofs in VP
   - Implement policy-based verification

---

## THREAT MODELS

| Threat               | Current State | Impact                              |
| -------------------- | ------------- | ----------------------------------- |
| Issuer Impersonation | Vulnerable    | Attacker gains issuer status        |
| Credential Forgery   | Vulnerable    | Attacker creates any credential     |
| Universal Revocation | Vulnerable    | Attacker revokes all credentials    |
| Key Compromise       | Vulnerable    | Lost ability to verify credentials  |
| Status Forgery       | Vulnerable    | Attacker controls revocation status |
| Network MITM         | Vulnerable    | Attacker sees credential data       |
| Revocation Evasion   | Vulnerable    | Revoked credentials still valid     |

---

## FILE LOCATIONS

**Critical Components**:

- `/apps/issuer-api/src/middleware/dpopGuard.ts` - DPoP validation (GOOD)
- `/apps/issuer-api/src/services/clinicianIdentityIssuer.ts` - Credential issuance
- `/apps/verifier-api/src/routes/verifyCredential.ts` - Verification (BROKEN)
- `/apps/status-api/src/routes/statusList.ts` - Revocation (BROKEN)
- `/services/wallet/deviceChallenge.ts` - Device auth (GOOD)
- `/packages/domain-identity/src/crypto/ed25519.ts` - Signing (GOOD)
- `/packages/domain-identity/src/did/cachedResolver.ts` - DID resolution (STUB)

**Missing Files**:

- `/services/identity/signingKeyProvider.ts` (imported but doesn't exist)
- `/.well-known/jwks.json` endpoint (not implemented)
- `getPublicJwksPayload()` function (called but not found)

---

## COMPLIANCE

**Standards Assessment**:

- **W3C VC Data Model 2.0**: 6/8 requirements met (no credentialStatus, no W3C proof)
- **OIDC4VCI**: 4/9 requirements met (missing metadata, token endpoint, authz server)
- **OIDC4VP**: 0/5 requirements met (routes exist but TODO)
- **RFC 9449 DPoP**: 10/10 requirements met (fully compliant)
- **StatusList2021**: 4/6 requirements met (missing signature, not used in VCs)

---

## RECOMMENDATIONS MATRIX

| Priority | Task                         | Effort  | Impact                      | Days      |
| -------- | ---------------------------- | ------- | --------------------------- | --------- |
| P0       | Fix unknown issuer bypass    | 5 min   | Blocks verification         | Same day  |
| P0       | Authenticate revocation      | 30 min  | Prevents DoS                | Same day  |
| P0       | Persist revocation status    | 1 hour  | Prevents data loss          | Day 1     |
| P1       | Implement JWKS endpoint      | 2 hours | Enables verification        | Day 2     |
| P1       | Implement signingKeyProvider | 4 hours | Enables key management      | Day 3-4   |
| P1       | Implement DID resolution     | 6 hours | Enables issuer verification | Day 5-7   |
| P2       | Sign status lists            | 2 hours | Prevents status forgery     | Day 8     |
| P2       | Implement OIDC4VP            | 1 day   | Enables presentations       | Day 9-10  |
| P3       | Add E2E encryption           | 2 days  | Protects credentials        | Day 11-14 |
| P3       | Blockchain anchoring         | 3 days  | Immutable audit trail       | Day 15-20 |

---

## CODE SNIPPETS NEEDING FIXES

### CRITICAL FIX #1: Unknown Issuer (verifyCredential.ts:131)

**Current**:

```typescript
return res.json({
  valid: true, // WRONG!
  reason: 'Issuer not trusted. Signature not verified.',
  warning: 'This verification is incomplete. Signature was not cryptographically verified.',
});
```

**Fixed**:

```typescript
return res.status(401).json({
  error: 'unknown_issuer',
  error_description: 'Issuer not in trusted list',
});
```

### CRITICAL FIX #2: Revocation Auth (statusList.ts:113)

**Current**:

```typescript
export function revokeCredential(req: Request, res: Response): void {
  const { credential_id, reason } = req.body;
  // NO AUTHENTICATION!
  statusList.set(credential_id, { revoked: true, ... });
}
```

**Fixed**:

```typescript
export function revokeCredential(req: Request, res: Response): void {
  // Require DPoP proof
  const dpopProof = req.headers['dpop'];
  if (!dpopProof) {
    return res.status(401).json({ error: 'use_dpop' });
  }
  // Verify issuer owns credential
  // ... then update statusList
}
```

### CRITICAL FIX #3: Revocation Persistence (statusList.ts:29)

**Current**:

```typescript
const statusList = new Map<string, StatusListEntry>();
```

**Fixed**:

```typescript
// Use Prisma
async function revokeCredential(credentialId: string, issuerDid: string) {
  await prisma.credentialStatus.upsert({
    where: { credentialId },
    update: { revoked: true, revokedAt: new Date() },
    create: { credentialId, issuerDid, revoked: true, revokedAt: new Date() },
  });
}
```

---

## NEXT STEPS

1. **Read Full Report**: See `TRUST_FLOW_ANALYSIS.md` (all 1537 lines)
2. **Schedule Review**: Security review with team
3. **Create Issues**: File GitHub issues for each critical fix
4. **Assign Tasks**: Assign to developers (E2-E3 for fixes)
5. **Set Deadlines**: All P0 fixes by end of week
6. **Track Progress**: Update milestone as fixes land

---

**Report Generated**: 2026-01-09
**Analysis Tool**: Claude Code File Search & Analysis
**Full Details**: See TRUST_FLOW_ANALYSIS.md

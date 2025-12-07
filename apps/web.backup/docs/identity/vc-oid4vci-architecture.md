# VC v2.0 + OID4VCI Implementation Architecture

## Overview

This document summarizes the W3C Verifiable Credentials Data Model v2.0 and OpenID for Verifiable Credential Issuance (OID4VCI) implementation for VitalCV.

## Architecture Components

### 1. Core VC Data Model (VC2-001)

**Location:** `/apps/api/src/vc/models/index.ts`

- TypeScript interfaces and Zod schemas for W3C VC Data Model v2.0
- Supports both JWT-encoded and JSON-LD-based credentials
- Normalized internal representation for consistent processing
- Key types: `Credential`, `CredentialSubject`, `Issuer`, `Evidence`, `Status`, `CredentialSchema`, `Proof`

### 2. JOSE-based VC Signing with AWS KMS (VC2-002)

**Location:** `/apps/api/src/vc/signing/joseKmsSigner.ts`

- VC signing using JOSE (JWS) with AWS KMS keys
- Supports ES256, ES384, ES512, and EdDSA algorithms
- Private keys never leave KMS (security best practice)
- Returns JWS proof objects aligned with JOSE/COSE security spec

**Configuration:**

- Environment variables for KMS key ARNs and issuer key IDs
- IAM roles configured so only VC signing service has `kms:Sign` permission

### 3. VC Verification Service (VC2-003)

**Location:** `/apps/api/src/vc/verification/joseVerifier.ts`

- Verifies JWS-based VC proofs
- Resolves issuer public keys via DID documents, JWKS, or KMS
- Validates signature, exp/nbf/iat, kid
- Ensures payload matches expected VC schema
- Exposes reusable `verifyCredential()` helper

### 4. Status List v2.0 (VC2-004)

**Location:**

- Prisma schema: `CredentialStatusList`, `CredentialStatusEntry` models
- Service: `/apps/api/src/vc/status/statusService.ts`

- Bitstring-based revocation (StatusList v2 style)
- Allocates status positions, marks revoked, fetches current status
- Hooks prepared for future on-chain anchoring to Substrate AuditScrapbook pallet

### 5. Peppered Hash Utility (VC2-006)

**Location:** `/apps/api/src/crypto/pepperedHash.ts`

- GDPR-compliant hashing for sensitive identifiers
- High-entropy per-record pepper stored only off-chain
- Only hash ends up on Substrate, enabling GDPR erasure via deleting off-chain record
- Used for credential IDs and subject DIDs

### 6. VC Type Registry (VC2-007)

**Location:** `/apps/api/src/vc/registry/credentialTypes.ts`

Defines VitalCV-specific credential types:

- `LicenseCredential` - State medical board license
- `BoardCertificationCredential` - Medical specialty board certification
- `SanctionClearanceCredential` - Verification of no active sanctions
- `IdentityAssertionCredential` - Verified identity with NPI
- `DEACredential` - DEA registration
- `CompactEligibilityCredential` - Interstate medical licensure compact
- `PrivilegeCredential` - Hospital/facility clinical privileges
- `EducationCredential` - Medical school/residency training

Each entry includes:

- JSON schema
- Human-readable name
- Allowed issuers
- Default status list
- Required/optional claims
- Validity period

### 7. OID4VCI Endpoints

#### Well-Known Metadata (OID4VCI-010)

**Location:** `/apps/api/src/routes/.well-known/openid-credential-issuer.ts`

Exposes `/.well-known/openid-credential-issuer` with:

- `credential_issuer` - Issuer identifier
- `credential_endpoint` - Credential issuance endpoint
- `token_endpoint` - Access token endpoint
- `deferred_credential_endpoint` - Deferred issuance endpoint
- `supported_credential_formats` - e.g., `jwt_vc_json`, `vc+sd-jwt`
- `supported_credentials` - List from VC type registry

#### PAR Endpoint (OID4VCI-011)

**Location:** `/apps/api/src/routes/oid4vci/par.ts`

- Accepts pushed authorization requests (RFC 9126)
- Validates client authentication
- Returns `request_uri` + `expires_in`
- Stores requests for retrieval by token endpoint

#### Token Endpoint (OID4VCI-011)

**Location:** `/apps/api/src/routes/oid4vci/token.ts`

- Issues DPoP-bound access tokens for credential issuance
- Validates DPoP proofs
- Stores `cnf.jkt` in token claims
- Supports:
  - Pre-authorized code flow
  - Authorization code flow (with PAR)
  - Device code flow (for deferred issuance)

#### Credential Endpoint (OID4VCI-012)

**Location:** `/apps/api/src/routes/oidc4vci/credential.ts` (existing, needs update)

- Accepts bearer/DPoP tokens
- Validates `credential_type`, `format` (e.g., `vc+sd-jwt`)
- Handles subject binding (DID, sub, NPI)
- Uses VC2-002 signing service to produce signed VC
- Respects scope/purpose-of-use from token claims
- Returns credential directly or deferred reference

## Integration Points

### Trust Ledger Audit Logging (VC2-005)

**Status:** Pending implementation

When a VC is issued, revoked, or verified:

- Call blockchain adapter to write `AuditRecord` to Substrate Trust Ledger
- Send extrinsics containing:
  - `action_type` (issuance/revocation/verification)
  - `target_hash` (peppered hash of VC ID + subject identifier)
  - `actor_did`
  - `meta_hash`
- Non-blocking (async fire-and-forget with retry queue)

### NPI→DID Mapping (OID4VCI-014)

**Status:** Pending implementation

During issuance:

- Resolve or create NPI-linked DID (based on existing NPI→DID design)
- Embed as subject identifier in VC
- Enforce stable mapping (each NPI maps to one DID)
- Log mapping via Trust Ledger audit client

### TEFCA-Aware Purpose-of-Use (OID4VCI-015)

**Status:** Pending implementation

- Tailor VC claims to token's `purpose_of_use`:
  - Treatment
  - Payment
  - Operations
  - etc.
- Policy table: `PoU × role → allowed claim whitelist`
- Filter VC claims before signing
- Log applied PoU and claim set summary via audit client

### SD-JWT Selective Disclosure (VC2-008)

**Status:** Pending implementation

- Issue license-related credentials as SD-JWT
- Enable selective disclosure (e.g., reveal 'license active' without DOB/home address)
- Integrate SD-JWT library (existing implementation in `/apps/api/src/services/credentials/sdjwt.ts`)
- Define disclosures for common healthcare attributes

### Verification API (VC2-009)

**Status:** Pending implementation

**Location:** `/api/verify/credential`

- Accepts VC or Verifiable Presentation
- Verifies signature, status, and schema
- Returns structured result:
  - `valid`/`invalid`
  - `reason`
  - `subject` summary
  - `compliance` flags
- Checks revocation via status list
- Logs verification event via AuditScrapbook

## Security & Compliance

### Security Checks (SEC-VC-040)

**Status:** Pending implementation

Extend VC issuance code paths with:

- Enforce issuer RBAC
- Ensure no PHI fields beyond policy for given PoU
- Validate only allowed credential types per issuer
- Structured security logs for issuance attempts (success/failure, reason)
- Ship logs to central logging for SOC2/HITRUST evidence

## Testing

### End-to-End Tests (TEST-VC-020)

**Status:** Pending implementation

**Location:** `/apps/api/tests/e2e/oid4vci-issuance.spec.ts`

Tests should simulate:

- Client obtaining issuance token (PAR + token)
- Calling `/credential` for a `LicenseCredential`
- Verifying resulting VC via verification service
- Cases for:
  - `sd-jwt` format
  - PoU-restricted claims
  - Deferred issuance

Use local Postgres + mocked KMS + mocked Substrate node in CI.

## Deployment

### AWS KMS Configuration (OPS-VC-010)

**Status:** Pending implementation

- Provision dedicated AWS KMS keys for issuer signing
- Separate keys per issuer org where possible
- Terraform/IaC scripts
- Update application config for key ARNs
- Configure IAM roles (only VC signing service has `kms:Sign`)
- Document key rotation process
- Smoke-test script: sign and verify sample VC via KMS

## Sequence Diagrams

### Credential Issuance Flow

```
Client                    PAR Endpoint          Token Endpoint         Credential Endpoint
  |                            |                      |                        |
  |-- POST /par -------------->|                      |                        |
  |                            |-- Store request -----|                        |
  |<-- request_uri ------------|                      |                        |
  |                            |                      |                        |
  |-- POST /token (request_uri)->|                      |                        |
  |                            |-- Get PAR request --->|                        |
  |                            |                      |                        |
  |                            |<-- POST /token (DPoP)-|                        |
  |                            |                      |-- Validate token -------|
  |                            |                      |-- Sign VC (KMS) ---------|
  |                            |                      |-- Allocate status -------|
  |                            |                      |-- Audit log ------------|
  |<-- access_token -----------|                      |<-- credential ----------|
  |                            |                      |                        |
  |-- POST /credential (token)->|                      |                        |
  |                            |                      |                        |
  |<-- credential (JWT) -------|                      |                        |
```

### Verification Flow

```
Verifier              Verification API         Status Service        Chain Client
  |                          |                      |                    |
  |-- POST /verify/credential->|                      |                    |
  |                          |-- Verify signature -->|                    |
  |                          |-- Check status -------|                    |
  |                          |                      |-- Query status list|
  |                          |                      |<-- status ---------|
  |                          |-- Audit log ---------|                    |
  |                          |                      |                    |
  |<-- verification result ---|                      |                    |
```

## HIPAA Audit Controls

This implementation supports HIPAA audit controls through:

- Non-repudiable signatures (KMS-backed)
- Immutable audit trail (Trust Ledger)
- Minimum-necessary disclosure (PoU-based claim filtering)
- Status list for revocation tracking
- Peppered hashes for GDPR compliance

## Future Integrations

- OID4VP (OpenID for Verifiable Presentations) for wallet presentations
- Chrome/Android native wallet integrations
- EUDI Wallet compatibility (already partially implemented)

## References

- [W3C VC Data Model v2.0](https://www.w3.org/TR/vc-data-model-2.0/)
- [OID4VCI 1.0](https://openid.net/specs/openid-4-verifiable-credential-issuance-1_0.html)
- [Status List 2021](https://www.w3.org/TR/vc-status-list-2021/)
- [DPoP (RFC 9449)](https://www.rfc-editor.org/rfc/rfc9449.html)
- [PAR (RFC 9126)](https://www.rfc-editor.org/rfc/rfc9126.html)

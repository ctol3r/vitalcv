# API Security Profiles: DPoP + mTLS + EUDI Flows

**B119C-DOCS-028**: API documentation update for DPoP+mTLS profiles and EUDI flows

## Overview

This document describes the security profiles and authentication flows supported by the VitalCV platform APIs, including Demonstrating Proof-of-Possession (DPoP), mutual TLS (mTLS), and EUDI wallet integration.

## Table of Contents

1. [DPoP Profile](#dpop-profile)
2. [mTLS Profile](#mtls-profile)
3. [EUDI Wallet Flows](#eudi-wallet-flows)
4. [Swagger Examples](#swagger-examples)

---

## DPoP Profile

### Overview

Demonstrating Proof-of-Possession (DPoP) is an OAuth 2.0 security extension that binds access tokens to a client's public key, preventing token theft and replay attacks.

### Specification

- **RFC**: [RFC 9449](https://www.rfc-editor.org/rfc/rfc9449.html)
- **JOSE Algorithm**: RS256, ES256, ES256K (allowlisted)
- **Token Type**: `DPoP`

### Request Flow

#### 1. Generate Key Pair

```typescript
import { generateKeyPair, exportJWK } from 'jose';

const { privateKey, publicKey } = await generateKeyPair('ES256');
const jwk = await exportJWK(publicKey);
```

#### 2. Create DPoP Proof

```http
POST /oauth/token HTTP/1.1
Host: api.vitalcv.ai
Content-Type: application/x-www-form-urlencoded
DPoP: eyJ0eXAiOiJkcG9wK2p3dCIsImFsZyI6IkVTMjU2Iiwia2lkIjoi...

grant_type=authorization_code
&code=authorization_code_here
&redirect_uri=https://client.example.com/callback
&client_id=client_id_here
```

**DPoP Proof JWT Claims:**

```json
{
  "typ": "dpop+jwt",
  "alg": "ES256",
  "kid": "key-id",
  "jwk": {
    "kty": "EC",
    "crv": "P-256",
    "x": "base64url-encoded-x",
    "y": "base64url-encoded-y"
  }
}
```

**DPoP Proof Payload:**

```json
{
  "htm": "POST",
  "htu": "https://api.vitalcv.ai/oauth/token",
  "iat": 1234567890,
  "jti": "unique-proof-id"
}
```

#### 3. Access Token Response

```json
{
  "access_token": "eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9...",
  "token_type": "DPoP",
  "expires_in": 3600,
  "dpop_nonce": "optional-nonce-for-replay-protection"
}
```

#### 4. Using DPoP Token

```http
GET /api/verifier/presentation HTTP/1.1
Host: api.vitalcv.ai
Authorization: DPoP eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9...
DPoP: eyJ0eXAiOiJkcG9wK2p3dCIsImFsZyI6IkVTMjU2Iiwia2lkIjoi...
```

### Validation Rules

1. **Algorithm Check**: Must use allowlisted algorithm (RS256, ES256, ES256K)
2. **Typ Check**: Must be `dpop+jwt`
3. **Kid Check**: Must be present and match JWK
4. **HTM/HTU Check**: Must match request method and URI
5. **Nonce Check**: If `dpop_nonce` provided, must be included in proof
6. **Replay Protection**: `jti` must be unique within nonce window

### Error Responses

```json
{
  "error": "invalid_dpop_proof",
  "error_description": "DPoP proof validation failed: invalid algorithm",
  "error_code": "DPOP_INVALID_ALG"
}
```

---

## mTLS Profile

### Overview

Mutual TLS (mTLS) provides certificate-based authentication for service-to-service communication, ensuring both client and server verify each other's identity.

### Specification

- **RFC**: [RFC 8705](https://www.rfc-editor.org/rfc/rfc8705.html) (OAuth 2.0 Mutual-TLS Client Authentication)
- **Certificate Format**: X.509 v3
- **Key Exchange**: ECDHE with P-256 or RSA 2048+

### Certificate Requirements

#### Client Certificate

- **Subject Alternative Name (SAN)**: Must include client ID
- **Validity**: Maximum 90 days
- **Key Usage**: Digital Signature, Key Encipherment
- **Extended Key Usage**: Client Authentication

#### Server Certificate

- **Subject**: CN matching API domain
- **SAN**: DNS names for all API endpoints
- **Validity**: Maximum 365 days
- **Key Usage**: Digital Signature, Key Encipherment, Server Authentication

### Request Flow

#### 1. Certificate Provisioning

```bash
# Generate client certificate
openssl req -new -x509 -key client.key -out client.crt -days 90 \
  -subj "/CN=client-id-123" \
  -addext "subjectAltName=DNS:client-id-123"
```

#### 2. mTLS Request

```http
POST /oauth/token HTTP/1.1
Host: api.vitalcv.ai
Content-Type: application/x-www-form-urlencoded
Client-Cert: MIIB...

grant_type=client_credentials
&scope=verifier:read issuer:write
```

**Client-Cert Header Format:**

```
Client-Cert: <base64url-encoded-certificate>
```

#### 3. Token Response

```json
{
  "access_token": "eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9...",
  "token_type": "Bearer",
  "expires_in": 3600,
  "scope": "verifier:read issuer:write"
}
```

### Validation Rules

1. **Certificate Chain**: Must validate against trusted CA
2. **Client ID Extraction**: From SAN or CN
3. **Revocation Check**: CRL/OCSP validation
4. **Expiry Check**: Certificate must be valid
5. **Key Usage**: Must include client authentication

### Error Responses

```json
{
  "error": "invalid_client",
  "error_description": "Client certificate validation failed",
  "error_code": "MTLS_INVALID_CERT"
}
```

---

## EUDI Wallet Flows

### Overview

European Digital Identity (EUDI) wallet integration for verifiable credential presentation and verification.

### Specification

- **EUDI Regulation**: [EU 2024/1183](https://eur-lex.europa.eu/eli/reg/2024/1183)
- **Trust List**: EUDI Trust List API
- **Presentation Format**: ISO/IEC 18013-5 (mDL) or W3C VC

### Flow 1: EUDI Wallet Presentation

#### 1. Verifier Request

```http
GET /.well-known/openid-credential-verifier HTTP/1.1
Host: verifier.vitalcv.ai
```

**Response:**

```json
{
  "verifier": "https://verifier.vitalcv.ai",
  "presentation_endpoint": "https://verifier.vitalcv.ai/presentation",
  "supported_credential_formats": [
    "jwt_vc_json",
    "vc+sd-jwt",
    "eudi_mdl"
  ],
  "eudi_only_mode": false,
  "trust_registry": "https://eudi.ec.europa.eu/trust-list"
}
```

#### 2. Presentation Request

```http
POST /presentation HTTP/1.1
Host: verifier.vitalcv.ai
Content-Type: application/json
Authorization: Bearer verifier_access_token

{
  "vp_token": "eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9...",
  "nonce": "presentation-nonce-123",
  "presentation_submission": {
    "id": "submission-456",
    "definition_id": "eudi-physician-credential",
    "descriptor_map": [
      {
        "id": "eudi-credential",
        "path": "$.vp.verifiableCredential[0]",
        "format": "eudi_mdl"
      }
    ]
  },
  "trust_registry": "https://eudi.ec.europa.eu/trust-list"
}
```

#### 3. Verification Response

```json
{
  "verified": true,
  "credential_id": "eudi:credential:123",
  "issuer": "did:eudi:issuer:456",
  "trust_list_status": "valid",
  "verification_timestamp": "2025-01-15T10:30:00Z",
  "claims": {
    "given_name": "John",
    "family_name": "Doe",
    "professional_qualification": "MD"
  }
}
```

### Flow 2: EUDI Wallet Acceptance Enforcement

When `eudi_only_mode: true`, only EUDI wallet presentations are accepted:

```json
{
  "error": "eudi_wallet_required",
  "error_description": "Only EUDI wallet presentations are accepted",
  "error_code": "EUDI_ONLY_MODE",
  "supported_wallets": [
    "https://eudi-wallet.example.com"
  ]
}
```

### Trust List Integration

```http
GET https://eudi.ec.europa.eu/trust-list/issuers HTTP/1.1
Authorization: Bearer trust_list_token
```

**Trust List Response:**

```json
{
  "issuers": [
    {
      "did": "did:eudi:issuer:123",
      "name": "Ministry of Health",
      "status": "active",
      "credentials": [
        {
          "type": "ProfessionalQualification",
          "schema": "https://eudi.ec.europa.eu/schemas/professional-qualification"
        }
      ]
    }
  ]
}
```

---

## Swagger Examples

### DPoP Token Request

```yaml
paths:
  /oauth/token:
    post:
      summary: Request access token with DPoP
      security:
        - DPoP: []
      requestBody:
        content:
          application/x-www-form-urlencoded:
            schema:
              type: object
              properties:
                grant_type:
                  type: string
                  enum: [authorization_code, client_credentials]
                code:
                  type: string
                redirect_uri:
                  type: string
      responses:
        '200':
          description: Token issued with DPoP binding
          content:
            application/json:
              schema:
                type: object
                properties:
                  access_token:
                    type: string
                  token_type:
                    type: string
                    example: DPoP
                  expires_in:
                    type: integer
                  dpop_nonce:
                    type: string
```

### mTLS Token Request

```yaml
paths:
  /oauth/token:
    post:
      summary: Request access token with mTLS
      security:
        - mTLS: []
      requestBody:
        content:
          application/x-www-form-urlencoded:
            schema:
              type: object
              properties:
                grant_type:
                  type: string
                  enum: [client_credentials]
                scope:
                  type: string
      responses:
        '200':
          description: Token issued with mTLS client authentication
          content:
            application/json:
              schema:
                type: object
                properties:
                  access_token:
                    type: string
                  token_type:
                    type: string
                    example: Bearer
                  expires_in:
                    type: integer
```

### EUDI Presentation

```yaml
paths:
  /presentation:
    post:
      summary: Verify EUDI wallet presentation
      tags:
        - EUDI
      requestBody:
        content:
          application/json:
            schema:
              $ref: '#/components/schemas/EUDIPresentationRequest'
            examples:
              eudi_mdl:
                summary: EUDI mDL presentation
                value:
                  vp_token: "eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9..."
                  nonce: "eudi-nonce-123"
                  presentation_submission:
                    id: "eudi-submission-456"
                    definition_id: "eudi-physician-credential"
                    descriptor_map:
                      - id: "eudi-credential"
                        path: "$.vp.verifiableCredential[0]"
                        format: "eudi_mdl"
                  trust_registry: "https://eudi.ec.europa.eu/trust-list"
      responses:
        '200':
          description: EUDI presentation verified
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/EUDIPresentationResponse'
```

---

## Security Considerations

### DPoP

- **Key Storage**: Private keys must be stored securely (HSM, TPM, or secure enclave)
- **Nonce Management**: Implement nonce rotation to prevent replay attacks
- **Clock Skew**: Allow ±5 minutes for `iat` validation

### mTLS

- **Certificate Rotation**: Implement automated certificate rotation (90-day validity)
- **Revocation**: Check CRL/OCSP before accepting certificates
- **Key Strength**: Minimum RSA 2048 or ECDSA P-256

### EUDI

- **Trust List Caching**: Cache trust list with TTL (recommended: 1 hour)
- **Wallet Validation**: Verify wallet signature against trust list
- **Credential Expiry**: Check credential expiration dates

---

## References

- [RFC 9449: OAuth 2.0 Demonstrating Proof-of-Possession](https://www.rfc-editor.org/rfc/rfc9449.html)
- [RFC 8705: OAuth 2.0 Mutual-TLS Client Authentication](https://www.rfc-editor.org/rfc/rfc8705.html)
- [EUDI Regulation (EU) 2024/1183](https://eur-lex.europa.eu/eli/reg/2024/1183)
- [EUDI Trust List API](https://eudi.ec.europa.eu/trust-list)


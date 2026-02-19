# VitalCV OpenID Conformance Specification

Version: 2026.02
Status: REQUIRED FOR MERGE

Target Standards:
- OpenID4VCI 1.0
- OpenID4VP 1.0
- HAIP 1.0 Profile

These rules override permissive base OpenID behaviors.

## 1. Cryptographic Policy

Allowed Signature Algorithms:
- ES256 ONLY

Disallowed:
- RS256
- ES256K
- HS256
- none

All JWT validation MUST reject unsupported alg values.

## 2. DPoP Requirements

- Required for token, credential, verifier endpoints
- htm must match HTTP verb
- htu must match full URL
- jti must be unique
- exp ≤ 5 minutes
- Replay MUST return 401

## 3. PAR

- PAR REQUIRED
- Plain authorization requests rejected
- Request object must be signed
- Redirect URI must match registered client exactly

## 4. PKCE

- PKCE REQUIRED
- S256 ONLY
- Plain forbidden
- code_verifier mismatch MUST reject

## 5. Nonce Handling

- Required
- Single-use
- Replay rejected
- Expire ≤ 5 minutes

## 6. Audience Validation

- aud must match expected resource exactly
- Array aud values disallowed unless explicitly supported
- Mismatch MUST reject

## 7. Clock Skew

- Max skew 60 seconds
- Future iat rejected
- Expired tokens rejected

## 8. Credential Format

Allowed:
- vc+sd-jwt
- jwt_vc_json (if enabled)

Strict schema validation required.

## 9. CI Enforcement

No PR merges unless:
- Conformance tests PASS
- Negative tests PASS

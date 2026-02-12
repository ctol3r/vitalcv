# VitalCV OpenID Enforcement Policy

## 1. Central Policy File

All enforcement must reference:
src/security/openid-policy.ts

No hardcoded values allowed outside policy file.

## 2. Hard Rejection Rule

Invalid tokens MUST throw errors.
No silent fallback.
No warning-only enforcement.

## 3. Middleware Requirements

All endpoints must include:
- JWT validation middleware
- DPoP validation middleware
- Nonce validation middleware
- Audience validation middleware

## 4. HAIP Strict Mode

When enabled:
- ES256 only
- PAR required
- DPoP required
- PKCE S256 required
- Plain auth rejected

No downgrade path allowed.

## 5. Replay Protection

Replay detection must:
- Store jti
- Store nonce
- Reject duplicates immediately
- Expire safely

## 6. Security Testing

Negative tests mandatory.
Positive-only tests insufficient.

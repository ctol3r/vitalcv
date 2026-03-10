# Hospital Verifier Backend Integration Kit

## Quick Start
1. Register your organization DID via `POST /api/trust-registry/issuers`
2. Call `POST /api/validate/sd-jwt` to validate provider credentials
3. Use `GET /api/trust-anchors` to enumerate accepted issuer roots

## Verification Flow
```
Clinician presents SD-JWT credential
→ POST /api/validate/sd-jwt { compact, disclosures, policy: "STRICT_HEALTHCARE" }
→ { valid: true, claims: { npi, licenseNumber, state, expiresAt }, policyPassed: true }
```

## Feature Flags Required
- `FEATURE_TRUST_ANCHORS=true`
- `FEATURE_SD_JWT_ISSUER=true`

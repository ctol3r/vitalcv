# Purpose of Use (PoU) Minimum Necessary Policies

**B125A-POLICY-006**: PoU min-necessary allowlists (Treatment/Operations/Payment/HOPER) + tests

This document describes the minimum necessary field allowlists for each Purpose of Use category, ensuring HIPAA compliance and privacy protection.

## Overview

Each Purpose of Use (PoU) category has a specific allowlist of credential fields that can be requested/accessed. Requests that exceed these allowlists are automatically rejected to enforce minimum necessary standards.

## Purpose of Use Categories

### 1. TREATMENT

**Purpose**: Clinical care, treatment decisions, direct patient care

**Allowed Fields**:
- Core identity: `id`, `name`, `givenName`, `familyName`
- Professional credentials: `licenseNumber`, `licenseState`, `licenseType`, `specialty`, `boardCertifications`
- Clinical qualifications: `degrees`, `institutions`, `issuanceDate`, `expirationDate`
- Status: `credentialStatus`, `active`

**Coverage**: ≥90% (most permissive for clinical needs)

**Example Use Cases**:
- Hospital credentialing
- Specialist referrals
- Clinical team coordination
- Emergency department staffing

---

### 2. OPERATIONS

**Purpose**: Administrative, operational, quality improvement, business operations

**Allowed Fields**:
- Minimal identity: `id`, `name`
- License status only: `licenseNumber`, `licenseState`, `credentialStatus`, `active`
- Issuance metadata: `issuanceDate`, `expirationDate`

**Coverage**: ~20-30% (restrictive by design)

**Example Use Cases**:
- Administrative reporting
- Quality metrics
- Operational analytics
- Staff directory management

---

### 3. PAYMENT

**Purpose**: Billing, payment processing, claims adjudication

**Allowed Fields**:
- Identity for billing: `id`, `name`
- License validation: `licenseNumber`, `licenseState`, `credentialStatus`, `active`

**Coverage**: ~15-20% (minimal necessary for billing)

**Example Use Cases**:
- Insurance claims
- Payment processing
- Provider enrollment
- Billing verification

---

### 4. HOPER (Healthcare Operations, Policy, and Research)

**Purpose**: Research, policy development, public health, aggregated analytics

**Allowed Fields**:
- De-identified identity: `id`, `name`
- Aggregatable fields: `licenseNumber`, `licenseState`, `specialty`, `taxonomy`
- Status: `credentialStatus`, `active`, `issuanceDate`, `expirationDate`

**Excluded**: All PII beyond minimal necessary (no SSN, DOB, address, contact info)

**Coverage**: ~25-35% (research-relevant fields only)

**Example Use Cases**:
- Public health research
- Healthcare policy analysis
- Workforce analytics
- Epidemiological studies

---

### 5. OTHER

**Purpose**: Explicit consent scenarios, special circumstances

**Allowed Fields**: All fields (wildcard `*`)

**Coverage**: 100%

**Example Use Cases**:
- Legal proceedings
- Regulatory audits
- Explicit user consent flows

---

## Role-Based Policy Guards

In addition to PoU allowlists, role-based restrictions apply:

### Clinician
- **Allowed PoUs**: TREATMENT, OPERATIONS
- **Max Fields**: No limit
- **Explicit Consent**: Not required

### Admin
- **Allowed PoUs**: OPERATIONS, PAYMENT
- **Max Fields**: 20
- **Explicit Consent**: Not required

### Verifier
- **Allowed PoUs**: TREATMENT, OPERATIONS, PAYMENT
- **Max Fields**: 30
- **Explicit Consent**: Not required

### Auditor
- **Allowed PoUs**: OPERATIONS, OTHER
- **Max Fields**: 50
- **Explicit Consent**: Required

### System
- **Allowed PoUs**: All
- **Max Fields**: No limit
- **Explicit Consent**: Not required

---

## Enforcement

### Over-Request Rejection

Requests that include fields not in the PoU allowlist are **automatically rejected** with a `403 Forbidden` response:

```json
{
  "error": "forbidden",
  "error_description": "Fields not allowed for PoU TREATMENT: credentialSubject.ssn, credentialSubject.dateOfBirth",
  "denied_fields": ["credentialSubject.ssn", "credentialSubject.dateOfBirth"],
  "allowed_pou": "TREATMENT"
}
```

### Audit Logging

All PoU requests are logged with:
- Purpose of Use category
- Requested fields (allowed + denied)
- Requester role
- Timestamp
- Result (allowed/denied)

Audit log format:
```json
{
  "event": "POU_REQUEST",
  "timestamp": "2025-11-12T10:30:00Z",
  "pou": "TREATMENT",
  "role": "clinician",
  "requested_fields": ["credentialSubject.name", "credentialSubject.licenseNumber"],
  "allowed_fields": ["credentialSubject.name", "credentialSubject.licenseNumber"],
  "denied_fields": [],
  "result": "ALLOWED"
}
```

---

## Implementation

### Middleware

The PoU policy is enforced via middleware:

```typescript
import { pouAllowlistEnforcer } from './policies/middleware';

router.use(pouAllowlistEnforcer);
```

### API

```typescript
import { validateFieldsAgainstAllowlist, validateRoleBasedPolicy } from './policies/pouPolicy';

// Validate fields against PoU allowlist
const result = validateFieldsAgainstAllowlist(
  ['credentialSubject.name', 'credentialSubject.licenseNumber'],
  'TREATMENT'
);

if (!result.valid) {
  console.error(result.error);
  console.error('Denied fields:', result.deniedFields);
}

// Validate role-based policy
const roleResult = validateRoleBasedPolicy(
  'TREATMENT',
  'clinician',
  ['credentialSubject.name']
);

if (!roleResult.valid) {
  console.error(roleResult.error);
}
```

---

## Testing

Comprehensive test suite covers:
- ✅ Allowlist validation for all PoU categories
- ✅ Over-request rejection
- ✅ Coverage ≥90% for TREATMENT
- ✅ Role-based policy guards
- ✅ Edge cases and negative scenarios

Run tests:
```bash
npm test -- apps/verifier-api/src/policies/__tests__/pouPolicy.test.ts
```

---

## Compliance

This implementation ensures:
- **HIPAA Minimum Necessary Standard**: Only request/access the minimum data needed for the stated purpose
- **Privacy by Design**: Default to least privilege; require explicit consent for broader access
- **Auditability**: All requests logged with PoU and fields accessed
- **Accountability**: Role-based restrictions and max field limits

---

## References

- HIPAA Privacy Rule § 164.502(b) - Minimum Necessary Standard
- HIPAA Security Rule § 164.308(a)(4) - Access Controls
- 45 CFR § 164.514(d) - De-identification for Research (HOPER)

---

**Document Version**: 1.0
**Last Updated**: 2025-11-12
**Owner**: Security & Compliance Team


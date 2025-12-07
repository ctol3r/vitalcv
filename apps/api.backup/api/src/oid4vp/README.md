# OID4VP API Module

This module implements OpenID for Verifiable Presentations (OID4VP) functionality for the VitalCV platform.

## Overview

OID4VP enables verifiers (recruiters, hospitals, etc.) to request and verify credentials from credential holders (clinicians) in a standardized, privacy-preserving way.

## Architecture

```
┌─────────────┐      ┌──────────────┐      ┌─────────────┐
│  Verifier   │─────▶│  OID4VP API  │─────▶│   Wallet    │
│  (Frontend) │      │  (Backend)   │      │  (Clinician)│
└─────────────┘      └──────────────┘      └─────────────┘
                           │
                           ▼
                    ┌──────────────┐
                    │   Database   │
                    │  (Sessions,  │
                    │  Candidates) │
                    └──────────────┘
```

## Endpoints

### Request Generation

**POST** `/api/oid4vp/request`

Generates a presentation request with nonce, state, and presentation_definition.

**Request:**
```json
{
  "workflow": "full_onboarding",
  "orgId": "org-123",
  "clientId": "vitalcv-verifier"
}
```

**Response:**
```json
{
  "sessionId": "session-789",
  "nonce": "random-nonce",
  "state": "random-state",
  "presentation_definition": { ... },
  "request_url": "openid-credential-offer://?...",
  "qr_payload": "{ ... }",
  "expires_at": "2024-01-01T12:00:00Z"
}
```

### Verification

**POST** `/api/oid4vp/verify`

Verifies a VP token returned from a wallet.

**Request:**
```json
{
  "vp_token": "eyJhbGci...",
  "nonce": "random-nonce",
  "state": "random-state"
}
```

**Response:**
```json
{
  "verified": true,
  "sessionId": "session-789",
  "result": {
    "status": "verified",
    "subjectInfo": { ... },
    "credentialSummaries": [ ... ],
    "policyFlags": { ... }
  }
}
```

## Services

### PresentationDefinitionService

Manages reusable presentation definitions.

```typescript
import { PresentationDefinitionService } from './presentationDefinitionService';

// Save a definition
const id = await PresentationDefinitionService.save({
  orgId: 'org-123',
  name: 'Hospitalist Onboarding',
  json: { ... }
});

// Retrieve
const def = await PresentationDefinitionService.getById(id);
```

### VerifierPolicy

Maps workflows to credential requirements.

```typescript
import { getPolicy, generatePresentationDefinition } from './policy/verifierPolicy';

const policy = getPolicy('full_onboarding');
const pd = generatePresentationDefinition('full_onboarding', {
  nonce: 'abc123',
  state: 'xyz789'
});
```

## Database Models

### VerifierSession

Tracks OID4VP request/response correlation:
- `nonce`: Replay protection
- `state`: CSRF protection
- `expiresAt`: Session TTL
- `status`: pending | completed | expired | failed

### PresentationDefinition

Stores reusable presentation definitions:
- `json`: The presentation_definition JSON
- `orgId`: Organization that owns it

### Candidate

Links verifications to candidate profiles:
- `npi`, `did`: Identifier from credentials
- `verifiedData`: Extracted verified information
- Linked to `VerifierSession`

## Security

1. **Nonce Binding**: Each request includes unique nonce
2. **State Parameter**: CSRF protection
3. **Session Expiry**: Short-lived (15 min default)
4. **Replay Protection**: Nonce and JTI tracking
5. **Holder Key Binding**: DPoP or cnf.jkt verification

## Error Handling

All endpoints return standard error responses:

```json
{
  "error": "error_code",
  "error_description": "Human-readable description"
}
```

Common errors:
- `invalid_request`: Missing or invalid parameters
- `not_found`: Session or definition not found
- `expired`: Session has expired
- `already_used`: Nonce/state already used
- `invalid_binding`: Holder key binding failed

## Testing

Run tests:
```bash
npm test -- oid4vp-flow.test.ts
```

Test endpoints manually:
```bash
./scripts/test-oid4vp-endpoints.sh
```

## See Also

- `docs/identity/digital-credentials-oid4vp.md` - Full documentation
- `docs/oid4vp-setup-guide.md` - Setup instructions


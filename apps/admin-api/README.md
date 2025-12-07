# Admin API - AAL2/AAL3 MFA Policy Enforcement

## Overview

This service implements phishing-resistant Multi-Factor Authentication (MFA) policies aligned with NIST SP 800-63B Authentication Assurance Levels (AAL) 2 and 3.

## Features

- **WebAuthn Support**: Registration and authentication using WebAuthn (passkeys, security keys)
- **AAL2 Policy**: Multi-factor authenticator or two separate factors
- **AAL3 Policy**: Device-bound cryptographic authenticator (phishing-resistant)
- **Policy Management**: JSON-based policy configuration and user assignments
- **Enforcement Hooks**: Middleware for enforcing AAL requirements on routes

## API Endpoints

### WebAuthn Registration

- `POST /api/auth/webauthn/register/start` - Start WebAuthn registration
- `POST /api/auth/webauthn/register/finish` - Complete WebAuthn registration
- `GET /api/auth/webauthn/authenticators` - List user's authenticators
- `DELETE /api/auth/webauthn/authenticators/:id` - Revoke authenticator

### WebAuthn Authentication

- `POST /api/auth/webauthn/authenticate/start` - Start WebAuthn authentication
- `POST /api/auth/webauthn/authenticate/finish` - Complete WebAuthn authentication

### AAL Policy Management

- `GET /api/auth/policy` - List all policies
- `GET /api/auth/policy/:name` - Get specific policy
- `POST /api/auth/policy` - Create/update policy (requires AAL3)
- `GET /api/auth/policy/user/:userId` - Get user's policy and compliance status
- `POST /api/auth/policy/user/:userId/assign` - Assign policy to user (requires AAL3)

## Policy Configuration

Default policies are defined in `src/auth/policy-config.ts`:

- **AAL2**: Multi-factor authenticator (WebAuthn or TOTP)
- **AAL3**: Device-bound cryptographic authenticator (WebAuthn with platform authenticator)
- **Admin Default**: AAL3 for all admin users
- **Verifier Default**: AAL2 for verifiers

## Usage

### Enforcing AAL Requirements

```typescript
import { requireAal, requireDeviceBound } from './auth/middleware/aal-guard';

// Require AAL2
router.get('/sensitive', requireAal(2), handler);

// Require AAL3 (device-bound)
router.post('/admin', requireDeviceBound(), handler);
```

### Environment Variables

- `WEBAUTHN_RP_ID` - Relying Party ID (default: 'localhost')
- `WEBAUTHN_RP_NAME` - Relying Party Name (default: 'VitalCV Platform')
- `WEBAUTHN_ORIGIN` - Origin URL (default: 'http://localhost:3000')

## Database Schema

The service uses the following Prisma models:

- `WebAuthnAuthenticator` - Stores WebAuthn credentials
- `AalPolicy` - Policy configurations
- `UserAalAssignment` - User-to-policy assignments

## Acceptance Criteria

✅ AAL2 requires WebAuthn or equivalent
✅ AAL3 requires device-bound cryptographic authenticator
✅ Policy JSON published in `policy-config.ts`
✅ Enforcement hooks available as middleware


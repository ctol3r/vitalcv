# VitalCV Backend Contract

## Core (Authoritative)
apps/api/backend

Owns:
- Authorization decisions
- Audit logging
- Credential lifecycle (issue, verify, revoke)
- Business rules & invariants

## Edge Services (Adapters Only)
apps/issuer-api
apps/verifier-api
apps/admin-api
apps/status-api
apps/router

Allowed:
- Request validation
- Protocol translation
- Rate limiting
- Forwarding to core backend

Not Allowed:
- Independent auth policy
- Writing audit logs
- Mutating credential state

## Rule
If logic changes credential state or policy, it must live in apps/api/backend.

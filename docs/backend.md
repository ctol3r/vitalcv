# VitalCV Backend Authority

Primary backend:
- apps/api/backend

This service is the single authority for:
- authorization decisions
- audit logging
- credential issuance, verification, and revocation
- core business logic

All other backend services are edge or support layers and must delegate
core decisions to apps/api/backend.

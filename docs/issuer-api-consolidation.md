# Issuer API Consolidation Plan

## Current Role
apps/issuer-api currently exposes issuer-facing endpoints.

## Target Role
apps/issuer-api becomes a thin edge adapter:
- Authenticates requests
- Validates input
- Forwards to apps/api/backend
- Returns responses

## Logic to Move
- Credential issuance rules
- Schema validation
- Audit logging
- State changes

## Logic to Keep
- HTTP routing
- Partner-specific headers
- Rate limiting

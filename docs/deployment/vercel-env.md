# Vercel Environment Variables

Use this checklist for both Vercel projects (`@vitalcv/web` and `@vitalcv/api`).

## Required in Production

### Shared Backend Storage / Policy
- `DATABASE_URL`  
  PostgreSQL connection string used by `@vitalcv/api`, `@vitalcv/authz`, and `@vitalcv/verifier-api`.

- `SIGNING_KEY_JWK`  
  JSON JWK used for authz token signing. Required by `@vitalcv/authz`.

- `CORS_ORIGIN`  
  Comma-separated allowed CORS origins. **Must not be `*` in production.**

- `API_KEYS`  
  Comma-separated API keys. Required in production for write endpoints on `@vitalcv/api`.

### Frontend Configuration
- `NEXT_PUBLIC_API_BASE` or `NEXT_PUBLIC_BACKEND_URL`  
  Backend base URL consumed by `@vitalcv/web`.

- `NEXT_PUBLIC_SENTRY_DSN`  
  Public Sentry DSN (optional, but supported) for frontend monitoring.

- `NEXT_PUBLIC_ADMIN_API_URL` or `NEXT_PUBLIC_APP_URL`  
  Optional route-prefix variables used by specific web screens.

## Optional

- `SAM_API_KEY`  
  Optional downstream service key used by `@vitalcv/api` integrations.

- `SENTRY_DSN`  
  Server-side Sentry DSN for `@vitalcv/api` crash/error reporting.

- `VERIFIER_AUDIENCE`, `TOKEN_AUDIENCE`, `TOKEN_ISSUER`, `VERIFIER_ISSUER`  
  Override only when wiring non-default OIDC endpoints.

- `NEXT_PUBLIC_*` variables not listed above  
  Add only documented frontend values needed by your deployment.


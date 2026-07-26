# CLERK_JWT_VERIFICATION → enforce rollout

The backend's `verifiedIdentity` middleware
(`apps/api/backend/src/middleware/verifiedIdentity.ts`) has three modes, set by
the `CLERK_JWT_VERIFICATION` env var (default `off`):

- **off** — no-op. `x-clerk-user-id` is trusted verbatim (the historical, unsafe default).
- **shadow** — verifies the bearer when present, compares `sub` to `x-clerk-user-id`,
  logs the outcome, and **never blocks**.
- **enforce** — identity comes **only** from a verified token: a valid bearer rewrites
  `x-clerk-user-id` from `sub`; an identity header **without** a valid bearer → **401**;
  anonymous requests pass but have role-bypass headers stripped.

`enforce` is the target end state (closes gap G1 and the `x-user-role: super-admin`
tenant bypass). The danger is the 401: any legitimate caller that sends
`x-clerk-user-id` without a verifiable `Authorization: Bearer <clerk jwt>` breaks.

## Preconditions (must all hold before flipping enforce)

1. **Web tier forwards tokens.** DONE — every web→backend proxy now attaches both
   `x-clerk-user-id` and the bearer, via `lib/auth/forwardIdentity.ts` and the now-async
   `lib/server/marketplace-proxy.ts#buildMarketplaceHeaders`. Verified by
   `__tests__/forward-identity.test.ts` and `__tests__/marketplace-proxy-token.test.ts`.
   A repo scan shows **zero** remaining `x-clerk-user-id` senders that omit a token path,
   and **no non-web sender** of `x-clerk-user-id` (no mobile/cron/service caller).
2. **`CLERK_ISSUER` is set** on the backend env. `config/envValidation.ts` fails boot on
   `enforce` without it. Set it in the same deploy that flips the flag, not after.
3. **Shadow has baked with clean telemetry** (see below).

## Rollout steps (Railway env — operator action, not code)

1. Set `CLERK_JWT_VERIFICATION=shadow` and `CLERK_ISSUER=<clerk issuer>` on the backend.
2. Watch backend logs (`jwt_auth` events) for a full traffic cycle. The outcomes:
   - `verified_match` — healthy (token valid, `sub` == header). Expect the majority.
   - `verified_mismatch` — token valid but `sub` != header. A forgery signal **or** a
     proxy bug. Investigate every one before flipping.
   - `token_only` — token valid, no identity header. Fine.
   - `invalid_token` / header-without-token — **these are what enforce will 401.** Must
     trend to ~zero from legitimate traffic before flipping. Any steady stream here is a
     caller still not forwarding a token — fix it first.
3. When `invalid_token` / header-without-token from real users is ~zero, set
   `CLERK_JWT_VERIFICATION=enforce`.
4. **Rollback** is instant and safe: set the var back to `shadow` (or `off`). No data
   migration, no code deploy.

## Known residual risk

The repo scan is static. Shadow telemetry (step 2) is the authoritative proof that no
un-tokened legitimate caller exists — trust it over the scan. Do not skip the shadow bake.

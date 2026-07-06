# G1 — Verified-JWT Rollout Runbook (CLERK_JWT_VERIFICATION)

**Date:** 2026-07-06 · **Gap:** G1 header-trust authn (`docs/security/ASVS-scorecard-2026-07.md`, 14.5.4 / 4.1.2)
**Code:** `apps/api/backend/src/middleware/verifiedIdentity.ts` (+ 18-case test suite)

## What shipped

A global backend middleware (mounted before the tenant guard) that verifies the
Clerk session JWT the web tier already forwards as `Authorization: Bearer` on
~40 of 59 backend-proxy call sites (`apps/web/app/api/intelligence/_shared.ts`
→ `resolveSessionAuthToken()`), via remote JWKS
(`${CLERK_ISSUER}/.well-known/jwks.json`, issuer + exp + optional `azp` checks).

| Mode | Behavior |
|---|---|
| `off` (default) | No-op. |
| `shadow` | Verify + log (`jwt_auth_verification` events), never block. Forgery signals (`verified_mismatch`, `invalid_token`) always log; high-volume outcomes are sampled (first 25, then 1/100). |
| `enforce` | Identity ONLY from a verified token: `x-clerk-user-id` rewritten to the verified `sub` (all ~35 downstream header readers transparently inherit proven identity); identity header without a valid token → **401 fail-closed**; unverified requests lose `x-user-role`/`x-verifier-role`/`x-role` (closes the `super-admin` tenant-guard bypass); anonymous + API-key server-to-server flows unaffected. |

Boot safety: `CLERK_JWT_VERIFICATION=enforce` without `CLERK_ISSUER` **fails the
boot** (envValidation) — a security control must never silently no-op. `shadow`
without an issuer logs loudly and no-ops.

## Step 1 — Enable shadow (safe any time, zero traffic risk)

On the Railway **api** service:

```
CLERK_ISSUER=https://clerk.vitalcv.com
CLERK_JWT_VERIFICATION=shadow
# optional: CLERK_AUTHORIZED_PARTIES=https://vitalcv.com,https://www.vitalcv.com
```

## Step 2 — Read the telemetry (1–2 weeks)

Watch `jwt_auth_verification` events by `outcome`:

- `verified_match` — healthy; the token path works end-to-end.
- `verified_mismatch` / `invalid_token` — **forgery or bug signals; investigate every one.**
- `header_without_token` — a web call site not forwarding the bearer. The `path`
  field identifies which of the ~19 ad-hoc proxy sites (employer-review, ingest,
  psv/oig, employers, pilot-ops, snapshot…) still needs `Authorization`
  forwarding added. Fix by routing them through the shared helper.

## Step 3 — Flip criteria for `enforce`

All of:
1. `header_without_token` ≈ 0 on all **mutating** routes for 7 consecutive days.
2. Zero unexplained `verified_mismatch`.
3. The ad-hoc web call sites forward tokens (route through `buildForwardHeaders`).
4. Confirm no server-to-server integration sends `x-clerk-user-id` without a
   session token (those would 401 under enforce).

Then set `CLERK_JWT_VERIFICATION=enforce`. Rollback = set back to `shadow`
(instant, config-only).

## Phase 2 (tracked, not shipped)

- Bind `x-org-id` to a verified org claim (needs the org claim added to the
  Clerk JWT template first).
- Derive roles from verified claims/DB instead of role headers entirely
  (converges with G2 RBAC enforcement).

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
  field identifies which proxy site still needs `Authorization` forwarding added.
  **Fix helper: `apps/web/lib/auth/forwardIdentity.ts`** — replace an ad-hoc
  `{ 'x-clerk-user-id': userId }` with `await buildIdentityHeaders({ userId })`
  (object spread) or `await applyIdentityHeaders(headers, { userId })` (Headers
  object). It forwards the bearer via `auth().getToken()` and degrades to
  id-only if minting is unavailable (behavior-preserving).

### Call-site conversion status — COMPLETE (2026-07-10)

- **2026-07-06:** the 12-file `headers.set(...)` cohort + the ~40 sites already
  forwarding via `_shared.ts`.
- **2026-07-10:** the remaining 26 ad-hoc sites converted (object-property,
  inline, conditional-spread, and bracket-assign shapes) — employer-review
  queue/batch/[action], employer opportunities/profile/setup, psv/oig
  check+batch, ownership claim/me, profile links/self-attested/work-auth/
  completeness/resume, capacity, velocity, marketplace pool, request-review,
  share, export/packet, organization-context, auth/resolve-role, candidates,
  trust-state refresh, trust/events. `trust/events` additionally stopped
  forwarding the CLIENT-supplied `x-clerk-user-id` verbatim (spoofable) —
  identity is now server-derived.
- **Every web→backend proxy now forwards the bearer** (flip criterion #3 met
  code-side). Remaining flip criteria are telemetry-only: watch
  `header_without_token` → ≈0 confirms it empirically, plus zero unexplained
  `verified_mismatch`, and confirm no server-to-server caller sends
  `x-clerk-user-id` without a token.

## Step 3 — Flip criteria for `enforce`

All of:
1. `header_without_token` ≈ 0 on all **mutating** routes for 7 consecutive days.
2. Zero unexplained `verified_mismatch`.
3. The ad-hoc web call sites forward tokens (route through `buildForwardHeaders`).
4. Confirm no server-to-server integration sends `x-clerk-user-id` without a
   session token (those would 401 under enforce).

Then set `CLERK_JWT_VERIFICATION=enforce`. Rollback = set back to `shadow`
(instant, config-only).

## Generating the happy-path signal automatically (the real unblock)

The 2026-07-11 telemetry readout (`shadow-telemetry-2026-07-11.md`) found the
forgery classes clean but **zero `verified_match`** — no signed-in traffic had
reached the backend at all. The project already has an automated generator for
exactly this: the **`release-verify` workflow** mints a synthetic clinician and
walks the six signed-in `/holder` surfaces from an external runner every 30 min,
which drives the converted web→backend proxies with a real bearer → produces
`verified_match` events (and a durable green `vitalcv/release-verified` commit
status).

**It is currently skipping** — commit status reads `pending — skipped: monitor
not wired (set CLERK_SECRET_KEY)`. Two GitHub **repo** secrets are missing
(the live values already exist on the Railway `delightful-essence` service):

- `CLERK_SECRET_KEY` — **gates the whole signed-in verification** (blocks first).
- `RAILWAY_API_TOKEN` — secondary (deploy-SHA GraphQL fallback in `check:deploy`).

**Owner action** (one line each; the Clerk value is piped straight from Railway
so it is never pasted — an operator with both CLIs authenticated runs it, since
copying a live `sk_live_` key is a credential action an agent must not perform):

```bash
railway variables --kv --service delightful-essence \
  | sed -n 's/^CLERK_SECRET_KEY=//p' \
  | gh secret set CLERK_SECRET_KEY --repo ctol3r/vitalcv
# RAILWAY_API_TOKEN: create a project token in Railway → set the same way.
```

Once set, the next `release-verify` run (≤30 min, or `gh workflow run
release-verify.yml`) verifies for real, flips the commit status green, and
starts emitting `verified_match` continuously — satisfying the happy-path
prerequisite without any manual browsing. Re-run the telemetry readout after a
clean week (earliest **2026-07-17**) to confirm, then flip.

For **G2**: one employer-review mutation by an `admin`/`reviewer` org member
under `VERIFIER_RBAC_MODE=shadow` (should log **no** would-block); a `read_only`
member attempting it should log one. The synthetic clinician is a holder, not a
verifier org member, so G2 still needs a real verifier action or a synthetic
verifier fixture.

## Phase 2 (tracked, not shipped)

- Bind `x-org-id` to a verified org claim (needs the org claim added to the
  Clerk JWT template first).
- Derive roles from verified claims/DB instead of role headers entirely
  (converges with G2 RBAC enforcement).

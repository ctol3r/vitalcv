# `/api/me/role` backend transport-auth gate (Wave 2B follow-up to #504)

Closes the residual that #503/#504 explicitly deferred. **Reviewable, not
merged.** Arming it is a coordinated, reversible env change — read the rollout
before merging.

> **Scope note (trimmed after #507).** This PR originally also gated the web
> `/api/auth/resolve-role` proxy and had the middleware forward a secret to it.
> #507 changed the architecture: the middleware no longer self-fetches
> resolve-role (it redirects to the `/auth/resolving` interstitial), and
> resolve-role now identifies the caller from the verified Clerk session via
> `auth()` — not a trusted header. That already closes the web-proxy vector, and
> an inbound secret gate on a **browser-called** endpoint would re-break the P0.
> So this PR is now **backend-gate-only**: the sole remaining change is the
> backend `GET /api/me/role` gate plus resolve-role forwarding the secret
> *outbound* to the backend.

## Background / threat model

`#503` skip-listed `GET /api/me/role` from the backend tenant guard so signed-in
role resolution works. That also made it reachable on the internet-facing
`api.vitalcv.com`, where it trusts the caller-supplied `x-clerk-user-id` /
`x-clerk-user-email` headers.

- `#504` closed the **account-takeover** path (email→row rebind is now
  allowlisted to platform placeholder rows only; real accounts → 409).
- `#507` closed the **web proxy** vector: `/api/auth/resolve-role` is now
  authenticated by the Clerk session (`auth()`), so an external caller cannot use
  it to resolve anyone's role.
- **Residual, still open — the backend route only:** `api.vitalcv.com/api/me/role`
  remains header-trusting, so two lower-severity vectors persist there:
  1. **Role disclosure** — given a known Clerk id, an external caller learns that
     user's VitalCV role.
  2. **Email pre-squat DoS** — an external caller can create a placeholder-free
     `User` row for a victim's email, so the victim later 409s on first sign-in.

Both are closed by requiring the shared internal `MONITORING_SECRET` (already
used by ~20 backend internal routes) on the backend route, so only our own web
tier — which resolve-role gates with a verified session — can reach it.

## Design — why a flag, not a hard requirement

The #504 author deferred this precisely because a hard secret requirement "needs
env coordination … would re-break [the signed-in P0] if mis-set." So backend
enforcement is behind **`ENFORCE_ME_ROLE_INTERNAL_AUTH`**, default **off**:

| Component | Off (default) | On (armed) |
| --- | --- | --- |
| Backend `GET /api/me/role` | serves as today | 403 unless `x-monitoring-secret` matches |
| Web `/api/auth/resolve-role` | `auth()`-gated (session); **forwards** `x-monitoring-secret` to the backend (harmless when off) | same — no inbound flag; identity is the verified session, not a header |
| Web middleware | not involved (redirects to `/auth/resolving`; never calls resolve-role) | same |

**Merging this PR changes no behavior** — the backend flag is off and the
outbound header is ignored, so it cannot regress the P0. The gate is armed only
after the secret is confirmed on both tiers.

The backend predicate is pure and unit-tested:
`apps/api/backend/src/auth/internalRoleAuth.ts`
(`enforce=false` → always allow; `enforce=true` → fail-closed exact match).

## Rollout runbook (in order)

1. **Merge + deploy** this PR. No-op (flag off). Confirm the signed-in flow is
   unchanged: sign in → `/auth/resolving` → `/holder`.
2. **Set `MONITORING_SECRET` on the web service** to the **same value** the
   backend already uses, so resolve-role forwards a matching secret. Redeploy
   web. Still a no-op (backend flag off), but the secret now flows end-to-end.
3. **Verify the secret path works** while still unenforced — sign in and confirm
   `/holder` still loads (the resolve-role→backend call now carries the secret).
4. **Arm it:** set `ENFORCE_ME_ROLE_INTERNAL_AUTH=true` on the **backend**
   service. Redeploy backend. (No flag needed on web — it has no inbound gate.)
5. **Verify enforcement:**
   - Signed-in flow still works: sign in → `/holder` (not `/auth/error`).
   - External backend call is now blocked:
     ```bash
     curl -s -o /dev/null -w '%{http_code}\n' \
       -H 'x-clerk-user-id: user_anything' https://api.vitalcv.com/api/me/role
     # expect 403 (was 200/404)
     ```
   - The web proxy already rejects unauthenticated external callers (independent
     of this flag, via #507):
     ```bash
     curl -s -o /dev/null -w '%{http_code}\n' \
       -H 'x-clerk-user-id: user_anything' https://vitalcv.com/api/auth/resolve-role
     # expect 401 (no verified session)
     ```

## Rollback

Set `ENFORCE_ME_ROLE_INTERNAL_AUTH=false` (or unset it) on the backend and
redeploy — instant return to the current, working behavior. No code revert
needed. If mid-rollout the signed-in flow ever dead-ends at `/auth/error`, the
cause is almost always the web `MONITORING_SECRET` not matching the backend —
fix the env or disarm the flag.

## Note on the JWT fast path (optional, separate)

`#503`/`#507` resolve the loop with a signed cookie, not the Clerk session-token
claim, so this system works with no Clerk dashboard change. Enabling the
`vitalcv.role` session-token claim later is a pure optimization (fewer backend
hops) and is independent of this gate.

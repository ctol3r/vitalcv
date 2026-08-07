# Enforce-readiness package — G1 identity verification + verifier org-role RBAC

**Date:** 2026-08-07 · **Author:** Claude (session lane), founder gate pending
**Decision this document supports:** flip `CLERK_JWT_VERIFICATION` and `VERIFIER_RBAC_MODE` from `shadow` to `enforce` on the production backend (Railway service `delightful-essence` = api.vitalcv.com).

This is the named authorization gate required by the authorization-boundary practice: the flip
is executed only on an explicit founder selection recorded against this package. Both flips are
config-only and instantly reversible (`--set` back to `shadow`).

## Current production state (read live 2026-08-07)

| Var | Value | Since |
|---|---|---|
| `CLERK_JWT_VERIFICATION` | `shadow` | 2026-07-06 |
| `VERIFIER_RBAC_MODE` | `shadow` | 2026-07-07 |
| `CLERK_ISSUER` | `https://clerk.vitalcv.com` | set |

## G1 flip criteria (docs/security/verified-jwt-rollout.md, Step 3) — scored

| # | Criterion | Status | Evidence |
|---|---|---|---|
| 1 | `header_without_token` ≈ 0 on mutating routes, 7 consecutive days | **Met (~4 weeks)** | 2026-07-11 readout (PR #616): all 5 events predate the final proxy conversion (#612, Jul 10); zero since. 2026-08-07 sweep across 4 recent deployments: zero. Forgery-class events log unsampled, so zeros are meaningful. |
| 2 | Zero unexplained `verified_mismatch` | **Met** | Zero ever (PR #616 readout); zero in the 2026-08-07 sweep. `invalid_token` likewise zero. |
| 3 | All web call sites forward the bearer | **Met (code)** | PR #609 converted the final 26 ad-hoc sites (2026-07-10); trust/events stopped forwarding client-supplied `x-clerk-user-id`. |
| 4 | No server-to-server caller sends `x-clerk-user-id` without a token | **Met (empirical)** | Same `header_without_token` zeros as #1 over ~4 weeks of deployments. |
| — | Happy path proven (`verified_match`) | **Met (indirect)** | The release-verify workflow mints a synthetic clinician and walks 6 signed-in /holder surfaces every ~hour through the converted proxies; green runs all day 2026-08-07 (latest 19:31Z). Short-lived containers between deploys mean per-deployment log slices rarely capture the sampled event itself; the workflow's assertions are the stronger signal. |

## Verifier RBAC readiness — scored

| Item | Status | Evidence |
|---|---|---|
| Guard live in prod, evaluating | **Confirmed 2026-08-07** | Live probe 20:00:13Z: role-less `POST /api/verifier/accept` with empty body → guard logged `verifier_rbac_shadow_would_block role="none" mode="shadow"`, handler returned 400 before any write. |
| UI path carries verified `x-org-role` | **Confirmed at main tip** | `buildMarketplaceHeaders` (apps/web/lib/server/marketplace-proxy.ts) forwards `x-org-role` from the verified Clerk `org_role` claim + `x-user-role` for the super-admin bypass; the `/api/verifier/accept` web proxy exists and uses it. |
| Shadow observation window | **Structurally unfulfillable — decision is reasoned, not observed** | The backend serves ~a dozen requests per container lifetime; a month of shadow produced no organic verifier-mutation traffic. Zero would-block events from legit UI traffic, but that is absence of traffic, not proof. Acknowledged per the 2026-07-27 finding. |
| Role ≠ membership (#951) | **Closed 2026-07-28** | #954 authorizes activation routes on org membership resolved from the membership store keyed on verified Clerk id (`requireOrgRole` stays as defense-in-depth); #992 requires tenant context on the directory publish write. Enforce covers *who you are*; membership checks separately cover *which org you are in*. |

## Sequencing (order matters)

1. **`CLERK_JWT_VERIFICATION=enforce` first.** Identity comes only from a verified token;
   `x-clerk-user-id` is rewritten to the verified `sub`; unverified requests lose
   `x-user-role`/`x-verifier-role`/`x-role`; identity-header-without-token → 401. This is what
   makes the RBAC guard's `x-org-role` header spoof-resistant (the web proxy is then the only
   layer that can set it on behalf of a verified session).
2. Verify: boot clean (envValidation passes — `CLERK_ISSUER` is set), release-verify stays green
   on its next run, re-run the role-less probe (expect unchanged 400 path), watch for 401s.
3. **`VERIFIER_RBAC_MODE=enforce` second.** Role-less or insufficient-role verifier mutations →
   `403 insufficient_org_role`, fail-closed.
4. Code follow-up PR: flip `rbacEnforced: true` in `apps/web/lib/verifier/orgRolesFoundation.ts`
   (honest-state contract: the literal stays `false` until prod enforces) and update
   `docs/ops/launch-blockers.md` item #2 per the close-out protocol.

## Known risks and rollback

- Any undiscovered server-to-server caller sending an identity header without a token starts
  receiving 401s at step 1. Four weeks of zero `header_without_token` says none exists; if one
  surfaces, rollback is `--set CLERK_JWT_VERIFICATION=shadow` (instant, no deploy of code).
- Any legit verifier mutation path not routed through the web proxies starts receiving 403s at
  step 3. Traffic on these routes is near-nil today; rollback is
  `--set VERIFIER_RBAC_MODE=shadow`.
- Railway var-set auto-triggers a redeploy; the new value lands on the deployment created after
  the set (poll `railway deployment list`).

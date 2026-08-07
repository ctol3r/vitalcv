# Enforce-readiness package — G1 identity verification + verifier org-role RBAC

**Date:** 2026-08-07 · **Author:** Claude (session lane), founder gate pending
**Decision this document supports:** flip `CLERK_JWT_VERIFICATION` and `VERIFIER_RBAC_MODE` from `shadow` to `enforce` on the production backend (Railway service `delightful-essence` = api.vitalcv.com).

This is the named authorization gate required by the authorization-boundary practice: the flip
is executed only on an explicit founder selection recorded against this package. Both flips are
config-only and instantly reversible (`--set` back to `shadow`).

> **STATUS 2026-08-07: NOT READY.** A first flip was executed today on a mis-scored criterion and
> **rolled back within 23 minutes**. Production is back at `shadow`/`shadow`. One gap blocks the
> flip — see "Correction" and "The one real blocker" below. Do not re-flip until the canary has
> produced a genuine signed-in `verified_match`.

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
| — | Happy path proven (`verified_match`) | **NOT MET — this is the blocking gap** | See "Correction" below. The release-verify workflow's signed-in walk has **never executed**: its preflight skips the verification step unless `CLERK_SECRET_KEY` is set as a repo secret, and `gh secret list` (2026-08-07) shows it absent. Every hourly "success" is green-with-the-step-skipped, posting a neutral status. Prod has logged **zero** `verified_match` in a month of shadow. A successful token verification has never once been observed in production. |

## Correction (2026-08-07, after the first flip attempt)

An earlier revision of this document scored the happy-path criterion "Met (indirect)" on the
strength of hourly green release-verify runs. **That was wrong.** The runs are green because the
step that performs the signed-in walk is skipped, not because it passed — the classic
green-CI-is-not-evidence trap. `CLERK_SECRET_KEY` has been missing from the repo secrets since the
workflow was built (flagged 2026-07-11, still absent 2026-08-07), and the workflow deliberately
degrades to a neutral status rather than a red failure when unwired.

**What was executed and then reverted, on that mistaken basis:**

| Time (UTC) | Action | Result |
|---|---|---|
| 20:02 | `CLERK_JWT_VERIFICATION=enforce` set; deployment `99e0dd2f` | SUCCESS, booted clean in `mode="enforce"` |
| ~20:05 | Probe: anonymous `POST /api/verifier/accept` | 400 (unchanged — anonymous flows unaffected) |
| ~20:05 | Probe: forged `x-clerk-user-id` + `x-org-role: admin`, no token | **401 `identity_header_requires_verified_session_token`** — the forgery hole closes exactly as designed |
| 20:09 | release-verify dispatched as canary | "success", but **`Run release verification` skipped** — no signed-in evidence produced |
| 20:11–20:25 | Live deployment log sweep | 16 requests, all `outcome:"anonymous"`, **zero 401s, zero verified** — no signed-in traffic exists to prove or disprove the happy path |
| 20:25 | `CLERK_JWT_VERIFICATION=shadow` — **rolled back** | Var set; rollback carried by a later deployment |
| 20:35 | Rollback **confirmed at the behavior level** | Forged-header probe returned to **400** (was 401 under enforce); anonymous 400; `mode="shadow"` in logs; both vars read `shadow`. Note the deployment created immediately after the var-set ended `REMOVED` — superseded seconds later by another build — so deployment status alone would have read as a failed rollback. Assert the served behavior, not the deployment row. |

No user-visible breakage was observed during the ~23 minutes at enforce, but absence of breakage
here is absence of traffic, not evidence of correctness. Leaving a security-critical fail-closed
control live when its happy path has never once been demonstrated risks 401-ing every authenticated
backend call silently, with no monitor watching — so it was reverted rather than sustained.

## The one real blocker, and who can clear it

**Wire `CLERK_SECRET_KEY` as a GitHub repo secret.** This is a credential action and belongs to the
founder — an agent must not copy live `sk_live_` material. The value already exists on Railway
(`delightful-essence`). Owner one-liner:

```bash
railway variables --kv --service delightful-essence | sed -n 's/^CLERK_SECRET_KEY=//p' | gh secret set CLERK_SECRET_KEY --repo ctol3r/vitalcv
```

The workflow self-heals the moment it is set: the preflight passes, the synthetic clinician walks
six signed-in /holder surfaces hourly, and the first green run with the step actually **executed**
is the missing `verified_match` evidence. Then, and only then, re-run the sequence below.

Setting `RAILWAY_API_TOKEN` alongside it also activates the PR #508 release-monitoring loop.

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

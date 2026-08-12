# Enforce-readiness package — G1 identity verification + verifier org-role RBAC

**Date:** 2026-08-07 · **Author:** Claude (session lane), founder gate pending
**Decision this document supports:** flip `CLERK_JWT_VERIFICATION` and `VERIFIER_RBAC_MODE` from `shadow` to `enforce` on the production backend (Railway service `delightful-essence` = api.vitalcv.com).

This is the named authorization gate required by the authorization-boundary practice: the flip
is executed only on an explicit founder selection recorded against this package. Both flips are
config-only and instantly reversible (`--set` back to `shadow`).

> **STATUS 2026-08-08 03:55Z: NEARLY READY — one criterion left, and it is a waiting period, not a
> defect.** A first flip was executed 2026-08-07 on a mis-scored criterion and **rolled back within
> 23 minutes**; production is `shadow`/`shadow`. Since then: the named live callers that enforce
> would have broken are **fixed and deployed** (#1158, `79d3f2033`), client-set identity headers are
> **audited and cannot reach the backend unpaired**, and — the criterion that had never once been met
> — **the happy path is PROVEN in production** (26 `verified_match` events, see below). What remains
> is a clean `identity_header_without_bearer` count over a day of real traffic. See
> "Update 2026-08-08" and "Happy path — PROVEN".

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
| ~20:05 | Probe: anonymous mutation on a verifier route | 400 (unchanged — anonymous flows unaffected) |
| ~20:05 | Probe: asserted identity with no session token | **401 `identity_header_requires_verified_session_token`** — the forgery hole closes exactly as designed. [Reproduction detail withheld — see internal gap register.] |
| 20:09 | release-verify dispatched as canary | "success", but **`Run release verification` skipped** — no signed-in evidence produced |
| 20:11–20:25 | Live deployment log sweep | 16 requests, all `outcome:"anonymous"`, **zero 401s, zero verified** — no signed-in traffic exists to prove or disprove the happy path |
| 20:25 | `CLERK_JWT_VERIFICATION=shadow` — **rolled back** | Var set; rollback carried by a later deployment |
| 20:35 | Rollback **confirmed at the behavior level** | The same probe returned to its pre-enforce status code; anonymous 400; `mode="shadow"` in logs; both vars read `shadow`. Note the deployment created immediately after the var-set ended `REMOVED` — superseded seconds later by another build — so deployment status alone would have read as a failed rollback. Assert the served behavior, not the deployment row. |

No user-visible breakage was observed during the ~23 minutes at enforce, but absence of breakage
here is absence of traffic, not evidence of correctness. Leaving a security-critical fail-closed
control live when its happy path has never once been demonstrated risks 401-ing every authenticated
backend call silently, with no monitor watching — so it was reverted rather than sustained.

## Update 2026-08-08 — the blocker is NOT the canary. Enforce would break live callers.

The canary was never the real gate. Attempting to produce happy-path evidence by hand found
something better and worse: **named call sites that enforce would 401 today.**

**Method.** A signed-in session loaded `/holder` in production. The backend logged **zero**
authenticated requests — no `verified_match`, and equally no `invalid_token`. That is a real
negative, not a gap in observation: `verifiedIdentityMiddleware` is mounted app-wide via
`app.use()` (`app.ts:3566`, before the tenant guard) and `shouldLogSampled` always logs the first
N of every outcome, and prod has recorded zero `verified_match` in a month. The only traffic on
three consecutive containers was `/health`, `/favicon.ico`, `/credentials/status/demo` and one
anonymous `/api/matcha/opportunities/...`, all with `hasHeaderIdentity: false`.

**Conclusion 1 — `/holder` never touches this middleware.** Signed-in clinician surfaces are
served by the web app, so the enforce blast radius on the clinician golden path is smaller than
the readiness package assumed. It also means signing in to `/holder` can never produce the
happy-path evidence; that method is a dead end regardless of the canary.

**Conclusion 2 — the actual hazard, with names.** Under enforce the middleware 401s
(`identity_header_requires_verified_session_token`) any request carrying `x-clerk-user-id`
*without* a verified bearer. Two live sources do exactly that:

1. **`apps/web/lib/server/employer-workspace.ts`** asserts an identity header with **no
   `Authorization` header at all** (zero references in the file) on two backend calls
   (lines 128 and 239). It is imported by the live route
   `apps/web/app/api/request-review/route.ts`. **This 401s the moment enforce is on.**
2. **`apps/web/lib/auth/forwardIdentity.ts`** — the helper written *for* this flip — degrades to
   forwarding `x-clerk-user-id` alone when `getToken()` returns null. Its own docblock calls that
   "strictly additive and safe to land before the backend flips to enforce," which is true, and
   precisely why it is **not** safe after. Every null-token session becomes a 401.

Seven more files set `x-clerk-user-id` without going through the helper
(`app/api/track/apply/route.ts`, `components/apply/ApplyWithVitalCV.tsx`,
`components/monitoring/MonitoringStatusPanel.tsx`, `components/replay-doctrine/ReplayContractMap.tsx`,
`lib/learning/useTrackEvent.ts`, `lib/ops-engine/getOpsEngineSnapshot.ts`,
`app/api/intelligence/_shared.ts`); each needs the same audit before the flip.

**So the exit criteria change.** "Prove the happy path" is necessary but not sufficient. Enforce
must not be flipped until every caller that sends an identity header also sends a verified bearer,
and the helper's null-token path is decided deliberately — fail the request in the web layer with a
real error, rather than silently emitting a header that the backend will reject. Until then the
flip has a *known* break, and no amount of canary green changes that.

## Happy path — PROVEN 2026-08-08 (the criterion that had never once been met)

For a month of shadow, and throughout the 23-minute enforce window, production logged **zero**
`verified_match`. A token had never been observed verifying successfully against prod. That — not
the canary — was the criterion carrying real risk: if JWKS fetch, issuer match, or clock skew were
wrong, enforce would 401 every authenticated backend call and we would learn it from users.

**It is now met.** A signed-in session exercising an **employer** surface produced **26
`verified_match` events**, `mode: shadow`, `hasHeaderIdentity: true`, across five real
identity-bearing routes — the employer workspace lookup
(`lib/server/employer-workspace.ts`), two profile/proof reads, an applications read, and
one telemetry write. **[Route list withheld — see internal gap register.]**

`verified_match` is the strong outcome: the token verified **and** its `sub` matched the forwarded
`x-clerk-user-id` — precisely the pairing enforce requires. JWKS, issuer and clock are therefore all
working in production.

Two honesty notes on this evidence. The counts (25–26) hit `ALWAYS_LOG_FIRST` in
`shouldLogSampled`, so there were *at least* that many, not exactly that many. And the containers
carrying it (`4b3f9683`, `e36a661d`) are already `REMOVED` — the finding is recorded here precisely
because it cannot be re-read later.

**Why the earlier `/holder` attempt found nothing:** `/holder` never reaches this backend at all —
signed-in clinician surfaces are served by the web app. That was confirmed as a true negative, not
an observation gap: `verifiedIdentityMiddleware` is mounted app-wide (`app.use()`, `app.ts:3566`,
before the tenant guard) and the sampler always logs the first N of each outcome. **Use an employer
surface to exercise this middleware; `/holder` cannot.**

### What is still NOT measured

`identity_header_without_bearer` — the warning added by #1158 for the null-token fallback — reads
**zero**, but that number is currently worthless: the instrumentation deployed at the same moment as
the test session, and the web containers hold only ~11 log lines total. **Absence of warnings here
is absence of observation, not evidence.**

A first pass looked for this warning in the *backend* logs, where it could never appear — it is a
`console.warn` in `apps/web`, so it surfaces on the `vitalcv-web` service. Corrected; both were
checked.

**This is the remaining gate, and it is a waiting period rather than a defect.** The happy path
working proves enforce *can* succeed; a clean warning count across a day of real traffic is what
proves it will not 401 someone in an edge case. Flip only after that window, and treat any non-zero
count as a known breakage rather than an acceptable risk.

### How to read the count (run this before deciding)

The warning is a `console.warn` in `apps/web`, so it lands on the **`vitalcv-web`** service, NOT the
backend. Railway keeps logs per deployment and containers are replaced often, so sweep several:

```bash
cd /Users/christoler/vitalcv   # railway project link is per-directory
for d in $(railway deployment list --service vitalcv-web --json < /dev/null | jq -r '.[:8][].id'); do
  n=$(railway logs "$d" --json < /dev/null 2>/dev/null | grep -c identity_header_without_bearer)
  echo "${d:0:8}: $n"
done
```

Interpreting it:
- **All zero across containers that carry real traffic** → the null-token fallback never fires; enforce
  is safe on this axis, and `forwardIdentity`'s fallback can then be made fail-closed as a follow-up.
- **Any non-zero** → those sessions WILL 401 under enforce. Read the `where` field (`buildIdentityHeaders`,
  `buildEmployerWorkspaceHeaders`, `intelligence/_shared:*`) to find the caller, and fix before flipping.
- **Zero on containers with almost no log lines** → *not* evidence. That was the state at 03:55Z
  (~11 lines total). Confirm the containers actually served signed-in traffic before trusting a zero;
  cross-check with `verified_match` counts on `delightful-essence` for the same window.

## The canary — a monitoring requirement, no longer the evidence path

*(Superseded 2026-08-08. This section previously called `CLERK_SECRET_KEY` "the one real blocker"
and said the first genuinely-executed canary run would supply the missing `verified_match`. Both
are now wrong: the happy path was proven directly — see above — and the secret governs **ongoing
monitoring**, not the flip decision.)*

**`CLERK_SECRET_KEY` exists at NO scope GitHub Actions can read.** Verified against the API rather
than `gh secret list` (which shows only repo scope): repo returns `total_count: 5` without it, and
all nine environments return `total_count: 0` — the repo call returning 5 being the control that
proves the API is not hiding it from the caller's token. The value *does* exist on the Railway
API service; its presence was confirmed by shape assertion only, and no value was read, echoed
or recorded.

Wiring it is a founder credential action — an agent must not copy live `sk_live_` material. **Do not
use a pipeline for this**: three attempts through
`railway variables --kv … | sed … | gh secret set …` failed silently, because the pipe swallows the
error from the `gh` end. Use the interactive form, which cannot hide a failure, and target the
environment the job now declares (`environment: Production`, added by #1138):

```bash
gh secret set CLERK_SECRET_KEY --repo ctol3r/vitalcv --env Production
```

Then re-dispatch `release-verify` and read the **step** conclusion, never the run conclusion — the
proof is `Run release verification` showing `success` rather than `skipped`. As of #1138 an unwired
monitor now fails red instead of reporting a silent green, which was verified live (a dispatch on
main concluded `failure` with the step skipped).

**Correction (2026-08-08):** an earlier revision of this section warned that the canary might only
walk `/holder` and so never produce a `verified_match`. **That was wrong — the canary is exactly the
right monitor**, and it was designed for this precise gap.

`lib/release-monitor/syntheticClinician.ts` does walk `/holder`, but it also exports
`probeBackendIdentityProxy`, which hits the identity-bearing web→backend workspace proxy with
the synthetic session. Its docblock states the reasoning outright: *"The page sweep
alone cannot see this — the /holder surfaces render in the web tier without calling the backend."*
Whoever built it had already established the topology finding recorded above.

It is wired end to end, not merely defined: `scripts/release-verify.ts:172` supplies it, and
`lib/release-monitor/verify.ts:160` runs it as check `backend_identity_proxy` with
**`critical: true`**, so a failure fails the run. In `shadow` it emits `verified_match` telemetry on
every monitor run; in `enforce` it turns the release status red the moment the token path breaks,
because the backend 401 propagates through the proxy.

So wiring `CLERK_SECRET_KEY` does buy exactly the ongoing enforce monitoring this rollout needs —
and it would also have produced the happy-path evidence on its own, hourly, had it ever run.

Setting `RAILWAY_API_TOKEN` alongside it also activates the PR #508 release-monitoring loop.

## Verifier RBAC readiness — scored

| Item | Status | Evidence |
|---|---|---|
| Guard live in prod, evaluating | **Confirmed 2026-08-07** | Live probe 20:00:13Z on a role-less verifier mutation: guard logged `verifier_rbac_shadow_would_block role="none" mode="shadow"`, handler returned 400 before any write. [Reproduction detail withheld — see internal gap register.] |
| UI path carries verified org-role | **Confirmed at main tip** | `buildMarketplaceHeaders` (apps/web/lib/server/marketplace-proxy.ts) forwards the org-role from the verified Clerk `org_role` claim, plus the platform-role header for the super-admin path; the verifier-acceptance web proxy exists and uses it. |
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

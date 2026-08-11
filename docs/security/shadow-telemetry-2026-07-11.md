# Shadow-Telemetry Readout — G1 verified-JWT & G2 verifier RBAC

**Date:** 2026-07-11 (04:50 UTC) · **Window analyzed:** 2026-07-06 20:00 UTC → now
**Method:** `railway logs <deployment-id> --json` across all 12 api deployments in
the window (per-deployment retention caps at ~500 lines, so counts are floors,
not totals; forgery-class events always log unsampled, so **zeros in those
classes are trustworthy**).

## G1 — `jwt_auth_verification` (89 events parsed)

| Outcome | Count | Meaning |
|---|---|---|
| `anonymous` | 84 | health probes + public reads — expected |
| `header_without_token` | 5 | legacy call sites — **all pre-conversion** (see below) |
| `verified_mismatch` | **0** | no forged-header attempts observed |
| `invalid_token` | **0** | no broken/expired token traffic |
| `verified_match` / `token_only` | **0** | ⚠️ no authenticated traffic sampled at all |

The five `header_without_token` events all **predate the final call-site
conversion deploy** (PR #612, live 2026-07-10 23:34 UTC):

- `2026-07-08` — two identity-bearing routes, ×2 each (fixed in #610/#611)
- `2026-07-10 23:21` — one identity-bearing route (13 min before #612, which
  converted its caller)

[Route names withheld — see internal gap register.]

**Zero `header_without_token` since full conversion went live.**

## G2 — `employer_rbac_shadow_would_deny` / `verifier_rbac_shadow_would_block`

**0 events** — but this is *absence of verifier-mutation traffic*, not proof the
role wiring is correct. Nobody exercised application-review / workflow-action /
credential-accept in the window.

## Verdict: DO NOT flip yet — two honest gaps

1. **The 7-day clean clock starts 2026-07-10 23:34 UTC** (full-conversion
   deploy), not at shadow go-live. Earliest flip per the runbook criteria:
   **2026-07-17**.
2. **The happy path is unproven in prod.** Zero `verified_match` events means no
   signed-in web session has hit the backend in the sampled windows (consistent
   with pre-pilot traffic levels). Flipping enforce before at least one real
   `verified_match` would risk 401ing the first real clinician on an unforeseen
   token gap. Same for G2: no verifier mutation has ever traversed the guard in
   shadow.

## What unblocks the flip (cheap)

- **G1:** one signed-in walkthrough (Chris, real browser — Clerk bot-blocks
  automation) touching a converted proxy (e.g. `/holder` home, profile save).
  Expected log: `jwt_auth_verification {outcome: verified_match}`. Then let the
  clean clock run to 2026-07-17.
- **G2:** one employer-review action (accept / request-refresh) by an
  `admin`/`reviewer` org member while `VERIFIER_RBAC_MODE=shadow` — expected:
  **no** would-block line. A `read_only` member attempting the same should log
  one.
- Re-run this readout after; if both signals appear and stay clean 7 days, the
  flips are one-line env changes (`CLERK_JWT_VERIFICATION=enforce`,
  `VERIFIER_RBAC_MODE=enforce`) — instantly revertible.

## Notes

- Log-retention friction: only ~500 lines survive per deployment, and tonight's
  merge train (6 deploys in 6 h) fragmented the window. If longer-horizon
  telemetry is wanted before the flip, ship logs somewhere durable (M5-2
  structured-logging follow-up) or rely on the always-log guarantee for the
  forgery classes (sufficient for these criteria).

# Live Blockers

**Conversion-optimization wave deliverable.** Ranked list of what
currently blocks public conversion, ordered by user-visibility and
fix effort.

## §1 — Critical (must clear before public launch)

| # | Blocker | Source | Who fixes |
|---|---|---|---|
| 1 | Apex returns HTTP 402 (Vercel deployment paused) | `pause-root-cause-report.md` (PR #363) | OPERATOR (Vercel dashboard) |
| 2 | Apex Vercel env vars unset: Clerk keys, `RECEIPT_PRIVATE_KEY_JWK`, `RECEIPT_KID`, `DATABASE_URL` | `production-env-requirements.md` (PR #363) | OPERATOR |
| 3 | Demo NPI 1346053246 not seeded in Railway production DB | `final-deployment-sequence.md` §5 (PR #363) | OPERATOR |

While #1 is in effect, NO conversion optimization matters — visitors can't reach the product. Clear this first.

## §2 — High-visibility (causes immediate trust loss)

| # | Blocker | Status |
|---|---|---|
| 4 | `LaneHealthMount` band reads "Unknown" on `/passport` until probe runner cron is scheduled | OPERATOR — schedule cron in Vercel; `production-env-requirements.md` §2 row `CRON_SECRET` |
| 5 | `/api/ingest/[npi]` masked-200 fallback caused homepage NPI submit to throw | **FIXED in PR #365** |
| 6 | Homepage had no recruiter-facing entry point | **FIXED in this PR** |
| 7 | `/verifier` 404 cascade from 4 inbound links | **FIXED in PR #365** |
| 8 | `/signup` page had no actual sign-up CTA | **FIXED in PR #365** |

## §3 — Medium-visibility (visible during demo but not catastrophic)

| # | Blocker | Status |
|---|---|---|
| 9 | Mobile responsive parity not verified on real devices | OPERATOR + FOUNDER Day-2 QA |
| 10 | Sentry DSN unset on apex → no error tracking | OPERATOR — set `NEXT_PUBLIC_SENTRY_DSN` |
| 11 | Legacy `/api/.well-known/jwks.json` emits `application/json` instead of `application/jwk-set+json` | Acceptable for survival launch; institutional verifier may notice |
| 12 | `/api/health` reports `apiBase: false` (cosmetic — backend reachable via fallback) | OPERATOR — set `NEXT_PUBLIC_API_BASE` |

## §4 — Low-visibility (post-launch acceptable)

| # | Blocker | Status |
|---|---|---|
| 13 | Internal-experimental routes (`/calibration`, `/autopilot`, `/roi`, etc.) accessible by direct URL | Per `lean-public-surface.md` §1; cleanup PR optional |
| 14 | `apps/web/app/_archive/` tree in repo (walled off but bloats clone) | Same cleanup PR |
| 15 | Pre-existing `@vitalcv/wallet-sdk` build failure on origin/main (does not block direct web build) | Small separate PR |
| 16 | CI workflow duplication (`ci.yml` + `monorepo.yml` both fire on main push to web paths) | `build-churn-audit.md` §5 on survival branch — workflow diffs ready to apply |
| 17 | Multiple inline backend-URL resolvers (~40 files) — falls back to localhost if env unset | Medium cleanup PR; not user-visible if env is set |

## §5 — Not user-blockers (despite appearing in past audits)

The following are NOT blockers and the founder should stop worrying
about them:

- Cardinality of API routes (213) — each one is a working surface
- Length of `HomePageClient.tsx` (197 lines, not 425 as some audits previously claimed)
- Length of `passport/page.tsx` (841 lines) — works correctly, not a defect
- Existence of `apps/marketing` as a separate Next app — different domain, doesn't interfere
- "Verified" appearing in code (always compound forms like `source-verified`)
- T1-T4 vocabulary visibility — this IS the product vocabulary, keep it

## §6 — Single-line summary

**The ONLY thing blocking public conversion today is the Vercel
HTTP 402 pause.** Every other blocker is either (a) already fixed in
this PR or PR #365, or (b) operator-side configuration the operator
can do in <30 minutes, or (c) post-launch polish that doesn't block
sign-ups.

Total time-to-conversion-ready: **~2 operator hours** (clear 402 +
set env + schedule cron + seed demo) **+ this PR + PR #365 merged**.

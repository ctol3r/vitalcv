# Wave 4 Release Freeze Checklist

Generated: 2026-03-20 PDT
Scope: VCV mobile / product launch wave 4

## Evidence Captured

- Live public route health:
  - `https://vitalcv.com/` -> `200`
  - `https://vitalcv.com/explore` -> `200`
  - `https://vitalcv.com/employers` -> `200`
  - `https://vitalcv.com/developers` -> `200`
  - `https://vitalcv.com/demo` -> `200`
  - `https://vitalcv.com/intelligence?view=dashboard` -> `200`
  - `https://vitalcv.com/intelligence?view=findings` -> `200`
  - `https://vitalcv.com/intelligence?view=providers` -> `200`
  - `https://vitalcv.com/intelligence?view=storylines` -> `200`
  - `https://vitalcv.com/intelligence?view=graph` -> `200`
  - `https://vitalcv.com/intelligence?view=investigations` -> `200`
  - `https://vitalcv.com/intelligence?view=system-health` -> `200`
- Auth gates:
  - `https://vitalcv.com/sign-in` -> `200`
  - `https://vitalcv.com/onboarding` -> `307` to `/sign-in?redirect_url=%2Fonboarding`
  - `https://vitalcv.com/holder/home` -> `307` to `/sign-in?redirect_url=%2Fholder%2Fhome`
  - `https://vitalcv.com/holder/readiness` -> `307` to `/sign-in?redirect_url=%2Fholder%2Freadiness`
- Launch-surface tests passed:
  - `apps/web/__tests__/analytics-proxies.test.ts`
  - `apps/web/__tests__/mobile-launch-analytics.test.tsx`
  - `apps/web/__tests__/marketplace-proxies.test.ts`
  - `apps/web/__tests__/holder-home-page.test.tsx`
  - `apps/web/__tests__/holder-readiness-page.test.tsx`
  - `apps/web/__tests__/mobile-page.test.tsx`
  - `apps/web/__tests__/passport-page.test.tsx`
  - `apps/web/__tests__/intelligence-forwarding.test.ts`
- Live baseline snapshots:
  - frontend package version: `0.1.0`
  - local workspace SHA: `fa330204`
  - backend live SHA from `/health` and `/readyz`: `5522d2f9a0ae131491688b821553f165e6e85ada`
  - live providers total: `10`
  - live findings total: `93`
  - live storylines total: `31`
  - live graph totals: `25` nodes / `102` edges

## Public Checklist

| Surface | Status | Evidence |
| --- | --- | --- |
| Homepage | PASS | Live route `200` |
| Explore | WARN | Live route `200`, but `/api/opportunities` returned `organization_context_required` during baseline pull |
| Employers | WARN | Live route `200`, but `/api/employers` returned `organization_context_required` during baseline pull |
| Developers | PASS | Live route `200` |
| Demo | PASS | Live route `200` |

## Clinician Mobile Checklist

| Flow | Status | Evidence |
| --- | --- | --- |
| Sign in entry | PASS | `/sign-in` live route `200`; `clinician.sign_in` analytics test passes |
| Onboarding gate | PASS | `/onboarding` redirects correctly to sign-in; onboarding analytics start/complete test passes |
| Readiness | PASS | `holder-readiness-page` and launch analytics tests pass |
| Blocker resolution | PASS | blocker open/resolve analytics test passes; blocker detail surface compiles after syntax fix |
| Apply | WARN | apply analytics now fires in tests, but live public opportunity count could not be confirmed because `/api/opportunities` required org context |
| Application detail | PASS | application detail analytics test passes |
| Alerts | PASS | alert surface analytics test passes |
| Wallet / passport | PASS | `passport-page` and wallet analytics test pass |
| App reopen / restore | PASS | `mobile-page` and holder home page tests pass; return-session instrumentation remains in place |
| Full signed-in clinician browser loop | BLOCKED | no authenticated launch clinician session was available in this workspace for end-to-end live browsing |

## Operator Checklist

| Surface / Flow | Status | Evidence |
| --- | --- | --- |
| Intelligence dashboard | PASS | live route `200` |
| Findings | PASS | live route `200`; forwarding tests pass |
| Providers | PASS | live route `200`; forwarding tests pass |
| Storylines | PASS | live route `200` |
| Graph | PASS | live route `200`; live graph returned `25` nodes / `102` edges |
| Investigations | PASS | live route `200` |
| System health | PASS | live route `200`; backend `/health` = `ok`, `/readyz` = `ready` |
| Employer application review / action | BLOCKED | no authenticated employer/admin session was available for live browser verification |

## Freeze / Readiness Notes

- `holder/checklist` now redirects to `/holder/home`.
- `holder/referrals` now redirects to `/holder/home`.
- Shared clinician support and failure-state components are wired into readiness, alerts, home, onboarding, and wallet/mobile surfaces.
- Launch analytics now proxy through `/api/analytics/event` and `/api/analytics/funnel`, and the clinician launch event matrix passes in targeted tests.
- The backend marketplace analytics service now records `clinician.application_detail_viewed`.

## Open Blockers

- Repo-wide `pnpm typecheck` is still failing outside this wave in `apps/api/backend/src/services/pilot/pilotOpsService.ts`.
- Repo-wide `pnpm test` is still failing outside this wave in `packages/haip-config/src/__tests__/haipConfig.test.ts`.
- `pnpm --filter @vitalcv/web build` compiles, but the build did not complete cleanly in this workspace after page-data collection; stale `.next` output was part of the failure path, but the clean rebuild still did not finish to a final success state.
- Public baseline counts for opportunities/employers are not trustworthy yet because the live `/api/opportunities` and `/api/employers` endpoints currently answer with `organization_context_required`.
- Live clinician and employer end-to-end browser QA remains incomplete without authenticated pilot accounts.

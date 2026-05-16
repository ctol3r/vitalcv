# Runtime Stabilization State

Date: 2026-05-14

Scope: institutional runtime stabilization and employer-facing polish for the passport runtime. This pass did not add blockchain infrastructure, queues, microservices, orchestration, or new platform scope.

## Current Verdict

Local candidate runtime: PASS for passport response observability, structured degraded truth, replay and continuity fields, runtime health, and employer-readable passport rendering.

Live production: PENDING DEPLOYMENT. `https://vitalcv.com/api/passport/npi/1346053246` still returns stable JSON without transport leakage, but it does not yet expose `replayPosture`, `continuityPosture`, or `issuerPosture`. `https://vitalcv.com/api/runtime-health` returns `404`.

## 1. Remaining Runtime Fragility

- Production has not yet picked up the self-contained runtime-health surface or the new replay/continuity posture fields.
- Local canonical web boot now starts through `pnpm --filter @vitalcv/web dev`; the wrapper still emits a Node module-type warning because the root package is not marked as ESM.
- Browser validation still reports local Clerk CSP and PostHog-token console errors. These are not passport hydration failures, but they reduce demo calmness and should be resolved before a live walkthrough.
- UUID/entity hydration remains a truthful degraded path unless a source-backed App Router entity lookup is available.
- The passport response is operationally diagnosable through structured logs, but deployment log retention, routing, and alerting depend on the hosting environment.

## 2. Remaining Degraded Truth Areas

- NPPES identity can be checked directly; OIG/LEIE, state board, and PECOS lanes remain pending in the local degraded passport fallback.
- Readiness remains `CHECKING` with score `0` when safety, authority, and eligibility are pending.
- The UI now states "Source incomplete", "Partial source coverage", and "Pending" instead of implying full verification.
- Replay and continuity are presented as partial when only the NPPES identity check is replayable.

## 3. Remaining External Dependencies

- CMS NPPES reachability is the only live source probe exposed by `/api/runtime-health`.
- Production deployment identity depends on existing Vercel/Railway environment variables; absent values are returned as `null`.
- Clerk and PostHog browser configuration remain external dependencies for a clean local visual demo.

## 4. Employer Readability Status

Status: improved locally.

- Passport trust states distinguish source-backed, partial, pending, unavailable, and cannot-verify states without raw enum language.
- Employer review copy no longer uses ambiguous decision wording such as "Safe to proceed" or "Proceed with caution".
- Readiness copy avoids hiring certainty and frames the passport as source-backed evidence, not a hiring, privileging, or employment decision.
- Degraded source states are visible as intentional operational states rather than blank or failed UI.

## 5. Replay Readability Status

Status: improved locally.

- Runtime fields are present in local passport JSON: `checkedAt`, `lineageKey`, `replayPosture`, `continuityPosture`, and `issuerPosture`.
- The passport UI translates those fields into operational labels: Runtime check, Run reference, Evidence chain, Replay check, Continuity, Source issuer, and Source chronology.
- Raw runtime field names are not shown on the passport page.
- Live production does not yet expose the new replay/continuity fields.

## 6. Recommended Next Non-Infrastructure Priorities

1. Deploy the current runtime patch and rerun the live production checks for passport JSON, runtime health, and passport page rendering.
2. Fix the Clerk CSP host mismatch and missing PostHog token for a clean demo console.
3. Add a focused production smoke check that fails if passport JSON loses `checkedAt`, replay posture, continuity posture, degraded truth, or source coverage.
4. Add one operator log dashboard view or saved query for `passport.runtime.hydration.success` and `passport.runtime.hydration.failure`.
5. Keep UUID/entity passport hydration explicitly degraded until a source-backed entity lookup exists in the App Router.

## Validation Evidence

- `pnpm --filter @vitalcv/web exec vitest run __tests__/passport-proxy-routes.test.ts __tests__/passport-trust-posture.test.tsx __tests__/banned-verified-label.test.ts`: 3 files passed, 9 tests passed.
- `pnpm --filter @vitalcv/web exec tsc --noEmit --pretty false`: passed.
- `pnpm --filter @vitalcv/web dev`: canonical runtime booted on `http://localhost:3030` after the runtime banner import fix.
- Local `/api/runtime-health`: `200`, JSON, NPPES reachability `operational`, degraded fallback available.
- Local `/api/passport/npi/1346053246`: `200`, JSON, `checkedAt`, replay posture, continuity posture, issuer posture, structured degraded truth, no localhost or transport leakage.
- Browser check on local `/passport/1346053246`: replay labels visible, raw runtime field names hidden, no banned certainty language visible, no blank reserved section gap after disabling scroll-triggered hidden sections on the passport surface.
- Live `https://vitalcv.com/api/passport/npi/1346053246`: `200`, JSON, checked timestamp present, no localhost or transport leakage, but replay/continuity/issuer posture fields absent.
- Live `https://vitalcv.com/api/runtime-health`: `404`, not yet deployed.

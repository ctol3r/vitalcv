# Runtime Reliability State

Generated: 2026-05-13

Scope: passport hydration runtime only. This pass did not add infrastructure, services, queues, or orchestration. Frontend visual hierarchy is out of scope for this report.

## Current Verdict

Local passport hydration runtime is contract-locked and observable.

Production passport hydration is not yet converged to the new contract. The live route returns HTTP 200 JSON, but the deployed payload still reflects the older shape and fails the new runtime contract gate.

## Validation Evidence

| Check | Result | Evidence |
| --- | --- | --- |
| Focused route regression tests | PASS | `pnpm --dir apps/web exec vitest run __tests__/passport-proxy-routes.test.ts` passed 6 tests. |
| Live passport route reachability | PASS | `pnpm verify:passport-runtime` reached `https://vitalcv.com/api/passport/npi/1346053246` with HTTP 200. |
| Live passport contract convergence | FAIL | Live payload lacks `checkedAt`, `lineageKey`, `replayPosture`, `continuityPosture`, `issuerPosture`, `_degraded`, and stable top-level ordering. |
| Leakage scan for deployed payload | PASS | Smoke verifier did not find localhost, fetch-failed, backend, upstream, or proxy leakage in the live JSON payload. |

## Runtime Observability Status

Passport hydration routes now emit one structured JSON log per request through `passport-observability`.

Logged fields:

- `event`: `passport.runtime.hydration.success` or `passport.runtime.hydration.failure`
- `runtimeRole`: `passport-app-router`
- `runtimeTopology`: `self-contained-app-router`
- `entityKind`: `npi`, `entity`, or `unknown`
- `entityFingerprint`: short SHA-256 fingerprint, not the raw NPI or entity ID
- `hydrationLatencyMs`
- `degradedState`: emitted/category/reason
- `sourceAvailability`
- `sourceAvailabilitySummary`
- `sourceReachability`
- `replayEmission`
- `continuityEmission`
- `issuerEmission`
- `deploymentDiagnostics`

Safety constraints:

- Logs do not include clinician names.
- Logs do not include raw NPI values.
- Logs do not include full passport payloads.
- Error messages are sanitized for URLs and 10-digit NPIs.

## Passport Contract Status

Locked local contract fields:

- `checkedAt`
- `lineageKey`
- `replayPosture`
- `continuityPosture`
- `issuerPosture`
- `truth`
- `_degraded`
- `readiness`
- `sourceCoverage`

Stable ordering assertions now cover:

- Top-level passport keys
- `readiness` keys
- `sourceCoverage.summary` keys
- runtime posture key order: `status`, `label`, `detail`
- `truth` key order

## Degraded Truth Status

Current local degraded semantics are operationally meaningful:

- NPPES unavailable is represented as source unavailable, not a transport failure.
- OIG LEIE, state board, and PECOS are represented as pending when not checked.
- Replay unavailable is represented explicitly when no source check completed.
- Partial replay is represented when NPPES identity is checked but other lanes remain pending.
- `fetch failed`, backend, localhost, proxy, and upstream terminology are blocked from normal passport JSON by tests and the smoke verifier.

## Remaining Runtime Fragility

1. Production deployment is not yet serving the locked passport runtime contract.
2. The live route is reachable, but runtime metadata is absent from the deployed payload.
3. Non-hydration passport subroutes still contain legacy proxy assumptions and should be scoped separately before removal:
   - `/api/passport/[npi]/embed.svg`
   - `/api/passport/[npi]/export`
   - `/api/passport/[npi]/trust`
   - `/api/passport/analytics`
   - `/api/passport/analytics/[npi]`
4. Runtime health exists, but the production passport route must be redeployed before the health and contract story match externally.

## Remaining Degraded Truth Areas

1. Live production still returns the older contract, so degraded truth is not externally contract-locked yet.
2. State board, OIG LEIE, and PECOS remain pending in the local degraded passport when only NPPES is reachable.
3. Entity-ID passport lookup without NPI can only emit structured unavailable/pending truth until a source-backed entity hydration path is mounted.

## Replay Readability Status

Local runtime payloads now carry machine-readable replay posture:

- `replayPosture.status`
- `replayPosture.label`
- `replayPosture.detail`
- `lineageKey`
- `checkedAt`

Production does not yet expose these fields on the tested live endpoint.

## Employer Readability Status

This report does not claim frontend UX or layout convergence. Employer readability improvements in this pass are contained to runtime JSON semantics and observability:

- source unavailable
- source pending
- source incomplete
- replay unavailable
- continuity unavailable or partially available

## Remaining External Dependencies

1. CMS NPPES API remains the direct identity source dependency for NPI passport hydration.
2. Vercel deployment propagation is required before live checks can pass.
3. Non-hydration passport proxy routes may still depend on the legacy backend unless separately collapsed.

## Recommended Non-Infrastructure Next Priorities

1. Deploy the current App Router passport runtime and rerun `pnpm verify:passport-runtime`.
2. Treat the smoke verifier as a release gate for passport runtime deployment convergence.
3. Decide whether the legacy non-hydration passport subroutes are in scope for self-contained topology; if yes, collapse them in a separate focused pass.
4. Keep the focused Vitest route contract in CI for future passport changes.
5. Add a production-only alert on `passport.runtime.hydration.failure` if the structured JSON failure log appears.

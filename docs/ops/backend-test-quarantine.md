# Backend test quarantine — burn-down list

**Created:** 2026-07-05 (enterprise Wave 2B / task I1) · **Owner:** backend

The `Backend Tests (Postgres)` CI gate (`.github/workflows/backend-tests.yml`)
runs the backend jest suite against an ephemeral Postgres so **new** backend
regressions are caught on every PR. To make the gate green on day one without
masking real problems, the suites below — all failing on **pre-existing** debt
that predates the gate — are excluded via `testPathIgnorePatterns` in
`apps/api/backend/jest.config.js`.

**This is a burn-down list, not a graveyard.** Every entry must be fixed and
**removed from `jest.config.js`** as it goes green. Do not add to it to make a
PR pass — fix the test. The old web `STALE_TEST_FILES` list rotted because it
was never revisited (it hid passing suites); this list exists to be emptied.

## Rules
- A PR that fixes a suite here **deletes** its line from `jest.config.js` and its
  row below, in the same PR.
- A PR may **not** add a new entry here to get green — that hides a real failure.
- Anything that turns out to be a **product bug** (not a test bug) gets a linked
  issue and a decision before the test is "fixed".

## Quarantined suites

| Suite | Failure class | Notes / fix direction |
|---|---|---|
| `__tests__/connectors/oigConnector.test.ts` | fixture isolation | Loads the full ~83k-row LEIE dataset in test mode instead of a sandbox fixture (expected ~10). Fix the test's data isolation. |
| `__tests__/nppesApi.test.ts` | **possible product bug** | 2 value mismatches: expected `TX`/`ORGANIZATION`, got `CA`/`INDIVIDUAL`. Either a stale mock response **or a real NPPES-parser regression** — investigate the parser before "fixing" the test. |
| `__tests__/credentialIngestion.trustState.test.ts` | mock + clock-drift | Divergence detection calls `.findMany` on a Prisma model the test doesn't mock; also a PECOS `UNKNOWN` from freshness clock-drift (pin the clock like `trustStateEngine.authority`). |
| `__tests__/vcvCredentialMaterializer.test.ts` | schema-drift (model-aware) | `where: { subject: { npi } }` — `VcvCredential` no longer has a `subject` relation; it has a `subjectId` scalar (`@map("subject_id")`). Needs a query rewrite, not a rename. |
| `src/routes/__tests__/employerActions.test.ts` | assertion (uninvestigated) | Ran with assertion failures; classify clock-drift vs logic. |
| `src/routes/__tests__/velocity.test.ts` | assertion (uninvestigated) | Org-scope drilldown assertion; classify. |
| `src/services/identity/__tests__/divergenceEngine.test.ts` | assertion (uninvestigated) | "detects all seven canonical divergence rules" — likely clock-drift or fixture. |
| `src/services/entity/__tests__/passportService.test.ts` | assertion (uninvestigated) | Freshness-window / posture assertions — likely clock-drift (pin the clock). |
| `src/services/velocity/__tests__/velocityEngine.test.ts` | assertion (uninvestigated) | Time-to-start metrics — likely clock-drift. |
| `src/routes/__tests__/predictions.test.ts` | **product bug** | Compile fix landed, but under a real DB `predictionEngineService.ts:189` calls `groupBy({ by: ["hospital_affiliation"] })` — Prisma expects the field name `hospitalAffiliation`, not the `@map`'d column. Fix the service, not the test. |
| `src/services/identity/__tests__/leieCache.test.ts` | fixture isolation | Fuzzy possible-match overrides an explicit NPI because the real LEIE dataset leaks into test mode (expected `CLEAR`, got `POSSIBLE_MATCH`). Same root as `oigConnector`. |
| `src/services/identity/__tests__/physicianLicensureLaunchLane.test.ts` | assertion (uninvestigated) | "honest manual-only claim for unsupported states" — classify clock-drift vs fixture vs logic. |
| `src/services/passport/__tests__/npiPassportContract.test.ts` | assertion (uninvestigated) | `buildPassportDataByNpi` frontend-safe contract shape drifted from fixture. |
| `src/services/simulation/__tests__/liveSimulationEngine.test.ts` | **possible import-time bug** | Suite fails to run at `import '../liveSimulationEngine'` — if the module throws at import, production importing it would too. Investigate before "fixing" the test. |
| `tests/e2e/fhirExport.spec.ts` | e2e (uninvestigated) | FHIR export end-to-end; classify. |
| `src/routes/__tests__/decisionRecommendations.test.ts` | **product bug (same as predictions)** | Institution recommendation bucket returns 0 (expected 1) — downstream of the `predictionEngineService.ts:189` `groupBy` field-name bug. Fixing the service should green both; delete both rows together. |
| `__tests__/passportEntity.pdf.test.ts` | assertion — possible contract change | `renderPassportPdf`/`buildPassportDataByNpi` mocks not invoked as pinned and the fail-closed 404 body shape drifted (`Expected -3 / Received +1`). Verify whether the PDF route's error contract changed intentionally; update pins only if so. |

## Already fixed (NOT quarantined — left to run under the gate)
- `trustStateEngine.authority` — clock-pin fix (commit `67f47ca2`).
- 6 `User`/`PersonProfile` seed suites — relation-removal fix (commit `4a980f81`).
- The `credentialIngestion.trustState` / `nppesApi` / `predictions` **compile**
  errors — schema-drift fixes (commit `6da95add`). All three then revealed
  runtime failures under the real DB and are quarantined above (`predictions` on a
  real source bug, not a test bug).

## Deployment-integrity finding (separate from this gate — needs a follow-up)

The gate builds the ephemeral test DB with `prisma db push` (schema → DB), not
`prisma migrate deploy`, because **`migrate deploy` does not create all tables in
`schema.prisma`**: the `Application` (`applications`) and `BlockerResolutionEvent`
(`blocker_resolution_events`) models have **no migration** (verified — 0 migrations
create them). `railway.toml`'s `preDeployCommand` runs `migrate deploy` in prod, so
a fresh prod database built purely from migrations would be **missing these tables**;
prod currently survives only because its DB was built up incrementally. This is a
real migration/schema drift to reconcile (generate the missing migrations) — a
deploy-integrity task (relates to enterprise-map C3/C5/I3), not a test-gate task.

## Definition of done for I1
Quarantine list empty → every backend suite green under the gate → gate marked
**required** in branch protection.

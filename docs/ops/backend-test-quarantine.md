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

## Already fixed (NOT quarantined — left to run under the gate)
- `trustStateEngine.authority` — clock-pin fix (commit `67f47ca2`).
- 6 `User`/`PersonProfile` seed suites — relation-removal fix (commit `4a980f81`).
- `predictions`, and the `credentialIngestion.trustState` / `nppesApi` **compile**
  errors — schema-drift fixes (commit `6da95add`). (`predictions` is
  DB-integration and runs under the gate's Postgres; the latter two remain
  quarantined for their revealed runtime failures above.)

## Definition of done for I1
Quarantine list empty → every backend suite green under the gate → gate marked
**required** in branch protection.

# API Railway Build Gap - delightful-essence

Date: 2026-05-26
Branch: `fix/api-railway-build-gap`
Base: `origin/main`

## Context

`delightful-essence` is the Railway API service for `api.vitalcv.com`.
It currently watches `main`.

The active Railway API deployment is stale at the PR #359-era build. Newer API
deploy attempts from `main` have failed, including the PR #415 line now on
`origin/main`.

PR #420 is based on `wave-10a/docs-status`. Even after it is considered safe,
it will not deploy to `delightful-essence` unless either:

- the required commits reach `main`, which is the branch the API service watches;
- or the operator intentionally changes the Railway service watched branch.

This repair does not change Railway config, DNS, env vars, secrets, Prisma
schema, migrations, or source-truth behavior.

## Reproduced Failure

Command:

```bash
pnpm turbo run build --filter @vitalcv/api
```

Failure reproduced on `origin/main`:

```text
backend/src/routes/employerActions.ts(53,8): error TS2307: Cannot find module '../services/runtimeTrustCohesion'
backend/src/server.ts(180,39): error TS2307: Cannot find module './config/loadDotenv'
backend/src/services/audit/replayEngine.ts(24,8): error TS2307: Cannot find module '../runtimeTrustCohesion'
backend/src/services/audit/replayEngine.ts(31,8): error TS2307: Cannot find module '../multi-tenant/tenantIsolation'
backend/src/services/audit/replayEngine.ts(41,8): error TS2307: Cannot find module './replayCorruptionContainment'
backend/src/services/audit/replayEngine.ts(45,8): error TS2307: Cannot find module './confidenceCalibration'
backend/src/services/audit/replayEngine.ts(610,40): error TS7006: Parameter 'r' implicitly has an 'any' type.
```

## Root Cause

`main` contains imports from the runtime trust cohesion / replay hardening stack,
but the helper modules those imports require were missing from `main`.

The missing files exist on `wave-10a/docs-status` and are pure helper modules:
they do not write to the database, mutate source truth, change API routes, or
change deployment configuration.

The `replayEngine.ts:610` implicit `any` error was a downstream type-resolution
effect of the missing `tenantIsolation` module. Restoring that module restores
the generic type for `scopeRelatedDecisions`.

## Files Changed

Added the missing helper modules required by the existing imports:

- `apps/api/backend/src/config/loadDotenv.ts`
- `apps/api/backend/src/services/runtimeTrustCohesion.ts`
- `apps/api/backend/src/services/multi-tenant/tenantIsolation.ts`
- `apps/api/backend/src/services/audit/replayCorruptionContainment.ts`
- `apps/api/backend/src/services/audit/confidenceCalibration.ts`

No package files, lockfiles, Prisma schema files, migrations, env files,
Railway config, DNS config, or secret material were changed.

## Validation

Railway root install:

```bash
pnpm install --frozen-lockfile
```

Result: passed; lockfile stayed unchanged.

Railway root build command:

```bash
pnpm turbo build
```

Result:

```text
Tasks: 32 successful, 32 total
```

Note: the root build logged a web-side `DATABASE_URL` warning during static
generation, but the build completed successfully. The API package task completed
inside the root build.

API Railway-equivalent build:

```bash
pnpm turbo run build --filter @vitalcv/api
```

Result:

```text
Tasks: 15 successful, 15 total
```

Targeted backend TypeScript validation:

```bash
pnpm --filter @vitalcv/api exec tsc -p backend/tsconfig.json --noEmit
```

Result: passed.

Requested package-level TypeScript probe:

```bash
pnpm --filter @vitalcv/api exec tsc --noEmit
```

Result: failed before project config with inherited type-resolution noise:

```text
error TS2688: Cannot find type definition file for 'minimatch'.
```

Repo lint:

```bash
pnpm lint
```

Result: passed. Existing marketing hook warning was replayed from cache; web
lint was clean.

## Remaining Operator Action

This branch repairs the API build gap on top of `main`; it does not by itself
deploy PR #420.

To deploy PR #420 to `delightful-essence`, the operator must choose one path:

1. Merge this build repair to `main`, then merge or cherry-pick PR #420's API
   patch to `main`.
2. Or intentionally change `delightful-essence` to watch the branch containing
   PR #420, after confirming that branch's API build passes.

Do not merge all of `wave-10a/docs-status` into `main` just to deploy PR #420
unless that broader branch promotion is explicitly approved.

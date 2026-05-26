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

## Codex remediation (2026-05-26)

First Codex three-audit pass on the restored helper modules returned
**UNSAFE** with three findings. This section records the exact remediation
applied on top of the original build-repair commit.

### P1 — `apps/api/backend/src/services/multi-tenant/tenantIsolation.ts`

**Finding:** `assertTenantScope` returned `OPEN` whenever `requesterTenantId`
was null, even for tenant-owned capsules. The audit-replay route handlers
in `apps/api/backend/src/routes/auditReplay.ts` called `replayDecision(id)`
without forwarding any request organization, so any caller that reached
the route could read another tenant's capsule by id.

**Remediation:**

1. Added a `RequesterAuthority = 'tenant' | 'system' | 'unknown'` type and a
   new violation kind `MISSING_REQUESTER_FOR_TENANT_OWNED`.
2. Updated `assertTenantScope` and `evaluateTenantScope` to take
   `requesterAuthority` (default `'unknown'`). When `requesterTenantId` is
   null AND `capsuleTenantId` is set AND `requesterAuthority !== 'system'`,
   the validator throws `MISSING_REQUESTER_FOR_TENANT_OWNED`. Internal /
   admin callers may pass `'system'` explicitly to bypass — never inferred.
3. Updated `replayDecision` and `buildAuditBundle` (in
   `apps/api/backend/src/services/audit/replayEngine.ts`) to accept and
   forward `requesterAuthority`.
4. Updated every `replayDecision` call site in `auditReplay.ts` to forward
   the request's organization id via a new `tenantScopeFromRequest(req)`
   helper that reads `getRequestOrganizationId(req)` and sets
   `requesterAuthority` to `'tenant'` when a tenant id is present or
   `'unknown'` otherwise.
5. Mapped `TenantIsolationError` to `403 Forbidden` (with the violation
   code) so clients can distinguish authorization failures from server
   faults.

**Other source-truth invariants are preserved:** mismatched tenants still
throw `CROSS_TENANT_REPLAY` regardless of authority; ambiguous (requester
set, capsule unowned) still throws `AMBIGUOUS_TENANT`.

### P2 — `apps/api/backend/src/services/runtimeTrustCohesion.ts`

**Finding:** `buildRuntimeReplayMetadata` reused caller-supplied
`payloadHash` and `mutationFingerprint` verbatim even when the caller also
supplied a `tenantId`. Capsule metadata written before tenant binding
existed has no tenant in its hash preimage, so the emitted record could
advertise `tenantBound: true` while the actual hash had no tenant binding —
defeating the cross-tenant collision guarantee.

**Remediation:** when `tenantBound` is true, both `payloadHash` and
`mutationFingerprint` are now recomputed deterministically with `tenantId`
folded into the preimage. Caller-supplied hashes are only honored in the
back-compat un-anchored path (`tenantBound: false`), where their preimage
is also un-anchored and consumers correctly interpret the record as
predating tenant isolation.

### P2 — `apps/api/backend/src/config/loadDotenv.ts`

**Finding:** the prior loader resolved `path.resolve(__dirname, '..', '..')`,
which works in the source layout but NOT in the compiled-dist layout
produced by `backend/tsconfig.json` (`rootDir: ../../.. + outDir: dist`).
In the compiled layout the file is emitted at
`apps/api/backend/dist/apps/api/backend/src/config/loadDotenv.js`, and
`__dirname/../..` resolves inside `dist/`. The packaged server never loaded
`.env.local` / `.env`.

**Remediation:** loader now walks upward from `__dirname` looking for a
`package.json` whose `name` is `chai-vc-platform-backend`. This locates the
backend package root in both source and compiled layouts. A `process.cwd()`
fallback covers the case where the walk fails (matches Railway's
`npm --prefix apps/api/backend start` cwd). Missing `.env` files remain
silently ignored.

### New focused tests

| File | Coverage |
|---|---|
| `apps/api/backend/__tests__/tenantIsolation.codex.test.ts` | Closed-by-default for tenant-owned + null requester; explicit `'system'` bypass; cross-tenant cannot be bypassed by authority; back-compat paths still OPEN/ENFORCED as documented. |
| `apps/api/backend/__tests__/runtimeTrustCohesion.codex.test.ts` | Tenant-bound replay metadata recomputes hashes; two tenants produce different hashes for the same capsule; un-anchored back-compat path still honors stored hashes. |
| `apps/api/backend/__tests__/loadDotenv.codex.test.ts` | Resolver finds backend package root in source layout, simulated compiled-dist layout, and falls back to `process.cwd()` outside the package tree. |

### Validation commands

```bash
pnpm turbo run build --filter @vitalcv/api --force
pnpm --filter @vitalcv/api exec tsc --noEmit
pnpm --filter @vitalcv/api test -- tenantIsolation runtimeTrustCohesion loadDotenv
pnpm lint
```

### Behavior NOT changed by this remediation

- No Passport / NPPES truth-state behavior change.
- No copy / banned-phrase change.
- No Prisma schema or migration.
- No env file, secret, Railway service config, or DNS change.
- No new third-party dependency.
- No source adapter, route handler other than the audit-replay routes is
  touched — and the audit-replay change is strictly *adding* the tenant
  scope that should have been there from the start.

### Remaining risk

The audit-replay routes now require the request to carry a tenant id (via
JWT, query string, or `x-org-id` header) for any tenant-owned capsule. A
client that previously relied on the open-by-default behavior to read a
tenant-owned capsule WITHOUT forwarding its org will now receive a
`403 Forbidden { code: TENANT_ISOLATION_VIOLATION, violation: MISSING_REQUESTER_FOR_TENANT_OWNED }`.
Public capsules (no tenant anchor) remain readable without an org id — by
design.

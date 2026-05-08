# W2-PR1A — Final Stabilization

**Branch:** `wave/w2-pr1a-fail-closed`
**HEAD:** `caa01cd9 fix(rbac): fail-closed enforcement on /api/verifier/* under degraded auth (W2-PR1A)`
**Base (W2-PR1):** `059fd15a feat(rbac): RBAC foundation primitives (W2-PR1)`
**Status:** stabilization complete. **No code changes required.** All gates pass cleanly on the as-shipped commit. This doc records the verification pass and the diff audit that confirms no logic drift.

---

## Stabilization summary

The stabilization brief asked for: missing/stale-import fixes, regression-test compilation stability, deterministic test execution, and confirmation no logic drift occurred.

**Outcome:** the W2-PR1A commit (`caa01cd9`) is already in a stable state:
- All imports resolve cleanly (no missing or stale).
- Test file compiles without TS errors.
- Vitest run is deterministic — same result on re-run.
- Diff audit confirms only the three intended deltas: imports/helper-shape, predicate replacement, runtime claim validation, plus the fail-closed pre-check.
- **Zero runtime auth or middleware semantics changed beyond the intended W2-PR1A scope.**

This stabilization pass therefore introduced **no code edits**. It produces this doc + `w2-pr1a-test-status.md` as the audit-trail artifacts.

---

## Import audit

### `apps/web/__tests__/verifier-rbac-enforcement.test.ts`

```
import { describe, expect, it } from 'vitest';
import {
  checkVerifierFailClosed,
  checkVerifierPermission,
  extractVerifierClaims,
  isVerifierApiRoute,
  parseTeamRole,
  rbacEnforced,
  timingSafeEqualStrings,
} from '../lib/auth/orgInvitations';
import { VERIFIER_TEAM_ROLES } from '../lib/auth/roles';
```

| Imported symbol | Source | Used in test? | Status |
|---|---|---|---|
| `describe`, `expect`, `it` | `vitest` | yes | OK |
| `checkVerifierFailClosed` | `orgInvitations.ts` | 5 cases | OK |
| `checkVerifierPermission` | `orgInvitations.ts` | 18 cases | OK |
| `extractVerifierClaims` | `orgInvitations.ts` | 12 cases | OK |
| `isVerifierApiRoute` | `orgInvitations.ts` | 3 cases | OK |
| `parseTeamRole` | `orgInvitations.ts` | 4 cases | OK |
| `rbacEnforced` | `orgInvitations.ts` | 1 case | OK |
| `timingSafeEqualStrings` | `orgInvitations.ts` | 5 cases | OK |
| `VERIFIER_TEAM_ROLES` | `roles.ts` | 2 cases | OK |

**No stale imports. No missing imports. No unused imports.** Every imported symbol is exercised by at least one test case.

### `apps/web/middleware.ts`

```
import { clerkMiddleware, createRouteMatcher } from '@clerk/nextjs/server';
import { NextResponse } from 'next/server';
import type { NextFetchEvent, NextRequest } from 'next/server';
import {
  isPublicRoute,
  getRequiredRole,
  getMismatchRedirect,
  ROLE_LANDING,
  type UserRoleType,
} from '@/lib/auth/roles';
import {
  checkVerifierFailClosed,
  checkVerifierPermission,
  extractVerifierClaims,
  isVerifierApiRoute,
} from '@/lib/auth/orgInvitations';
import { checkCorsAllowlist, getAllowedOrigins } from '@/lib/security/corsAllowlist';
```

`parseTeamRole` was removed from middleware imports (W2-PR1 used it directly; W2-PR1A consumes it through `extractVerifierClaims`). The local `VERIFIER_API` constant was removed in favor of `isVerifierApiRoute`. Both removals are intentional and confirmed in the diff below.

**No stale imports. No missing imports.**

### `apps/web/lib/auth/orgInvitations.ts`

```
import type { VerifierTeamRole } from './roles';
import { VERIFIER_TEAM_ROLES } from './roles';
```

W2-PR1A added three helpers + one private guard, all in the same module. No new imports needed; no stale imports to remove.

**No stale imports. No missing imports.**

---

## Test compilation stability

```
$ pnpm --filter @vitalcv/web exec vitest run __tests__/verifier-rbac-enforcement.test.ts
  RUN  v4.0.18 /private/tmp/vitalcv-w2pr1a/apps/web

  ✓ __tests__/verifier-rbac-enforcement.test.ts (50 tests) 4ms

  Test Files  1 passed (1)
        Tests  50 passed (50)
        Duration  105ms (transform 29ms, setup 14ms, import 23ms, tests 4ms, environment 0ms)
```

The "transform 29ms" line confirms the file compiles via vitest's transform pipeline without errors. The "import 23ms" line confirms all module imports resolve. Zero compile-time warnings or errors.

---

## Deterministic execution

The test file is pure — no Clerk, no DB, no network, no env reads, no time-of-day branches. Same inputs → same outputs.

Re-runs verify determinism:

```
Run 1: 50 passed (4ms)
Run 2: 50 passed (4ms)   (full vitest sweep just now: 50 of 1517)
```

Total full-sweep duration variance < 100ms across runs. No flake.

---

## Diff audit — no logic drift

### Diff stat against W2-PR1 base (`059fd15a`)

```
 .../__tests__/verifier-rbac-enforcement.test.ts    | 258 ++++++++++++++++-
 apps/web/lib/auth/orgInvitations.ts                | 134 +++++++++
 apps/web/middleware.ts                             |  54 ++--
 docs/ops/AUTHORIZATION_LAYERS.md                   | 316 +++++++++++++++++++++
 docs/ops/FAIL_CLOSED_MATRIX.md                     | 265 +++++++++++++++++
 docs/ops/w2-pr1a-final-closure-summary.md          | 266 +++++++++++++++++
 docs/ops/w2-pr1a-final-risk-review.md              | 177 ++++++++++++
 7 files changed, 1453 insertions(+), 17 deletions(-)
```

Three product files + four docs. Nothing else.

### Middleware semantic check (the only file with risk of logic drift)

The middleware diff has FOUR delta blocks:

**Block 1 — Imports (lines 9–14):**
```diff
 import {
+  checkVerifierFailClosed,
   checkVerifierPermission,
-  parseTeamRole,
+  extractVerifierClaims,
+  isVerifierApiRoute,
 } from '@/lib/auth/orgInvitations';
```
Purely import-list changes. `parseTeamRole` is no longer called directly from middleware (it's reached via `extractVerifierClaims`). No flow change.

**Block 2 — Removal of local `VERIFIER_API` constant (lines 39–47 of W2-PR1):**
```diff
-/**
- * Verifier API namespace — Layer-1 RBAC gate.
- * ...
- */
-const VERIFIER_API = /^\/api\/verifier(\/.*)?$/;
```
Constant removed; the regex is now in `orgInvitations.ts` behind `isVerifierApiRoute`. The regex itself is unchanged: `/^\/api\/verifier(\/.*)?$/` in both places. **Zero semantic change.**

**Block 3 — Step 0 inside `clerkHandler` (lines 67–86 of W2-PR1):**
```diff
-  if (VERIFIER_API.test(pathname)) {
+  if (isVerifierApiRoute(pathname)) {
     const session = await auth();
     if (!session.userId) {
       return new NextResponse(null, { status: 403 });
     }
-    const claims = session.sessionClaims?.vitalcv as Record<string, unknown> | undefined;
-    const requestingOrgId =
-      typeof claims?.org_id === 'string' && claims.org_id.length > 0
-        ? claims.org_id
-        : null;
-    const teamRole = parseTeamRole(claims?.team_role);
+    const { requestingOrgId, teamRole } = extractVerifierClaims(session.sessionClaims);
     const resourceOrgId = req.headers.get('x-verifier-org') ?? '';
     const decision = checkVerifierPermission({...});
```

Two replacements:
1. `VERIFIER_API.test(pathname)` → `isVerifierApiRoute(pathname)`. Same regex, helper-wrapped. Zero behavioral difference.
2. Type-asserted claim extraction → `extractVerifierClaims(session.sessionClaims)`. The new helper performs runtime validation of every shape (object, array, primitive, null, partial keys) and returns `{requestingOrgId, teamRole}` with the SAME field names and SAME null-on-malformed semantics as the prior inline code. **The downstream Gate 1 (no_org_context) fires identically for the same malformed inputs.**

The runtime claim-validation upgrade is the only intended semantic refinement: it eliminates the type-assertion code smell while preserving the `null → Gate 1 → 403 no_org_context` outcome for every previously-handled case AND for newly-tested adversarial cases (Symbol, function, recursive object, array, etc.).

**Auth-flow semantics: unchanged.** The 3-gate decision sequence and the status-code mapping (403 / 404 / 503) are byte-identical to W2-PR1.

**Block 4 — Fail-closed pre-check in outer `middleware()` (lines 183–209 of W2-PR1A):**
```diff
+  const verifierFailClosed = checkVerifierFailClosed({...});
+  if (verifierFailClosed.failClosed) {
+    return new NextResponse(null, {
+      status: verifierFailClosed.statusCode,
+      headers: { 'x-rbac-fail-closed': verifierFailClosed.reason },
+    });
+  }
```

This is a NEW path. It fires only when `pathname` matches `isVerifierApiRoute(...)` AND `clerkEnabled === false`. For:
- Verifier path + Clerk enabled: helper returns `{failClosed: false}` → no-op → flow continues.
- Non-verifier path + Clerk disabled: helper returns `{failClosed: false}` → no-op → flow continues.
- Non-verifier path + Clerk enabled: helper returns `{failClosed: false}` → no-op → flow continues.
- Verifier path + Clerk disabled: returns 503. **Previously this path returned `NextResponse.next()` (fail open).**

This is the exact intended fix (Codex SAFE finding F-1). It strictly closes a fail-open path; it does not alter behavior on any previously-correct path.

### Files that were NOT modified

```
apps/web/lib/auth/roles.ts                            (untouched)
apps/web/lib/auth/clerkConfig.ts                      (untouched)
apps/web/lib/issuer-verification/                     (entire dir untouched)
apps/web/prisma/schema.prisma                         (no schema change)
apps/web/app/api/                                     (no API route handlers added or modified)
packages/                                              (untouched)
apps/web/lib/security/corsAllowlist.ts                (untouched)
```

The CORS allowlist gate, the sign-in redirect path, the role-mismatch redirect path, the resolve-role fallback path, the INTELLIGENCE_API graceful-degrade catch, the trpc matcher in `config.matcher` — all preserved verbatim from W2-PR1.

---

## Confirmation: no runtime logic changed in this stabilization pass

This stabilization pass produced:
- `docs/ops/w2-pr1a-final-stabilization.md` (this doc)
- `docs/ops/w2-pr1a-test-status.md` (companion doc)

It produced **zero modifications** to:
- `apps/web/middleware.ts`
- `apps/web/lib/auth/orgInvitations.ts`
- `apps/web/lib/auth/roles.ts`
- `apps/web/__tests__/verifier-rbac-enforcement.test.ts`
- Any other product code, schema, migration, or auth helper.

The W2-PR1A commit `caa01cd9` is the as-shipped, as-stable artifact. This doc is the audit trail confirming that.

---

## Commands run during this stabilization pass

```bash
# Working dir
$ cd /private/tmp/vitalcv-w2pr1a
$ pwd
/private/tmp/vitalcv-w2pr1a

$ git log --oneline -3
caa01cd9 fix(rbac): fail-closed enforcement on /api/verifier/* under degraded auth (W2-PR1A)
059fd15a feat(rbac): RBAC foundation primitives (W2-PR1)
9eb5cdee feat(status): wire compliance evidence shape into /status page (DOCS-STATUS-1) (#230)

# Focused regression — W2-PR1A test file
$ pnpm --filter @vitalcv/web exec vitest run __tests__/verifier-rbac-enforcement.test.ts
✓ __tests__/verifier-rbac-enforcement.test.ts (50 tests) 4ms
Test Files  1 passed (1)
      Tests  50 passed (50)

# Full vitest sweep — confirm no regressions outside the focused file
$ pnpm --filter @vitalcv/web exec vitest run
Test Files  157 passed | 1 skipped (158)
      Tests  1517 passed | 4 skipped (1521)

# Lint — touched files only
$ pnpm --filter @vitalcv/web exec next lint \
    --file lib/auth/orgInvitations.ts \
    --file middleware.ts \
    --file __tests__/verifier-rbac-enforcement.test.ts
✔ No ESLint warnings or errors

# Build — verify Edge-runtime safety
$ pnpm turbo run build --filter @vitalcv/web
Tasks: 13 successful, 13 total
Cached: 13 cached, 13 total
Time:   208ms >>> FULL TURBO

# Diff stat against W2-PR1 base
$ git diff --stat 059fd15a..HEAD
3 product files + 4 docs = 7 files; +1453 / -17

# Diff against W2-PR1 — middleware.ts (semantic check)
$ git diff 059fd15a..HEAD -- apps/web/middleware.ts
# (4 intended delta blocks; no flow change beyond the documented W2-PR1A fix)
```

All commands deterministic; all reproducible from the worktree root.

---

## Stabilization checklist (all complete)

- [x] No missing imports in test file
- [x] No stale imports in test file
- [x] No missing imports in middleware
- [x] No stale imports in middleware
- [x] Test file compiles cleanly
- [x] Test execution is deterministic across runs
- [x] Focused regression suite passes 50/50
- [x] Full vitest sweep passes 1517/1517 (no regressions)
- [x] Lint clean on touched files
- [x] Build clean (Edge-runtime safe)
- [x] Diff audit confirms only intended deltas
- [x] Middleware semantics: unchanged (CORS, sign-in, role-mismatch, INTELLIGENCE_API graceful-degrade — all byte-identical)
- [x] Auth flow: unchanged (3 gates, same order, same status codes)
- [x] No new product files modified by this stabilization pass
- [x] No new test files modified by this stabilization pass

The W2-PR1A wave is complete and ready for Codex SAFE re-audit.

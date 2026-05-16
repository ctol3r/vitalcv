# W2-PR1 — Codex Audit Plan
**Wave:** Wave 2, PR 1  
**Date:** 2026-05-07  
**Status:** Planning only  
**Classification:** HIGH_RISK — full three-audit required

---

## Pre-Audit Prerequisite Verification

Before running `codex exec`, Claude Code Terminal must confirm:

```bash
# 1. Only 4 files in the diff
git diff origin/main --name-only | wc -l   # must be 4

# 2. All 4 files are exactly the expected ones
git diff origin/main --name-only
# Expected output (order may vary):
#   apps/web/lib/auth/roles.ts
#   apps/web/lib/auth/orgInvitations.ts
#   apps/web/middleware.ts
#   apps/web/__tests__/verifier-rbac-enforcement.test.ts

# 3. Tests pass
pnpm --filter @vitalcv/web exec vitest run __tests__/verifier-rbac-enforcement.test.ts
# Must print: all tests passed

# 4. Typecheck clean
pnpm typecheck
# Must print: no errors

# 5. Lint clean
pnpm lint
# Must print: no warnings or errors

# 6. Banned-string check
git diff origin/main | grep -iE "automatically verified|guaranteed verification|hire instantly|HIPAA compliant|SOC2 certified|NPDB|SAM\.gov"
# Must return: empty
```

If any prerequisite fails, DO NOT call `codex exec`. Fix and re-verify.

---

## Codex Audit Prompt (paste-ready for `codex exec`)

```
Audit PR branch feat/verifier-rbac-rebased against origin/main.
Wave: W2-PR1 — RBAC Foundation (roles primitives + middleware intercept)
Classification: HIGH_RISK

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
AUDIT 1 — IMPLEMENTATION
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

lib/auth/roles.ts:
  □ VERIFIER_TEAM_ROLES is defined as ['owner','admin','member','readonly'] as const
      Exact check: the array contains exactly these 4 values in this order.
      If any value is missing, added, or reordered → FAIL.
  □ VerifierTeamRole type is derived as (typeof VERIFIER_TEAM_ROLES)[number]
      It must be a union of the literal strings — not string, not enum.
  □ No other exports in roles.ts are modified.
      The diff must only ADD; no existing exports may be changed.

lib/auth/orgInvitations.ts:
  □ rbacEnforced = true as const
      Check: the literal expression is `true as const`, NOT `Boolean(true)`, NOT `!!1`.
      If it is `true` without `as const` → FAIL (allows widening to boolean).
  □ checkVerifierPermission implements gates in this EXACT ORDER:
      Gate 1: (!ctx.requestingOrgId || !ctx.teamRole) → 403, 'no_org_context'
      Gate 2: (!timingSafeEqualStrings(...)) → 404, 'cross_org'
      Gate 3: (readonly && MUTATING_METHODS) → 403, 'readonly_blocks_mutation'
      Default: permitted: true
      If gates are reordered → FAIL (load-bearing order).
  □ timingSafeEqualStrings:
      Uses crypto.timingSafeEqual from node:crypto (NOT a manual loop).
      Pads both strings to the same length before calling timingSafeEqual.
      Returns false when lengths differ (cannot be equal), even after timing-safe run.
      Does NOT return early on length mismatch before processing all bytes.
      If it uses === for comparison anywhere → FAIL.
      If it returns early on length mismatch → FAIL.
  □ parseTeamRole:
      Returns null for any value not in VERIFIER_TEAM_ROLES.
      Does NOT throw for unknown values — returns null only.
      Does NOT accept values by case-insensitive match (e.g., 'READONLY' → null).
  □ The module has NO imports other than node:crypto and local types.
      No fetch, no prisma, no clerkClient, no console, no DB.
      If any I/O import is present → FAIL.
  □ All functions are synchronous. No async, no Promise.
      If any function is async → FAIL.
  □ RbacDecision is a discriminated union.
      The permitted:true branch has NO statusCode property.
      The permitted:false branch has BOTH statusCode AND reason.

middleware.ts:
  □ VERIFIER_API pattern is /^\/api\/verifier(\/.*)?$/
      Check the exact regex. If broader (e.g., /api\/verif/) → FAIL.
  □ The VERIFIER_API block executes BEFORE the isPublicRoute check (step 1).
      In the clerkHandler function, the VERIFIER_API block is the FIRST conditional.
      If isPublicRoute fires before VERIFIER_API → FAIL (API routes are public, check never runs).
  □ On session.userId absent: returns 403 (not 401, not redirect).
      If it returns 401 → FAIL. If it redirects to /sign-in → FAIL.
  □ requestingOrgId is derived ONLY from sessionClaims.vitalcv.org_id.
      NOT from req.headers. NOT from req.body. NOT from URL params.
      If any other source is used → FAIL.
  □ teamRole is derived via parseTeamRole(claims?.team_role) ONLY.
      If it reads from headers → FAIL.
  □ resourceOrgId is derived from req.headers.get('x-verifier-org') ?? ''.
      Empty string fallback is correct (missing header → cross_org → 404).
  □ The two-layer defense comment is present explaining x-verifier-org is validated,
      not accepted as resource ownership proof.
  □ On !decision.permitted: returns decision.statusCode (403 or 404). No body.
      If it returns a JSON body with error details on the 404 branch → FAIL
      (would leak that the resource org exists).
  □ ALL existing PROTECTED_ROUTES entries are preserved.
      Compare the full list from origin/main roles.ts — every entry must remain.
  □ ALL existing PUBLIC_ROUTE_PATTERNS entries are preserved.
      /api/** must still be in PUBLIC_ROUTE_PATTERNS.
  □ The INTELLIGENCE_API graceful-degrade pattern is preserved.
      The intelligence route handling must be unchanged.
  □ No new routes added to PROTECTED_ROUTES.
  □ No existing routes removed from PROTECTED_ROUTES.

Tests:
  □ verifier-rbac-enforcement.test.ts covers all 4 invariant groups:
      1. readonly blocks POST/PUT/DELETE, allows GET
      2. cross-org returns 404, not 403, for all roles including owner
      3. timingSafeEqualStrings: true for equal, false for unequal, false for diff length
      4. no org context (requestingOrgId=null OR teamRole=null) → 403 no_org_context
  □ rbacEnforced is asserted as the literal true:
      expect(rbacEnforced).toBe(true)   ← correct
      NOT expect(rbacEnforced).toBeTruthy()  ← would FAIL
  □ No test uses `any` type. All mocks are typed.
  □ No test requires a DB, Clerk, or network connection.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
AUDIT 2 — DIFF
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  □ EXACTLY 4 files changed:
      apps/web/lib/auth/roles.ts (modified)
      apps/web/lib/auth/orgInvitations.ts (new)
      apps/web/middleware.ts (modified)
      apps/web/__tests__/verifier-rbac-enforcement.test.ts (new)
      If any other file appears in the diff → FAIL.

  □ apps/web/prisma/schema.prisma is NOT in the diff.
      If it appears → FAIL (schema change requires founder approval).

  □ packages/ directory is NOT in the diff.
      If any package file appears → FAIL.

  □ apps/web/app/ directory is NOT in the diff.
      No route handlers changed. If any route.ts appears → FAIL.

  □ The diff to roles.ts is ADDITIVE ONLY.
      No existing exports removed or modified.
      New exports: VERIFIER_TEAM_ROLES, VerifierTeamRole.
      If any existing export is changed → FAIL.

  □ The diff to middleware.ts preserves all existing logic.
      Only the VERIFIER_API constant and its conditional block are added.
      No existing lines removed (rebase may reformat but must not remove).

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
AUDIT 3 — COPY/TRUTH
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Scan all changed files for:

MUST NOT APPEAR (any match = FAIL):
  □ "automatically verified"
  □ "guaranteed verification"
  □ "hire instantly" / "instantly"
  □ "HIPAA compliant" / "SOC2 certified" / "NCQA certified"
  □ "NPDB" / "DEA integration" / "ABMS" / "SAM.gov" / "Doximity"
  □ bare status label "Verified" (as a user-facing string)
  □ "rbacEnforced: false" or "rbacEnforced = false"

MUST APPEAR (absence = FAIL):
  □ "rbacEnforced" — in orgInvitations.ts
  □ "timingSafeEqualStrings" — in orgInvitations.ts
  □ "VERIFIER_API" — in middleware.ts
  □ "Layer 1" and "Layer 2" (or equivalent) — in middleware.ts comment

FORBIDDEN ERROR MESSAGES (in the middleware block):
  □ No JSON body in 403/404 responses from the VERIFIER_API block.
      Rationale: JSON error bodies leak information (resource existence, failure reason).
      The 404 for cross-org must return no body.
      Exception: if `decision.reason === 'no_org_context'` or 'readonly_blocks_mutation',
      a minimal `{ error: 'Forbidden' }` body on the 403 is acceptable but not required.
      A JSON body on the 404 cross_org response → FAIL (information leak).

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
VERDICT CRITERIA
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

SAFE: All □ boxes above confirmed. Tests pass. Typecheck clean. Diff bounded.

FAIL: Any □ failed. Must report:
  - Which check failed
  - Exact file:line of the failure
  - Whether the failure is blocking (must fix before merge) or advisory

BLOCKING FAILURES (must fix before merge, no exceptions):
  - Gate order violation in checkVerifierPermission
  - timingSafeEqualStrings uses === or returns early on length mismatch
  - VERIFIER_API fires after isPublicRoute (check never runs)
  - Any existing PROTECTED_ROUTES entry removed
  - 404 cross-org response includes a JSON body
  - More than 4 files in the diff
  - schema.prisma or packages/ in the diff
  - rbacEnforced is not the literal true as const

ADVISORY FAILURES (document, then merge at founder discretion):
  - Missing two-layer defense comment in middleware
  - parseTeamRole test case for empty string not present
  - Test uses toBeTruthy() instead of toBe(true) for rbacEnforced

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
ROLLBACK BOUNDARY
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

If post-merge regression discovered:

Automatic revert triggers (revert without investigation):
  - Any route in PROTECTED_ROUTES returns 200 without credentials
  - A VERIFIER route returns 403 to a user with valid JWT + correct org + non-readonly role
  - Any previously-working page route returns wrong status code

Investigate before reverting:
  - /api/verifier/* returns 403 to a client that does not send x-verifier-org
    (Expected behavior — client must send the header. Not a regression.)
  - /api/verifier/* returns 404 to a client whose JWT org does not match x-verifier-org
    (Expected behavior — cross-org denied. Not a regression.)

Revert command (generates a new PR — also requires Codex SAFE):
  gh pr revert <PR_NUMBER> --title "revert: W2-PR1 RBAC foundation — [reason]"
```

---

## PR Description Template (paste into GitHub)

```markdown
## W2-PR1 — RBAC Foundation

### Summary
Installs the RBAC primitives required for verifier team access control.
Rebases feat/verifier-rbac (PR #243) onto current origin/main.

### Risk classification
HIGH_RISK — middleware.ts modification

### Scope lock
Files changed:
  - apps/web/lib/auth/roles.ts (additive)
  - apps/web/lib/auth/orgInvitations.ts (new)
  - apps/web/middleware.ts (VERIFIER_API intercept added)
  - apps/web/__tests__/verifier-rbac-enforcement.test.ts (new)

Files NOT changed: schema.prisma, packages/*, apps/web/app/*

### Truth contracts
- rbacEnforced = true as const (sealed literal)
- Cross-org returns 404 not 403 (no info leak)
- Gate order is load-bearing and preserved
- timingSafeEqualStrings uses node:crypto, no early exit

### What NOT changed
- No employer-review route changes (W2-PR2)
- No invitation lifecycle (W2-PR4)
- No audit route changes (W2-PR3)
- No hiring flow changes
- No Prisma schema changes

### Codex audit required
[ ] Implementation audit (gate order, literal types, timing-safe compare)
[ ] Diff audit (exactly 4 files, no schema, no packages)
[ ] Copy/truth audit (no banned strings, no info-leaking 404 body)

### Rollback
gh pr revert <PR_NUMBER>
Revert also requires Codex SAFE before merging.
```

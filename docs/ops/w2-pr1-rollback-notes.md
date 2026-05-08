# W2-PR1 — Rollback Notes

**Branch:** `wave/w2-pr1-rbac-foundation`
**Risk classification:** HIGH_RISK (middleware modification)
**Rollback complexity:** LOW — pure additive PR with zero data effects.

---

## When to revert

Revert this PR if **any** of the following happens after merge:

1. **Build regression on Edge runtime.** If Vercel build fails with an error citing `node:crypto`, `Buffer`, or any Node-only API in `middleware.ts` chain, revert immediately. (The implementation uses `TextEncoder` and Web-API XOR exactly to avoid this — but the revert path is the safe default if a different file accidentally pulls Node APIs into middleware.)

2. **A live `/api/verifier/*` route starts returning unexpected 403/404.** If W2-PR4 ships a verifier route between this PR's merge and a regression report, the gate may reveal a misconfigured Clerk JWT claim. Revert this PR to restore "no gate" while the JWT claim is fixed; re-land after.

3. **`isPublicRoute(pathname)` returns `true` for any `/api/verifier/*` path** in the future. This would mean someone added a verifier-path public-pattern after merge. Step 0 still fires first — but a code review oversight that broadens public exposure should be reverted, not patched.

4. **Cross-tenant leak surfaced via Layer-2.** If W2-PR4 ships verifier route handlers and a tenant-leak is reported, the handler — not this middleware — is the proximate fault. Revert THIS PR only if the route handler cannot be fixed forward and the gate must come down to restore the previous "no auth check, no route handlers" state.

5. **`pnpm typecheck` or `pnpm lint` regression** introduced by a downstream PR that depends on this one. Revert if and only if the dependency cannot be fix-forward'd.

---

## Do NOT revert for

- A failing test on a different surface unrelated to RBAC.
- A copy / wording change that conflicts with this branch.
- A founder-requested wording / comment update — fix forward in the doc, not the security path.
- A Codex audit comment requesting a doc clarification — update the doc, not the code.

The doctrine §6.4 + `openclaw-pr-scope-rules.md` Rule 9: **on security regressions, revert first, then root-cause.** Do not "fix forward" through a window of vulnerability.

---

## Rollback procedure — preferred (single command)

```bash
gh pr revert <PR-NUMBER> --title "revert: W2-PR1 RBAC foundation"
```

This generates a clean-revert PR. The revert PR must itself pass Codex SAFE before merge (per merge doctrine §6.1). The clean-revert is preferred over `git revert` because:
- It preserves git history clarity (the revert PR cites the original PR).
- It runs through the full CI gate (build + tests + Codex).
- It produces an audit-trailable artifact.

---

## Rollback procedure — manual fallback

If `gh pr revert` is unavailable or fails:

```bash
# 1. Identify the merge commit
gh pr view <PR-NUMBER> --json mergeCommit --jq '.mergeCommit.oid'
# Capture the SHA — call it $MERGE_SHA

# 2. From a fresh worktree off main
git fetch origin main
git worktree add -b revert/w2-pr1-rbac-foundation /tmp/vitalcv-revert-w2pr1 origin/main
cd /tmp/vitalcv-revert-w2pr1

# 3. Revert the merge commit
git revert $MERGE_SHA --no-edit

# 4. Verify the revert removes ALL four files
git diff HEAD~1 --stat
# Expected:
#   apps/web/lib/auth/orgInvitations.ts                | XX --
#   apps/web/lib/auth/roles.ts                         | XX --
#   apps/web/middleware.ts                             | XX --
#   apps/web/__tests__/verifier-rbac-enforcement.test.ts | XX --

# 5. Build + test verify the revert
pnpm install --frozen-lockfile
pnpm turbo run build --filter @vitalcv/web
pnpm --filter @vitalcv/web exec vitest run

# 6. Push + open revert PR
git push -u origin revert/w2-pr1-rbac-foundation
gh pr create \
  --title "revert: W2-PR1 RBAC foundation" \
  --body "Reverts PR #<PR-NUMBER>. Reason: <one-liner>. \
  Blast radius: removes the /api/verifier/* gate. No /api/verifier/* \
  route handlers exist on main today, so the only observable change is \
  that the gate is no longer armed. No data, schema, auth, or tenant \
  state is affected. See docs/ops/w2-pr1-rollback-notes.md."

# 7. After Codex SAFE on the revert PR:
gh pr merge --squash --delete-branch
```

---

## Blast radius on revert

### What changes

| Surface | Behavior change |
|---|---|
| `apps/web/lib/auth/roles.ts` | `VERIFIER_TEAM_ROLES` and `VerifierTeamRole` exports removed. **Breaking** for any importer — must be fix-forward'd at the same time. |
| `apps/web/lib/auth/orgInvitations.ts` | File removed entirely. Any downstream importer (route handler, test, other module) that landed AFTER this PR but BEFORE the revert will fail to compile. |
| `apps/web/middleware.ts` | `VERIFIER_API` constant removed; Step-0 block removed. Existing CORS / public-route / role-gate flow restored verbatim. |
| `apps/web/__tests__/verifier-rbac-enforcement.test.ts` | File removed; 26 test cases deleted. |
| `/api/verifier/*` paths | Lose the Step-0 gate. Today (no handlers exist), this is observationally irrelevant. **Caveat:** if W2-PR4 has merged before the revert, those route handlers lose their middleware-level RBAC and rely entirely on Layer-2 (handler) ownership checks. **In that case the revert is risky — a fix-forward on the security path may be safer.** |

### What does NOT change

- No data, schema, or persisted state is affected.
- No Clerk session, JWT claim, or org membership is affected.
- No CSP / CORS / security-header policy is affected.
- No audit-event row is touched.
- No tenant boundary in the application database is affected.

### Cascade risk

If any of the following PRs are merged BETWEEN this PR's merge and the revert, **the revert breaks them**:

1. **W2-PR2** (employer-review acceptance role check). If W2-PR2 imports `parseTeamRole` or `checkVerifierPermission`, reverting W2-PR1 breaks W2-PR2. Revert W2-PR2 first OR fix-forward.

2. **W2-PR3** (audit / hiring / PSV API guards). If W2-PR3 imports the helpers, same problem.

3. **W2-PR4** (verifier invitation lifecycle). Will definitely import.

4. **Any unplanned PR** that references `VERIFIER_TEAM_ROLES` from `roles.ts`.

**Pre-revert check:**

```bash
# Confirm no other PR is consuming the symbols this PR added
git grep -nE "VERIFIER_TEAM_ROLES|VerifierTeamRole|checkVerifierPermission|parseTeamRole|rbacEnforced|orgInvitations" apps packages 2>&1 | grep -v __tests__ | grep -v node_modules | grep -v dist | head -20
```

If the grep returns hits in production code (apps/, packages/, services/) outside the four files this PR adds, those are downstream consumers — they will break on revert. Before reverting, identify each consumer:

```bash
git log --oneline origin/main..HEAD -- apps/web/lib/auth/orgInvitations.ts apps/web/lib/auth/roles.ts apps/web/middleware.ts
```

Then either:
1. Revert downstream PRs first (in reverse-merge order), then this one.
2. Fix-forward by patching the downstream consumers to not depend on these symbols.

The plan-doc dependency tree (W2-PR1 → W2-PR2 → W2-PR3 → W2-PR4) suggests reverting in reverse order is straightforward; this is the pre-merge risk this rollback note flags.

---

## Edge-runtime-specific rollback considerations

The `timingSafeEqualStrings` implementation uses `TextEncoder` (Web API), which is stable in Edge. If the revert is required *because* of an Edge-runtime build failure unrelated to this code (e.g., a different file pulled `node:crypto`), this PR's revert won't fix the underlying problem — investigate the actual culprit first.

If a future change to `apps/web/lib/auth/orgInvitations.ts` introduces a Node-only API, the build will fail at deploy. Revert that change, not this PR.

---

## Verification after revert

After the revert PR merges:

```bash
# Confirm the four files are gone (or restored to origin/main shape)
git -C /Users/christoler/vitalcv ls-tree -r origin/main apps/web/lib/auth/ | grep -E "orgInvitations"
# Expected: no match

git -C /Users/christoler/vitalcv show origin/main:apps/web/lib/auth/roles.ts | grep -E "VERIFIER_TEAM_ROLES"
# Expected: no match

git -C /Users/christoler/vitalcv show origin/main:apps/web/middleware.ts | grep -E "VERIFIER_API"
# Expected: no match

# Confirm test count returns to baseline
pnpm --filter @vitalcv/web exec vitest run | tail -3
# Expected: tests = baseline - 26 (this PR adds 26 cases)
```

---

## Recovery — re-landing after revert

If the revert was tactical (e.g., a downstream W2-PR2 caused a regression and we needed clean ground), re-landing W2-PR1 is straightforward: cherry-pick the 4-file diff onto a fresh branch off the new `main`, re-run the audit, re-merge. The PR's content is small and additive; rebasing onto a moved `main` is mechanical (the only conflict surface is `middleware.ts` if someone touched it, and `roles.ts` if someone added new exports).

```bash
# Re-land procedure
git fetch origin main
git worktree add -b wave/w2-pr1-rbac-foundation-relanded /tmp/vitalcv-w2pr1-r2 origin/main
cd /tmp/vitalcv-w2pr1-r2
# Cherry-pick the original 4-file diff (or recreate from the docs)
# Run full verification
pnpm install --frozen-lockfile
pnpm turbo run build --filter @vitalcv/web
pnpm --filter @vitalcv/web exec vitest run __tests__/verifier-rbac-enforcement.test.ts
pnpm --filter @vitalcv/web exec next lint --file <four-touched-files>
# Re-open PR; re-run Codex audit
```

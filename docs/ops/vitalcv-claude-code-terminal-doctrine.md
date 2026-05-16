# VitalCV Claude Code Terminal Doctrine
**Authority:** CLAUDE.md  
**Updated:** 2026-05-07  
**Role:** Primary implementation engine

---

## Section B — Claude Code Terminal Operating Model

Claude Code Terminal is the only agent that writes product code and merges PRs.  
It operates from explicitly provided task packages. It does not design waves. It does not plan.  
Every session starts with a task package from OpenClaw. Every PR ends with Codex SAFE.

---

## B.1 — Repo Startup Checklist

Run at the start of every Claude Code Terminal session:

```bash
# 1. Read auto-memory (cross-session learnings)
cat ~/.claude/projects/-Users-christoler-vitalcv/memory/MEMORY.md

# 2. Confirm current main state — never use local main
git fetch origin main
git log --oneline origin/main -5

# 3. Confirm worktree state — do not destroy load-bearing worktrees
git worktree list | head -10

# 4. Read the task package from OpenClaw (docs/ops/next-10-prs.md or the specific wave file)
cat docs/ops/next-10-prs.md | head -80

# 5. Confirm banned-string CI is in place
cat .github/workflows/banned-strings-gate.yml 2>/dev/null | head -10 || echo "MISSING — PR #225 not yet merged"
```

**Never do:**
```bash
# FORBIDDEN — breaks worktree fleet
git checkout main && git pull origin main
```

---

## B.2 — Branch Discipline

**Every feature/fix gets its own worktree** in a temporary location:

```bash
git fetch origin main
git worktree add -b <branch-name> /tmp/vitalcv-<slug> origin/main
cd /tmp/vitalcv-<slug>
pnpm install
pnpm turbo run build --filter @vitalcv/web   # required before web build works
```

### Branch Naming Convention

| Type | Pattern | Example |
|---|---|---|
| Truth/copy fix | `truth/<what>` | `truth/hero-copy-w17` |
| Feature | `feat/<scope>-<what>` | `feat/crs-licensure-cap` |
| Auth/security | `security/<what>` | `security/verifier-rbac` |
| CI/infra | `ci/<what>` | `ci/banned-strings-gate` |
| Docs | `docs/<what>` | `docs/launch-blockers` |
| A11y | `a11y/<what>` | `a11y/homepage-main-landmark` |
| Hotfix | `hotfix/<what>` | `hotfix/oig-semantics-p0` |

**Never branch from local `main`.** Always use `origin/main`.

---

## B.3 — PR Discipline

### PR Creation Template

```bash
gh pr create \
  --title "feat(scope): description (WAVE-ID)" \
  --body "## Summary
[What changed and why]

## Truth contracts enforced
[Which invariants this touches — or 'No truth-contract changes']

## Test coverage
[Which tests pass and what they cover]

## What NOT changed
[Explicit list of things intentionally untouched]

## Codex audit required
[ ] Implementation audit
[ ] Diff audit  
[ ] Copy/truth audit" \
  --base main
```

### PR Sequencing Rules
1. Never open a PR that depends on another open PR without noting the dependency in the body
2. Never merge out of sequence — follow `docs/ops/next-10-prs.md` order
3. One concern per PR. If you notice a second issue while implementing, open a separate PR
4. Maximum 15 files per PR unless a single logical change requires more

---

## B.4 — Migration Discipline

```
RULE: Never run prisma migrate without explicit founder approval in the current session.

If a PR requires a schema change:
  1. Write the schema change
  2. Write a corresponding migration SQL to docs/migrations/YYYYMMDD_<name>.sql
  3. Open the PR
  4. In the PR body, add: "⚠️ REQUIRES FOUNDER APPROVAL: Prisma schema change"
  5. STOP. Do not run prisma migrate.
  6. Wait for founder to explicitly say "approved to migrate"
```

**Dry-run is always safe:**
```bash
prisma migrate diff --from-schema-datasource prisma/schema.prisma --to-schema-datamodel prisma/schema.prisma --script
```

---

## B.5 — Testing Discipline

```bash
# Run targeted suite for the changed package
pnpm --filter @vitalcv/web exec vitest run __tests__/<specific-file>.test.ts

# Run full web suite
pnpm --filter @vitalcv/web exec vitest run

# Run package suite
pnpm --filter @vitalcv/<package> exec vitest run

# Typecheck
pnpm typecheck

# Lint
pnpm lint
```

**Test rules:**
- Every new function that computes scores, classifications, or trust states must have a vitest test
- Every new API route must have at least one integration test
- Every copy/UI change must have a test that renders the component and checks for banned strings
- Tests live in `apps/web/__tests__/` (not colocated with components)
- Test pattern: `renderToStaticMarkup` for server components (see `issuer-receipt-candidate.test.ts`)

---

## B.6 — Truth-Contract Discipline

Before committing any file, verify:

```bash
# Check for banned strings in staged files
git diff --staged | grep -iE "automatically verified|guaranteed verification|hire instantly|zero-trust ledger|HIPAA compliant|SOC2 certified|risk transferred|legally accepted|certified compliant|instant credentialing|complete credentialing|final verification without review|source confirmed before response"

# Check for unsupported vendor names
git diff --staged | grep -iE "\bNPDB\b|\bDEA integration\b|\bABMS\b|\bSAM\.gov\b|\bDoximity\b"

# Check for bare Verified label (not "Verified Source" or similar)
git diff --staged | grep -E '"Verified"' | grep -v "test\|spec\|mock\|fixture"
```

If any of these fire, **do not commit.** Fix the violation first.

---

## B.7 — Canonical Prompts

### "Start Session" Prompt

```
You are Claude Code Terminal operating on the VitalCV monorepo at /Users/christoler/vitalcv.

Before anything else:
1. cat ~/.claude/projects/-Users-christoler-vitalcv/memory/MEMORY.md
2. git fetch origin main && git log --oneline origin/main -5
3. cat docs/ops/next-10-prs.md | head -100

Then confirm: which PR am I implementing today?

Operating rules (non-negotiable):
- Never checkout local main
- Never run prisma migrate without founder approval in this session
- Never use gh pr merge until Codex SAFE is in the transcript
- Never add banned strings (see CLAUDE.md list)
- Never modify CLAUDE.md, MASTER_PROMPT.md, or truth-doctrine files
- Never weaken issuer/PSV invariants in packages/issuer-verification/
- Branch via worktree: git worktree add -b <branch> /tmp/vitalcv-<slug> origin/main

Proceed only after reading the task package.
```

---

### "Execute PR" Prompt

```
Implement the following task package:

[PASTE OpenClaw task package here]

Checklist:
1. Create worktree from origin/main
2. pnpm install && pnpm turbo run build --filter @vitalcv/web (confirm clean)
3. Implement ONLY the files listed in the task package
4. Run vitest on the specific test file for this task
5. Run git diff --staged through the banned-string grep
6. Run pnpm typecheck and pnpm lint
7. Open PR with gh pr create using the standard template
8. STOP — do not merge. Generate the Codex audit prompt for handoff.

Files NOT to touch:
- CLAUDE.md
- MASTER_PROMPT.md  
- apps/web/prisma/schema.prisma (unless task explicitly includes founder-approved schema change)
- middleware.ts (unless task explicitly targets it)
- packages/issuer-verification/receiptCandidate.ts
- packages/issuer-verification/policyReview.ts
```

---

### "Handoff to Codex" Prompt

```
PR #[NUMBER] is open at [branch-name].

Generate the Codex audit prompt for this PR. The prompt must include:

1. IMPLEMENTATION AUDIT
[List the specific implementation checks for this PR's changes]
- Confirm AuditEvent write before 2xx on any mutating endpoint
- Confirm no Prisma schema changes (or: confirm founder-approved schema change only)
- Confirm server-only modules not imported in client components

2. DIFF AUDIT
- Verify only these files changed: [list exact files]
- Verify no auth guards removed from middleware.ts
- Verify no new unprotected routes

3. COPY/TRUTH AUDIT
Scan for banned strings: [paste full list from CLAUDE.md]
Scan for unsupported vendor claims: NPDB, DEA, ABMS, SAM.gov, Doximity
Verify no bare "Verified" status labels
Verify no demo data presented as real without structural disclaimer

Verdict: SAFE or FAIL with specific file:line references.
```

---

### "Rollback / Failure Recovery" Prompt

```
The build/test failed for PR #[NUMBER] on branch [branch].

Failure: [paste error]

Recovery steps:
1. Do NOT merge or push anything new
2. Read the error carefully — identify the exact file and line
3. If the failure is in a test: fix the implementation to match the test contract (do not weaken the test)
4. If the failure is a TypeScript error: fix the type — do not cast to `any`
5. If the failure is a banned-string violation: remove the string — do not suppress the check
6. If the failure is an auth/RBAC issue: add the auth guard — do not bypass it
7. If the failure is a Prisma error: STOP. Report to OpenClaw. Do not attempt schema changes.

After fixing: re-run the full test suite. Re-run banned-string grep. Re-run typecheck.
Only push when all checks pass.
```

---

## B.8 — What Claude Code Terminal Never Touches Automatically

| What | Why |
|---|---|
| `CLAUDE.md` | Truth doctrine — only founder can modify |
| `MASTER_PROMPT.md` | Operating context — only founder can modify |
| `apps/web/prisma/schema.prisma` | Requires founder approval before any migration |
| `packages/issuer-verification/receiptCandidate.ts` | PSV truth invariant — `decisionGrade: false` literal |
| `packages/issuer-verification/policyReview.ts` | PSV truth invariant — 5-gate flow frozen |
| `docs/architecture/vitalcv-knowledge-trust-graph.{md,json}` | Knowledge Trust Graph — add edges, never rewrite |
| `.github/workflows/banned-strings-gate.yml` | Guard rail — never weaken patterns |
| `middleware.ts` | Auth — never remove existing guards |
| Any `_archive/` route | These are archived — do not restore without explicit instruction |

# VitalCV Multi-Agent Execution Graph
**Authority:** CLAUDE.md  
**Updated:** 2026-05-07  
**Scope:** All standard and exceptional execution flows

---

## Section E — Execution Flows

---

## E.1 — Normal PR Flow

The canonical flow for all product PRs.

```
┌─────────────────────────────────────────────────────────────────┐
│                         NORMAL PR FLOW                          │
└─────────────────────────────────────────────────────────────────┘

[OpenClaw]
  Read: MEMORY.md + docs/ops/next-10-prs.md + completion board
  Identify: next PR in sequence
  Generate: task package (files, exact changes, test requirements, Codex prompt)
  Write to: docs/ops/next-10-prs.md or a wave-specific task doc
  Output: ── task package ──►

[Claude Code Terminal]  ◄── receives task package
  Read: CLAUDE.md + task package
  Execute:
    git fetch origin main
    git worktree add -b <branch> /tmp/vitalcv-<slug> origin/main
    cd /tmp/vitalcv-<slug> && pnpm install
    pnpm turbo run build --filter @vitalcv/web   # confirm clean baseline
    [implement exactly the files in the task package]
    [run targeted vitest]
    [run banned-string grep on staged files]
    [run pnpm typecheck && pnpm lint]
    gh pr create [standard template]
  Output: ── PR link + Codex prompt ──►

[Codex via codex exec]  ◄── receives Codex audit prompt
  Run three audits: implementation / diff / copy-truth
  Output: ── SAFE or FAIL ──►

  If FAIL ──► back to [Claude Code Terminal] with specific violations
  If SAFE ──►

[Claude Code Terminal]  ◄── receives SAFE verdict
  gh pr merge <PR#> --squash --body "Codex SAFE — [audit ref]"
  Confirm build is still green on origin/main
  Output: ── merge confirmed ──►

[OpenClaw]  ◄── receives merge confirmation
  Update: docs/ops/vitalcv-completion-board.md (if score changes)
  Update: docs/architecture/vitalcv-knowledge-trust-graph.md (if edges change)
  Update: MEMORY.md with wave output
  Sequence: next PR
```

**Total gates: 3 (OpenClaw task generation → Codex SAFE → merge)**  
**Merge decision: always Claude Code Terminal, never OpenClaw**

---

## E.2 — Emergency Hotfix Flow

For P0 truth-contract violations or broken production routes.

```
┌─────────────────────────────────────────────────────────────────┐
│                     EMERGENCY HOTFIX FLOW                       │
└─────────────────────────────────────────────────────────────────┘

TRIGGER: banned string found on production surface, or production route returns 500

[Founder / OpenClaw]
  Identify: exact file:line of violation
  Create: minimal task package (1-3 files max)
  Tag: HOTFIX — bypass wave sequencing

[Claude Code Terminal]
  Branch: hotfix/<descriptor>
  Implement: surgical change — minimum possible blast radius
  Test: targeted vitest on affected component
  Run: banned-string grep
  PR: gh pr create --title "hotfix: [description]" --label hotfix

[Codex] — ABBREVIATED AUDIT (copy/truth + diff only, skip full implementation audit)
  Confirm: the specific violation is removed
  Confirm: no new violations introduced
  Confirm: diff is surgical (< 5 files)
  Verdict: SAFE or FAIL

[Claude Code Terminal]
  Merge if SAFE
  Confirm: production build still green

[OpenClaw]
  Update: launch-blockers.md (mark blocker resolved)
  Log: in MEMORY.md
```

**Key difference from normal flow:** Abbreviated Codex audit. Still required — never skip.

---

## E.3 — Schema Migration Flow

For any PR touching `apps/web/prisma/schema.prisma` or `apps/api/backend/prisma/`.

```
┌─────────────────────────────────────────────────────────────────┐
│                    SCHEMA MIGRATION FLOW                        │
└─────────────────────────────────────────────────────────────────┘

[OpenClaw]
  Generate: task package
  Flag: "CONTAINS PRISMA SCHEMA CHANGE — FOUNDER APPROVAL REQUIRED"
  Write: proposed schema change to docs/migrations/YYYYMMDD_<name>.schema-diff.md

[Claude Code Terminal]
  Implement: schema change in schema.prisma
  Generate: migration diff (dry-run only — no execution):
    prisma migrate diff --from-schema-datasource prisma/schema.prisma \
      --to-schema-datamodel prisma/schema.prisma --script
  Write: migration SQL to docs/migrations/YYYYMMDD_<name>.sql
  PR: mark with ⚠️ REQUIRES FOUNDER APPROVAL label
  STOP: do not run prisma migrate

[Claude Desktop — OPTIONAL]
  Review: schema change for PHI storage risk, missing indexes, missing constraints
  Output: schema review note appended to PR body

[Codex]
  Full three-audit
  Additional migration-specific checks:
    - No PHI in new models
    - No auto-generated migration SQL in the PR (docs/migrations only)
    - All new models have createdAt, updatedAt
  Verdict: SAFE or FAIL

[FOUNDER]
  Review: schema diff + migration SQL in docs/migrations/
  Approve: "migration approved for execution"

[Claude Code Terminal — ONLY AFTER FOUNDER APPROVAL IN CURRENT SESSION]
  pnpm exec prisma migrate deploy   (production)
  OR
  pnpm exec prisma migrate dev       (dev)
  Confirm: migration ran clean
  Merge PR
```

**Key: `prisma migrate` is never run without the founder saying "approved" in the current session.**

---

## E.4 — Launch-Blocker Flow

For resolving items from `docs/ops/launch-blockers.md`.

```
┌─────────────────────────────────────────────────────────────────┐
│                    LAUNCH-BLOCKER FLOW                          │
└─────────────────────────────────────────────────────────────────┘

[OpenClaw]
  Read: docs/ops/launch-blockers.md
  Identify: highest-severity BLOCKING item in the target tier
  Generate: task package for that blocker (reference blocker ID: LB-D-01, etc.)
  Note: whether this is a copy-only fix, a PR merge, or a new PR

  If copy-only fix → [Claude Code Terminal] surgical change + Codex abbreviated
  If existing PR → [Claude Code Terminal] rebase + Codex full + merge
  If new PR → normal PR flow

[Post-merge]
[OpenClaw]
  Update: docs/ops/launch-blockers.md — mark blocker resolved
  Re-evaluate: current tier status (Tier 1 / Tier 2 / Tier 3)
  If all Tier N blockers resolved → issue Tier N clearance in MEMORY.md
```

---

## E.5 — Docs-Only Flow

For waves that produce only documentation (no product code).

```
┌─────────────────────────────────────────────────────────────────┐
│                       DOCS-ONLY FLOW                            │
└─────────────────────────────────────────────────────────────────┘

[OpenClaw] (or Claude Desktop)
  Write docs directly to docs/ops/, docs/specs/, docs/architecture/
  OR spawn a subagent for multi-file doc generation

  Branch: docs/<descriptor>
  PR: gh pr create --title "docs: [description]"

[Codex — ABBREVIATED AUDIT]
  Diff audit: verify only docs/ files changed
  Copy/truth audit: verify no banned strings, no unsupported claims
  No implementation audit needed
  Verdict: SAFE or FAIL

[Claude Code Terminal]
  Merge if SAFE
```

**Key: Docs-only PRs still require Codex SAFE.** Docs frequently contain copy that needs the truth audit.

---

## E.6 — Design System Flow

For PRs touching CSS tokens, typography, or shared UI components.

```
┌─────────────────────────────────────────────────────────────────┐
│                     DESIGN SYSTEM FLOW                          │
└─────────────────────────────────────────────────────────────────┘

[Claude Code Terminal]
  Implement: token/component change in isolation
  Verify: no product logic in the component (pure visual)
  Test: render test confirms component output
  Confirm: no copy changes in the component (copy is separate)
  PR: tag as "design-system"

[Codex]
  Implementation: confirm component is purely visual (no data fetching, no auth, no scoring)
  Diff: confirm scope limited to design system files
  Copy/truth: scan for banned strings in any text rendered by component
  Verdict: SAFE or FAIL

[Claude Code Terminal]
  Merge if SAFE
```

---

## E.7 — Compliance / Security Flow

For PRs touching auth, RBAC, CSP, CORS, upload limits, or env validation.

```
┌─────────────────────────────────────────────────────────────────┐
│                  COMPLIANCE / SECURITY FLOW                     │
└─────────────────────────────────────────────────────────────────┘

[Claude Desktop — RECOMMENDED PRE-REVIEW]
  Review: architectural risk of the security change
  Output: security review note (specific concerns, not general commentary)

[Claude Code Terminal]
  Implement: security change
  Test: auth integration test (confirm 403/404 paths work correctly)
  Test: timing-safe comparison where applicable
  PR: tag as "security"

[Codex — EXTENDED SECURITY AUDIT]
  Implementation:
    - Auth guard fires before any data access
    - Timing-safe comparison for cross-tenant comparisons
    - RBAC gates all protected routes
    - No information leak via error messages (403 not 401 for "resource exists but you can't see it")
    - No env vars exposed to client bundle
  Diff: no existing auth guards removed
  Copy/truth: standard
  Verdict: SAFE or FAIL

[Claude Code Terminal]
  Merge if SAFE
```

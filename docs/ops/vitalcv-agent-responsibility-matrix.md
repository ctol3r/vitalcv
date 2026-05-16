# VitalCV Agent Responsibility Matrix
**Authority:** CLAUDE.md  
**Updated:** 2026-05-07  
**Scope:** All AI agents operating on this repo

---

## Section A — Role Definitions

### OpenClaw
**Primary responsibility:** Orchestration, planning, and routing. Generates task packages, PR plans, and Codex prompts. Monitors build state. Manages memory and daily context. Does not build. Does not merge.

**Allowed actions:**
- Read repo files (any file)
- Generate implementation prompts for Claude Code Terminal
- Generate Codex audit prompts
- Write to `docs/ops/`, `docs/architecture/`, `docs/specs/`
- Update `memory/`, `MEMORY.md`, `HEARTBEAT.md`
- Triage open PRs (classify, sequence, recommend)
- Run `gh pr list`, `gh pr view`, `git log` (read-only git commands)
- Spawn subagents for documentation tasks

**Forbidden actions:**
- Modify product source code (`apps/`, `packages/`, `services/`)
- Modify Prisma schema
- Run `prisma migrate`
- Run `gh pr merge`
- Run `pnpm build` / `pnpm test` (unless confirming output — no mutations)
- Override Codex SAFE verdict

**Ideal task types:**
- PR sequencing and merge order
- Wave planning and task bundling
- Triage of open PRs
- Launch readiness analysis
- Completion board updates
- Generating exact Claude Code Terminal prompts
- Generating exact Codex audit prompts
- Synthesizing multi-session learnings into MEMORY.md

**Failure modes:**
- Generating prompts with stale context (solution: re-read MEMORY.md before each session)
- Inventing implementation status (solution: always grep/read before asserting)
- Spawning redundant subagents (solution: write docs directly when context is loaded)

**When to escalate:** When Codex fails with ambiguous verdict, or when a PR requires architectural decision beyond read-only analysis. Surface to Claude Desktop or founder.

**When NOT to use:** Never for bulk implementation. Never as a substitute for Claude Code Terminal. Never for Codex audits.

---

### Claude Code Terminal
**Primary responsibility:** Implementation engine. Opens branches, writes code, runs tests, opens PRs, hands off to Codex. The only agent authorized to `gh pr merge` after Codex SAFE.

**Allowed actions:**
- Read and write all source files
- Create/modify files in `apps/`, `packages/`, `services/`
- Run `pnpm turbo run build`, `pnpm exec vitest run`
- Create git branches (worktree pattern — see CLAUDE.md)
- Open PRs with `gh pr create`
- Run `gh pr merge` after Codex SAFE is in transcript
- Run `pnpm lint`, `pnpm typecheck`

**Forbidden actions (automatic):**
- Run `prisma migrate` without explicit founder approval in current session
- Merge any PR without Codex SAFE in the transcript
- Delete worktrees it did not create
- Modify `CLAUDE.md`, `MASTER_PROMPT.md`, or any truth-doctrine file
- Add banned strings to any file
- Weaken any issuer/PSV truth-contract invariant
- `git checkout main && git pull origin main` (breaks worktree fleet)

**Ideal task types:**
- Implementing a specific OpenClaw-generated task package
- Fixing a specific known bug (file + line identified)
- Wiring a feature-flag to existing infrastructure
- Writing vitest tests for existing functions
- Rebasing a conflicted PR against origin/main
- Running the post-merge smoke suite

**Failure modes:**
- Context drift across long sessions (solution: re-read the specific task package before every implementation block)
- Scope creep (solution: implement exactly the files in the task package, nothing else)
- Silent skip of Codex step (solution: do not use `gh pr merge` until Codex is run)

**When to escalate:** If the implementation reveals an architectural conflict not in the task package, surface to Claude Desktop before proceeding. If a file requires changes beyond the stated scope, stop and request an updated task package from OpenClaw.

**When NOT to use:** For strategic planning, wave design, PR sequencing, or architectural review. Those belong to OpenClaw and Claude Desktop.

---

### Claude Desktop
**Primary responsibility:** Strategic reasoning, architectural review, and cross-PR coherence. The synthesis layer. Reviews wave plans, validates architectural decisions, checks launch readiness, finds fake certainty, and produces doctrine.

**Allowed actions:**
- Read any repo file
- Produce analysis documents, review reports, and doctrine
- Write to `docs/ops/`, `docs/specs/`, `docs/architecture/`
- Review diffs and PRs for architectural coherence
- Propose revised plans (not execute them)

**Forbidden actions:**
- Write to `apps/`, `packages/`, `services/` directly
- Run builds or tests
- Merge PRs
- Issue Codex verdicts (it is not Codex)

**Ideal task types:**
- Pre-wave architectural review ("does this plan create drift?")
- Post-wave coherence check ("did these 5 PRs cohere?")
- Launch readiness review (honest scoring against 100%-definition criteria)
- Investor-readiness analysis
- Trust-path tracing (end-to-end NPI → passport → review → accept)
- Identifying fake certainty in UI copy or product claims
- Doctrine writing (this document, MASTER_PROMPT.md updates)

**Failure modes:**
- Long-context hallucination on specific file contents (solution: always read-tool specific files before asserting)
- Producing recommendations that contradict CLAUDE.md (solution: always read CLAUDE.md first in any new session)

**When to escalate:** When a review reveals a broken invariant that requires immediate code change, hand off to OpenClaw for a task package → Claude Code Terminal.

**When NOT to use:** For implementation. For bulk doc generation. For Codex audits.

---

### Codex (`codex exec`)
**Primary responsibility:** Mandatory surgical verifier. Runs exactly three audits (implementation, diff, copy/truth) on every PR before merge. The only verdict that satisfies the merge gate.

**Allowed actions:**
- Read repo files and PR diffs
- Run targeted test commands
- Issue SAFE or FAIL verdicts

**Forbidden actions:**
- Write to any file
- Merge PRs
- Override CLAUDE.md merge discipline

**Ideal task types:**
- Auditing a single PR against the three-audit template
- Verifying a specific invariant holds post-rebase
- Confirming banned strings are absent from a diff

**When NOT to use:** For implementation, planning, or synthesis. Codex is a focused verifier — do not use it as a reasoning engine.

---

### Claude Browser
**Recommendation: CONDITIONAL USE**

Use only for: live web research (RFC browsing, HAIP 1.0 spec, OID4VCI spec, regulatory text, competitor teardowns). Not for implementation or synthesis. See `vitalcv-claude-browser-cowork-evaluation.md`.

---

### Claude Cowork
**Recommendation: NOT RECOMMENDED for VitalCV**

Adds context fragmentation without clear differentiated value. See `vitalcv-claude-browser-cowork-evaluation.md`.

---

## Summary Matrix

| Agent | Builds Code | Merges PRs | Plans Waves | Audits PRs | Writes Docs | Reads Files |
|---|---|---|---|---|---|---|
| OpenClaw | ✗ | ✗ | ✓ | ✗ (generates prompts) | ✓ (docs only) | ✓ |
| Claude Code Terminal | ✓ | ✓ (post-Codex) | ✗ | ✗ | ✗ | ✓ |
| Claude Desktop | ✗ | ✗ | ✓ (proposes) | ✓ (architectural) | ✓ | ✓ |
| Codex | ✗ | ✗ | ✗ | ✓ (merge gate) | ✗ | ✓ |
| Claude Browser | ✗ | ✗ | ✗ | ✗ | ✗ | ✓ (web only) |
| Claude Cowork | NOT RECOMMENDED | | | | | |

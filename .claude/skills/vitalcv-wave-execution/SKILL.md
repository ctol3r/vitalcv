---
name: vitalcv-wave-execution
description: Executes VitalCV waves with Claude Desktop as supervisor, Claude Code Terminal as builder, Codex as independent verifier and merge gate, and Browser/Cowork as optional QA. OpenClaw and Claude Design are paused unless the user explicitly restores them.
---

# VitalCV Wave Execution

Reusable workflow for shipping a VitalCV wave (1–3 coherent PR buckets) end-to-end with merge protection and board accuracy.

Invoke this skill at the start of any wave/rescue/sprint that involves opening one or more PRs against `main`.

## Current default tool policy

This is the **active** tool policy. Read it before delegating to any role.

| Tool | Role | When to use |
|---|---|---|
| **Claude Desktop** | Supervisor / judgment / visual review | Owns the user-facing conversation, sets wave intent, makes judgment calls, reviews visual deltas in preview panes, supervises parallel sessions. |
| **Claude Code Terminal** | Builder / operator | Branch creation, file copying, test/build, PR creation. The only role allowed to push code, run `gh pr merge`, or modify the working tree. |
| **Codex** (`codex exec` v0.125+) | Independent verifier and merge gate | Mandatory three-pass audit (implementation / diff / copy) before any merge. Subagent stand-ins do NOT satisfy the merge hook. |
| **Browser** | Optional QA | Live preview / route / mobile QA against the Vercel preview URL. Skip when the change is invisible on the URL surface (server-only, types-only, lib-only). |
| **Cowork** | Optional QA | Copy QA, docs polish, stakeholder-readable synthesis. Skip when the PR is internal-only or has no user-facing copy changes. |
| **OpenClaw** | **PAUSED** | Do not invoke unless the user explicitly says "restore OpenClaw" or names it in the brief. The user / Claude Desktop / Claude Code Terminal handle the queue directly. OpenClaw is not the conductor, not the default, not preferred for any wave shape. |
| **Claude Design** | **PAUSED** | Do not invoke unless the user explicitly says "restore Claude Design" or names it in the brief. No required end-of-wave design bundle. Visual review, when needed, is handled by Claude Desktop. |

**Do not add optional tools just because they exist.** Each optional tool burns context; only invoke when its specific affordance materially affects the gate decision.

**Hard exclusion:** Browser, Cowork, (paused) OpenClaw, and (paused) Claude Design must not perform build/verify work. The merge-protection hook on `gh pr merge` requires a real `codex exec` SAFE verdict visible in the transcript — no other source counts.

## Workflow

### 1. Current queue/branch reality check

Before touching anything:

```bash
git fetch origin main
git log --oneline -5 origin/main                 # confirm tip
gh pr list --state open --limit 100 \
  --json number,title,headRefName,mergeStateStatus,isDraft,url \
  --jq 'sort_by(.number)|reverse|.[] | "#\(.number) | \(.title) | \(.headRefName) | \(.mergeStateStatus) | draft=\(.isDraft) | \(.url)"'
git worktree list                                # check fleet — never `git checkout main`
```

Stop the wave if:
- The intended branch already exists on origin and a parallel agent has it open as a PR.
- The triage report or task brief is older than the latest `origin/main` and may be stale.
- An identifying SHA in the brief no longer matches `origin/main`.

### 2. Build or patch branch

Always work in a fresh worktree off `origin/main` (never `git checkout main && git pull` — local main is held by the worktree fleet):

```bash
git fetch origin main
git worktree add -b <feature-branch> /tmp/vitalcv-<slug> origin/main
cd /tmp/vitalcv-<slug>
pnpm install --frozen-lockfile
```

When rescuing files from a dirty source tree, copy with `rsync -R` preserving paths and STOP if the candidate file list does not exactly match what the brief asked for. Never commit dirty-root wholesale and never run `git clean`.

If the brief's expected files turn out to already exist on `origin/main` with identical content, the rescue is a **no-op** — abort and report rather than open an empty/duplicate PR.

### 3. Test/build/truth scan

Targeted vitest first, then full build:

```bash
# Targeted suite for the PR scope
pnpm --filter @vitalcv/web exec vitest run __tests__/<scope-pattern>*.test.ts

# Full build through turbo (prebuilds @vitalcv/trust-state dist/)
pnpm turbo run build --filter @vitalcv/web

# Optional full suite if scope touches >5 files
pnpm --filter @vitalcv/web test
```

Truth-contract scan against the diff scope:

```bash
grep -RInE "automatically verified|guaranteed verification|complete credentialing|instant credentialing|legally accepted|risk transferred|HIPAA compliant|SOC2 certified|certified compliant|verified profile|source attestation" \
  apps/web/app apps/web/lib apps/web/__tests__ apps/web/components 2>/dev/null

# Also catch the bare label
grep -RInE "label:\s*['\"]Verified['\"]" apps/web/design-system 2>/dev/null
```

Allowed hits: negative/safety text, tests asserting banned strings are absent, the forbidden-language POLICY definition itself in `CLAUDE.md`. Anything else is a NEEDS FIX.

### 4. Open PR

```bash
git status --short
git diff --name-status origin/main...HEAD          # confirm scope is exactly the bucket
git add <ONLY in-scope files>                       # never `git add -A`
git commit -m "<type>(<scope>): <imperative summary>"
git push -u origin <feature-branch>

gh pr create --base main --head <feature-branch> \
  --title "<type>(<scope>): <summary>" \
  --body "$(cat <<'EOF'
## Summary
- one bullet per coherent change

## Truth rules
- explicit list of what is NOT being claimed (no verified-profile, no compliance certification, etc.)

## Validation
- targeted tests passing X/X
- pnpm turbo run build --filter @vitalcv/web: 13/13
EOF
)"
```

Then watch CI:

```bash
gh pr view <N> --json number,title,url,headRefOid,mergeStateStatus,mergeable,statusCheckRollup
gh pr checks <N> --watch --interval 25
```

If a check fails, read the failure log (`gh run view <id> --log-failed`), fix the smallest possible thing, push again. Do NOT broaden scope to "fix the test by changing the contract" — change the contract only when the brief says so.

### 5. Codex verification (mandatory before merge)

A `feature-dev:code-reviewer` subagent does NOT satisfy the merge hook. Use `codex exec` and produce three audits:

1. **Implementation audit** — does the diff actually implement the brief?
2. **Diff scope audit** — are any out-of-scope files included?
3. **Copy/truth audit** — does the diff respect the truth contract?

Each audit must end in a SAFE / NEEDS FIX verdict that appears in the visible transcript before the merge command runs.

### 6. Merge gate

Only after: (a) checks green/neutral/skipping, (b) Codex SAFE verdict in transcript, (c) explicit user approval if the wave brief did not pre-authorize merging.

```bash
gh pr merge <N> --squash --delete-branch \
  --subject "<type>(<scope>): <summary>"
```

Never use `--admin`, `--no-verify`, or force-push. If the hook blocks, investigate the root cause — do not bypass.

After merge:

```bash
git fetch origin main
git log --oneline -5 origin/main          # confirm squash commit landed
git grep -n "<key truth literal>" origin/main -- <touched file>   # spot-check evidence
```

### 7. Completion-board update only on merged evidence

Per BOARD-SCHEMA-3: scores move only after merge + verification. Update `docs/ops/vitalcv-completion-board.md` only when the merged PR has provided the evidence the row's `Detail / Action Per Area` column requires.

For each touched row:

```
| <Area> | <Current %> | <After Wave %> | <evidence ≤120 chars referencing PR # and SHA> | <emoji phase derived from After Wave %> |
```

Status emoji is **derived from** the percentage, never asserted independently. Never use qualitative words (`very low`, `near complete`, `partial`, etc.) in the Status cell.

## Rules (hard constraints)

- **No fake percentages.** Numbers move only after merge + verification. A PR open or in review is not a delta.
- **No placeholders.** Never write `Keep current`, `Need board lookup`, `Mixed baseline`, `TBD`, `N/A` in the board or any wave doc.
- **No phantom branches.** Don't reference branches that don't exist on `origin`. Verify with `gh pr list` and `git ls-remote origin` first.
- **No mixed-bucket rescue PRs.** One PR per coherent bucket. Reject diffs that include crypto + clinician + design-system together.
- **No `git checkout main && git pull`.** Local main is held by `/Users/christoler/vitalcv-omega4f-trigger`. Always work from a fresh `origin/main` worktree.
- **No `git clean` in rescue worktrees.** Never destroy untracked files; the user's other waves may depend on them.
- **One PR per coherent bucket.** A bucket is "all the work needed for one row family or one feature surface, no more."
- **Codex SAFE required before merge.** Subagent stand-ins do not satisfy the merge hook. Use `codex exec`.
- **Use exact board values from `docs/ops/vitalcv-completion-board.md`.** Never round, paraphrase, or "approximate" a row's `Current %`. Quote it character-for-character from the file on `origin/main`.
- **No product code in docs-only waves.** A wave declared as docs/skill/board/ops cannot include `apps/web/{app,lib,components}` source changes. If a docs PR needs a product change to land, split it into a separate product PR with its own gate.
- **No merge without `gh pr checks`.** The merge command must be preceded in the visible transcript by a `gh pr checks <N>` (or `gh pr view <N> --json statusCheckRollup`) call confirming green/neutral/skipping. No assumptions, no "checks were green earlier."
- **OpenClaw is paused.** Do not invoke OpenClaw — not as conductor, not as preferred-for-3-waves, not as state memory — unless the user explicitly says "restore OpenClaw" in the active brief.
- **Claude Design is paused.** Do not invoke Claude Design and do not include a "Claude Design end-of-wave bundle" in any wave summary. Visual review, when needed, is handled by Claude Desktop. Do not restore unless the user explicitly says "restore Claude Design" in the active brief.
- **Truth contract is non-negotiable.** Banned strings from `CLAUDE.md` may not appear in product code or product copy. Tests asserting their absence are encouraged.
- **No status label may be the bare word `Verified`.** Use `Source-verified`, `Source-backed`, etc.

## Standard command snippets

PR queue + check inspection:

```bash
gh pr list --state open --limit 100 --json number,title,headRefName,mergeStateStatus,isDraft,url
gh pr view <N> --json number,title,url,headRefName,headRefOid,baseRefName,mergeStateStatus,mergeable,statusCheckRollup
gh pr checks <N>
gh pr checks <N> --watch --interval 25
gh run view <run-id> --log-failed
```

Worktree creation + cleanup:

```bash
git worktree add -b <branch> /tmp/vitalcv-<slug> origin/main
git worktree list
git worktree remove /tmp/vitalcv-<slug>
git worktree prune
```

Build + test invocations:

```bash
pnpm install --frozen-lockfile
pnpm --filter @vitalcv/web exec vitest run __tests__/<file>.test.ts
pnpm --filter @vitalcv/web test                                 # full suite
pnpm turbo run build --filter @vitalcv/web                      # canonical web build
pnpm typecheck
pnpm lint
```

Truth/overclaim scans:

```bash
grep -RInE "automatically verified|guaranteed verification|complete credentialing|instant credentialing|legally accepted|risk transferred|HIPAA compliant|SOC2 certified|certified compliant|final verification without review|source confirmed before response" \
  apps/web/app apps/web/lib apps/web/__tests__ apps/web/components 2>/dev/null

grep -RInE "label:\s*['\"]Verified['\"]" apps/web/design-system 2>/dev/null

grep -RInE "Keep current|Need board lookup|Mixed baseline|TBD|N/A" docs 2>/dev/null
```

Diff/scope verification:

```bash
git diff --name-status origin/main...HEAD
git diff --stat origin/main...HEAD
git log --oneline origin/main..HEAD
```

Merge (only after Codex SAFE + green checks):

```bash
gh pr merge <N> --squash --delete-branch \
  --subject "<type>(<scope>): <summary>"
```

## 3-wave-per-request operating pattern

When a single user request bundles multiple waves (the most common shape), execute them as three sequential lanes within the same conversation. Each lane must complete its own gate before the next starts.

### Lane structure

| Lane | Purpose | Allowed work | Forbidden work |
|---|---|---|---|
| **Lane 1: Gate the current PR** | Watch CI, run Codex, merge if SAFE — close out whatever PR is in flight from the prior turn. | `gh pr checks --watch`, fix smallest possible regression, push, request `codex exec`, then `gh pr merge`. | Opening a new branch. Touching files outside the in-flight PR. Inflating the board. |
| **Lane 2: Build the next narrow PR** | Open the next coherent bucket from the queue. One PR, one bucket, one branch. | Fresh `origin/main` worktree, copy in-scope files only, targeted vitest, full build, truth scan, push, open PR. | Mixed-bucket rescues. Speculative refactors. Touching the board before merge. |
| **Lane 3: Prepare the following PR or tooling/cleanup** | Stage the next bucket OR ship a non-product PR (skill, doc, board update, completion board delta after a merge). | New worktree for next bucket; or a docs/skill/ops PR; or worktree pruning; or board update for a row whose evidence merged in Lane 1. | Starting a third product PR in the same turn. Bypassing Codex on the Lane-1 merge to free up time. |

### Order of operations within a 3-wave turn

1. **Inspect first.** `git fetch origin main`, `gh pr list`, `git worktree list`. Establish the queue truth before any worktree creation.
2. **Lane 1 first, always.** Never start a new branch while a prior PR is mid-flight. Either gate it through to merge, or explicitly mark it `WAITING FOR CODEX` and proceed.
3. **Lane 2 only after Lane 1 is unblocked.** Lane 1 may be unblocked by either: merge, Codex SAFE awaiting user approval, or `WAITING FOR CHECKS` with no fixable failures.
4. **Lane 3 only after Lane 2 has a PR open.** Lane 3 can run in parallel with Lane 2's CI watch (it does not push to the same branch).
5. **Single end-of-turn report.** One summary table covering all three lanes. Never report Lane 1 separately and then forget to mention Lane 2's CI state.

### Anti-patterns to refuse

- **Lane drift.** Lane 2 work creeping into Lane 1's PR scope (e.g. "while I'm here, also fix this other thing"). Reject — open a separate PR.
- **Lane skipping.** Starting Lane 3 before Lane 2 has a PR open. Reject — Lane 3 depends on Lane 2 being committed.
- **Lane stacking.** Two product PRs in Lane 2 + Lane 3 of the same turn. Lane 3 must be tooling/docs/cleanup, not a second product slice.
- **Gate bypass.** Skipping Lane 1's Codex/merge to "save time for Lane 2." Reject — the merge gate is non-negotiable; better to ship one clean PR than three half-gated ones.
- **Stale brief execution.** Acting on a triage report that predates `origin/main`. Re-validate file lists against the current `origin/main` SHA before copying anything.

### Compact 3-lane end-of-turn report

| Lane | PR # | Branch | State | Verdict | Next action |
|---|---|---|---|---|---|
| 1 | `<N>` | `<branch>` | merged / waiting Codex / waiting checks / NEEDS FIX | one of `MERGED` / `READY FOR MERGE` / `WAITING FOR CHECKS` / `NEEDS FIX` | what unblocks it |
| 2 | `<N>` | `<branch>` | open, CI \<state\> | `READY FOR CODEX VERIFY` / `WAITING FOR CHECKS` / `NEEDS FIX` | what unblocks it |
| 3 | `<N>` or N/A | `<branch>` or "tooling/cleanup" | open / N/A | `READY FOR CODEX VERIFY` / `STAGED` / `N/A` | what unblocks it |

## Failure modes to refuse

- **Stale-snapshot trap.** Triage report says "rescue file X" but X is byte-identical to `origin/main` already. Abort and report no-op; do not open an empty PR.
- **Destructive rewrite framed as rescue.** A "rescue" diff that deletes more lines than it adds, or strips schema enforcement (e.g. board normalization rules). Reject and ask for cherry-picked row updates instead.
- **Vendor-gated row inflation.** A row claiming Government ID / IAL2 / native iOS without the corresponding vendor contract or app shell. Score stays at the foundation tier (max 25–30) until vendor evidence lands.
- **Bare-Verified label.** `label: 'Verified'` in any badge component. Required fix: change to a compound label like `Source-verified` that does not match the bare-word ban.
- **Mixed-bucket diff.** Crypto + issuer + clinician changes in one PR. Split into separate buckets and ask for re-triage.
- **Merge attempted without Codex SAFE.** The hook will block; do not attempt to bypass. Report the blocker and request a `codex exec` run.

## Output format for the user

End every wave with a compact summary table:

| Item | Result |
|------|--------|
| Diff scope | `<paths>` only |
| Targeted tests | X/X passing |
| Build | 13/13 |
| Truth scan | CLEAN / N hits (listed) |
| CI | green / pending / failed (which) |
| Codex SAFE | YES / MISSING |
| PR link | `https://github.com/ctol3r/vitalcv/pull/<N>` |
| Verdict | `READY FOR CODEX VERIFY` / `READY FOR MERGE` / `NEEDS FIX` |

If the verdict is anything other than `READY FOR MERGE`, list the specific blockers and the smallest next action that resolves each one.

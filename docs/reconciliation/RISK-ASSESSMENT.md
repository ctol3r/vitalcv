# System Risk Assessment
**Audit Date:** 2026-04-22
**Auditor:** Claude Cowork (VitalCV Master Operator)

---

## Final Verdict

```
⚠️  FRAGMENTED
```

**The canonical repo is intact and self-contained for development.** However, there are
specific fragmentation vectors that must be resolved before the system can be considered
fully clean. None of these are active production blockers, but they introduce risk at
maintainability, onboarding, and agent-execution boundaries.

---

## Risk Dimension Analysis

### 1. COMPLETENESS RISK — MEDIUM

| Check | Result | Risk |
|---|---|---|
| All core packages in repo? | ✅ 35 packages present | — |
| All apps in repo? | ✅ 8 apps present | — |
| Apps with source code? | ⚠️ `router` has only node_modules, no package.json or src | LOW |
| Mobile app built? | ⚠️ `apps/mobile` has scaffolding but Wave Wallet spec incomplete | LOW |
| Blockchain present? | ✅ `blockchain/substrate/` exists | — |
| `backend/` external dump absorbed? | ❌ `~/backend/` (1.1 GB) not absorbed — may contain unique BATCH-era decisions | MEDIUM |
| Loose root .md files | ✅ Only 1 remains (`CONSOLIDATION-AUDIT-2026-04-20.md`) — others cleaned | — |
| 9 undocumented packages | ⚠️ MASTER_PROMPT doesn't document `command-registry`, `conflict-resolution`, `domain`, `domain-authority`, `domain-provider`, `idempotency`, `shared`, `source-adapters`, `trust-contract`, `truth-enforcement` | LOW |

### 2. COHERENCE RISK — LOW-MEDIUM

| Check | Result | Risk |
|---|---|---|
| Conflicting source versions? | Not confirmed — worktrees are git-managed snapshots, not independent forks | LOW |
| Schema divergence? | `~/substrate/` vs `blockchain/substrate/` — diff not confirmed | LOW-MEDIUM |
| Parallel implementations? | `vitalcv-backend/` is pre-monorepo dump — likely fully superseded | LOW |
| MASTER_PROMPT drift | MASTER_PROMPT says mobile is empty (false), doesn't list 9 packages | MEDIUM |

**Key coherence risk:** The MASTER_PROMPT — which drives all AI agent behavior — contains two confirmed inaccuracies. Agents operating from this context will make wrong assumptions about `apps/mobile/` and about the package surface.

### 3. REPRODUCIBILITY RISK — LOW

| Check | Result | Risk |
|---|---|---|
| New developer clone viability | `pnpm install && pnpm build` should work from canonical repo | LOW |
| External dependencies on non-repo dirs? | No confirmed hidden deps on external worktrees | LOW |
| Environment configs captured? | `.env` not in repo (correct per HIPAA posture) — env vars documented in MASTER_PROMPT | — |
| Agent prompts in repo? | ✅ OpenClaw prompts in `docs/specs/` | LOW |

### 4. SECURITY RISK — LOW

| Check | Result | Risk |
|---|---|---|
| `.env` files outside repo? | Not confirmed — not scanned for secrets | UNKNOWN |
| PHI in external directories? | All external dirs are git worktrees of same repo — same PHI policy applies | LOW |
| Secrets in BATCH docs? | `~/backend/` and `~/vitalcv-backend/` BATCH docs may contain API keys or env examples | LOW-MEDIUM |

### 5. GIT HYGIENE RISK — HIGH

| Check | Result | Risk |
|---|---|---|
| Worktree count | 79 prunable worktrees | HIGH (disk + mental overhead) |
| Codex worktrees accumulating | 36 detached HEAD worktrees in `.codex/` | HIGH (grows each Codex run) |
| Git metadata bloat | `.git/worktrees/` contains 79 stale entries | MEDIUM |
| Recovery complexity | Correcting mistakenly-removed worktrees is complex | MEDIUM |

---

## Top 5 Immediate Actions

### P0 — URGENT
**1. Prune Codex worktrees regularly**
These accumulate on every Codex agent run and are never auto-cleaned. Run from `~/vitalcv/`:
```bash
git worktree prune --verbose --dry-run  # verify first
git worktree prune --verbose            # then execute
```
This removes the 36 `.codex/worktrees/` entries and 3 `/tmp/` entries automatically
(their directories are already gone). Does NOT touch the named `vitalcv-*` worktrees.

**2. Update MASTER_PROMPT with correct state**
Two confirmed inaccuracies in MASTER_PROMPT that affect all AI agent behavior:
- `apps/mobile/` is NOT empty — correct to: "Has wave-121 role contract and service scaffolding"
- 9 undocumented packages — add `command-registry`, `conflict-resolution`, `domain`, `domain-authority`, `domain-provider`, `idempotency`, `shared`, `source-adapters`, `trust-contract`, `truth-enforcement`

### P1 — THIS WEEK
**3. Review and remove named worktrees**
All 35 named `vitalcv-*` worktrees are prunable. Before removing:
- Confirm no active development happening in any of them
- For each branch, verify it's been merged to main or is truly abandoned
- Then: `git worktree remove /Users/christoler/vitalcv-[name]`
Or if you just want the directory references cleaned: `git worktree prune` (for detached/gone ones only)

**4. Diff `~/substrate/` against `~/vitalcv/blockchain/substrate/`**
Confirm whether the standalone substrate directory is identical, older, or newer than the
in-repo version. Command:
```bash
diff -rq ~/substrate/ ~/vitalcv/blockchain/substrate/ --exclude=node_modules --exclude=target
```
If identical or the repo version is newer → archive `~/substrate/` to `~/christoler/_archive/`.

**5. Copy prior audit into repo**
```bash
cp ~/christoler/VITALCV-CONSOLIDATION-AUDIT-2026-04-20.md \
   ~/vitalcv/docs/reconciliation/CONSOLIDATION-AUDIT-2026-04-20.md
```

### P2 — BACKLOG
**6. Add `package.json` to `apps/router/`**
Currently only has `node_modules/`. Either scaffold properly or remove from `apps/`.

**7. Assess `~/vitalcv-backend/` and `~/backend/`**
These are the only non-worktree, non-independent-repo directories with potential unique content.
The BATCH_xxx docs may contain implementation decisions worth archiving.

---

## Risk Summary

| Dimension | Level |
|---|---|
| Completeness | 🟡 MEDIUM |
| Coherence | 🟡 LOW-MEDIUM |
| Reproducibility | 🟢 LOW |
| Security | 🟡 LOW-MEDIUM (unconfirmed) |
| Git Hygiene | 🔴 HIGH |
| **Overall** | **⚠️ FRAGMENTED** |

---

## What Would Change This to CLEAN

1. ✅ `git worktree prune` executed — removes 39+ stale worktrees
2. ✅ Named worktrees confirmed merged/abandoned and removed
3. ✅ MASTER_PROMPT corrected (mobile state, package list)
4. ✅ `~/substrate/` vs `blockchain/substrate/` confirmed and archived
5. ✅ `~/backend/` and `~/vitalcv-backend/` assessed and archived or confirmed superseded
6. ✅ `apps/router/` given a `package.json` or removed
7. ✅ 9 undocumented packages documented in MASTER_PROMPT

**Estimated effort to reach CLEAN:** 2–4 hours. Mostly `git worktree` commands and MASTER_PROMPT edits.

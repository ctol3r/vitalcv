# VitalCV Reconciliation Audit — Index
**Audit Dates:** 2026-04-20 (prior) + 2026-04-22 (this audit)
**Auditor:** Claude Cowork (VitalCV Master Operator)
**Triggered by:** `/vitalcvtask-bundler` — full-system reconciliation

---

## System Risk Verdict

```
⚠️  FRAGMENTED  (not CRITICAL — development is safe, but hygiene is poor)
```

The canonical repo at `~/christoler/vitalcv` is intact and self-contained.
The "fragmentation" is almost entirely 79 prunable git worktrees — not true code scatter.
However, MASTER_PROMPT contains inaccuracies, and non-worktree legacy dumps need assessment.

---

## Output Files

| File | Contents |
|---|---|
| `README.md` | This index |
| `PRIOR-AUDIT-SUMMARY.md` | Summary of 2026-04-20 audit + what changed since |
| `CANONICAL-INVENTORY.md` | Full inventory of the canonical repo (apps, packages, services, gaps) |
| `CLASSIFICATION-TABLE.md` | Every external directory classified with action |
| `RISK-ASSESSMENT.md` | Full risk analysis + top 5 immediate actions |

---

## Top 5 Immediate Actions

| Priority | Action | Command / File |
|---|---|---|
| **P0** | Prune Codex worktrees | `cd ~/vitalcv && git worktree prune --verbose` |
| **P0** | Fix MASTER_PROMPT mobile claim | Edit `MASTER_PROMPT.md` — `apps/mobile/` is NOT empty |
| **P0** | Add 9 undocumented packages to MASTER_PROMPT | `command-registry`, `conflict-resolution`, `domain`, `domain-authority`, `domain-provider`, `idempotency`, `shared`, `source-adapters`, `trust-contract`, `truth-enforcement` |
| **P1** | Confirm + remove named worktrees | `git worktree list --porcelain` then `git worktree remove` per branch |
| **P1** | Diff standalone substrate vs repo | `diff -rq ~/substrate/ ~/vitalcv/blockchain/substrate/ --exclude=node_modules` |

---

## Key Discoveries (New Since Prior Audit)

1. **The external `vitalcv-*` dirs are git worktrees, not clones** — confirmed again; do not `mv` or `rm -rf`
2. **36 Codex worktrees** accumulating in `~/.codex/worktrees/` — new since prior audit; `git worktree prune` cleans these
3. **`apps/mobile/` is NOT empty** — has wave-121 role contract, `src/services/`, `app.json`. MASTER_PROMPT is wrong.
4. **35 packages exist** — MASTER_PROMPT documents 26. 9 are undocumented (`command-registry`, `conflict-resolution`, `domain`, `domain-authority`, `domain-provider`, `idempotency`, `shared`, `source-adapters`, `trust-contract`, `truth-enforcement`)
5. **Only 1 loose file remains at ~/christoler/ root** — prior cleanup worked; just `VITALCV-CONSOLIDATION-AUDIT-2026-04-20.md` remains
6. **Current branch changed** — was `feat/acceptance-graph-learning-clean`, now `feature/apply-with-vcv-core-loop`
7. **80 total registered worktrees** — 79 prunable; this is the dominant "fragmentation" signal

---

## What Is Genuinely Outside the Repo (Non-Worktrees)

| Item | Type | Risk |
|---|---|---|
| `~/backend/` (1.1 GB) | Legacy pre-monorepo dump | MEDIUM — may have unique BATCH-era decisions |
| `~/vitalcv-backend/` | BATCH docs, no git | LOW — likely superseded |
| `~/substrate/` | Substrate scaffolding | LOW-MEDIUM — diff needed |
| `claw-code/` | OpenClaw Rust agent | LOW — intentionally separate |
| `chai-vc-platform/` | Independent repo | None — different product |
| `v0-vital-cv-frontend-mvp/` | Independent repo | None — legacy MVP |
| `vitalcv-ai-sandbox/` | Independent repo | None — experiment sandbox |
| `vitalcv-venv/` | Python venv | None — delete when done |
| `_trash-2026-04-20/` | Prior consolidation trash | LOW — confirm then delete |

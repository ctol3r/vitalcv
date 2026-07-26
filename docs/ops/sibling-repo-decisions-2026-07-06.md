# M0-5 — Sibling-Repo Consolidation Decision Pass

**Date:** 2026-07-06
**Finding that reframes the audit:** Of ~38 `~/vitalcv-*` directories, **34 are
git worktrees of THIS monorepo** (they hold a `.git` *file* pointing back to
`~/vitalcv/.git`), already inventoried in M0-4. Only **4** are genuinely
separate on-disk artifacts. The historical "15+ sibling repos" concern is mostly
worktree sprawl, not divergent codebases.

## Genuinely-separate artifacts (not worktrees)

| Dir | What it is | Size | Decision | Rationale |
|---|---|---|---|---|
| `~/vitalcv-ai-sandbox` | Independent GitHub repo `ctol3r/vitalcv-ai-sandbox` — Vite/React prototype (Gemini service, prototype ClinicianPassport / EmployerReviewDashboard / SharePacketModal), 25 files, last commit **2026-03-31** | small | **ARCHIVED** | Early UI prototype, superseded by `apps/web`. Uses Gemini (not the monorepo stack). No unique production logic. README-stamp + GitHub archive. |
| `~/vitalcv-backend` | Plain dir, **no git**, 737 MB, has `package.json`/`prisma`/`src`/`tests`/`node_modules` | 737 MB | **OWNER REVIEW → likely ABSORBED** | Un-versioned backend snapshot — the one real risk. Diff `src/` + `prisma/` against `apps/api/backend` before deleting; extract anything unique, then delete. 737 MB (mostly `node_modules`) reclaimable. |
| `~/vitalcv-web` | Plain dir, no git, 56 KB — only `app/` + `styles/trust.css` | 56 KB | **DELETE (absorbed)** | Trivial fragment; `trust.css` lineage already lives in `apps/web`. Confirm then remove. |
| `~/vitalcv-venv` | Python virtualenv (`bin/include/lib`), not code | 51 MB | **DELETE (regenerable)** | Not source. Recreate from requirements if ever needed. |

## Everything else (34 dirs)

All are worktrees of `~/vitalcv/.git` → governed by the M0-4 inventory
(`docs/ops/repo-inventory-2026-07-06.md`). Includes `vitalcv-omega4f-trigger`
(holds local `main` per CLAUDE.md — **do not touch**) and the Codex fleet.

## Recommended owner actions (NOT executed — home-dir deletions are irreversible)

```bash
# 1. Preserve anything unique in the un-versioned backend snapshot FIRST
diff -qr ~/vitalcv-backend/src ~/vitalcv/apps/api/backend/src | grep -v node_modules
diff -qr ~/vitalcv-backend/prisma ~/vitalcv/apps/api/backend/prisma
# 2. After confirming no unique work:
#    rm -rf ~/vitalcv-web ~/vitalcv-venv
#    (archive ai-sandbox on GitHub; rm -rf ~/vitalcv-ai-sandbox local clone)
#    (rm -rf ~/vitalcv-backend once diffed clean)
```

## Why not executed here

These live in the user's home directory, outside the repo, and deletion is
irreversible. `vitalcv-backend` (737 MB, un-versioned) could contain unique work;
deleting it blind would violate the "look before you delete" rule. Canonical code
lives in `~/vitalcv` (this monorepo) — that conclusion is now unambiguous.

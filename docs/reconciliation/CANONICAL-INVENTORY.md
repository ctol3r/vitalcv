# Canonical Repo Inventory
**Repo:** `/Users/christoler/vitalcv`
**Branch:** `feature/apply-with-vcv-core-loop`
**Audit Date:** 2026-04-22

---

## Applications (`apps/`)

| App | package.json | Has Files | Notes |
|---|---|---|---|
| `web` | ✅ | ✅ | Next.js 15 / React 19 — active production app |
| `api` | ✅ | ✅ | Express + Prisma — active production API |
| `marketing` | ✅ | ✅ | Public site — ⚠️ P0: CTA routes to dead `/clinician` page |
| `mobile` | ✅ | ✅ | **NOT EMPTY** — has `src/services/`, `app.json`, ROLE.md (Wave-121). MASTER_PROMPT is incorrect in calling this empty. Contains role contract, service scaffolding, and theme. |
| `issuer-api` | ✅ | ✅ | Credential issuance service |
| `verifier-api` | ✅ | ✅ | OID4VP verifier |
| `admin-api` | ✅ | ✅ | Admin tooling |
| `router` | ❌ | ✅ (node_modules only) | ⚠️ Missing `package.json` — has `node_modules` but no source or manifest |

### apps/mobile — Actual State
- `ROLE.md` — wave-121 role contract (mobile is entry point + readiness monitor only)
- `VALIDATION.md` — wave validation
- `src/services/` — service scaffolding exists
- `theme.ts` — design token file
- `package.json`, `app.json`, `babel.config.js`, `tsconfig.json`, `vitest.config.ts`

**Conclusion:** Mobile is scaffolded, not empty. Wave Wallet spec may be partially implemented.

---

## Packages (`packages/`) — 35 total

### In MASTER_PROMPT (26 documented)
| Package | Status |
|---|---|
| `audit` | ✅ Present |
| `audit-receipts` | ✅ Present |
| `claims` | ✅ Present |
| `crs` | ✅ Present |
| `domain-common` | ✅ Present |
| `domain-core` | ✅ Present |
| `domain-events` | ✅ Present |
| `domain-identity` | ✅ Present |
| `embed-sdk` | ✅ Present |
| `graph-core` | ✅ Present |
| `haip-config` | ✅ Present |
| `ingest` | ✅ Present |
| `issuer-sdk` | ✅ Present |
| `poe-engine` | ✅ Present |
| `psv` | ✅ Present |
| `psv-adapters` | ✅ Present |
| `rate-limiter` | ✅ Present |
| `runtime-mode` | ✅ Present |
| `sdk` | ✅ Present |
| `tracing` | ✅ Present |
| `trust-state` | ✅ Present |
| `vc-formats-csdjwt` | ✅ Present |
| `verifier-sdk` | ✅ Present |
| `vitalindex` | ✅ Present |
| `wallet-sdk` | ✅ Present |

### NOT in MASTER_PROMPT (9 undocumented packages)
| Package | Notes |
|---|---|
| `command-registry` | ⚠️ Undocumented — likely command dispatch system |
| `conflict-resolution` | ⚠️ Undocumented — likely trust conflict handling |
| `domain` | ⚠️ Undocumented — possible domain root or barrel package |
| `domain-authority` | ⚠️ Undocumented — authority domain primitives |
| `domain-provider` | ⚠️ Undocumented — provider domain primitives |
| `idempotency` | ⚠️ Undocumented — idempotency middleware/helpers |
| `shared` | ⚠️ Undocumented — likely shared utilities |
| `source-adapters` | ⚠️ Undocumented — possibly replaces/extends `psv-adapters` |
| `trust-contract` | ⚠️ Undocumented — trust contract types |
| `truth-enforcement` | ⚠️ Undocumented — truth enforcement engine |

**Action required:** MASTER_PROMPT needs updating to document these 9 packages.

---

## Services (`services/`)
| Service | Present |
|---|---|
| `decision-engine` | ✅ |
| `investigator-engine` | ✅ |

---

## Blockchain (`blockchain/`)
| Item | Present |
|---|---|
| `README.md` | ✅ |
| `substrate/` | ✅ |

Separate standalone `~/christoler/substrate/` exists outside repo — version drift vs repo version unconfirmed (see GAP analysis).

---

## Documentation (`docs/`)
Rich structure present. Key directories:
- `docs/specs/` — 14 canonical spec files ✅
- `docs/canon/`, `docs/audits/`, `docs/archive/`, `docs/adr/`, `docs/architecture/`
- `docs/yc/`, `docs/yc-snapshots/` — YC positioning materials
- `docs/trust-protocol/`, `docs/security/`, `docs/compliance-scaffolding.md`
- Root-level `.md` files in `docs/`: ~50+ named documents

---

## Root-Level Markdown Files
Key files present at `~/vitalcv/`:
- `ANTIGRAVITY.md` ✅
- `MASTER_PROMPT.md` ✅ (but has 9 undocumented packages, wrong mobile state)
- `CONTRACTORS.md` ✅
- `WAVE180.md` ✅
- `WAVE_TASK.md` ✅
- `CLAUDE_CODE_ACCELERATOR.md` ✅
- `CONSOLIDATION_STATUS.md` ✅
- `MIGRATION_SOURCE_INTEGRATION.md` ✅
- `PROMPTS-CLARITY-MARKET-SEO.md` ✅
- `VITALCV-BILLION-DOLLAR-WAVE-BUNDLE.md` ✅
- `README.md` ✅
- `SKILL.md` ✅

---

## Gaps vs MASTER_PROMPT

| Claim in MASTER_PROMPT | Actual State |
|---|---|
| `apps/mobile/` is empty | ❌ FALSE — has scaffolding, ROLE.md, src/services/ |
| 26 packages documented | ❌ FALSE — 35 packages exist; 9 undocumented |
| `router` app status unknown | ✅ Confirmed — no package.json, only node_modules |
| Current branch was `feat/acceptance-graph-learning-clean` (per prior audit) | Changed — now `feature/apply-with-vcv-core-loop` |

---

## Worktree Summary

**Total registered worktrees:** 80 (including main)

| Type | Count | Location Pattern | All Prunable? |
|---|---|---|---|
| Main repo | 1 | `/Users/christoler/vitalcv` | N/A |
| Named feature worktrees | 35 | `/Users/christoler/vitalcv-*` | ✅ Yes |
| Codex agent worktrees | 36 | `~/.codex/worktrees/*/vitalcv` | ✅ Yes |
| /tmp worktrees | 3 | `/private/tmp/vitalcv-*` | ✅ Yes |
| Hidden `.worktrees/` | 4 | `.worktrees/`, `.claude/worktrees/` | ✅ Yes |
| **Total prunable** | **79** | — | ✅ All |

**Safe cleanup command (run from ~/vitalcv/):**
```bash
git worktree prune --verbose
```
This removes all references to worktrees whose directories are gone or detached.
For active named worktrees still on disk, use `git worktree remove <path>` first.

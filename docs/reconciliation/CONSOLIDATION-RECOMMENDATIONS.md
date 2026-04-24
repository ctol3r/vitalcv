# Consolidation Recommendations
**Audit Date:** 2026-04-22
**Status:** READY FOR HUMAN REVIEW — do not execute without sign-off

---

## Quick Summary

| Action Type | Count | Effort |
|---|---|---|
| `git worktree prune` (auto-safe) | 39 worktrees removed | 30 seconds |
| Named worktree removal | 35 worktrees | 10–30 minutes |
| Substrate DID pallet absorption | 1 pallet + tests | 1–2 hours (chain team) |
| Archive pre-monorepo dumps | 3 directories | 10 minutes |
| MASTER_PROMPT corrections | 2 inaccuracies | ✅ DONE |

---

## ACTION 1 — Prune Stale Worktrees (SAFE, run now)

These worktrees' filesystem paths are either gone or detached. `git worktree prune` removes
only the stale git metadata — it cannot damage anything.

```bash
cd ~/vitalcv

# Step 1: Dry-run to see what will be pruned
git worktree prune --verbose --dry-run

# Step 2: Execute
git worktree prune --verbose
```

**Expected result:** Removes ~39 entries:
- 36 Codex worktrees (`~/.codex/worktrees/*/vitalcv`)
- 3 /tmp worktrees (`/private/tmp/vitalcv-*`)

The 35 named `vitalcv-*` worktrees in `~/christoler/` will NOT be pruned by this
(they still exist on disk) — handle those in Action 2.

---

## ACTION 2 — Remove Named Worktrees (REVIEW FIRST)

Before removing, verify no active work is happening in these branches. For each:

```bash
cd ~/vitalcv

# Check each branch — is it merged into main?
git log --oneline main..feat/autonomous-execution-engine | head -5
# If output is empty → branch is merged → safe to remove worktree

# Remove all 35 named worktrees (one-liner — ONLY run after reviewing above)
for wt in \
  vitalcv-autonomous-execution \
  vitalcv-ci-lane-stability \
  vitalcv-consolidation-2 \
  vitalcv-continuous-verification \
  vitalcv-control-plane \
  vitalcv-conversion-distribution \
  vitalcv-decision-engine \
  vitalcv-defensibility-moat \
  vitalcv-distribution-integration \
  vitalcv-engineering-discipline \
  vitalcv-engineering-discipline-2 \
  vitalcv-gtm-revenue \
  vitalcv-hybrid-loader \
  vitalcv-market-domination \
  vitalcv-marketplace \
  vitalcv-network-effect \
  vitalcv-omega4f-trigger \
  vitalcv-passport \
  vitalcv-pilot-intake-clean \
  vitalcv-pilot-launch-workspace \
  vitalcv-pr85-verify \
  vitalcv-pr87-verify \
  vitalcv-revenue-conversion \
  vitalcv-runtime-stability \
  vitalcv-security-hardening \
  vitalcv-system-1 \
  vitalcv-system-closure \
  vitalcv-time-to-start-engine \
  vitalcv-trustgraph-explorer \
  vitalcv-usage-activation \
  vitalcv-wallet \
  vitalcv-wave13 \
  vitalcv-wave14 \
  vitalcv-wedge-truth \
  vitalcv-widget; do
  echo "Removing: ~/christoler/$wt"
  git worktree remove ~/christoler/$wt --force
done

# Prune any remaining stale refs
git worktree prune --verbose
```

⚠️ `--force` removes the worktree even if it has uncommitted changes. Since all are
marked `prunable` (no unique commits ahead of tracked branches), this is safe — but
confirm with the dry-run first.

---

## ACTION 3 — Absorb Substrate DID Pallet (CHAIN TEAM REQUIRED)

The standalone `~/substrate/` contains a `pallet-did` that is NOT in the canonical repo.
This should be reviewed by whoever owns the blockchain integration.

```bash
# Step 1: Review the DID pallet implementation
cat ~/substrate/pallets/did/src/lib.rs | head -80

# Step 2: If confirmed unique and needed, copy into canonical
cp -r ~/substrate/pallets/did/ ~/vitalcv/blockchain/substrate/pallets/did/

# Step 3: Copy test infrastructure into credential pallet
cp ~/substrate/pallets/credential/src/benchmarking.rs \
   ~/vitalcv/blockchain/substrate/pallets/credential/src/
cp ~/substrate/pallets/credential/src/mock.rs \
   ~/vitalcv/blockchain/substrate/pallets/credential/src/
cp ~/substrate/pallets/credential/src/tests.rs \
   ~/vitalcv/blockchain/substrate/pallets/credential/src/
cp ~/substrate/pallets/credential/src/weights.rs \
   ~/vitalcv/blockchain/substrate/pallets/credential/src/

# Step 4: Copy examples (non-production, reference only)
cp -r ~/substrate/node-example/ ~/vitalcv/blockchain/substrate/node-example/
cp -r ~/substrate/runtime-example/ ~/vitalcv/blockchain/substrate/runtime-example/

# Step 5: Build to verify (Rust)
cd ~/vitalcv/blockchain/substrate
cargo build 2>&1 | tail -20

# Step 6: Only after verified — archive standalone
mv ~/substrate/ ~/christoler/_archive/pre-monorepo/substrate-$(date +%Y-%m-%d)/
```

**Why the DID pallet matters:** The VitalCV architecture binds NPI → DID → trust chain.
If `pallet-did` isn't in the runtime, the on-chain DID anchoring is incomplete.
Check whether `pallets/identity-binding/` already covers this before absorbing.

---

## ACTION 4 — Archive Pre-Monorepo Dumps

These are NOT worktrees — they can be moved with standard filesystem commands.

```bash
# Create archive directory
mkdir -p ~/christoler/_archive/pre-monorepo/

# Archive backend/ (1.1 GB — takes a moment)
# FIRST: verify nothing references this path actively
mv ~/christoler/backend/ ~/christoler/_archive/pre-monorepo/backend-$(date +%Y-%m-%d)/

# Archive vitalcv-backend/ (BATCH docs only)
mv ~/christoler/vitalcv-backend/ ~/christoler/_archive/pre-monorepo/vitalcv-backend-$(date +%Y-%m-%d)/

# Copy prior audit into repo (keep original in place)
cp ~/christoler/VITALCV-CONSOLIDATION-AUDIT-2026-04-20.md \
   ~/vitalcv/docs/reconciliation/CONSOLIDATION-AUDIT-2026-04-20.md
```

---

## ACTION 5 — OID4VP Routes from backend/ (ENGINEERING DECISION)

Before archiving `~/backend/`, review whether these OID4VP routes are already in
`apps/verifier-api/` or need to be absorbed:

```bash
# Check what's in verifier-api
ls ~/vitalcv/apps/verifier-api/src/routes/ 2>/dev/null

# Review the presentation session route in backend/
cat ~/christoler/backend/apps/api/src/routes/oidc4vp/session.ts
cat ~/christoler/backend/apps/api/src/routes/oidc4vp/presentation-request.ts

# If these routes are missing from verifier-api, copy them:
# cp ~/christoler/backend/apps/api/src/routes/oidc4vp/*.ts \
#    ~/vitalcv/apps/verifier-api/src/routes/oidc4vp/
# (then run: pnpm --filter @vitalcv/verifier-api build to verify)
```

---

## ACTION 6 — Fix apps/router (OPTIONAL — LOW RISK)

```bash
# Check what's in router/
ls ~/vitalcv/apps/router/

# Option A: scaffold a minimal package.json
cd ~/vitalcv/apps/router
cat > package.json << 'EOF'
{
  "name": "@vitalcv/router",
  "version": "0.0.1",
  "private": true,
  "description": "Internal routing service"
}
EOF

# Option B: remove it if truly unused
# git rm -r apps/router/
```

---

## MOVE LIST (exact copy-paste paths)

| Source | Destination | Type | Safe Now? |
|---|---|---|---|
| `~/substrate/pallets/did/` | `~/vitalcv/blockchain/substrate/pallets/did/` | COPY | After chain team review |
| `~/substrate/pallets/credential/src/benchmarking.rs` | `~/vitalcv/blockchain/substrate/pallets/credential/src/` | COPY | After chain team review |
| `~/substrate/pallets/credential/src/mock.rs` | same | COPY | After chain team review |
| `~/substrate/pallets/credential/src/tests.rs` | same | COPY | After chain team review |
| `~/substrate/pallets/credential/src/weights.rs` | same | COPY | After chain team review |
| `~/christoler/VITALCV-CONSOLIDATION-AUDIT-2026-04-20.md` | `~/vitalcv/docs/reconciliation/` | COPY | ✅ Yes |

## ARCHIVE LIST

| Source | Archive Destination | Safe Now? |
|---|---|---|
| `~/christoler/backend/` (1.1 GB) | `~/christoler/_archive/pre-monorepo/backend-YYYY-MM-DD/` | After verifier-api OID4VP review |
| `~/christoler/vitalcv-backend/` | `~/christoler/_archive/pre-monorepo/vitalcv-backend-YYYY-MM-DD/` | ✅ Yes — docs only |
| `~/substrate/` | `~/christoler/_archive/pre-monorepo/substrate-YYYY-MM-DD/` | After absorption |
| `~/christoler/_trash-2026-04-20/` | permanent deletion | After confirming prior audit completeness |

## DELETE CANDIDATES (REQUIRE HUMAN CONFIRMATION)

| Item | Reason | Confirm Before Deleting |
|---|---|---|
| `~/christoler/vitalcv-venv/` | Python venv — not needed in repo | Check if any scripts reference it |
| Named worktrees (35) | All prunable per git | Confirm no active work |
| Codex worktrees (36) | All detached HEAD | `git worktree prune` handles automatically |

## IGNORE LIST (leave permanently in place)

| Item | Reason |
|---|---|
| `~/christoler/claw-code/` | Independent OpenClaw Rust agent — separate project |
| `~/christoler/chai-vc-platform/` | Independent repo, different GitHub remote |
| `~/christoler/v0-vital-cv-frontend-mvp/` | Independent repo, legacy MVP |
| `~/christoler/vitalcv-ai-sandbox/` | Independent sandbox repo |
| `~/christoler/go/`, `gstack/`, `nerve/`, `mythos-router/` | Unrelated projects |

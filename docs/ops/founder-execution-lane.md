# Founder Execution Lane

Deterministic flows for the operator. Minimal, executable, no
process theater.

Each flow is a sequence of shell commands you can paste and run.
Every command is idempotent or explicitly safe to re-run.

## 1. Start repo

```
git clone git@github.com:ctol3r/vitalcv.git
cd vitalcv
pnpm install --frozen-lockfile
```

## 2. Verify repo

```
pnpm verify:operational-health
```

This single command runs:
- `verify:reality`           (worktrees + branches + lockfile + tsc + workspace packages)
- `verify:stack`             (stack ancestry + cherry-pick + empty-diff)
- `verify:codex-ready`       (branch + remote + lockfile + uncommitted)

Exits 0 when all gates pass. Exits non-zero with a deterministic
list of failures otherwise.

## 3. Run local demo

```
# Workspace prebuild (required once per fresh clone):
pnpm turbo run build --filter @vitalcv/trust-state

# Start web dev server on :3030 (canonical runtime guard):
pnpm --filter @vitalcv/web dev

# Optional: prisma client regen if the schema changed:
cd apps/web && pnpm exec prisma generate
```

The dev server enforces the canonical runtime assertion. If your env
is missing `RECEIPT_PRIVATE_KEY_JWK` it falls back to an ephemeral
keypair (dev only); production deployments must pin the key.

## 4. Open Cloudflare tunnel

```
# Pin the issuer host so .well-known/* documents render the tunnel host:
export VCV_ISSUER_HOST="<random-name>.trycloudflare.com"

# In a second terminal:
cloudflared tunnel --url http://localhost:3030

# Verify discovery surfaces:
curl -i https://${VCV_ISSUER_HOST}/.well-known/did.json | jq '.id, .verificationMethod[0].publicKeyJwk.crv'
#  "did:web:<tunnel>"
#  "Ed25519"

curl -i https://${VCV_ISSUER_HOST}/.well-known/openid-credential-issuer | jq '.credential_issuer'
#  "https://<tunnel>"
```

Without `VCV_ISSUER_HOST`, the route falls back to `X-Forwarded-Host`
(which trycloudflare sets) and then `Host`. Pinning the env is the
robust path.

## 5. Run Codex audit

For each session PR (after the operator confirms the diff is final):

```
# Generate the Codex context packet:
pnpm generate:codex-context <branch>  > /tmp/codex-context.md

# Paste /tmp/codex-context.md into the Codex prompt alongside the PR diff,
# then issue:
#   codex exec audit implementation
#   codex exec audit diff
#   codex exec audit copy
#
# Three SAFE verdicts → merge-eligible.
```

The Codex packet enumerates ancestry / inherited / added / absent
capabilities so Codex cannot be tricked into approving a claim that
sits on a parallel branch.

## 6. Verify stack integrity

```
pnpm verify:stack
```

Reports declared-base mismatches, empty-diff stacked branches, and
cherry-pick source presence. Run before merging any stacked PR.

## 7. Prep pilot demo

```
# 1. Confirm the discovery probe works:
curl -fs https://${VCV_ISSUER_HOST}/.well-known/did.json | jq '.id'

# 2. Resolve a known NPI through the public hook:
curl -fs "https://${VCV_ISSUER_HOST}/api/resolve-npi?npi=1346053246" | jq .

# 3. Print the deployment kit for the cohort:
open "https://${VCV_ISSUER_HOST}/pilot/deployment-kit/cedar-q2-26"
#  (use the browser's print dialog → Save as PDF)

# 4. Walk the interoperability rehearsal:
open "https://${VCV_ISSUER_HOST}/interoperability/exchange/exch_cedar_q2_26_01"

# 5. Open the stacked provenance ledger for an example receipt:
open "https://${VCV_ISSUER_HOST}/trust/panes/<receipt-id>"

# 6. Final operator gate before live audience:
pnpm verify:operational-health
```

Steps 3 / 4 / 5 require their respective PRs (#387, #395, #385) to be
merged. Pre-merge, run them inside the PR's worktree by setting
`VCV_ISSUER_HOST` to the local tunnel + visiting the URL on the dev
server.

## What this lane does NOT cover

- **Production deployment.** Vercel / DNS / env management lives in
  `docs/deployment/` (separate operator runbook).
- **Real federation handshakes.** The pilot demo is read-only.
- **Wallet UX.** Out of scope for this session.

## Operator anti-patterns

- Do NOT `git checkout main` from `~/vitalcv-omega4f-trigger` --
  local main is held by that worktree (see
  `docs/ops/worktree-governance.md`).
- Do NOT skip the `pnpm verify:operational-health` step before
  asking Codex for SAFE. The script is fast and catches the easy
  failures.
- Do NOT paste a Codex context packet from one branch into a Codex
  prompt for another branch. The packets are branch-specific.

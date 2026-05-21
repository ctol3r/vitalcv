# Founder Release Lane

Midnight-usable release workflow for one operator. Paste, run, ship.

This doc is the END-TO-END release sequence. Other docs explain WHY;
this doc tells you WHAT to run. Cross-reference:

- `docs/ops/canonical-release-graph.md` (this PR) -- which PR, which class
- `docs/ops/release-batching-guide.md` (this PR) -- batch boundaries
- `docs/ops/merge-risk-taxonomy.md` (this PR) -- class meanings

## Pre-flight (once per release session)

```
# Sync local with origin
cd ~/vitalcv-omega4f-trigger || cd /Users/$(whoami)/vitalcv-omega4f-trigger
git fetch origin
git checkout main
git pull --ff-only

# Install + workspace prebuild + repair confirmation
pnpm install --frozen-lockfile
pnpm turbo run build --filter @vitalcv/trust-state
pnpm verify:operational-health          # from PR #397 (if present on main)
pnpm verify:ci-convergence              # from PR #398 (if present on main)
```

If either verify command fails, stop and resolve before merging
anything.

## Per-PR merge loop

Repeat the four steps below for each PR in the canonical release
graph order:

```
PR=<number>                              # e.g. 382
BRANCH=$(gh pr view "$PR" --json headRefName --jq .headRefName)

# 1. Verify stack integrity for this PR's branch
pnpm verify:stack                        # from PR #396 (if present)
pnpm generate:codex-context "$BRANCH" > /tmp/codex-context.md   # from PR #396

# 2. Run Codex audit on the PR (paste /tmp/codex-context.md into the prompt)
#    codex exec audit implementation
#    codex exec audit diff
#    codex exec audit copy

# 3. Merge with rebase (Codex SAFE recorded on all three audits)
gh pr merge --rebase "$PR"

# 4. Verify main is healthy after the merge
git checkout main && git pull --ff-only
pnpm install --frozen-lockfile
pnpm verify:post-merge                   # this PR's new dispatcher
```

If `verify:post-merge` fails, STOP. Do NOT proceed to the next PR
until you understand what broke and either:
- revert the merge (preferred), or
- ship a follow-up PR fixing the regression before merging the next.

## Class-specific extra steps

### PROTOCOL_RISK PRs (#384, #392, #393)

After step 4:

```
# Probe the live deployment if available:
TUNNEL=${VCV_ISSUER_HOST:-vitalcv.com}
curl -fs "https://${TUNNEL}/.well-known/did.json" | jq '.id, .verificationMethod[0].publicKeyJwk.crv'
curl -fs "https://${TUNNEL}/.well-known/openid-credential-issuer" | jq '.credential_issuer'
```

Expected shape:
- `did.json` `.id` matches `did:web:${TUNNEL}`
- `did.json` `.verificationMethod[0].publicKeyJwk.crv` is `"Ed25519"` (after #392)
- `openid-credential-issuer` `.credential_issuer` matches `https://${TUNNEL}`

If the response is wrong shape, STOP and revert.

### SEMANTIC_RISK PRs (#382, #386, #390)

After step 4:

```
pnpm --filter @vitalcv/web exec vitest run __tests__/institutional-trust-primitives.test.tsx
# (and the suite specific to the merged PR; see merge-risk-taxonomy.md row)
```

Confirm all tests still pass on main.

### SAFE_WITH_DEPENDENCIES PRs (#383, #386, #393, #395)

After step 4:

```
pnpm verify:stack                       # confirms ancestry is now flat
```

Confirms the previous chain step has been absorbed cleanly into main.

## Cloudflare tunnel demo verification

When a release session lands `PROTOCOL_RISK` or `SEMANTIC_RISK` PRs
and a Cloudflare tunnel demo is planned for the same day:

```
# Start the tunnel
export VCV_ISSUER_HOST=$(echo "$TUNNEL_URL" | sed 's|https://||;s|/.*||')
pnpm --filter @vitalcv/web dev          # in one terminal
cloudflared tunnel --url http://localhost:3030  # in another

# Verify discovery surfaces resolve through the tunnel
curl -fs "https://${VCV_ISSUER_HOST}/.well-known/did.json" | jq '.id'
# Expected: "did:web:<tunnel-host>"

# Verify demo routes
curl -fs "https://${VCV_ISSUER_HOST}/pilot/deployment-kit/cedar-q2-26" > /dev/null
curl -fs "https://${VCV_ISSUER_HOST}/interoperability/exchange/exch_cedar_q2_26_01" > /dev/null
curl -fs "https://${VCV_ISSUER_HOST}/api/resolve-npi?npi=1346053246" | jq '.firstName'
# Expected: a non-null first name from NPPES
```

## Continue merge chain

After all PRs in a session have landed:

```
git checkout main && git pull --ff-only
pnpm verify:post-merge                   # full final gate
```

Update the operational-state board (`docs/ops/operational-state.md`)
to reflect which PRs are now MERGED. The doc is the operator's
ledger; reconcile it against `gh pr list --state merged --search "Co-Authored-By: Claude Opus"` if you lose track.

## When things go wrong

**A `verify:post-merge` failure after a SAFE PR:**
Usually a transient install / lockfile drift. Re-run
`pnpm install --frozen-lockfile` once. If still failing, revert.

**A `verify:post-merge` failure after a PROTOCOL_RISK PR:**
The discovery response shape is wrong on main. Revert immediately;
the tunnel demo will break.

**A `verify:post-merge` failure after a SEMANTIC_RISK PR:**
Likely a downstream test on the touched suite is failing. Open the
test, run it against main, identify the assertion that broke. Either
revert or ship a targeted fix.

**Lost track of order:**
Run `pnpm verify:release-graph` (this PR's new command) -- it reads
`canonical-release-graph.md` and tells you the next merge.

## What this lane does NOT cover

- Production deployment (Vercel / DNS / env management) -- separate operator runbook.
- Long-running marketing / pricing pages -- not part of the session stack.
- Wallet UX -- out of scope.
- Real federation handshakes -- the rehearsal is read-only.

## One-line midnight sequence

For a tired operator wanting the bare-minimum command sequence:

```
gh pr merge --rebase <pr> && git checkout main && git pull --ff-only && pnpm install --frozen-lockfile && pnpm verify:post-merge
```

If the final command exits 0, move to the next PR. Otherwise, stop
and investigate.

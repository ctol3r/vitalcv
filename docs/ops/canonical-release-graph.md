# Canonical Release Graph

The single deterministic release graph for the session-created PR
stack. Cross-references:

- `docs/ops/canonical-merge-graph.md` (PR #397) -- raw merge order
- `docs/ops/merge-risk-taxonomy.md` (this PR) -- per-PR risk class
- `docs/ops/release-batching-guide.md` (this PR) -- batch boundaries
- `docs/ops/founder-release-lane.md` (this PR) -- the midnight runbook

This doc combines them into one graph an operator can read at a glance
to plan a release session.

## Release graph at a glance

| # | Branch | Risk class | Merge order in its chain | Post-merge verification |
|---|---|---|---|---|
| 381 | prisma-contract-fragmentation | `SAFE` | isolated | install + tsc + lint |
| 382 | institutional-trust-primitives | `SEMANTIC_RISK` | chain B step 1 | install + tsc + lint + full vitest on primitives suite + truth-audit |
| 383 | trust-integration-coherence | `SAFE_WITH_DEPENDENCIES` | chain B step 2 (needs #382) | install + tsc + lint + stack-ancestry recheck + vitest on integration suite |
| 384 | well-known-dynamic-host | `PROTOCOL_RISK` | isolated | install + tsc + lint + probe did.json + openid-credential-issuer |
| 385 | matuschak-provenance-panes | `SAFE` | isolated | install + tsc + lint |
| 386 | canonical-provenance-navigation | `SAFE_WITH_DEPENDENCIES` + `SEMANTIC_RISK` | chain B step 3 (needs #383 + #385 cherry-pick) | install + tsc + lint + stack recheck + full vitest on navigation + truth-audit |
| 387 | pilot-deployment-kit | `SAFE` | isolated | install + tsc + lint |
| 388 | doximity-hook-and-roi-math | `SAFE` | chain C step 1 (first @vitalcv/core scaffold) | install + tsc + lint |
| 389 | openevidence-risk-engine-and-matuschak-api | `SAFE` | chain C step 2 | install + tsc + lint + rebase confirms scaffold absorbs |
| 390 | antigravity-router-and-durable-chain | `SEMANTIC_RISK` | chain C step 3 | install + tsc + lint + vitest on hash-chain suite + prisma migrate dev (operator) for AuditEvent columns |
| 391 | truth-constrained-operationalization | `GOVERNANCE_ONLY` | isolated | docs present + verify-post-merge-health |
| 392 | live-npi-resolver-and-openmythos-compliance | `PROTOCOL_RISK` | chain C step 4 | install + tsc + lint + probe did.json + openid-credential-issuer + wallet-sdk build |
| 393 | protocol-integrity-hardening | `PROTOCOL_RISK` + `SAFE_WITH_DEPENDENCIES` | chain C step 5 (needs #392) | install + tsc + lint + probe ETag / Vary / 304 |
| 394 | repository-reality-alignment | `GOVERNANCE_ONLY` | isolated | docs present + verify-post-merge-health |
| 395 | interoperability-rehearsal-infrastructure | `SAFE_WITH_DEPENDENCIES` | chain B step 4 (needs #386) | install + tsc + lint + stack recheck + vitest on interoperability suite |
| 396 | stacked-infrastructure-governance | `GOVERNANCE_ONLY` | isolated | docs present + verify-stack |
| 397 | operational-compression-and-merge-execution | `GOVERNANCE_ONLY` | isolated | docs present + verify-operational-health |
| 398 | ci-unlock-and-stack-convergence | `SAFE` | isolated | wallet-sdk build PASS + verify-ci-convergence exits 0 |
| 399 | merge-orchestration-and-release-discipline | `GOVERNANCE_ONLY` | isolated | docs present + verify-post-merge-health |

## Chain summary

| Chain | Order | Land-criteria |
|---|---|---|
| **Block A · ISOLATED** | any order | each PR passes its risk-class post-merge checks |
| **Block B · trust canon** | #382 → #383 → #386 → #395 | each PR passes class checks; rebase resolves cleanly; stack ancestry recheck after each |
| **Block C · core scaffold + discovery** | #388 → #389 → #390 → #392 → #393 | scaffold-duplicate PRs absorb on rebase; protocol-risk PRs (#392 / #393) require discovery probe after merge |

Blocks A / B / C may merge **concurrently** with each other -- the
ordering constraint is only within each chain.

## Dependency-critical PRs

A "dependency-critical" PR blocks other PRs from advancing. Order them
first within each session.

| PR | Blocks |
|---|---|
| #382 | #383, #386, #395 |
| #383 | #386, #395 |
| #386 | #395 |
| #388 | #389, #390, #392, #393 (scaffold absorbs first lander) |
| #392 | #393 |
| #398 | every other PR's transitive `pnpm turbo build` (wallet-sdk repair) |

## Protocol-sensitive PRs

Three PRs touch protocol discovery surfaces:

- **#384** -- adds dynamic host resolution to `api/.well-known/*`. Backward compatible. Post-merge: probe both endpoints; confirm response still resolves on `vitalcv.com` Host header.
- **#392** -- adds **direct** `app/.well-known/*` routes (shadow the api/* rewrites). Adds Ed25519 verification method. Post-merge: confirm response now uses `crv: 'Ed25519'`; confirm the api/* path still serves for backwards compat.
- **#393** -- adds canonical JSON + ETag + 304 + Vary. Backward compatible. Post-merge: probe ETag header; conditional GET returns 304 on match.

## Isolated merges

Isolated PRs have no semantic dependency on other session PRs and
require only the class-defined post-merge checks. Eight of them:

#381, #384, #385, #387, #391, #394, #396, #397, #398, #399

(#384 is technically isolated but PROTOCOL_RISK -- post-merge probe required.)

## Stack-critical merges

Stack-critical = "must land in chain order; rebase will conflict
otherwise":

- #383 needs #382 merged first
- #386 needs #383 merged AND #385 merged (cherry-pick)
- #395 needs #386 merged
- #393 needs #392 merged
- #389 / #390 / #392 each absorb #388's `@vitalcv/core` scaffold on rebase

## Required post-merge verification per merge

After each `gh pr merge --rebase <pr>`:

```
# 1. Ensure main is up-to-date locally:
git fetch origin main
git checkout main
git pull --ff-only

# 2. Run the class-mandated checks:
pnpm install --frozen-lockfile
pnpm verify:post-merge        # bundles install + wallet-sdk build + tsc + lint + class-specific probes
                              # exits non-zero if anything regressed

# 3. For PROTOCOL_RISK PRs only:
curl -fs https://<deployment>/.well-known/did.json | jq '.id, .verificationMethod[0].publicKeyJwk.crv'
curl -fs https://<deployment>/.well-known/openid-credential-issuer | jq '.credential_issuer'

# 4. For SEMANTIC_RISK PRs only:
pnpm --filter @vitalcv/web exec vitest run __tests__/<touched-suite>

# 5. Update operational-state.md (PR #397's lane board) to reflect MERGE_SAFE -> MERGED.
```

## Merge-collapse hazards (cross-ref)

See `docs/ops/merge-collapse-hazards.md` (this PR) for the rules
that catch:

- semantic duplication
- protocol regression
- replay grammar drift
- provenance divergence
- stack-order violations
- hidden ancestry assumptions

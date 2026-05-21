# Release Batching Guide

Concrete rules for batching the session-created PR stack into a
release session. Designed for an operator who wants to land several
PRs in one sitting without breaking main.

## Batch boundaries

A **batch** is a set of PRs that can merge without rebases between
them. A **sequence** is a chain where each PR must rebase onto the
previous one's post-merge main.

| Pattern | Rule |
|---|---|
| Multiple `SAFE` / `GOVERNANCE_ONLY` PRs that touch disjoint files | merge as one batch (any order) |
| `SAFE_WITH_DEPENDENCIES` chain (#382 → #383 → #386 → #395) | merge as one sequence (chain order) |
| `SAFE_WITH_DEPENDENCIES` chain (#388 → #389 → #390 → #392 → #393) | merge as one sequence (chain order; scaffold absorbs at first lander) |
| `PROTOCOL_RISK` PR | always isolated; post-merge probe before the next merge |
| `SEMANTIC_RISK` PR | merge in its own sub-batch; run full vitest before moving on |

## Three operational batches

For the current session roster (after Codex SAFE per PR), three
recommended batches:

### Batch 1 — fast governance + isolated SAFE

PRs that touch no shared code surface; merge in any order:

```
#398  ci-unlock-and-stack-convergence       (one-line wallet-sdk repair)
#381  prisma-contract-fragmentation         (seed cast)
#385  matuschak-provenance-panes            (standalone route)
#387  pilot-deployment-kit                  (standalone route)
#391  truth-constrained-operationalization  (governance docs + tests)
#394  repository-reality-alignment          (governance docs + tooling)
#396  stacked-infrastructure-governance     (governance docs + tooling)
#397  operational-compression-and-merge-execution  (governance docs + dispatcher)
#399  merge-orchestration-and-release-discipline   (THIS PR; governance docs + post-merge verifier)
```

**Constraint:** Land #398 first so the wallet-sdk repair is on main
before any other PR rebases. Everything else in the batch is
order-independent.

**Post-batch verification:**

```
git fetch origin main
git checkout main && git pull --ff-only
pnpm install --frozen-lockfile
pnpm verify:post-merge
```

Exits 0 if the batch landed cleanly.

### Batch 2 — protocol chain

```
#384  well-known-dynamic-host                    (api/.well-known dynamic host)
#388  doximity-hook-and-roi-math                 (first @vitalcv/core)
#389  openevidence-risk-engine-and-matuschak-api (scaffold-duplicate)
#390  antigravity-router-and-durable-chain       (scaffold-duplicate + AuditEvent schema)
#392  live-npi-resolver-and-openmythos-compliance (direct .well-known + Ed25519)
#393  protocol-integrity-hardening                (ETag + 304 on discovery)
```

**Sequence:** Within Block C scaffold chain, each PR after #388 must
rebase to absorb the scaffold. PRs #392 and #393 are `PROTOCOL_RISK`
and require a discovery probe after each lands.

**Post-each-merge probe (PROTOCOL_RISK PRs):**

```
git fetch origin main && git checkout main && git pull --ff-only
pnpm install --frozen-lockfile
pnpm verify:post-merge

# Probe the live deployment:
curl -fs https://vitalcv.com/.well-known/did.json | jq '.id, .verificationMethod[0].publicKeyJwk.crv'
curl -fs https://vitalcv.com/.well-known/openid-credential-issuer | jq '.credential_issuer'
```

### Batch 3 — trust canon chain

```
#382  institutional-trust-primitives           (SEMANTIC_RISK)
#383  trust-integration-coherence              (SAFE_WITH_DEPENDENCIES; needs #382)
#386  canonical-provenance-navigation          (SEMANTIC_RISK; needs #383 + #385)
#395  interoperability-rehearsal-infrastructure (SAFE_WITH_DEPENDENCIES; needs #386)
```

**Sequence:** Strict chain order. Each PR's rebase pulls in the
previous PR's payload. SEMANTIC_RISK PRs (#382 and #386) require a
full vitest suite run on touched surfaces after each lands.

**Post-each-merge verification:**

```
git fetch origin main && git checkout main && git pull --ff-only
pnpm install --frozen-lockfile
pnpm verify:post-merge

# For SEMANTIC_RISK PRs only:
pnpm --filter @vitalcv/web exec vitest run __tests__/<touched-suite>
```

## What merges together

- All `GOVERNANCE_ONLY` PRs in a session: any order, same batch.
- All `SAFE` PRs with disjoint file scope: any order, same batch.
- Scaffold-duplicate PRs that absorb on rebase: any order WITHIN
  block C scaffold chain (but each rebase pulls in main's scaffold).

## What merges sequentially

- `SAFE_WITH_DEPENDENCIES` chains: strict chain order.
- `SEMANTIC_RISK` PRs: one at a time; run full vitest in between.
- `PROTOCOL_RISK` PRs: one at a time; probe discovery in between.

## What requires isolated validation

- Every `PROTOCOL_RISK` merge: discovery probe before the next merge.
- Every `SEMANTIC_RISK` merge: full vitest on the touched suite
  before the next merge.
- The first `@vitalcv/core` scaffold lander (#388): subsequent PRs
  rebase against the merged scaffold; no parallel "first lander"
  is permitted.

## What requires post-merge Codex audit

- `SEMANTIC_RISK` PRs: Codex audits the merged state on main to
  confirm the merge did not silently widen any banned phrase or
  introduce semantic drift downstream PRs would inherit.
- `PROTOCOL_RISK` PRs: Codex audits the merged state on main to
  confirm the discovery surface response shape is intact.

Other classes do NOT require post-merge Codex audit; pre-merge Codex
SAFE is sufficient.

## What must verify on main immediately

After every merge:

```
pnpm verify:post-merge
```

Single deterministic command. Exits non-zero on any regression.
Operators run it before walking away from the terminal.

## Anti-patterns

- **Never** merge a `SEMANTIC_RISK` PR and a `PROTOCOL_RISK` PR in
  the same batch -- post-merge attribution becomes ambiguous if
  something regresses.
- **Never** rebase a `SEMANTIC_RISK` PR onto a freshly-merged
  parallel `SEMANTIC_RISK` PR without re-running its full vitest --
  inherited semantics may have drifted.
- **Never** skip the discovery probe after a `PROTOCOL_RISK` merge,
  even if pre-merge Codex SAFE was recorded.
- **Never** batch a stacked chain with another stacked chain --
  rebase ordering becomes a multi-dimensional problem.

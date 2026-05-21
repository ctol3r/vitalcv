# Canonical Merge Graph

The single, executable merge sequence for the session-created PR
stack. Read this when you actually want to merge. It supersedes the
"recommended merge order" sections scattered across PRs #394, #396 --
those remain accurate but this is the operational reference.

## Merge classification

| Class | Definition |
|---|---|
| `MERGE_SAFE` | Pass Codex audit; no upstream dep; ready now |
| `STACKED_SAFE` | Pass Codex audit; depends on a parent PR; merge AFTER parent |
| `BLOCKED_AUDIT` | Implementation present but Codex audit not yet issued |
| `BLOCKED_REBASE` | Codex SAFE but conflicts on rebase against current main |
| `ARCHIVE_CANDIDATE` | Superseded by a later PR; close, don't merge |
| `ISOLATED` | No semantic dependency on other session PRs |
| `EXPERIMENTAL` | Audit-flagged for follow-up; do not merge yet |

## Session PR roster (16 PRs)

| # | Branch | Class | Depends on | Reason |
|---|---|---|---|---|
| 381 | `fix/prisma-contract-fragmentation` | `MERGE_SAFE` · `ISOLATED` | — | Schema-fix only; no UI / protocol surface dependency |
| 382 | `feat/institutional-trust-primitives` | `MERGE_SAFE` · `ISOLATED` | — | Foundation of trust canon chain |
| 383 | `feat/trust-integration-coherence` | `STACKED_SAFE` | #382 | Wires #382 strip into receipt / verify / dossier |
| 384 | `fix/well-known-dynamic-host` | `MERGE_SAFE` · `ISOLATED` | — | Host resolution v1 under api/.well-known |
| 385 | `feat/matuschak-provenance-panes` | `MERGE_SAFE` · `ISOLATED` | — | Standalone /trust/panes route |
| 386 | `feat/canonical-provenance-navigation` | `STACKED_SAFE` | #383 (base) + #385 (cherry-pick) | Navigation primitives on top of integration + panes |
| 387 | `feat/pilot-deployment-kit` | `MERGE_SAFE` · `ISOLATED` | — | Standalone print-ready route |
| 388 | `feat/doximity-hook-and-roi-math` | `MERGE_SAFE` | — | Scaffolds @vitalcv/core (first lander) |
| 389 | `feat/openevidence-risk-engine-and-matuschak-api` | `MERGE_SAFE` | — | Scaffold-duplicate; rebases cleanly post-#388 |
| 390 | `feat/antigravity-router-and-durable-chain` | `MERGE_SAFE` | — | Scaffold-duplicate + AuditEvent schema delta |
| 391 | `fix/truth-constrained-operationalization` | `MERGE_SAFE` · `ISOLATED` | — | Operational-status taxonomy + truth audit |
| 392 | `feat/live-npi-resolver-and-openmythos-compliance` | `MERGE_SAFE` | — | Direct .well-known routes + Ed25519 + NPPES |
| 393 | `fix/protocol-integrity-hardening` | `STACKED_SAFE` | #392 | Canonical JSON + ETag + host hardening |
| 394 | `fix/repository-reality-alignment` | `MERGE_SAFE` · `ISOLATED` | — | Repo-health tooling + governance docs |
| 395 | `feat/interoperability-rehearsal-infrastructure` | `STACKED_SAFE` | #386 | Exchange rehearsal route + envelope |
| 396 | `fix/stacked-infrastructure-governance` | `MERGE_SAFE` · `ISOLATED` | — | Stack topology docs + Codex/Claude packet generators |
| 397 | `fix/operational-compression-and-merge-execution` | `MERGE_SAFE` · `ISOLATED` | — | THIS PR. Merge graph + founder lane + consolidated governance |

All 17 PRs are `BLOCKED_AUDIT` until Codex issues SAFE; the
classification above describes the state AFTER Codex audit.

## Deterministic merge sequence

```
                       [ 381 ]                # standalone schema fix
                       [ 384 ]                # standalone discovery v1
                       [ 387 ]                # standalone pilot kit
                       [ 391 ]                # standalone truth governance
                       [ 394 ]                # standalone repo-health
                       [ 396 ]                # standalone stack-governance
                       [ 397 ]                # standalone compression (this PR)

  [ 382 ] ─► [ 383 ] ─► [ 386 ] ─► [ 395 ]   # trust canon chain
              (+ cherry-pick of #385)

  [ 385 ]                                     # standalone panes
                                              # (also cherry-picked into 386)

  [ 388 ] ─► [ 389 ] ─► [ 390 ] ─► [ 392 ] ─► [ 393 ]
              (@vitalcv/core scaffold absorbed by whichever lands first)
```

Concurrent merge groups (in canonical order):

1. **Block A · ISOLATED** -- can merge in any order:
   `#381`, `#384`, `#385`, `#387`, `#391`, `#394`, `#396`, `#397`

2. **Block B · trust canon (must land in order):**
   `#382` → `#383` → `#386` → `#395`

3. **Block C · core-scaffold (absorbing rebase per merge):**
   `#388` → `#389` → `#390` → `#392` → `#393`

The blocks are independent; A / B / C may merge concurrently with each
other, but ordering within each chain is mandatory.

## Dependency-critical branches

| Branch | Why critical |
|---|---|
| `#382` | Blocks #383, #386, #395 |
| `#383` | Blocks #386, #395 |
| `#386` | Blocks #395 |
| `#388` | Blocks scaffold-rebase work for #389/#390/#392 |
| `#392` | Blocks #393 |

## Codex-blocked branches

All session PRs are currently `BLOCKED_AUDIT` -- Codex SAFE has not
been recorded for any of them in this session. Once Codex issues
SAFE, branches move to `MERGE_SAFE` or `STACKED_SAFE` per the table.

## Archive candidates

None. Every session PR carries a distinct capability per
`docs/ops/stack-topology.md`. The duplicate-scaffold relationship
across #388/#389/#390/#392 is `absorbed on rebase`, not
`archive candidate`.

## Merge-ready branches (after Codex SAFE)

When Codex SAFE is recorded, the following branches become
`MERGE_SAFE` immediately (no further prereq):

`#381`, `#382`, `#384`, `#385`, `#387`, `#388`, `#389`, `#390`,
`#391`, `#392`, `#394`, `#396`, `#397`.

## Operator instructions

```
# Merge order (after Codex SAFE per branch):
gh pr merge --rebase 381
gh pr merge --rebase 384
gh pr merge --rebase 385
gh pr merge --rebase 387
gh pr merge --rebase 391
gh pr merge --rebase 394
gh pr merge --rebase 396
gh pr merge --rebase 397

# Trust canon chain (in order):
gh pr merge --rebase 382
gh pr merge --rebase 383     # auto-rebases on top of #382
gh pr merge --rebase 386     # auto-rebases on top of #383 + cherry-pick
gh pr merge --rebase 395     # auto-rebases on top of #386

# Core scaffold chain (in order):
gh pr merge --rebase 388
gh pr merge --rebase 389     # scaffold absorbed
gh pr merge --rebase 390     # scaffold absorbed + AuditEvent schema delta
gh pr merge --rebase 392     # scaffold absorbed
gh pr merge --rebase 393     # rebased onto 392
```

Run `pnpm verify:operational-health` before each merge -- the
script confirms Codex SAFE recorded, branch pushed, lockfile clean,
tsc baseline preserved.

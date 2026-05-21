# Stack Topology

Authoritative map of the PR / branch / semantic-dependency stack
across this Claude session's waves. Companion to
`docs/ops/repository-reality-audit.md` (PR #394).

This document is binding for `fix/stacked-infrastructure-governance`.
PRs that stack on top of others MUST add an entry here before
requesting Codex audit.

## Branch ancestry

```
origin/main
├── #381 fix/prisma-contract-fragmentation
├── #382 feat/institutional-trust-primitives
│       └── #383 feat/trust-integration-coherence
│             └── #386 feat/canonical-provenance-navigation
│                       │  (cherry-picks #385's pane commit)
│                       └── #395 feat/interoperability-rehearsal-infrastructure
├── #384 fix/well-known-dynamic-host
├── #385 feat/matuschak-provenance-panes
├── #387 feat/pilot-deployment-kit
├── #388 feat/doximity-hook-and-roi-math       (scaffolds @vitalcv/core)
├── #389 feat/openevidence-risk-engine         (duplicate-scaffold)
├── #390 feat/antigravity-router-and-durable-chain  (duplicate-scaffold)
├── #391 fix/truth-constrained-operationalization
├── #392 feat/live-npi-resolver-and-openmythos-compliance  (duplicate-scaffold)
│       └── #393 fix/protocol-integrity-hardening
├── #394 fix/repository-reality-alignment
└── #396 fix/stacked-infrastructure-governance       (this PR)
```

## Semantic dependency table

Each row names the capability and the FIRST PR in the stack that
implements it. Branches downstream INHERIT the capability via merge
ancestry; branches PARALLEL to it do NOT.

| Capability | First implemented in | Inheritance scope |
|---|---|---|
| Canonical trust primitives (LineageHeader, OwnershipStateBadge, TierBadge, CheckedAtStamp, etc.) | #382 | #382 + descendants (#383, #386, #395) |
| Institutional language module (`lib/trust/institutional-language.ts`) | #382 | same |
| Five-mode failure taxonomy + `DegradationState` | #382 | same |
| Replay grammar (`composeLineage`, six-cell reading order) | #382 | same |
| Coherence wiring of canonical strip into receipt/verify/dossier routes | #383 | #383 + descendants (#386, #395) |
| Stacked Provenance Ledger (Matuschak panes, `?panes=` URL) | #385 | #385 only (cherry-picked into #386) |
| Canonical provenance navigation primitives (ProvenancePaneHeader, ProvenanceChronology, ProvenanceBinding, ProvenanceTrail, ReplayRunStamp, EntityBindingSummary) | #386 | #386 + descendants (#395) |
| `MAX_PANE_DEPTH = 7`, `safePush`, cycle detection | #386 | same |
| `@vitalcv/core` workspace scaffold | #388 (first land) | all duplicate-scaffold PRs absorb on rebase |
| OpenEvidence ROI calculator | #388 | #388 only |
| OpenEvidence risk engine + employer-pipeline `marketRisk` enrichment | #389 | #389 only |
| Matuschak Lineage Graph API | #389 | #389 only |
| Antigravity routing middleware (verifier-on-receipt guard) | #390 | #390 only |
| Durable hash-chain primitives (`HashChainService`, `createAuditEventWithChain`) | #390 | #390 only |
| AuditEvent schema columns (`lineageKey`, `priorRunId`) | #390 | #390 only |
| Operational-status taxonomy + evidence-bound claim helper | #391 | #391 only |
| Operational capability boundaries doc | #391 | #391 only |
| `lib/discovery/issuerHost.ts` (per-request host resolution) | #384 (first) → re-implemented in #392 | both implement |
| Direct `app/.well-known/{did.json,openid-credential-issuer}` routes | #392 | #392 + #393 |
| Live NPPES resolver (`packages/core/src/services/nppesResolver.ts`) | #392 | #392 + #393 |
| Ed25519 issuer key surface | #392 | #392 + #393 |
| Protocol integrity helpers (`canonicalSerialize`, `computeETag`, `canonicalizeHost`) | #393 | #393 only |
| Protocol-capability boundaries doc | #393 | #393 only |
| Repo-health verification tooling (`verify-repo-reality.ts`) | #394 | #394 only |
| Worktree-governance / Codex-ready / implementation-reality docs | #394 | #394 only |
| Verification exchange rehearsal route + envelope + readiness taxonomy | #395 | #395 only |
| Interoperability rehearsal boundaries doc | #395 | #395 only |
| Stack topology / semantic inheritance / stack-aware truth contract | #396 | #396 only (this PR) |

## Stack chains (ordered)

Five non-trivial chains exist in this session. Merge order matters:

| Chain | Order |
|---|---|
| Trust canon chain | #382 → #383 → #385 (cherry-pick) → #386 → #395 |
| Discovery chain | #384 (host resolution v1) ⟂ #392 (host resolution v2 + ed25519 + direct routes) → #393 (integrity hardening) |
| Core-scaffold chain | #388 → #389 → #390 → #392 (each duplicates the same `packages/core/` skeleton; first to land absorbs the rest on rebase) |
| Governance chain | #391 (truth) → #394 (repo reality) → #396 (stack governance, this PR) |
| Standalone | #381 (prisma), #387 (pilot kit) |

## Cherry-pick relationships

| PR | Cherry-picks |
|---|---|
| #386 | `feat/matuschak-provenance-panes` commit (PR #385's payload) onto a `feat/trust-integration-coherence` base. When #385 and #383 both land on main, #386's rebase resolves to the same diff. |

## Duplicate-scaffold PRs

PRs #388, #389, #390, #392 each ship an identical `packages/core/`
scaffold (package.json + tsconfig.json + vitest.config.ts + src/index.ts).
Whichever lands first absorbs the others on rebase; remaining PRs'
scaffold changes become no-ops. **Merge sequence does not matter
within this group**, but each PR must rebase before merging if it is
not first.

## Recommended merge order

```
1.  #381  fix/prisma-contract-fragmentation
2.  #382  feat/institutional-trust-primitives
3.  #383  feat/trust-integration-coherence            (rebase onto main after #382)
4.  #384  fix/well-known-dynamic-host
5.  #385  feat/matuschak-provenance-panes
6.  #386  feat/canonical-provenance-navigation        (rebase onto main after #383 + #385)
7.  #387  feat/pilot-deployment-kit
8.  #388  feat/doximity-hook-and-roi-math             (first @vitalcv/core scaffold)
9.  #389  feat/openevidence-risk-engine-and-matuschak-api  (rebase: scaffold absorbed)
10. #390  feat/antigravity-router-and-durable-chain        (rebase: scaffold absorbed)
11. #391  fix/truth-constrained-operationalization
12. #392  feat/live-npi-resolver-and-openmythos-compliance (rebase: scaffold absorbed)
13. #393  fix/protocol-integrity-hardening            (rebase onto main after #392)
14. #394  fix/repository-reality-alignment
15. #395  feat/interoperability-rehearsal-infrastructure   (rebase onto main after #386)
16. #396  fix/stacked-infrastructure-governance        (this PR -- no semantic deps)
```

Any deviation from this order MUST update this document AND surface
the deviation in the affected PR descriptions.

## What this document does NOT govern

- **External branches** (Codex agents, other operators): out of scope.
  This document describes the session-created stack only.
- **Future waves**: the recommended-order block must be extended each
  time a new PR is opened. There is no auto-discovery.
- **Long-running `wave/*` branches**: those predate this session and
  are governed by `docs/ops/worktree-governance.md`.

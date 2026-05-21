# Merge Risk Taxonomy

Seven canonical risk classes for the session-created PR stack. Every
PR is in exactly one class at a time. Class assignment drives which
post-merge verification steps are mandatory.

Companion to:
- `docs/ops/canonical-merge-graph.md` (PR #397) -- the merge order
- `docs/ops/canonical-release-graph.md` (this PR) -- merge order × risk class × required verification

## Classes

| Class | Definition |
|---|---|
| `SAFE` | No semantic dependencies on other session PRs; touches no protocol surface; no schema delta. Post-merge: workspace install + tsc + lint. |
| `SAFE_WITH_DEPENDENCIES` | Has a declared stack parent. Merge ONLY after the parent has landed AND the rebase resolves cleanly. Post-merge: same as SAFE plus a stack-ancestry recheck. |
| `SEMANTIC_RISK` | Modifies shared trust / replay / provenance vocabulary that downstream PRs inherit. Merge requires a Codex SAFE verdict that includes a "no semantic drift" assertion. Post-merge: full vitest run on touched surfaces. |
| `PROTOCOL_RISK` | Touches `.well-known/*` or other protocol discovery surfaces. Merge requires a Codex SAFE verdict that includes a "discovery surfaces unchanged or backward-compatible" assertion. Post-merge: probe the discovery routes against `origin/main` HEAD. |
| `GOVERNANCE_ONLY` | Ships only docs, scripts, or tooling -- no runtime surface change. Post-merge: docs presence check + verify-post-merge-health. |
| `HOLD` | Codex audit returned non-SAFE OR a blocking dependency is unmet. Do NOT merge until the hold is resolved. |
| `ARCHIVE` | Superseded by a later PR; close, do not merge. |

## Class assignment for the session PR roster

| # | Branch | Class | Reason |
|---|---|---|---|
| 381 | `fix/prisma-contract-fragmentation` | `SAFE` | Schema-fix; no UI / protocol surface |
| 382 | `feat/institutional-trust-primitives` | `SEMANTIC_RISK` | Foundation of trust canon vocabulary; downstream PRs inherit `LineageHeader`, replay grammar, banned-phrase list |
| 383 | `feat/trust-integration-coherence` | `SAFE_WITH_DEPENDENCIES` | Stacked on #382; surgical route-level integration |
| 384 | `fix/well-known-dynamic-host` | `PROTOCOL_RISK` | Modifies `/.well-known/did.json` and `/.well-known/openid-credential-issuer` (api/* path) |
| 385 | `feat/matuschak-provenance-panes` | `SAFE` | Standalone `/trust/panes` route; no protocol or semantic-canon touch |
| 386 | `feat/canonical-provenance-navigation` | `SAFE_WITH_DEPENDENCIES` + `SEMANTIC_RISK` | Stacked on #383 + cherry-pick #385; introduces provenance navigation primitives that future waves will inherit |
| 387 | `feat/pilot-deployment-kit` | `SAFE` | Standalone print-ready route |
| 388 | `feat/doximity-hook-and-roi-math` | `SAFE` | Standalone API route + first `@vitalcv/core` scaffold |
| 389 | `feat/openevidence-risk-engine-and-matuschak-api` | `SAFE` | Scaffold-duplicate (absorbed on rebase) |
| 390 | `feat/antigravity-router-and-durable-chain` | `SEMANTIC_RISK` | Middleware change + AuditEvent schema delta + hash-chain primitives downstream auditors will consume |
| 391 | `fix/truth-constrained-operationalization` | `GOVERNANCE_ONLY` | Adds taxonomy + tests + boundary doc; no runtime surface |
| 392 | `feat/live-npi-resolver-and-openmythos-compliance` | `PROTOCOL_RISK` | Adds direct `app/.well-known/*` routes that shadow rewrites + Ed25519 key surface |
| 393 | `fix/protocol-integrity-hardening` | `PROTOCOL_RISK` + `SAFE_WITH_DEPENDENCIES` | Stacked on #392; ETag + 304 + canonical-JSON on the discovery responses |
| 394 | `fix/repository-reality-alignment` | `GOVERNANCE_ONLY` | Adds verification tooling + docs |
| 395 | `feat/interoperability-rehearsal-infrastructure` | `SAFE_WITH_DEPENDENCIES` | Stacked on #386; introduces interoperability rehearsal route |
| 396 | `fix/stacked-infrastructure-governance` | `GOVERNANCE_ONLY` | Stack topology / inheritance / context-generator scripts |
| 397 | `fix/operational-compression-and-merge-execution` | `GOVERNANCE_ONLY` | Merge graph / founder lane / dispatcher |
| 398 | `fix/ci-unlock-and-stack-convergence` | `SAFE` | One-line wallet-sdk repair + verifier |
| 399 | `fix/merge-orchestration-and-release-discipline` | `GOVERNANCE_ONLY` | THIS PR |

## State legend

- A PR can carry **multiple** classes (e.g. #386 is both `SAFE_WITH_DEPENDENCIES` and `SEMANTIC_RISK`). Operationally, the strictest class wins: a PR carrying `PROTOCOL_RISK` runs both protocol verification AND its other class's verification.
- All 19 session PRs are currently behind `HOLD` until Codex SAFE is recorded.
- No session PR is `ARCHIVE`. The duplicate-scaffold relationship across #388/#389/#390/#392 is "absorbed on rebase", not archive.

## Required post-merge verification by class

| Class | Required after merge to main |
|---|---|
| `SAFE` | `pnpm install --frozen-lockfile`; `pnpm --filter @vitalcv/web typecheck`; `pnpm --filter @vitalcv/web lint` |
| `SAFE_WITH_DEPENDENCIES` | `SAFE` checks + `pnpm verify:stack` shows declared parent merged + clean rebase |
| `SEMANTIC_RISK` | `SAFE` checks + full vitest on touched surfaces + truth-audit grep (`institutional-trust-primitives.test.tsx` + `truth-constrained-operationalization.test.ts`) |
| `PROTOCOL_RISK` | `SAFE` checks + `pnpm --filter @vitalcv/wallet-sdk build` + probe `/.well-known/did.json` and `/.well-known/openid-credential-issuer` against the merged main |
| `GOVERNANCE_ONLY` | docs present + new tooling commands runnable |
| `HOLD` | n/a — do not merge |
| `ARCHIVE` | n/a — close, do not merge |

## How to record a class change

1. Edit the row in the table above on a `fix/*` follow-up PR (or in-place on the affected branch).
2. Re-run `pnpm verify:merge-risk` -- the script reads this doc.
3. If `HOLD` is being lifted, cite the resolution (Codex SAFE recorded; dependency landed; etc.) in the PR body.

# Canonical Wave Registry

Single deterministic table for every major wave in the repo. Each row
captures wave name + branch + PR + audit-target evidence + lifecycle
state. The registry is parsed by
`scripts/verify-wave-materialization.ts`; rows that fail verification
(missing branch, missing PR, missing audit target) are surfaced as
drift.

The registry is **append-only at the head**. When a wave's lifecycle
state advances, edit the row in place and update the
`Lifecycle` column. Do NOT delete rows.

## Lifecycle states

| State | Meaning |
|---|---|
| `conceptualized` | Wave is referenced in a doc, plan, or session note, but no branch exists yet |
| `implemented` | Branch exists with at least one commit ahead of origin/main |
| `pr_opened` | Pull request exists for the branch |
| `audited` | Codex audit verdict recorded against the PR |
| `merged` | PR is merged to main |
| `archived` | PR closed without merge or superseded by a later wave; the row stays |

A wave row MAY skip `audited` if the wave is documentation-only or
pure governance (no executable contract). All other rows MUST pass
through `audited` before reaching `merged`.

## Reality columns

Every row carries five reality columns. The verifier checks each:

| Column | Required | Check |
|---|---|---|
| `branch` | yes if state >= implemented | `git ls-remote origin <branch>` returns a ref |
| `pr` | yes if state >= pr_opened | `gh pr view <N>` succeeds |
| `audit_target` | yes if state >= audited | the path under `docs/` exists |
| `route` | optional | the path under `apps/web/app/` exists |
| `tests` | optional | the path under `apps/web/__tests__/` or `packages/*/test/` exists |

A `null` value in a column means "this wave does not require that
column" -- not "the value is missing."

## Registry

### Session waves (this conversation thread, May 2026)

| # | Wave | Branch | PR | Lifecycle | Audit target | Route | Tests |
|---|---|---|---|---|---|---|---|
| W22 | Operational Waste Visibility | `feat/operational-waste-visibility` | 402 | `pr_opened` | `docs/demo/operational-waste-boundaries.md` | `apps/web/app/demo/waste/page.tsx` | `apps/web/__tests__/operational-waste-visibility.test.tsx` |
| W23 | Operational Signal Hierarchy | `feat/operational-signal-hierarchy` | 403 | `pr_opened` | `docs/design/operational-signal-hierarchy.md` | `apps/web/app/ops/page.tsx` | `apps/web/__tests__/operational-signal-hierarchy.test.tsx` |
| W24 | Institutional Path Completion | `feat/institutional-path-completion` | 404 | `pr_opened` | `docs/product/institutional-path-boundaries.md` | `apps/web/app/pilot/PilotRequestForm.tsx` | `apps/web/__tests__/institutional-path-completion.test.tsx` |
| W25 | Reality Synchronization | `fix/reality-synchronization` | _this PR_ | `implemented` | `docs/ops/reality-synchronization-audit.md` | null | `apps/web/__tests__/reality-synchronization.test.ts` |

### Prior session waves (PRs #375 – #401)

These were materialized by earlier sessions and are listed for
verifier coverage. Lifecycle state is what `gh pr view` reports today
unless an archive note is recorded.

| PR | Branch | Lifecycle | Notes |
|---|---|---|---|
| 375 | `fix/wallet-sdk-interoperability-export` | `pr_opened` | wallet-sdk orphan-export fix (canonical) |
| 376 | `ops/vercel-exit-emergency` | `pr_opened` | Vercel exit runbook |
| 377 | `ops/local-demo-operator` | `pr_opened` | Local Cloudflare demo operator |
| 378 | `feat/design-trust-surfaces-canon-v1` | `pr_opened` | Trust surfaces canon |
| 379 | `docs/codebase-map-2026-05-18` | `pr_opened` | Codebase map planning doc |
| 380 | `fix/replay-engine-ci-regression` | `pr_opened` | Replay engine merge regression fix |
| 381 | `fix/prisma-contract-fragmentation` | `pr_opened` | Backend Prisma namespace normalization |
| 382 | `feat/institutional-trust-primitives` | `pr_opened` | Trust primitives canonicalization |
| 383 | `feat/trust-integration-coherence` | `pr_opened` | Trust system integration |
| 384 | `fix/well-known-dynamic-host` | `pr_opened` | .well-known per-request host resolution |
| 385 | `feat/matuschak-provenance-panes` | `pr_opened` | Stacked provenance panes |
| 386 | `feat/canonical-provenance-navigation` | `pr_opened` | Provenance navigation canonicalization |
| 387 | `feat/pilot-deployment-kit` | `pr_opened` | Pilot Deployment Kit route |
| 388 | `feat/doximity-hook-and-roi-math` | `pr_opened` | NPI hook + ROI calculator (C65 + C66) |
| 389 | `feat/openevidence-risk-engine-and-matuschak-api` | `pr_opened` | Risk engine + lineage graph (C69 + C72) |
| 390 | `feat/antigravity-router-and-durable-chain` | `pr_opened` | Antigravity routing + durable chain (C73 + C75) |
| 391 | `fix/truth-constrained-operationalization` | `pr_opened` | Truth-constrained semantics |
| 392 | `feat/live-npi-resolver-and-openmythos-compliance` | `pr_opened` | NPPES resolver + OpenMythos endpoints (C77 + C78) |
| 393 | `fix/protocol-integrity-hardening` | `pr_opened` | Discovery surface integrity |
| 394 | `fix/repository-reality-alignment` | `pr_opened` | Repository reality alignment |
| 395 | `feat/interoperability-rehearsal-infrastructure` | `pr_opened` | Exchange rehearsal infrastructure |
| 396 | `fix/stacked-infrastructure-governance` | `pr_opened` | Stacked infrastructure governance |
| 397 | `fix/operational-compression-and-merge-execution` | `pr_opened` | Operational compression + merge convergence |
| 398 | `fix/ci-unlock-and-stack-convergence` | `pr_opened` | CI unlock + stack convergence (carries the wallet-sdk orphan-export fix in narrative form alongside PR #375) |
| 399 | `fix/merge-orchestration-and-release-discipline` | `pr_opened` | Merge orchestration + release discipline |
| 400 | `feat/pilot-demonstration-compression` | `pr_opened` | Pilot demo narrative compression |
| 401 | `feat/institutional-intake-momentum` | `pr_opened` | Institutional intake momentum |

### Historical merged waves

These have already merged to main. They are listed for registry
completeness only; the verifier does not re-check them on every run.

| PR | Title | Merged on (approx) |
|---|---|---|
| 172 | PSV receipt reuse and revocation boundary | pre-session |
| 187 | Scheduled source health probes | pre-session |
| 203 | ES256 receipt issuer and JWKS endpoint | pre-session |
| 204 | Zero-Trust JWT Receipt Verification Engine | pre-session |
| 264 | Tier example NPDB removal | pre-session |
| 265 | Executive ROI dashboard foundation | pre-session |
| 268 | AI Knowledge Inbox surface foundation | pre-session |
| 270 | Start-activation console foundation | pre-session |
| 271 | Career autopilot dashboard foundation | pre-session |
| 273 | Cryptographic proof dossier foundation | pre-session |
| 274 | Waves B/D/E/F/H board delta | pre-session |
| 275 | Code Red final verification snapshot | pre-session |
| 359 | Bare "Verified" labels replaced + regression gate | pre-session |
| 362 | Production fail-closed receipt issuer | pre-session |

Newer merged PRs append at the head of this table as they land.

### Conceptual-only items (NO branch, NO PR)

These are referenced in session notes or older docs but have no
materialized branch yet. The verifier explicitly tolerates these as
`conceptualized` and emits NOTE entries rather than failures.

| Reference | Source | Action |
|---|---|---|
| (none currently) | -- | -- |

When an item is referenced anywhere in docs that cannot be traced to
a row here, the verifier reports it as **orphaned semantic**. The
correct response is either to add a row above OR to remove the
orphan reference. PRs cannot ship orphan references on origin/main.

## Operator rules

1. **Append in place at the head.** Newer rows go above older rows in
   the session table.
2. **Update lifecycle in place.** Do not delete rows when state
   advances; mutate the `Lifecycle` cell.
3. **Every PR reference outside this doc** MUST point to either an
   open or merged PR. Closed-without-merge PRs may only be cited if
   the citing doc explicitly notes the closure (see
   `docs/ops/pr-b-crypto-superseded-note.md` for the pattern).
4. **Conceptual references** (waves/PRs that do not yet exist as
   branch + PR) are forbidden outside this doc.

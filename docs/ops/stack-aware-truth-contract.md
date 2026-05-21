# Stack-Aware Truth Contract

Extends the project-wide CLAUDE.md truth contract with rules that
prevent semantic drift across stacked PR chains. Read alongside:

- `docs/ops/stack-topology.md` -- the binding ancestry map
- `docs/ops/semantic-inheritance-boundaries.md` -- inheritance rules
- `docs/ops/operational-capability-boundaries.md` (PR #391) -- operational status taxonomy
- `docs/protocol/protocol-capability-boundaries.md` (PR #393) -- protocol surface boundaries
- `docs/protocol/interoperability-rehearsal-boundaries.md` (PR #395) -- rehearsal boundaries

## Binding rules

A branch MUST NOT claim:

1. **Protocol surfaces absent from merge ancestry.**
   If `/.well-known/did.json` is not present in the branch's tree
   (either directly in the diff or in the merge-base from an ancestor),
   the PR body MUST NOT describe the branch as implementing or
   exposing that surface.

2. **Interoperability features absent from base chain.**
   If `apps/web/app/interoperability/exchange/...` is not in the
   tree, the PR body MUST NOT describe the branch as shipping
   "interoperability rehearsal" -- even if a parallel branch does.

3. **Replay semantics not present in branch lineage.**
   If `apps/web/lib/trust/replay-grammar.ts` is not in the tree, the
   PR body MUST NOT claim "canonical reading order" or "composeLineage".

4. **Discovery endpoints not merged into ancestry.**
   If `apps/web/app/.well-known/*` routes are not present, the PR body
   MUST NOT claim "did:web discovery" or "OID4VCI metadata exposure".

5. **Cryptographic primitives not present in branch lineage.**
   If `packages/core/src/services/ledger/HashChainService.ts` is not
   present, the PR body MUST NOT claim "SHA-256 hash chain" or
   "tamper-evident audit chain".

## How a branch declares inheritance

A PR body that inherits capability from an ancestor MUST include a
"Stacking note" heading near the top:

```markdown
> **Stacking note:** base = `<branch>` (PR #N). This PR inherits:
>   - <capability A> from PR #X
>   - <capability B> from PR #Y
> When upstream PRs land on main, rebase this PR before merging.
```

When the PR's diff explicitly introduces a new capability, the body
MUST include an "Adds" or "What ships" section that names the file(s)
contributing the capability. Reviewers + Codex audits cross-check
the section against the diff.

## How a branch is verified

`pnpm verify:semantic-lineage <branch>` (script shipped in this PR)
walks the branch's merge-base ancestry, enumerates the files +
symbols added by each ancestor PR, and emits a deterministic report.
Discrepancies between the PR body's claims and the report's findings
are flagged.

The audit is consultative; Codex makes the final SAFE / NOT-READY
call. A discrepancy is permissible if the operator explicitly notes
"override <reason>" in the PR body (per the Codex-ready checklist
override protocol from PR #394).

## Examples (anti-patterns)

### NOT-READY pattern A: claim without ancestor

PR body says: "Adds did:web discovery."

Branch diff: empty under `apps/web/app/.well-known/`.

Branch ancestry: does not include PR #392 (which added the direct
routes) or PR #384 (which added per-request host resolution to the
api/.well-known routes).

Verdict: **NOT READY**. Either:
- (a) add the route to this branch's diff, OR
- (b) rebase the branch onto a base that includes PR #392, OR
- (c) remove the claim from the PR body.

### NOT-READY pattern B: claim of inherited capability without ancestor

PR body says: "Inherits canonical provenance navigation from PR #386."

Branch ancestry: does NOT include PR #386 (base = `origin/main`, no
cherry-picks).

Verdict: **NOT READY**. The inheritance is fictitious. Either:
- (a) rebase the branch onto PR #386, OR
- (b) cherry-pick the relevant commits from PR #386, OR
- (c) implement the capability directly in this branch.

### READY pattern: precise stacking-note

PR body says:

> Stacking note: base = `feat/canonical-provenance-navigation` (PR #386).
> Inherits:
>   - canonical trust primitives (PR #382)
>   - provenance navigation primitives (PR #386)
>   - pane URL contract (PR #385, cherry-picked into #386)
> Adds:
>   - interoperability rehearsal route (`apps/web/app/interoperability/exchange/...`)
>   - ReplayBundleEnvelope model (`apps/web/lib/interoperability/...`)
> When PR #386 lands on main, rebase this PR before merging.

Branch diff: includes the listed files; does not include any file
that the PR body claims as inherited.

Branch ancestry: includes the commits from #382 + #383 + #385 (via
cherry-pick) + #386.

Verdict: **READY**.

## Banned cross-stack claims

The following phrasings are banned in any PR body that does not
include the corresponding capability in its ancestry. The grep audit
in `verify:semantic-lineage` flags them:

| Banned phrase | Requires in ancestry |
|---|---|
| "did:web discovery implemented" | #384 OR #392 |
| "OID4VCI metadata exposed" | #392 |
| "Ed25519 issuer identity" | #392 |
| "hash-chained audit events" | #390 |
| "Matuschak panes" | #385 OR ancestor that cherry-picks it |
| "provenance navigation primitives" | #386 |
| "interoperability rehearsal" | #395 |
| "live NPPES resolver" | #388 OR #392 |
| "OpenEvidence risk engine" | #389 |
| "antigravity routing" | #390 |

## Truth-contract escalation

If `verify:semantic-lineage` flags a discrepancy, the operator MUST:

1. Resolve on the branch (preferred), OR
2. Add an explicit `Codex audit policy: override <clause>` line to
   the PR body with a written reason, OR
3. Close the PR and open a follow-up wave to resolve the prerequisite.

Codex audits MUST NOT issue SAFE on a flagged PR without one of these
actions.

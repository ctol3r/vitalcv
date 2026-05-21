# Semantic Inheritance Boundaries

Defines what a stacked branch MAY claim by inheritance vs what MUST
be explicitly implemented in the current branch.

The rule is simple and binding:

> **A branch inherits a capability only if every commit that implements
> that capability is in the branch's git ancestry to the merge base
> against `origin/main`.**

In practice that means:

- A branch stacked on `feat/X` inherits everything `feat/X` adds.
- A branch stacked DIRECTLY on `origin/main` inherits nothing beyond
  what is already on main.
- A cherry-pick brings in a single commit, not an entire branch.

## Inheritance examples (binding)

| Branch | Inherits | Does NOT inherit |
|---|---|---|
| `feat/trust-integration-coherence` (#383, on #382) | canonical primitives, language module, degradation taxonomy, replay grammar | panes (#385), provenance navigation primitives (#386) |
| `feat/canonical-provenance-navigation` (#386, on #383 + cherry-pick #385) | everything in #383 + pane URL contract from cherry-picked commit | risk engine (#389), interoperability rehearsal (#395) |
| `feat/interoperability-rehearsal-infrastructure` (#395, on #386) | everything in #386 (which includes #383 + #382 + #385 panes) | live NPPES resolver (#392), Ed25519 keys (#392), antigravity middleware (#390) |
| `fix/protocol-integrity-hardening` (#393, on #392) | direct `app/.well-known/*` routes, Ed25519 key surface, live NPPES resolver | provenance primitives (#386), interop rehearsal (#395) |
| `fix/stacked-infrastructure-governance` (#396, on origin/main) | nothing beyond main | every session-wave capability |

## What MAY be inherited

The following capability categories inherit when their first-implementing
PR is in the branch's ancestry:

- **Trust primitives** (LineageHeader, OwnershipStateBadge, TierBadge,
  CheckedAtStamp, etc.) — once #382 is in ancestry, downstream branches
  may import from `@/components/trust/primitives`.
- **Replay grammar** (`composeLineage`, six-cell binding order) —
  same as above.
- **Degradation taxonomy** (`DegradationState`, `visualForDegradation`,
  `describeDegradation`) — same.
- **Institutional language** (`INSTITUTIONAL_PHRASES`,
  `READING_ORDER_LABELS`, `BANNED_INSTITUTIONAL_PHRASES`) — same.
- **Pane URL contract** (`?panes=` parser/serializer, `PaneKind` union)
  — once #385 is in ancestry (or cherry-picked).
- **Provenance navigation primitives** (`ProvenanceChronology`,
  `ProvenanceTrail`, `ProvenanceBinding`, etc.) — once #386 is in
  ancestry.
- **`@vitalcv/core` package** — once any of #388/#389/#390/#392 lands
  on main.

## What MUST be explicitly implemented

The following capability categories are NEVER inherited and MUST be
implemented in the branch that claims them:

- **Protocol discovery routes** (`/.well-known/did.json`,
  `/.well-known/openid-credential-issuer`) — each branch that claims
  these must include the route file in its diff. They are NOT inherited
  by branches outside the discovery chain (#384 / #392 / #393).
- **Live NPPES resolver** (`packages/core/src/services/nppesResolver.ts`)
  — branches that claim NPI resolution must include the file.
- **Ed25519 / ES256 key surfaces** (`lib/crypto/ed25519IssuerKey.ts`,
  `lib/crypto/receiptIssuer.ts`) — branches that claim cryptographic
  keys must include the file.
- **Antigravity middleware** (`apps/web/middleware.ts` antigravity
  hook) — branches that claim verifier-routing constraints must
  include the middleware change.
- **AuditEvent schema columns** (`lineageKey`, `priorRunId`) — branches
  that claim hash-chained audit events must include the Prisma schema
  delta.
- **Verification exchange route** (`/interoperability/exchange/...`) —
  branches that claim interop rehearsal must include the route file.
- **Governance docs / verification tooling** — never inherited. Each
  branch that ships governance must include the doc and the script.

## Anti-patterns (binding)

A branch SHALL NOT:

1. **Claim a capability without including its first-implementing PR
   in its merge-base ancestry.** Example: a branch off origin/main
   cannot claim canonical provenance primitives without first being
   rebased onto #386.
2. **Reference a route, file, or symbol that is not present in the
   diff or in the merge-base tree.** Codex audits flag these
   automatically once `verify:stack` runs.
3. **Describe a parallel branch's capability as "shipped" or
   "implemented" in its own PR body.** Use "shipped in #N (separate
   PR)" or "depends on #N landing first" instead.
4. **Hide a transitive dependency** by describing a feature as if it
   were implemented in this branch when it actually arrives from an
   ancestor. Cite the ancestor explicitly.

## Cherry-pick semantics

A cherry-picked commit inherits the SAME way as a regular commit:
once the picked commit is in the branch's history, capabilities
introduced by that commit are available.

The cherry-pick relationship MUST be declared in
`docs/ops/stack-topology.md` so Codex audits can trace the lineage.

## Capability-vs-claim verification

Run `pnpm verify:semantic-lineage <branch>` to surface:

- Which capabilities the branch's tree actually contains
- Which capabilities the branch's PR body / commit messages claim
- Discrepancies between the two

The script is deterministic and runs in seconds. Codex audits MUST
include the output before issuing a SAFE verdict on a stacked PR.

## Default posture for new waves

When a new wave is opened, the default posture is:

- Base = `origin/main`
- Inheritance = nothing beyond main
- If a different base is needed, the PR body MUST declare it under a
  "Stacking note" heading and add a row to `docs/ops/stack-topology.md`.

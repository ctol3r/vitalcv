# Merge-Collapse Hazards

Detection rules for the six failure modes that turn a clean stack
into a broken main. Each rule names the hazard, the detection
signature, and the operator action to take.

The post-merge dispatcher (`scripts/verify-post-merge-health.ts`,
this PR) covers many of these; this doc names them so the operator
can recognise the symptom even when the script misses an edge case.

## Hazard 1 — Semantic duplication

**Signature:** two PRs both claim to ship the same canonical
primitive / type / phrase constant. After both merge, the lib has
two competing implementations and consumers import the wrong one.

**Detection:**

```
pnpm --filter @vitalcv/web exec vitest run institutional-trust-primitives
pnpm verify:semantic-lineage              # from PR #396 (if present)
```

If the institutional-trust-primitives suite passes but consumers
report missing exports, look for two files exporting the same symbol
name in different modules.

**Operator action:**
Identify the authoritative implementation per
`docs/ops/stack-topology.md` (PR #396). Delete or rename the
duplicate; ship a follow-up PR.

## Hazard 2 — Protocol regression

**Signature:** a PROTOCOL_RISK merge lands on main and the discovery
endpoints return a different response shape than before. Verifiers
that consumed the old shape break silently.

**Detection:**

```
curl -fs https://<host>/.well-known/did.json | jq '.id, .verificationMethod[0].type'
curl -fs https://<host>/.well-known/openid-credential-issuer | jq '.credential_issuer, .credential_configurations_supported.VitalCVCredential.format'
```

Compare against the canonical shape documented in PR #392 / PR #393:

- `did.json` `.verificationMethod[0].type` is `JsonWebKey2020`
- `did.json` `.verificationMethod[0].publicKeyJwk.crv` is `Ed25519`
- `openid-credential-issuer` `.credential_issuer` is `https://<host>`
- `.credential_configurations_supported.VitalCVCredential.format` is `jwt_vc_json`

**Operator action:**
Revert the offending merge. Protocol surfaces must NEVER carry a
silent shape change.

## Hazard 3 — Replay grammar drift

**Signature:** a PR re-implements `composeLineage` or
`READING_ORDER_LABELS` or `LineageSlots` in a way that no longer
matches `apps/web/lib/trust/replay-grammar.ts`. Downstream consumers
that use `ProvenanceChronology` start rendering different slot
orders.

**Detection:**

```
pnpm --filter @vitalcv/web exec vitest run institutional-trust-primitives
pnpm --filter @vitalcv/web exec vitest run trust-integration-coherence
pnpm --filter @vitalcv/web exec vitest run canonical-provenance-navigation
```

The three suites collectively assert: six-cell binding order; total
`composeLineage`; per-slot label fidelity.

**Operator action:**
Replay grammar is binding (PR #382). A PR that drifts the order or
labels should be reverted or rebased to align.

## Hazard 4 — Provenance divergence

**Signature:** the canonical provenance navigation primitives
(`ProvenanceChronology`, `ProvenanceBinding`, etc.) are re-
implemented in a downstream surface instead of imported from
`@/components/trust/navigation`. Two visual systems coexist.

**Detection:**

```
grep -rn "ProvenanceChronology\|ProvenanceTrail\|ProvenanceBinding" apps/web --include='*.tsx'
# Every match should resolve to an import from @/components/trust/navigation
```

If a match is a local declaration, that's divergence.

**Operator action:**
Replace the local declaration with the canonical import. Ship the
fix as a `fix/*` PR.

## Hazard 5 — Stack-order violations

**Signature:** a stacked PR (e.g. #386) gets merged before its
declared base (#383). The merge succeeds on GitHub because git
permits any merge with non-conflicting diffs, but main now has the
downstream PR's payload referencing files that didn't exist when the
base PR landed.

**Detection:**

```
pnpm verify:stack                         # from PR #396 (if present)
pnpm verify:semantic-lineage              # from PR #396
```

Both scripts read `docs/ops/stack-topology.md` and walk the actual
ancestry; out-of-order merges surface as ancestry mismatches.

**Operator action:**
Revert the downstream merge until the base PR lands. The
canonical-release-graph (this PR) and canonical-merge-graph (PR #397)
are the single source of truth for order.

## Hazard 6 — Hidden ancestry assumptions

**Signature:** a PR's documentation or code refers to a capability
("provenance navigation primitives", "live NPPES resolver", "Ed25519
verification method") that the PR's actual ancestry does NOT contain.
When the PR rebases onto main, the references break.

**Detection:**

```
pnpm generate:codex-context <branch>      # from PR #396
# Compare the "Capabilities INHERITED from ancestry" section against
# the PR body's claims.
```

The stack-aware truth contract (PR #396 doc
`stack-aware-truth-contract.md`) enumerates the banned cross-stack
phrases.

**Operator action:**
Either (a) rebase the branch onto a parent that includes the claimed
capability, (b) implement the capability directly in the branch, or
(c) remove the claim from the PR body. Codex audits should flag this
pre-merge; this hazard catches the post-merge slip.

## Universal post-merge safety net

After ANY merge, run:

```
pnpm verify:post-merge
```

The dispatcher (this PR's `scripts/verify-post-merge-health.ts`)
runs:

- workspace install + lockfile integrity
- wallet-sdk build + artifact presence
- web tsc baseline preserved
- web lint clean
- key file presence: replay-grammar.ts, institutional-language.ts,
  navigation primitives, discovery routes, interop route (only when
  expected on main per the merge graph)

Exits 0 when main is healthy. Exits non-zero with a deterministic
list of regressions otherwise. The operator runs it before walking
away from the terminal.

## What this doc does NOT cover

- **Migration regressions** (e.g. AuditEvent schema delta from PR #390 not applied on the prod DB). Operator's runbook covers DB ops; the dispatcher only checks the schema file's presence, not the DB state.
- **Cloudflare tunnel state.** The tunnel is operator-managed; the dispatcher does not probe it directly. The founder-release-lane doc names the manual probes when a tunnel demo is planned.
- **Vercel preview deployments.** Preview state is operator-managed.

The dispatcher's scope is local repo health after a merge. Anything
beyond that is in the founder-release-lane runbook.

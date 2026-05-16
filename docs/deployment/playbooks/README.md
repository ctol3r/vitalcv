# Institutional Deployment Playbooks

This directory holds the W2-PR114A institutional deployment playbook set. Every
template in `templates/` follows the `vitalcv.playbook.v1` schema and is gated
by the [`deployment-playbook-gate`](../../../.github/workflows/deployment-playbook-gate.yml)
CI workflow.

Spec: [`docs/ops/institutional-deployment-playbooks.md`](../../ops/institutional-deployment-playbooks.md).

## What is enforced

A merge that touches `docs/deployment/playbooks/templates/**`,
`scripts/deploy/playbooks/**`, or the playbook gate workflow runs:

1. **Determinism** — `playbook-hash.mjs` is run twice; digests must match.
2. **Validation** — `playbook-validate.mjs` enforces the v1 schema, the
   ambiguity-branch contract, the recovery / irreversible contract, the
   fail-closed precondition contract, the banned-string contract, and (for
   onboarding) the named-metric contract.
3. **Chaos** — `playbook-chaos.mjs` runs six `C-PLAY-*` modes and asserts each
   fails closed.
4. **Lineage** — `playbook-lineage.mjs` writes a content-addressed
   `vitalcv.playbook-lineage.v1` manifest.
5. **Replay** — `playbook-replay.mjs` recomputes the digest from sources and
   asserts the manifest still matches.

Any of the above failing exits the gate non-zero and blocks the merge.

## Template index

| Playbook | Purpose |
|---|---|
| [`pilot-institutional-rollout.md`](templates/pilot-institutional-rollout.md) | Primary rollout playbook for a new pilot institution |
| [`replay-safe-rollout.md`](templates/replay-safe-rollout.md) | Guidance to keep a rollout replay-safe end-to-end |
| [`institutional-onboarding-sequence.md`](templates/institutional-onboarding-sequence.md) | Tenant onboarding sequence with named metrics |
| [`deployment-recovery.md`](templates/deployment-recovery.md) | Recovery procedures for half-applied deploys and rollback chains |
| [`rollout-escalation-map.md`](templates/rollout-escalation-map.md) | Escalation levels, roles, and triggers across the rollout |
| [`playbook-chaos-scenarios.md`](templates/playbook-chaos-scenarios.md) | Tabletop chaos scenarios operators run before a live rollout |

## How to add a new playbook

1. Copy an existing template into `templates/<new-slug>.md`.
2. Update the frontmatter (`playbook_id`, `version: 1`).
3. Fill every section. The validator rejects empty `## Preconditions`,
   `## Steps`, `## Recovery`, `## Escalation`, `## Evidence Capture`, or
   `## Ambiguity Branches`.
4. Every step must include `verification:`, `evidence_capture:`, `recovery:`
   (or `irreversible:`), `ambiguity_branch:`, and `on_failure:` annotations.
5. Run the gate locally before opening a PR:

   ```bash
   node scripts/deploy/playbooks/playbook-validate.mjs
   node scripts/deploy/playbooks/playbook-hash.mjs
   node scripts/deploy/playbooks/playbook-chaos.mjs
   node scripts/deploy/playbooks/playbook-lineage.mjs --dry-run
   ```

## Versioning

Bump `version:` on any *content* change. The `playbookSetHash` will move
automatically; the version number is for human readers ("which version did we
ship last week?"). Versions are monotonic; never decrement.

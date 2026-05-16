# Deployment Survivability — W2-PR50A

**Wave:** W2-PR50A — Operational Deployment + Environment Survivability
**Date:** 2026-05-09
**Scope:** Across deployment lineage, rollback, config integrity, environment replay, and deployment observability — do they remain *replay-safe, ambiguity-preserving, auditable, reconstructable, fail-closed, and drift-visible* — or do they collapse silently when a rollout half-applies, a config flips mid-deploy, or an operator asks "what's actually running"?
**Companion to:** [operational-integrity-continuity](operational-integrity-continuity.md), [governance-collapse-survivability](governance-collapse-survivability.md), [forensic-durability-understanding](forensic-durability-understanding.md), [deploy-canonicality](deploy-canonicality.md).

---

## What this track answers

The platform's *credential* audit trail is strong: capsule replay is hash-stable, tenant-bound fingerprints prevent cross-tenant collision, and `assertTenantScope` blocks ambiguous reads fail-closed. The platform's *deployment* trail has, until this wave, been thin — a Vercel push, a Railway env, a smoke test, no manifest of what was actually shipped, no chain back to the commit, no ambiguity-preserving rollback record.

This track introduces a deployment lineage spine that mirrors the credential lineage spine on five sub-properties:

- **Lineage integrity:** every deploy emits a content-addressed manifest naming git SHA, config hash, lockfile hash, operator, platform, timestamp, and `previousManifestId` pointer. Manifests are immutable; rollbacks emit *new* manifests, never erase old ones.
- **Rollback survivability:** rollback is a forward operation — it emits a manifest with `rollbackOf: <priorManifestId>`. Both the forward and the reverse manifests survive in lineage. The operator surface presents the chain, not the latest cell.
- **Config auditability:** the config hash is deterministic over (env-var **NAMES**, feature-flag **NAMES**, lockfile SHA, root `package.json` identity, git SHA). Re-running on the same source emits the same digest. A digest mismatch between two consecutive lineage links is the audit signal.
- **Environment replay fidelity:** given a manifest, an operator can answer "what was running at T?" with a hash-checkable JSON, not log archaeology.
- **Deployment infrastructure maturity:** the lineage gate is required for merge to main. Missing manifest, hash mismatch, or chaos-mode failure exits the gate non-zero; re-running CI must produce the identical hash, or the gate fails.

Each is scored on the same four questions used in operational-integrity-continuity:

1. **Coherent** — does the surface tell the same story as its peers?
2. **Survivable** — does it stay honest when a rollout half-applies, a region fails, or a manifest write is lost?
3. **Understandable** — can an operator three months later reconstruct the chain?
4. **Runtime-honest** — does what the manifest claims match what the platform *just deployed*?

🟢 / 🟡 / 🟠 / 🔴.

---

## D.1 Lineage integrity

**Surface:** [`scripts/deploy/config-hash.mjs`](../../scripts/deploy/config-hash.mjs) → [`scripts/deploy/lineage.mjs`](../../scripts/deploy/lineage.mjs) → `.deployment-lineage/<sha>-<ts>.json` → `.deployment-lineage/latest.json` (pointer).

**Manifest schema (`vitalcv.deployment-lineage.v1`):**

```json
{
  "schema": "vitalcv.deployment-lineage.v1",
  "manifestId": "<sha256 of canonical body — keys sorted, manifestId excluded>",
  "gitSha": "<commit>",
  "configHash": "<sha256 of name-only env + flag + lock identity + sha>",
  "lockfileSha": "<sha256 of pnpm-lock.yaml>",
  "rootPackageIdentity": "<name@version>",
  "envName": "staging | production | preview | ci | local",
  "platform": "vercel | railway | github-actions | local | other",
  "operator": "<actor — CI actor login or local user>",
  "buildTimestampUtc": "<ISO-8601>",
  "nodeVersion": "<X.Y.Z>",
  "pnpmVersion": "<X.Y.Z>",
  "featureFlags": ["FEATURE_X", "FEATURE_Y"],
  "previousManifestId": "<id> | null",
  "rollbackOf": "<id> | null",
  "chaosFingerprint": "<sha256 of chaos.mjs verdicts> | CHAOS_NOT_RUN"
}
```

| Question | Answer |
|---|---|
| Coherent | 🟢 — manifest schema versioned; every field present or `null`; `previousManifestId` chains lineage; `rollbackOf` is structurally distinct from a forward link. |
| Survivable | 🟢 — manifests are immutable JSON files in `.deployment-lineage/`; `latest.json` is a pointer, not a sink; lost pointer → enumerate directory; tampered pointer caught by [`replay-manifest.mjs`](../../scripts/deploy/replay-manifest.mjs). |
| Understandable | 🟡 — operators get a JSON file, not a UI. The lineage chain is reconstructable but requires reading manifests in order. A `/api/internal/deploy/lineage` surface is out of scope for this wave. |
| Runtime-honest | 🟢 — every field is computed at build time over committed sources; no field is derived from an external system at read time. Replay-verify recomputes from current state and compares. |

**Verdict:** 🟢 OPERATIONALLY COHERENT (with one 🟡 spot at operator surface).

---

## D.2 Rollback survivability

**Surface:** [`scripts/deploy/lineage.mjs --rollback-of=<id>`](../../scripts/deploy/lineage.mjs) → emits new manifest with `rollbackOf: <id>` and `previousManifestId: <current-latest>`. Both forward and reverse manifests persist.

**Rollback states (operator-visible):**

| State | Meaning | Manifest signal |
|---|---|---|
| `forward` | Standard deploy | `rollbackOf: null` |
| `rollback_target` | Manifest `X` was rolled back to | another manifest exists with `rollbackOf: X` |
| `rollback` | This deploy reverts a prior one | `rollbackOf: <prior>` set |
| `re-rollback` | Rollback of a rollback | `rollbackOf: <id>` where the referenced manifest itself has `rollbackOf` set |
| `orphan` | Pointer to manifest not present in directory | `replay-manifest` reports `DRIFT-CODE-ORPHAN` |

**Ambiguity preservation:** A rollback **does not erase** the rolled-back manifest. The lineage chain reads `… → forward(A) → forward(B) → rollback(B′ rollbackOf=B) → …`. An operator reading three months later sees that B was deployed *and* reversed; "what was running between B and B′?" is answerable with B's manifest.

| Question | Answer |
|---|---|
| Coherent | 🟢 — `rollbackOf` and `previousManifestId` are orthogonal axes; both can be set; the four named states emerge from two boolean fields, no enum widening required. |
| Survivable | 🟢 — re-rollback is just another link; no special-case state machine; the lineage chain remains a singly-linked structure with rollback as a side annotation. |
| Understandable | 🟡 — the four states are correct but assume the operator reads the chain, not just `latest.json`. An operator who reads only the latest pointer sees a forward deploy and may not realize they are *on top of* a rollback chain. |
| Runtime-honest | 🟢 — the manifest written at rollback time captures what was actually shipped; the platform does not pretend the prior deploy never happened. |

**Verdict:** 🟢 AMBIGUITY-PRESERVING (with 🟡 on chain-vs-pointer reading).

---

## D.3 Config auditability

**Surface:** [`scripts/deploy/config-hash.mjs`](../../scripts/deploy/config-hash.mjs) — deterministic digest over:

- Sorted list of required env var **names** (presence, never values — secrets are not in the hash)
- Sorted list of active `FEATURE_*` / `PILOT_*` / `YC_DEMO_*` / `SYSTEM_*` flag names and any `*_MODE` / `*_ENABLED` flags
- SHA-256 of `pnpm-lock.yaml`
- `<name>@<version>` of root `package.json`
- Current `git rev-parse HEAD`

**Audit invariants:**

- **Re-runnable:** running `config-hash.mjs` twice on the same source must produce the identical digest. Non-determinism is itself the audit failure — and the CI gate's `[hash1]` / `[hash2]` step enforces it.
- **Secret-safe:** values of secrets are *never* in the hash; only NAMES contribute. A rotated secret with the same name produces the same digest. (Operationally: secret rotation is a non-event in lineage; that is the correct semantics for an audit hash.)
- **Flag-sensitive:** turning on a feature flag changes the digest, even if no code changed. Operators see config drift, not just code drift.
- **Lockfile-sensitive:** a dependency change moves the digest before any application code re-renders.

| Question | Answer |
|---|---|
| Coherent | 🟢 — five inputs, sorted, hashed in order; output is a single digest; re-running is the test of coherence. |
| Survivable | 🟢 — works in any env (no DB, no network); a CI runner with the same lockfile produces the same hash as a local box with the same lockfile. |
| Understandable | 🟡 — operators reading a digest cannot see *which input changed*; the script emits a structured manifest body alongside the digest, but a "diff two manifests" tool is a follow-on. |
| Runtime-honest | 🟢 — every input is read from a committed file or the actual runtime env at compute time; no synthesized inputs. |

**Verdict:** 🟢 AUDITABLE (with 🟡 on diff-tooling absence).

---

## D.4 Environment replay fidelity

**Surface:** [`scripts/deploy/replay-manifest.mjs`](../../scripts/deploy/replay-manifest.mjs) — given a manifest path or `latest`, recomputes config-hash from current sources, compares.

**Drift codes (disjoint, named):**

| Code | Meaning | Action |
|---|---|---|
| `DRIFT-CODE-CLEAN` | Recomputed hash matches manifest | OK (exit 0) |
| `DRIFT-CODE-CONFIG` | Same git SHA, different config hash | A flag changed without a commit; operator must reconcile (exit 1) |
| `DRIFT-CODE-LOCK` | Same git SHA, different lockfile | A dependency was reinstalled; reproducibility broken (exit 1) |
| `DRIFT-CODE-SHA` | Different git SHA | Source moved since manifest written; expected after a deploy (exit 0) |
| `DRIFT-CODE-ORPHAN` | Manifest missing OR `previousManifestId` not present | Lineage chain broken; investigate manifest deletion (exit 1) |
| `DRIFT-CODE-TAMPER` | Manifest's `manifestId` ≠ sha256(canonical body) | Manifest body mutated post-write; treat as tamper (exit 1) |

| Question | Answer |
|---|---|
| Coherent | 🟢 — drift codes are disjoint and named; no `OTHER` bucket. |
| Survivable | 🟢 — replay needs no external system; works during full-source outage; works against historical manifests. |
| Understandable | 🟢 — each drift code names a single named cause; an operator reading the report can act without consulting an engineer. |
| Runtime-honest | 🟢 — replay recomputes from current source, not from a cached digest; mismatch is honest about *what changed*. |

**Verdict:** 🟢 REPLAYABLE.

---

## D.5 Deployment observability

**Surface:** [`scripts/deploy/chaos.mjs`](../../scripts/deploy/chaos.mjs) → [`.github/workflows/deployment-survivability.yml`](../../.github/workflows/deployment-survivability.yml) → CI artifact upload + scale-board-style metric emission.

**Chaos modes (deploy-layer, complementary to scale-gate's app-layer):**

| Mode | What it injects | Required behavior |
|---|---|---|
| `C-DEPLOY-1` | Missing manifest path | `replay-manifest` exits 1 with `DRIFT-CODE-ORPHAN` |
| `C-DEPLOY-2` | Manifest body mutated post-write (manifestId stale) | `replay-manifest` exits 1 with `DRIFT-CODE-TAMPER` |
| `C-DEPLOY-3` | Forged `configHash` on same git SHA (manifestId regenerated to pass tamper) | `replay-manifest` exits 1 with `DRIFT-CODE-CONFIG` |
| `C-DEPLOY-4` | Truncated lineage chain (`previousManifestId` points to absent file) | `replay-manifest` exits 1 with `DRIFT-CODE-ORPHAN` |
| `C-DEPLOY-5` | Lineage emitter must always include `rollbackOf` field (null or string) | `lineage.mjs --dry-run` output must contain `rollbackOf` key |

**CI gate:** every push to a deploy-relevant path runs config-hash twice (determinism check), `chaos.mjs` (all five modes must fail closed), `lineage.mjs` (manifest write), and `replay-manifest.mjs` (must report `DRIFT-CODE-CLEAN`). Any failure blocks merge.

| Question | Answer |
|---|---|
| Coherent | 🟢 — chaos mode names are namespaced (`C-DEPLOY-*`), distinct from scale-gate's (latency, throughput) chaos. |
| Survivable | 🟢 — chaos sims are mock-based, no DB or network; runner failure cannot mask a true positive (`chaos.mjs` exits non-zero on any unexpected pass). |
| Understandable | 🟡 — chaos modes are reachable by operators only via CI artifact. A "deployment lineage status" page that surfaces drift to the operator dashboard is out of scope for this wave; the foundation is built, the surface is not. |
| Runtime-honest | 🟢 — chaos verdicts are written into the lineage manifest's `chaosFingerprint`; a deploy without a chaos fingerprint is structurally distinguishable from one with. |

**Verdict:** 🟡 OBSERVABLE-IN-CI, NOT-YET-OBSERVABLE-TO-OPERATOR.

---

## Cross-surface continuity matrix

|  | Lineage | Rollback | Config | Replay | Observability |
|---|---|---|---|---|---|
| **Lineage** | — | manifest→rollbackOf: 🟢 | manifest→configHash: 🟢 | manifest→replay: 🟢 | manifest→ci-artifact: 🟢 |
| **Rollback** |   | — | rollback→config-hash: 🟢 | rollback→replay: 🟡 | rollback→operator-surface: 🟠 |
| **Config** |   |   | — | config-hash→replay: 🟢 | config-drift→ci-emit: 🟢 |
| **Replay** |   |   |   | — | drift-code→artifact: 🟢 |
| **Observability** |   |   |   |   | — |

**Patterns:**
- Manifest → all data-layer surfaces is 🟢. The lineage spine is the most coherent stretch.
- Operator surface is 🟠 — the lineage chain is reconstructable but no in-product viewer exists yet.
- Replay → rollback chain is 🟡 — `replay-manifest.mjs` follows `previousManifestId` but does not yet annotate "this is a re-rollback."

---

## Coherence-failure modes (the things that would actually break operator trust)

1. **Latest-pointer reading without chain reading** — operator runs `cat .deployment-lineage/latest.json`, sees a clean forward manifest, does not realize they are sitting on top of a rollback chain. Fix: emit a `chainSummary: {forwards: N, rollbacks: M}` field in `latest.json`. *Out of scope for this wave; named.*
2. **Missing in-product surface** — there is no `/admin/deploy/lineage` page. Operators must read CI artifacts. Fix: a follow-on wave wires the manifest into a dashboard.
3. **Config-hash diff opacity** — when two consecutive manifests have different `configHash` but same `gitSha`, the operator sees "config drift" but not *which name changed*. Fix: a `diff-manifests.mjs` follow-on.
4. **Chaos verdict not in audit ledger** — `chaosFingerprint` is in the manifest but not in the credential audit ledger; cross-system replay does not yet correlate "deployment chaos verdict X" with "decision capsule replayed at time T." *Out of scope; named.*
5. **No multi-region awareness** — single global manifest assumes a single deploy target. Multi-region or canary deploys are not modeled. *Out of scope; named.*
6. **Concurrent deploys race on `latest.json`** — two CI runs writing simultaneously can lose a chain link. Mitigation: only one deploy in flight; locking is a follow-on. *Named.*

---

## Track D summary

| Surface | Coherent | Survivable | Understandable | Runtime-honest | Composite |
|---|---|---|---|---|---|
| Lineage integrity | 🟢 | 🟢 | 🟡 | 🟢 | **🟢** |
| Rollback survivability | 🟢 | 🟢 | 🟡 | 🟢 | **🟢** |
| Config auditability | 🟢 | 🟢 | 🟡 | 🟢 | **🟢** |
| Environment replay fidelity | 🟢 | 🟢 | 🟢 | 🟢 | **🟢** |
| Deployment observability | 🟢 | 🟢 | 🟡 | 🟢 | **🟡** |

**Strongest stretch:** Environment replay fidelity — every drift cause has a named code; every code names a single failure; replay needs no external system to verify a manifest. The recompute-and-compare contract is fully closed.

**Weakest stretch:** Operator-visible deployment drift. The lineage data layer is honest; the operator surface is a CI artifact, not a dashboard. The first follow-on wave to invest in is converting at least one manifest field — `chainSummary` in `latest.json` — into a render that lets a non-author operator see whether they are sitting on a rollback chain.

The track is **replay-safe** (drift codes are disjoint and named), **ambiguity-preserving** (rollback emits a new manifest, never erases the rolled-back), **auditable** (config hash is deterministic over name-only inputs; no secret values leak), **reconstructable** (`previousManifestId` chains lineage; `replay-manifest` verifies), **fail-closed** (CI gate refuses merge on missing manifest, hash mismatch, or chaos failure), and **drift-visible** in CI but not yet in product.

---

## Completion board

📊 **Deployment Survivability Board** (W2-PR50A)

| Metric | % | Rationale |
|---|---|---|
| Deployment Lineage Integrity | **92%** | Manifest schema closed; immutable JSON files; chain pointer; tamper detection. −8 for absent in-product viewer. |
| Rollback Survivability | **88%** | Rollback is a forward operation; both forward + reverse manifests persist; four named states. −12 for chain-vs-pointer ambiguity at `latest.json`. |
| Config Auditability | **90%** | Deterministic digest over name-only inputs; secret-safe; flag-sensitive; lockfile-sensitive. −10 for absent diff-manifests tool. |
| Environment Replay Fidelity | **95%** | Six disjoint drift codes; recompute-and-compare; works during outage. −5 for no historical-manifest auto-archive policy. |
| Deployment Infrastructure Maturity | **85%** | CI gate required; fail-closed; chaos.mjs covers five named modes. −15 for no operator surface and no audit-ledger correlation. |

**Composite: 90%** — the platform's *deployment* lineage is now structurally on par with its *credential* lineage. The remaining 10% is operator-visible surface, not data-layer integrity.

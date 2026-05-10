# Institutional Deployment Templates Blueprint

> Wave: **W2-PR80A** — Institutional Deployment Templates
> Package: [`@vitalcv/deployment-templates`](../../packages/deployment-templates/)
> CI gate: [`.github/workflows/deployment-templates.yml`](../../.github/workflows/deployment-templates.yml)
> Status: foundation; reflects planned controls, not enforced production policies.

This document defines the repeatable institutional deployment blueprints for VitalCV. It is the operational counterpart to the deployment-survivability rubric: where survivability asks _"can a single deployment be replayed?"_, this blueprint asks _"can a class of institutions be onboarded the same way every time?"_

## Operating questions

Each template surface answers one of four questions. If a surface cannot answer its question with a literal, frozen value, the surface is incomplete.

1. **Coherent** — Does the template compose into a single, deterministic posture without relaxation?
2. **Replay-safe** — Does the same `(template, institution, env)` always produce the same `presetHash`?
3. **Lineage-honest** — Can every rollout be traced back to its genesis manifest, with rollbacks recorded as new manifests (not mutations)?
4. **Drift-detectable** — Does re-deriving the preset from current registry state surface every divergence with a named `DRIFT-*` code?

## Surfaces

### 1. Templates ([`templates.ts`](../../packages/deployment-templates/templates.ts))

Four registered templates as of foundation:

| `templateId` | Role | Tenant scope | Codex SAFE |
|---|---|---|---|
| `vitalcv.template.health-system-issuer` | health-system-issuer | single | required |
| `vitalcv.template.payer-verifier` | payer-verifier | single | required |
| `vitalcv.template.pilot-tenant` | pilot-tenant | pilot-isolated | not required |
| `vitalcv.template.multi-region-issuer` | multi-region-issuer | federated | required |

Templates are **immutable**. New behavior ships as a new `templateVersion`. Presets bind to both `templateId` AND `templateVersion`, so a registry mutation surfaces as `DRIFT-TEMPLATE-VERSION-MISMATCH`.

### 2. Trust-policy bundles ([`policyBundles.ts`](../../packages/deployment-templates/policyBundles.ts))

Five composable bundles. The composition rule is the load-bearing invariant: **a later bundle MUST NOT relax any field set by an earlier bundle.** Attempting to compose `[production-hardened, pilot]` throws.

| Bundle | Posture (representative) | Use case |
|---|---|---|
| `vitalcv.bundle.foundation` | foundation-only / unverified-foundation | minimum for any deployment |
| `vitalcv.bundle.issuer` | foundation-only | issuer-side audit coverage |
| `vitalcv.bundle.verifier` | foundation-only | verifier-side replay coverage |
| `vitalcv.bundle.pilot` | superadmin-gate disabled | time-boxed pilot only |
| `vitalcv.bundle.production-hardened` | enforced (redaction / retention / authority / superadmin) | production rollouts |

Disclaimers ship verbatim with the bundle and are preserved into onboarding kits and compliance evidence.

### 3. Replay-safe presets ([`presets.ts`](../../packages/deployment-templates/presets.ts))

A preset is `(template + institution + env)` frozen to a `presetHash`. The hash inputs are deliberately constrained:

- `templateId`, `templateVersion`, `institutionId`, `env`
- sorted `bundleIds`
- sorted env-var **NAMES** (no values)
- sorted feature-flag `(name, state)` pairs
- resolved `posture` (sorted via `stableStringify`)

The hash deliberately does NOT include `frozenAt` or any secret value — secret rotation cannot invalidate a historical replay.

### 4. Rollout lineage ([`rolloutLineage.ts`](../../packages/deployment-templates/rolloutLineage.ts))

Every apply / rollback emits a `DeploymentRolloutManifest`. Manifests form an append-only chain via `previousManifestId`. Rollback is **forward-only** — it emits a NEW manifest with `rollbackOf` set, never mutates the prior manifest.

`reconstructLineage()` returns three lists: `chain`, `orphans`, `crossTenantLeaks`. Cross-tenant leaks must always be empty in a tenant-scoped query; the field is surfaced explicitly so a regression cannot pass silently.

### 5. Environment onboarding kits ([`onboarding.ts`](../../packages/deployment-templates/onboarding.ts))

Generated deterministically from `(templateId, templateVersion, institutionId, env)`. Each kit ships:

- A six-step **preflight checklist**, including explicit Codex SAFE step and ES256-only signing requirement (HS256 banned per PR-B closure)
- Required env-var **names** with rationale (no values)
- Verbatim bundle disclaimers
- Expected audit-event types
- A `kitHash` for tamper detection

Pilot-isolated templates **cannot** be onboarded into prod env — fail-closed at kit generation.

### 6. Deployment chaos ([`chaos.ts`](../../packages/deployment-templates/chaos.ts))

Seven modes, every CI run:

| Mode | What it tries | Fail-closed surface |
|---|---|---|
| `C-TEMPLATE-FROZEN-FIELD-MUTATION` | tamper with frozen preset | `verifyPresetHash` |
| `C-TEMPLATE-BUNDLE-DOWNGRADE` | compose `[hardened, pilot]` | `composeBundles` |
| `C-TEMPLATE-MANIFEST-ORPHAN` | inject manifest with phantom previous | `reconstructLineage` |
| `C-TEMPLATE-PRESET-HASH-COLLISION` | check env-change perturbs hash | `computePresetHash` |
| `C-TEMPLATE-POSTURE-WIDENING` | check pilot bundle posture stable | bundle registry |
| `C-TEMPLATE-MISSING-CODEX-SAFE` | apply issuer template without verdict | `emitRolloutManifest` |
| `C-TEMPLATE-ENV-CROSS-APPLY` | onboard pilot into prod | `generateOnboardingKit` |

The fingerprint over all SAFE verdicts is recorded in every rollout manifest. A future replay that sees a different fingerprint detects that the chaos contract changed.

### 7. Drift detection ([`drift.ts`](../../packages/deployment-templates/drift.ts))

Seven drift codes. `DRIFT-TEMPLATE-CLEAN` is a real positive verdict, not the absence of others.

```
DRIFT-TEMPLATE-CLEAN                  // no divergence
DRIFT-TEMPLATE-VERSION-MISMATCH       // template version moved
DRIFT-TEMPLATE-BUNDLE-CHANGED         // bundle list differs
DRIFT-TEMPLATE-ENVVAR-DROPPED         // required env var no longer in template
DRIFT-TEMPLATE-FLAG-CHANGED           // feature-flag set differs
DRIFT-TEMPLATE-POSTURE-RELAXED        // composed posture is weaker
DRIFT-TEMPLATE-MANIFEST-ORPHAN        // hash mismatch / re-derive failure
```

## Workflow: rolling out a new institution

1. Operator picks a `templateId` matching their role.
2. `generateOnboardingKit({templateId, institutionId, env})` produces a kit.
3. Operator completes preflight checklist (env vars, KMS, observability subscriptions, Codex arrangement, disclaimer ack).
4. CI builds the package and runs `deployment-templates.yml` workflow:
   - `pnpm --filter @vitalcv/deployment-templates test` (vitest suites)
   - `node scripts/deploy-templates/validate.mjs` (template integrity)
   - `node scripts/deploy-templates/chaos.mjs` (chaos verdicts + fingerprint)
   - smoke onboarding-kit generation
5. `freezePreset({templateId, institutionId, env, frozenAt})` produces the preset; `presetHash` is the primary key for replay.
6. `emitRolloutManifest({preset, ...metadata})` produces the manifest. Issuer templates require a real Codex SAFE verdict id (subagent stand-ins do not satisfy).
7. After rollout, operator periodically re-runs `detectDrift({manifest, preset, detectedAt})`. Any non-CLEAN verdict triggers an investigation; a posture relaxation is treated as a security regression.

## Rollback semantics

Rollback emits a NEW manifest:

```
m1: previousManifestId=null, rollbackOf=null            // genesis apply
m2: previousManifestId=m1,    rollbackOf=null            // forward apply
m3: previousManifestId=m2,    rollbackOf=m1              // rollback
```

`reconstructLineage` returns `[m1, m2, m3]` in chain order. The original `m1` and `m2` are never mutated; lineage remains complete and replayable.

## Banned strings — preserved verbatim

The bundle disclaimers (and onboarding kit copy) are tested against the same banned-string list as the truth contract. The list per [CLAUDE.md](../../CLAUDE.md):

> `automatically verified`, `guaranteed verification`, `complete credentialing`, `instant credentialing`, `legally accepted`, `risk transferred`, `final verification without review`, `source confirmed before response`, `certified compliant`, `HIPAA compliant`, `SOC2 certified`. No status label may be the bare word `Verified`.

The CI suite verifies bundle disclaimers contain none of these.

## Completion board

| Metric | Foundation verdict |
|---|---|
| Deployment Repeatability % | high — 4 templates × 4 envs all reproduce identical `presetHash` for identical inputs |
| Replay-Safe Rollouts % | high — `presetHash` is deterministic; `verifyPresetHash` rejects tamper |
| Trust Policy Portability % | medium — 5 bundles compose without relaxation; production-hardened present |
| Deployment Drift Visibility % | medium — every drift case maps to a named code, but registry-side observability not yet wired |
| Institutional Deployment Maturity % | foundation — templates and CI gate live; production-hardened bundle remains foundation-shape on compliance report |

## Final verdicts

- **Strongest deployment-repeatability gain**: deterministic `presetHash` over `(templateId, templateVersion, institutionId, env, bundleIds, envVarNames, flags, posture)` — same inputs always produce the same hash, regardless of clock or operator.
- **Strongest replay-safe rollout gain**: rollback as forward-only manifest emission. Old manifests are never mutated; the chain reconstructs without loss for arbitrary forward / rollback sequences.
- **Biggest remaining deployment-friction risk**: institutions still supply env-var **values** out-of-band. The template owns the names and rationale; secret distribution remains the operator's responsibility and is the single largest source of "applied-but-broken" rollouts.
- **Deployment-template verdict**: foundation. The package, tests, chaos suite, and CI gate are wired. Production hardening (env-var value distribution, observability into drift detection over time, federated rollout sequencing) is the natural next wave.

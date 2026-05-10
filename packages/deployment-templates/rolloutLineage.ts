/**
 * W2-PR80A — Rollout lineage.
 *
 * Each apply / rollback emits a DeploymentRolloutManifest. Manifests form an
 * append-only chain via previousManifestId; rollbacks emit a new manifest with
 * rollbackOf set. The chain is the authoritative record of "what was deployed
 * when, by whom, atop which preset."
 *
 * Invariants:
 *  - Manifests are immutable.
 *  - Rollback is forward-only: it emits a new manifest, never mutates an old one.
 *  - A template requiring Codex SAFE MUST have a non-null codexSafeVerdictId
 *    on apply (rollback is exempt — rollback is a recovery action).
 *  - Tenant scope is preserved via institutionId on every manifest.
 */

import crypto from 'crypto';
import type { DeploymentPreset, DeploymentRolloutManifest } from './types';
import { DEPLOYMENT_ROLLOUT_SCHEMA } from './types';
import { getTemplate } from './templates';
import { verifyPresetHash } from './presets';

export type EmitRolloutInput = Readonly<{
  preset: DeploymentPreset;
  operator: string;
  rolloutAt: string; // ISO timestamp
  gitSha: string;
  previousManifestId: string | null;
  rollbackOf: string | null;
  codexSafeVerdictId: string | null;
  chaosFingerprint: string;
}>;

function deriveManifestId(input: EmitRolloutInput): string {
  // ManifestId is deterministic over (presetHash, operator, rolloutAt, gitSha,
  // previousManifestId, rollbackOf). Two callers writing the same manifest
  // with the same inputs collide intentionally — replay equivalence.
  const canonical = {
    presetHash: input.preset.presetHash,
    operator: input.operator,
    rolloutAt: input.rolloutAt,
    gitSha: input.gitSha,
    previousManifestId: input.previousManifestId ?? '',
    rollbackOf: input.rollbackOf ?? '',
    chaosFingerprint: input.chaosFingerprint,
  };
  const digest = crypto
    .createHash('sha256')
    .update(JSON.stringify(canonical))
    .digest('hex');
  return `manifest_${digest.slice(0, 32)}`;
}

export function emitRolloutManifest(input: EmitRolloutInput): DeploymentRolloutManifest {
  // Fail-closed gates run BEFORE manifest is constructed.
  if (!verifyPresetHash(input.preset)) {
    throw new Error(
      `deployment-templates: preset hash mismatch for ${input.preset.presetId} — fail-closed; refusing to emit manifest.`,
    );
  }
  const template = getTemplate(input.preset.templateId);

  const isApply = input.rollbackOf === null;
  if (isApply && template.requiresCodexSafe && !input.codexSafeVerdictId) {
    throw new Error(
      `deployment-templates: template ${template.templateId} requires Codex SAFE verdict on apply — none supplied; fail-closed.`,
    );
  }

  if (input.rollbackOf !== null && input.previousManifestId === null) {
    throw new Error(
      'deployment-templates: rollback must reference a previousManifestId in the chain — fail-closed.',
    );
  }

  const manifestId = deriveManifestId(input);

  return Object.freeze({
    schema: DEPLOYMENT_ROLLOUT_SCHEMA,
    manifestId,
    presetHash: input.preset.presetHash,
    templateId: input.preset.templateId,
    templateVersion: input.preset.templateVersion,
    institutionId: input.preset.institutionId,
    env: input.preset.env,
    operator: input.operator,
    rolloutAt: input.rolloutAt,
    gitSha: input.gitSha,
    previousManifestId: input.previousManifestId,
    rollbackOf: input.rollbackOf,
    codexSafeVerdictId: input.codexSafeVerdictId,
    chaosFingerprint: input.chaosFingerprint,
  });
}

/**
 * Reconstruct a rollout chain from a list of manifests. Returns the chain
 * ordered oldest → newest, plus any orphans (manifests whose previousManifestId
 * does not appear in the input). Orphans are a drift signal.
 */
export type LineageReconstruction = Readonly<{
  chain: ReadonlyArray<DeploymentRolloutManifest>;
  orphans: ReadonlyArray<DeploymentRolloutManifest>;
  /** Cross-tenant manifests in the input. MUST be empty after tenant filter. */
  crossTenantLeaks: ReadonlyArray<DeploymentRolloutManifest>;
}>;

export function reconstructLineage(
  manifests: ReadonlyArray<DeploymentRolloutManifest>,
  filter: { institutionId: string; env: string },
): LineageReconstruction {
  // Tenant filter first — defense in depth.
  const scoped = manifests.filter(
    (m) => m.institutionId === filter.institutionId && m.env === filter.env,
  );
  const crossTenantLeaks = manifests.filter(
    (m) => m.institutionId !== filter.institutionId || m.env !== filter.env,
  );

  const byId = new Map<string, DeploymentRolloutManifest>();
  for (const m of scoped) {
    byId.set(m.manifestId, m);
  }

  const genesisManifests = scoped.filter((m) => m.previousManifestId === null);
  if (genesisManifests.length > 1) {
    throw new Error(
      `deployment-templates: lineage has ${genesisManifests.length} genesis manifests for ${filter.institutionId}/${filter.env}; chain is forked — fail-closed.`,
    );
  }

  const chain: DeploymentRolloutManifest[] = [];
  if (genesisManifests.length === 1) {
    let cursor: DeploymentRolloutManifest | undefined = genesisManifests[0];
    const visited = new Set<string>();
    while (cursor) {
      if (visited.has(cursor.manifestId)) {
        throw new Error(
          `deployment-templates: lineage cycle detected at ${cursor.manifestId} — fail-closed.`,
        );
      }
      visited.add(cursor.manifestId);
      chain.push(cursor);
      const next: DeploymentRolloutManifest | undefined = scoped.find(
        (m) => m.previousManifestId === cursor!.manifestId,
      );
      cursor = next;
    }
  }

  const inChain = new Set(chain.map((m) => m.manifestId));
  const orphans = scoped.filter((m) => !inChain.has(m.manifestId));

  return Object.freeze({
    chain: Object.freeze(chain),
    orphans: Object.freeze(orphans),
    crossTenantLeaks: Object.freeze(crossTenantLeaks),
  });
}

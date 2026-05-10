/**
 * W2-PR80A — Replay-safe deployment presets.
 *
 * A preset is the materialized form of (template + institution + env). The
 * presetHash is the load-bearing identifier: same inputs → same hash, every
 * time, on every machine. The hash deliberately does NOT include secret
 * values — only env-var NAMES — so secret rotation does not invalidate
 * historical replays.
 *
 * Determinism rules:
 *  - All arrays sorted before hashing.
 *  - All objects serialized via stable-stringify (sorted keys).
 *  - frozenAt is supplied by caller (tests inject fixed timestamps).
 */

import crypto from 'crypto';
import type {
  DeploymentEnv,
  DeploymentPreset,
  DeploymentTemplate,
  TrustPolicyPosture,
} from './types';
import { DEPLOYMENT_PRESET_SCHEMA } from './types';
import { composeBundles } from './policyBundles';
import { getTemplate } from './templates';

/** Stable JSON: sort keys at every level so output is byte-identical for same input. */
export function stableStringify(value: unknown): string {
  return JSON.stringify(value, (_key, v) => {
    if (v && typeof v === 'object' && !Array.isArray(v)) {
      return Object.keys(v as Record<string, unknown>)
        .sort()
        .reduce<Record<string, unknown>>((acc, k) => {
          acc[k] = (v as Record<string, unknown>)[k];
          return acc;
        }, {});
    }
    return v;
  });
}

export type FreezePresetInput = Readonly<{
  templateId: string;
  institutionId: string;
  env: DeploymentEnv;
  /** Operator-supplied feature-flag overrides. Names not in template are rejected. */
  flagOverrides?: ReadonlyArray<{ name: string; state: 'on' | 'off' }>;
  /** ISO timestamp for frozenAt. Tests inject; production passes new Date().toISOString(). */
  frozenAt: string;
}>;

function applyFlagOverrides(
  template: DeploymentTemplate,
  overrides: ReadonlyArray<{ name: string; state: 'on' | 'off' }>,
): ReadonlyArray<{ name: string; state: 'on' | 'off' }> {
  const knownFlags = new Set(template.featureFlags.map((f) => f.name));
  for (const o of overrides) {
    if (!knownFlags.has(o.name)) {
      throw new Error(
        `deployment-templates: flag override ${o.name} is not declared by template ${template.templateId} — fail-closed.`,
      );
    }
  }
  const overrideMap = new Map(overrides.map((o) => [o.name, o.state] as const));
  const loadBearingOff = template.featureFlags.filter(
    (f) => f.loadBearing && (overrideMap.get(f.name) ?? f.defaultState) === 'off',
  );
  if (loadBearingOff.length > 0) {
    throw new Error(
      `deployment-templates: load-bearing flag(s) cannot be off: ${loadBearingOff
        .map((f) => f.name)
        .join(', ')} — fail-closed.`,
    );
  }
  return template.featureFlags
    .map((f) => ({
      name: f.name,
      state: overrideMap.get(f.name) ?? f.defaultState,
    }))
    .sort((a, b) => a.name.localeCompare(b.name));
}

/**
 * Compute preset hash. Hash inputs:
 *  - templateId, templateVersion, institutionId, env
 *  - sorted bundleIds
 *  - sorted env-var NAMES
 *  - sorted flag {name, state} pairs
 *  - resolved posture (sorted keys via stableStringify)
 *
 * frozenAt is NOT hashed — two presets created seconds apart with identical
 * config must produce identical hashes (replay equivalence).
 */
export function computePresetHash(input: {
  templateId: string;
  templateVersion: string;
  institutionId: string;
  env: DeploymentEnv;
  bundleIds: ReadonlyArray<string>;
  envVarNames: ReadonlyArray<string>;
  featureFlags: ReadonlyArray<{ name: string; state: 'on' | 'off' }>;
  resolvedPosture: TrustPolicyPosture;
}): string {
  const canonical = {
    templateId: input.templateId,
    templateVersion: input.templateVersion,
    institutionId: input.institutionId,
    env: input.env,
    bundleIds: [...input.bundleIds].sort(),
    envVarNames: [...input.envVarNames].sort(),
    featureFlags: [...input.featureFlags].sort((a, b) => a.name.localeCompare(b.name)),
    resolvedPosture: input.resolvedPosture,
  };
  return crypto.createHash('sha256').update(stableStringify(canonical)).digest('hex');
}

export function freezePreset(input: FreezePresetInput): DeploymentPreset {
  const template = getTemplate(input.templateId);
  const composition = composeBundles(template.policyBundleIds);
  const featureFlags = applyFlagOverrides(template, input.flagOverrides ?? []);
  const envVarNames = template.envVars
    .filter((v) => v.scope === 'all' || v.scope === input.env)
    .map((v) => v.name)
    .sort();

  const presetHash = computePresetHash({
    templateId: template.templateId,
    templateVersion: template.templateVersion,
    institutionId: input.institutionId,
    env: input.env,
    bundleIds: template.policyBundleIds,
    envVarNames,
    featureFlags,
    resolvedPosture: composition.posture,
  });

  const presetId = `${template.templateId}::${input.institutionId}::${input.env}::${presetHash.slice(0, 12)}`;

  return Object.freeze({
    schema: DEPLOYMENT_PRESET_SCHEMA,
    presetId,
    presetHash,
    templateId: template.templateId,
    templateVersion: template.templateVersion,
    institutionId: input.institutionId,
    env: input.env,
    bundleIds: template.policyBundleIds,
    envVarNames: Object.freeze(envVarNames),
    featureFlags: Object.freeze(featureFlags),
    resolvedPosture: composition.posture,
    frozenAt: input.frozenAt,
  });
}

/**
 * Verify a preset by recomputing its hash from its declared inputs. Returns
 * true iff recomputed hash matches the stored hash. A failure here means the
 * preset has been tampered with after freezing.
 */
export function verifyPresetHash(preset: DeploymentPreset): boolean {
  const recomputed = computePresetHash({
    templateId: preset.templateId,
    templateVersion: preset.templateVersion,
    institutionId: preset.institutionId,
    env: preset.env,
    bundleIds: preset.bundleIds,
    envVarNames: preset.envVarNames,
    featureFlags: preset.featureFlags,
    resolvedPosture: preset.resolvedPosture,
  });
  return recomputed === preset.presetHash;
}

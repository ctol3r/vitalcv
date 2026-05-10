/**
 * W2-PR80A — Deployment-template chaos simulations.
 *
 * Each chaos mode tries to make the template / preset / manifest pipeline
 * accept something it should reject. SAFE = correctly rejected (fail-closed).
 * UNSAFE = leaked through; the pipeline failed open.
 *
 * The chaos fingerprint over all SAFE verdicts is recorded in every rollout
 * manifest, so a future replay can detect that the chaos contract changed.
 */

import crypto from 'crypto';
import type { ChaosVerdict, DeploymentPreset, TemplateChaosMode } from './types';
import { TEMPLATE_CHAOS_MODES } from './types';
import { freezePreset, verifyPresetHash } from './presets';
import { composeBundles, getBundle } from './policyBundles';
import { emitRolloutManifest, reconstructLineage } from './rolloutLineage';
import { generateOnboardingKit } from './onboarding';

function safe(mode: TemplateChaosMode, rationale: string): ChaosVerdict {
  return Object.freeze({ mode, verdict: 'SAFE', rationale });
}
function unsafe(mode: TemplateChaosMode, rationale: string): ChaosVerdict {
  return Object.freeze({ mode, verdict: 'UNSAFE', rationale });
}

function expectThrow(fn: () => unknown): { threw: boolean; message: string } {
  try {
    fn();
    return { threw: false, message: '' };
  } catch (err) {
    return { threw: true, message: err instanceof Error ? err.message : String(err) };
  }
}

const FROZEN_AT = '2026-05-09T00:00:00.000Z';

/**
 * Mode 1: frozen-field mutation. A preset's posture is mutated in-memory
 * post-freeze; verifyPresetHash MUST detect the mismatch.
 */
function chaosFrozenFieldMutation(): ChaosVerdict {
  const mode: TemplateChaosMode = 'C-TEMPLATE-FROZEN-FIELD-MUTATION';
  const preset = freezePreset({
    templateId: 'vitalcv.template.health-system-issuer',
    institutionId: 'inst_chaos_1',
    env: 'pilot',
    frozenAt: FROZEN_AT,
  });
  const tampered: DeploymentPreset = {
    ...preset,
    resolvedPosture: { ...preset.resolvedPosture, redaction: 'enforced' },
  };
  if (verifyPresetHash(tampered)) {
    return unsafe(mode, 'verifyPresetHash returned true on tampered preset');
  }
  return safe(mode, 'tampered preset rejected by hash verification');
}

/**
 * Mode 2: bundle downgrade. Compose a template's bundles, then attempt to
 * compose with a relaxed bundle appended; composeBundles MUST throw.
 */
function chaosBundleDowngrade(): ChaosVerdict {
  const mode: TemplateChaosMode = 'C-TEMPLATE-BUNDLE-DOWNGRADE';
  const result = expectThrow(() =>
    composeBundles(['vitalcv.bundle.production-hardened', 'vitalcv.bundle.pilot']),
  );
  if (!result.threw) {
    return unsafe(mode, 'composeBundles allowed prod-hardened → pilot relaxation');
  }
  if (!result.message.includes('relaxes')) {
    return unsafe(mode, `composeBundles threw but not for relaxation: ${result.message}`);
  }
  return safe(mode, 'bundle relaxation rejected');
}

/**
 * Mode 3: manifest orphan. Reconstruct lineage with a manifest whose
 * previousManifestId is unknown; lineage MUST surface as orphan, not chain.
 */
function chaosManifestOrphan(): ChaosVerdict {
  const mode: TemplateChaosMode = 'C-TEMPLATE-MANIFEST-ORPHAN';
  const preset = freezePreset({
    templateId: 'vitalcv.template.payer-verifier',
    institutionId: 'inst_chaos_3',
    env: 'pilot',
    frozenAt: FROZEN_AT,
  });
  const m1 = emitRolloutManifest({
    preset,
    operator: 'ci_chaos',
    rolloutAt: FROZEN_AT,
    gitSha: 'sha_genesis',
    previousManifestId: null,
    rollbackOf: null,
    codexSafeVerdictId: 'codex_chaos_v1',
    chaosFingerprint: 'fp_chaos',
  });
  const orphan = emitRolloutManifest({
    preset,
    operator: 'ci_chaos',
    rolloutAt: FROZEN_AT,
    gitSha: 'sha_orphan',
    previousManifestId: 'manifest_does_not_exist',
    rollbackOf: null,
    codexSafeVerdictId: 'codex_chaos_v2',
    chaosFingerprint: 'fp_chaos',
  });
  const lineage = reconstructLineage([m1, orphan], {
    institutionId: preset.institutionId,
    env: preset.env,
  });
  if (lineage.orphans.length === 0) {
    return unsafe(mode, 'orphan manifest absorbed into chain silently');
  }
  return safe(mode, `${lineage.orphans.length} orphan(s) surfaced`);
}

/**
 * Mode 4: preset hash collision. Two different inputs MUST NOT produce the
 * same hash. Verify by freezing two presets with one differing field.
 */
function chaosPresetHashCollision(): ChaosVerdict {
  const mode: TemplateChaosMode = 'C-TEMPLATE-PRESET-HASH-COLLISION';
  const a = freezePreset({
    templateId: 'vitalcv.template.payer-verifier',
    institutionId: 'inst_chaos_4',
    env: 'pilot',
    frozenAt: FROZEN_AT,
  });
  const b = freezePreset({
    templateId: 'vitalcv.template.payer-verifier',
    institutionId: 'inst_chaos_4',
    env: 'staging', // env differs
    frozenAt: FROZEN_AT,
  });
  if (a.presetHash === b.presetHash) {
    return unsafe(mode, 'preset hash collision: env change did not perturb hash');
  }
  return safe(mode, 'differing inputs produced differing hashes');
}

/**
 * Mode 5: posture widening attempt. Manually re-derive a preset's bundle
 * composition to make sure no path produces a posture wider than what the
 * declared bundles allow.
 */
function chaosPostureWidening(): ChaosVerdict {
  const mode: TemplateChaosMode = 'C-TEMPLATE-POSTURE-WIDENING';
  // Pilot template only includes pilot bundle; superadminGate=disabled.
  const preset = freezePreset({
    templateId: 'vitalcv.template.pilot-tenant',
    institutionId: 'inst_chaos_5',
    env: 'pilot',
    frozenAt: FROZEN_AT,
  });
  if (preset.resolvedPosture.superadminGate !== 'disabled') {
    return unsafe(
      mode,
      `pilot template resolvedPosture.superadminGate is ${preset.resolvedPosture.superadminGate}, expected disabled`,
    );
  }
  // And verify bundle directly: the pilot bundle's superadminGate is 'disabled'.
  const pilot = getBundle('vitalcv.bundle.pilot');
  if (pilot.posture.superadminGate !== 'disabled') {
    return unsafe(mode, 'pilot bundle posture changed silently');
  }
  return safe(mode, 'posture matches declared pilot bundle');
}

/**
 * Mode 6: missing Codex SAFE verdict on apply. emitRolloutManifest MUST throw
 * when a Codex-required template applies without a verdict.
 */
function chaosMissingCodexSafe(): ChaosVerdict {
  const mode: TemplateChaosMode = 'C-TEMPLATE-MISSING-CODEX-SAFE';
  const preset = freezePreset({
    templateId: 'vitalcv.template.health-system-issuer',
    institutionId: 'inst_chaos_6',
    env: 'prod',
    frozenAt: FROZEN_AT,
  });
  const result = expectThrow(() =>
    emitRolloutManifest({
      preset,
      operator: 'ci_chaos',
      rolloutAt: FROZEN_AT,
      gitSha: 'sha_x',
      previousManifestId: null,
      rollbackOf: null,
      codexSafeVerdictId: null, // missing
      chaosFingerprint: 'fp_chaos',
    }),
  );
  if (!result.threw) {
    return unsafe(mode, 'apply without Codex SAFE was accepted');
  }
  if (!/Codex SAFE/i.test(result.message)) {
    return unsafe(mode, `threw but unrelated: ${result.message}`);
  }
  return safe(mode, 'apply without Codex SAFE rejected');
}

/**
 * Mode 7: cross-env apply. A pilot template applied to prod env MUST throw
 * via the onboarding-kit generator (which is the entry point operators use).
 */
function chaosEnvCrossApply(): ChaosVerdict {
  const mode: TemplateChaosMode = 'C-TEMPLATE-ENV-CROSS-APPLY';
  const result = expectThrow(() =>
    generateOnboardingKit({
      templateId: 'vitalcv.template.pilot-tenant',
      institutionId: 'inst_chaos_7',
      env: 'prod',
    }),
  );
  if (!result.threw) {
    return unsafe(mode, 'pilot template onboarded into prod silently');
  }
  if (!/pilot-isolated.*prod/i.test(result.message)) {
    return unsafe(mode, `threw but unrelated: ${result.message}`);
  }
  return safe(mode, 'pilot-into-prod rejected');
}

const CHAOS_RUNNERS: Readonly<Record<TemplateChaosMode, () => ChaosVerdict>> = {
  'C-TEMPLATE-FROZEN-FIELD-MUTATION': chaosFrozenFieldMutation,
  'C-TEMPLATE-BUNDLE-DOWNGRADE': chaosBundleDowngrade,
  'C-TEMPLATE-MANIFEST-ORPHAN': chaosManifestOrphan,
  'C-TEMPLATE-PRESET-HASH-COLLISION': chaosPresetHashCollision,
  'C-TEMPLATE-POSTURE-WIDENING': chaosPostureWidening,
  'C-TEMPLATE-MISSING-CODEX-SAFE': chaosMissingCodexSafe,
  'C-TEMPLATE-ENV-CROSS-APPLY': chaosEnvCrossApply,
};

export function runDeploymentChaos(): {
  verdicts: ReadonlyArray<ChaosVerdict>;
  fingerprint: string;
  allSafe: boolean;
} {
  const verdicts: ChaosVerdict[] = TEMPLATE_CHAOS_MODES.map((m) => CHAOS_RUNNERS[m]());
  const allSafe = verdicts.every((v) => v.verdict === 'SAFE');
  const canonical = JSON.stringify(
    verdicts.map((v) => ({ mode: v.mode, verdict: v.verdict })),
  );
  const fingerprint = crypto.createHash('sha256').update(canonical).digest('hex');
  return {
    verdicts: Object.freeze(verdicts),
    fingerprint,
    allSafe,
  };
}

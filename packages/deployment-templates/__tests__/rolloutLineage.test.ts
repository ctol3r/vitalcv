import { describe, expect, it } from 'vitest';
import {
  emitRolloutManifest,
  freezePreset,
  reconstructLineage,
  type DeploymentRolloutManifest,
} from '../index';

const FROZEN_AT = '2026-05-09T00:00:00.000Z';

function makeApply(): DeploymentRolloutManifest {
  const preset = freezePreset({
    templateId: 'vitalcv.template.payer-verifier',
    institutionId: 'inst_lin',
    env: 'pilot',
    frozenAt: FROZEN_AT,
  });
  return emitRolloutManifest({
    preset,
    operator: 'ci_lineage',
    rolloutAt: FROZEN_AT,
    gitSha: 'sha_genesis',
    previousManifestId: null,
    rollbackOf: null,
    codexSafeVerdictId: 'codex_v1',
    chaosFingerprint: 'fp_x',
  });
}

describe('W2-PR80A rollout lineage', () => {
  it('apply emits a manifest with deterministic id', () => {
    const a = makeApply();
    const b = makeApply();
    expect(a.manifestId).toBe(b.manifestId);
  });

  it('manifest is frozen', () => {
    const m = makeApply();
    expect(Object.isFrozen(m)).toBe(true);
  });

  it('Codex-required template fails closed when verdict missing', () => {
    const preset = freezePreset({
      templateId: 'vitalcv.template.health-system-issuer',
      institutionId: 'inst_x',
      env: 'prod',
      frozenAt: FROZEN_AT,
    });
    expect(() =>
      emitRolloutManifest({
        preset,
        operator: 'ci_lineage',
        rolloutAt: FROZEN_AT,
        gitSha: 'sha_x',
        previousManifestId: null,
        rollbackOf: null,
        codexSafeVerdictId: null,
        chaosFingerprint: 'fp_x',
      }),
    ).toThrow(/Codex SAFE/);
  });

  it('rollback without previous manifest is rejected', () => {
    const preset = freezePreset({
      templateId: 'vitalcv.template.payer-verifier',
      institutionId: 'inst_y',
      env: 'pilot',
      frozenAt: FROZEN_AT,
    });
    expect(() =>
      emitRolloutManifest({
        preset,
        operator: 'ci_lineage',
        rolloutAt: FROZEN_AT,
        gitSha: 'sha_y',
        previousManifestId: null,
        rollbackOf: 'manifest_some_id',
        codexSafeVerdictId: null,
        chaosFingerprint: 'fp_x',
      }),
    ).toThrow(/rollback must reference/);
  });

  it('lineage chain reconstructs from genesis through applies', () => {
    const m1 = makeApply();
    const preset = freezePreset({
      templateId: 'vitalcv.template.payer-verifier',
      institutionId: 'inst_lin',
      env: 'pilot',
      frozenAt: FROZEN_AT,
    });
    const m2 = emitRolloutManifest({
      preset,
      operator: 'ci_lineage',
      rolloutAt: FROZEN_AT,
      gitSha: 'sha_two',
      previousManifestId: m1.manifestId,
      rollbackOf: null,
      codexSafeVerdictId: 'codex_v2',
      chaosFingerprint: 'fp_x',
    });
    const lineage = reconstructLineage([m1, m2], {
      institutionId: 'inst_lin',
      env: 'pilot',
    });
    expect(lineage.chain).toHaveLength(2);
    expect(lineage.chain[0].manifestId).toBe(m1.manifestId);
    expect(lineage.chain[1].manifestId).toBe(m2.manifestId);
    expect(lineage.orphans).toHaveLength(0);
  });

  it('rollback emits a NEW manifest pointing back to the rolled-back one', () => {
    const m1 = makeApply();
    const preset = freezePreset({
      templateId: 'vitalcv.template.payer-verifier',
      institutionId: 'inst_lin',
      env: 'pilot',
      frozenAt: FROZEN_AT,
    });
    const rollback = emitRolloutManifest({
      preset,
      operator: 'ci_lineage',
      rolloutAt: FROZEN_AT,
      gitSha: 'sha_rb',
      previousManifestId: m1.manifestId,
      rollbackOf: m1.manifestId,
      codexSafeVerdictId: null,
      chaosFingerprint: 'fp_x',
    });
    expect(rollback.rollbackOf).toBe(m1.manifestId);
    expect(rollback.manifestId).not.toBe(m1.manifestId);
  });

  it('reconstructLineage filters cross-tenant manifests as leaks', () => {
    const m1 = makeApply();
    const otherPreset = freezePreset({
      templateId: 'vitalcv.template.payer-verifier',
      institutionId: 'inst_other',
      env: 'pilot',
      frozenAt: FROZEN_AT,
    });
    const otherManifest = emitRolloutManifest({
      preset: otherPreset,
      operator: 'ci_lineage',
      rolloutAt: FROZEN_AT,
      gitSha: 'sha_other',
      previousManifestId: null,
      rollbackOf: null,
      codexSafeVerdictId: 'codex_o1',
      chaosFingerprint: 'fp_x',
    });
    const lineage = reconstructLineage([m1, otherManifest], {
      institutionId: 'inst_lin',
      env: 'pilot',
    });
    expect(lineage.chain).toHaveLength(1);
    expect(lineage.crossTenantLeaks).toHaveLength(1);
    expect(lineage.crossTenantLeaks[0].manifestId).toBe(otherManifest.manifestId);
  });

  it('forked chain (two genesis manifests) is rejected fail-closed', () => {
    const m1 = makeApply();
    const altPreset = freezePreset({
      templateId: 'vitalcv.template.payer-verifier',
      institutionId: 'inst_lin',
      env: 'pilot',
      frozenAt: FROZEN_AT,
    });
    const m2 = emitRolloutManifest({
      preset: altPreset,
      operator: 'ci_lineage',
      rolloutAt: '2026-05-10T00:00:00.000Z',
      gitSha: 'sha_alt_genesis',
      previousManifestId: null,
      rollbackOf: null,
      codexSafeVerdictId: 'codex_alt',
      chaosFingerprint: 'fp_y',
    });
    expect(() =>
      reconstructLineage([m1, m2], { institutionId: 'inst_lin', env: 'pilot' }),
    ).toThrow(/forked/);
  });

  it('tampered preset is rejected before manifest emission', () => {
    const preset = freezePreset({
      templateId: 'vitalcv.template.payer-verifier',
      institutionId: 'inst_z',
      env: 'pilot',
      frozenAt: FROZEN_AT,
    });
    const tampered = {
      ...preset,
      resolvedPosture: { ...preset.resolvedPosture, retention: 'enforced' as const },
    };
    expect(() =>
      emitRolloutManifest({
        preset: tampered,
        operator: 'ci_lineage',
        rolloutAt: FROZEN_AT,
        gitSha: 'sha_z',
        previousManifestId: null,
        rollbackOf: null,
        codexSafeVerdictId: 'codex_z',
        chaosFingerprint: 'fp_x',
      }),
    ).toThrow(/preset hash mismatch/);
  });
});

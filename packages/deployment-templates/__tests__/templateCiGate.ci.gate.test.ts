/**
 * W2-PR80A — CI gate suite. This file is the load-bearing gate that the
 * deployment-templates CI workflow runs. It bundles the most important
 * invariants from each surface into one fast suite.
 *
 * If this suite fails, no rollout manifest may be emitted in CI.
 */
import { describe, expect, it } from 'vitest';
import {
  detectDrift,
  emitRolloutManifest,
  freezePreset,
  generateOnboardingKit,
  listBundles,
  listTemplates,
  reconstructLineage,
  runDeploymentChaos,
  summarizeDrift,
  verifyOnboardingKit,
  verifyPresetHash,
} from '../index';

const FROZEN_AT = '2026-05-09T00:00:00.000Z';

describe('W2-PR80A CI gate', () => {
  it('GATE: chaos contract is intact (all modes SAFE)', () => {
    const result = runDeploymentChaos();
    expect(result.allSafe).toBe(true);
  });

  it('GATE: all templates registered have unique ids and are frozen', () => {
    const ts = listTemplates();
    expect(ts.length).toBeGreaterThanOrEqual(4);
    const ids = ts.map((t) => t.templateId);
    expect(new Set(ids).size).toBe(ids.length);
    for (const t of ts) {
      expect(Object.isFrozen(t)).toBe(true);
    }
  });

  it('GATE: all bundles registered are frozen with non-empty disclaimers', () => {
    const bundles = listBundles();
    expect(bundles.length).toBeGreaterThanOrEqual(5);
    for (const b of bundles) {
      expect(Object.isFrozen(b)).toBe(true);
      expect(b.disclaimer.length).toBeGreaterThan(0);
    }
  });

  it('GATE: preset hash is deterministic and verifiable', () => {
    const a = freezePreset({
      templateId: 'vitalcv.template.payer-verifier',
      institutionId: 'inst_gate',
      env: 'pilot',
      frozenAt: FROZEN_AT,
    });
    const b = freezePreset({
      templateId: 'vitalcv.template.payer-verifier',
      institutionId: 'inst_gate',
      env: 'pilot',
      frozenAt: '2099-12-31T23:59:59.000Z',
    });
    expect(a.presetHash).toBe(b.presetHash);
    expect(verifyPresetHash(a)).toBe(true);
  });

  it('GATE: rollout manifest emission requires Codex SAFE for issuer template', () => {
    const preset = freezePreset({
      templateId: 'vitalcv.template.health-system-issuer',
      institutionId: 'inst_gate',
      env: 'prod',
      frozenAt: FROZEN_AT,
    });
    expect(() =>
      emitRolloutManifest({
        preset,
        operator: 'ci',
        rolloutAt: FROZEN_AT,
        gitSha: 'sha_g',
        previousManifestId: null,
        rollbackOf: null,
        codexSafeVerdictId: null,
        chaosFingerprint: 'fp_g',
      }),
    ).toThrow(/Codex SAFE/);
  });

  it('GATE: lineage reconstruction surfaces orphans (no silent drops)', () => {
    const preset = freezePreset({
      templateId: 'vitalcv.template.payer-verifier',
      institutionId: 'inst_gate',
      env: 'pilot',
      frozenAt: FROZEN_AT,
    });
    const m1 = emitRolloutManifest({
      preset,
      operator: 'ci',
      rolloutAt: FROZEN_AT,
      gitSha: 'sha_g1',
      previousManifestId: null,
      rollbackOf: null,
      codexSafeVerdictId: 'codex_g',
      chaosFingerprint: 'fp_g',
    });
    const orphan = emitRolloutManifest({
      preset,
      operator: 'ci',
      rolloutAt: FROZEN_AT,
      gitSha: 'sha_g_orphan',
      previousManifestId: 'manifest_phantom',
      rollbackOf: null,
      codexSafeVerdictId: 'codex_g',
      chaosFingerprint: 'fp_g',
    });
    const lineage = reconstructLineage([m1, orphan], {
      institutionId: 'inst_gate',
      env: 'pilot',
    });
    expect(lineage.orphans.length).toBeGreaterThanOrEqual(1);
  });

  it('GATE: drift detection on a clean preset+manifest pair returns CLEAN', () => {
    const preset = freezePreset({
      templateId: 'vitalcv.template.payer-verifier',
      institutionId: 'inst_gate',
      env: 'pilot',
      frozenAt: FROZEN_AT,
    });
    const manifest = emitRolloutManifest({
      preset,
      operator: 'ci',
      rolloutAt: FROZEN_AT,
      gitSha: 'sha_drift',
      previousManifestId: null,
      rollbackOf: null,
      codexSafeVerdictId: 'codex_drift',
      chaosFingerprint: 'fp_g',
    });
    const report = detectDrift({ manifest, preset, detectedAt: FROZEN_AT });
    expect(report.driftCode).toBe('DRIFT-TEMPLATE-CLEAN');
    expect(report.divergedFields).toEqual([]);
  });

  it('GATE: drift detection surfaces tampered preset hash as orphan', () => {
    const preset = freezePreset({
      templateId: 'vitalcv.template.payer-verifier',
      institutionId: 'inst_gate',
      env: 'pilot',
      frozenAt: FROZEN_AT,
    });
    const manifest = emitRolloutManifest({
      preset,
      operator: 'ci',
      rolloutAt: FROZEN_AT,
      gitSha: 'sha_drift',
      previousManifestId: null,
      rollbackOf: null,
      codexSafeVerdictId: 'codex_drift',
      chaosFingerprint: 'fp_g',
    });
    const tamperedManifest = { ...manifest, presetHash: 'tampered_hash' };
    const report = detectDrift({ manifest: tamperedManifest, preset, detectedAt: FROZEN_AT });
    expect(report.driftCode).toBe('DRIFT-TEMPLATE-MANIFEST-ORPHAN');
  });

  it('GATE: onboarding kit is verifiable post-generation', () => {
    const kit = generateOnboardingKit({
      templateId: 'vitalcv.template.health-system-issuer',
      institutionId: 'inst_gate',
      env: 'pilot',
    });
    expect(verifyOnboardingKit(kit)).toBe(true);
  });

  it('GATE: drift summary produces a board-ready visibility metric', () => {
    const summary = summarizeDrift([
      {
        presetHash: 'p1',
        manifestId: 'm1',
        driftCode: 'DRIFT-TEMPLATE-CLEAN',
        divergedFields: [],
        detectedAt: FROZEN_AT,
      },
      {
        presetHash: 'p2',
        manifestId: 'm2',
        driftCode: 'DRIFT-TEMPLATE-POSTURE-RELAXED',
        divergedFields: ['retention'],
        detectedAt: FROZEN_AT,
      },
    ]);
    expect(summary.totalCount).toBe(2);
    expect(summary.cleanCount).toBe(1);
    expect(summary.byCode['DRIFT-TEMPLATE-POSTURE-RELAXED']).toBe(1);
  });
});

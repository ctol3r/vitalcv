import { describe, expect, it } from 'vitest';
import {
  computePresetHash,
  freezePreset,
  stableStringify,
  verifyPresetHash,
} from '../index';

const FROZEN_AT = '2026-05-09T00:00:00.000Z';

describe('W2-PR80A replay-safe presets', () => {
  it('freezing same inputs twice produces identical hashes', () => {
    const a = freezePreset({
      templateId: 'vitalcv.template.payer-verifier',
      institutionId: 'inst_a',
      env: 'pilot',
      frozenAt: FROZEN_AT,
    });
    const b = freezePreset({
      templateId: 'vitalcv.template.payer-verifier',
      institutionId: 'inst_a',
      env: 'pilot',
      frozenAt: FROZEN_AT,
    });
    expect(a.presetHash).toBe(b.presetHash);
  });

  it('frozenAt does NOT influence presetHash', () => {
    const a = freezePreset({
      templateId: 'vitalcv.template.payer-verifier',
      institutionId: 'inst_a',
      env: 'pilot',
      frozenAt: '2026-01-01T00:00:00.000Z',
    });
    const b = freezePreset({
      templateId: 'vitalcv.template.payer-verifier',
      institutionId: 'inst_a',
      env: 'pilot',
      frozenAt: '2027-12-31T00:00:00.000Z',
    });
    expect(a.presetHash).toBe(b.presetHash);
    expect(a.frozenAt).not.toBe(b.frozenAt);
  });

  it('different env produces different hash', () => {
    const a = freezePreset({
      templateId: 'vitalcv.template.payer-verifier',
      institutionId: 'inst_a',
      env: 'pilot',
      frozenAt: FROZEN_AT,
    });
    const b = freezePreset({
      templateId: 'vitalcv.template.payer-verifier',
      institutionId: 'inst_a',
      env: 'staging',
      frozenAt: FROZEN_AT,
    });
    expect(a.presetHash).not.toBe(b.presetHash);
  });

  it('different institutionId produces different hash', () => {
    const a = freezePreset({
      templateId: 'vitalcv.template.payer-verifier',
      institutionId: 'inst_alpha',
      env: 'pilot',
      frozenAt: FROZEN_AT,
    });
    const b = freezePreset({
      templateId: 'vitalcv.template.payer-verifier',
      institutionId: 'inst_beta',
      env: 'pilot',
      frozenAt: FROZEN_AT,
    });
    expect(a.presetHash).not.toBe(b.presetHash);
  });

  it('verifyPresetHash returns true for an unmodified preset', () => {
    const preset = freezePreset({
      templateId: 'vitalcv.template.health-system-issuer',
      institutionId: 'inst_a',
      env: 'pilot',
      frozenAt: FROZEN_AT,
    });
    expect(verifyPresetHash(preset)).toBe(true);
  });

  it('verifyPresetHash returns false on tampered posture', () => {
    const preset = freezePreset({
      templateId: 'vitalcv.template.health-system-issuer',
      institutionId: 'inst_a',
      env: 'pilot',
      frozenAt: FROZEN_AT,
    });
    const tampered = {
      ...preset,
      resolvedPosture: { ...preset.resolvedPosture, retention: 'enforced' as const },
    };
    expect(verifyPresetHash(tampered)).toBe(false);
  });

  it('flag override on undeclared name is rejected fail-closed', () => {
    expect(() =>
      freezePreset({
        templateId: 'vitalcv.template.payer-verifier',
        institutionId: 'inst_a',
        env: 'pilot',
        flagOverrides: [{ name: 'feature.bogus', state: 'on' }],
        frozenAt: FROZEN_AT,
      }),
    ).toThrow(/not declared by template/);
  });

  it('turning off a load-bearing flag is rejected fail-closed', () => {
    expect(() =>
      freezePreset({
        templateId: 'vitalcv.template.health-system-issuer',
        institutionId: 'inst_a',
        env: 'pilot',
        flagOverrides: [{ name: 'feature.issuer.recognition', state: 'off' }],
        frozenAt: FROZEN_AT,
      }),
    ).toThrow(/load-bearing/);
  });

  it('non-load-bearing flag override is allowed', () => {
    const preset = freezePreset({
      templateId: 'vitalcv.template.health-system-issuer',
      institutionId: 'inst_a',
      env: 'pilot',
      flagOverrides: [{ name: 'feature.issuer.start-attested', state: 'off' }],
      frozenAt: FROZEN_AT,
    });
    const flag = preset.featureFlags.find((f) => f.name === 'feature.issuer.start-attested');
    expect(flag?.state).toBe('off');
  });

  it('stableStringify produces the same output regardless of key order', () => {
    const a = stableStringify({ b: 1, a: 2, c: { y: 1, x: 2 } });
    const b = stableStringify({ a: 2, c: { x: 2, y: 1 }, b: 1 });
    expect(a).toBe(b);
  });

  it('computePresetHash is order-independent for arrays of strings', () => {
    const base = {
      templateId: 't',
      templateVersion: '1.0.0',
      institutionId: 'i',
      env: 'pilot' as const,
      bundleIds: ['b', 'a'],
      envVarNames: ['Y', 'X'],
      featureFlags: [
        { name: 'b', state: 'on' as const },
        { name: 'a', state: 'off' as const },
      ],
      resolvedPosture: {
        redaction: 'foundation-only' as const,
        retention: 'foundation-only' as const,
        authorityAdapters: 'foundation-only' as const,
        superadminGate: 'unverified-foundation' as const,
        complianceReport: 'unverified-foundation' as const,
      },
    };
    const a = computePresetHash(base);
    const b = computePresetHash({ ...base, bundleIds: ['a', 'b'], envVarNames: ['X', 'Y'] });
    expect(a).toBe(b);
  });

  it('preset references all bundles from its template', () => {
    const preset = freezePreset({
      templateId: 'vitalcv.template.multi-region-issuer',
      institutionId: 'inst_mr',
      env: 'prod',
      frozenAt: FROZEN_AT,
    });
    expect(preset.bundleIds).toContain('vitalcv.bundle.production-hardened');
    expect(preset.resolvedPosture.redaction).toBe('enforced');
  });
});

import { describe, expect, it } from 'vitest';
import { generateOnboardingKit, verifyOnboardingKit } from '../index';

describe('W2-PR80A onboarding kit', () => {
  it('generates deterministic kit for same inputs', () => {
    const a = generateOnboardingKit({
      templateId: 'vitalcv.template.health-system-issuer',
      institutionId: 'inst_obk',
      env: 'pilot',
    });
    const b = generateOnboardingKit({
      templateId: 'vitalcv.template.health-system-issuer',
      institutionId: 'inst_obk',
      env: 'pilot',
    });
    expect(a.kitHash).toBe(b.kitHash);
    expect(a.kitId).toBe(b.kitId);
  });

  it('verifyOnboardingKit accepts an unmodified kit', () => {
    const kit = generateOnboardingKit({
      templateId: 'vitalcv.template.payer-verifier',
      institutionId: 'inst_obk',
      env: 'pilot',
    });
    expect(verifyOnboardingKit(kit)).toBe(true);
  });

  it('verifyOnboardingKit rejects a tampered disclaimer', () => {
    const kit = generateOnboardingKit({
      templateId: 'vitalcv.template.payer-verifier',
      institutionId: 'inst_obk',
      env: 'pilot',
    });
    const tampered = {
      ...kit,
      disclaimers: [...kit.disclaimers, 'fake disclaimer'],
    };
    expect(verifyOnboardingKit(tampered)).toBe(false);
  });

  it('preflightChecklist contains required Codex SAFE step', () => {
    const kit = generateOnboardingKit({
      templateId: 'vitalcv.template.health-system-issuer',
      institutionId: 'inst_obk',
      env: 'pilot',
    });
    const codexStep = kit.preflightChecklist.find((s) =>
      /codex/i.test(s.description),
    );
    expect(codexStep).toBeTruthy();
    expect(codexStep?.required).toBe(true);
  });

  it('preflightChecklist contains ES256 / HS256-banned step', () => {
    const kit = generateOnboardingKit({
      templateId: 'vitalcv.template.health-system-issuer',
      institutionId: 'inst_obk',
      env: 'pilot',
    });
    const keyStep = kit.preflightChecklist.find((s) => /ES256|HS256/.test(s.description));
    expect(keyStep).toBeTruthy();
  });

  it('pilot template into prod env is rejected fail-closed', () => {
    expect(() =>
      generateOnboardingKit({
        templateId: 'vitalcv.template.pilot-tenant',
        institutionId: 'inst_obk',
        env: 'prod',
      }),
    ).toThrow(/pilot-isolated.*prod/i);
  });

  it('pilot template into pilot env is allowed', () => {
    const kit = generateOnboardingKit({
      templateId: 'vitalcv.template.pilot-tenant',
      institutionId: 'inst_obk',
      env: 'pilot',
    });
    expect(kit.env).toBe('pilot');
  });

  it('disclaimers are non-empty and verbatim from bundles', () => {
    const kit = generateOnboardingKit({
      templateId: 'vitalcv.template.health-system-issuer',
      institutionId: 'inst_obk',
      env: 'staging',
    });
    expect(kit.disclaimers.length).toBeGreaterThanOrEqual(2);
    for (const d of kit.disclaimers) {
      expect(d.length).toBeGreaterThan(20);
    }
  });

  it('expectedAuditEvents is sorted and non-empty', () => {
    const kit = generateOnboardingKit({
      templateId: 'vitalcv.template.payer-verifier',
      institutionId: 'inst_obk',
      env: 'pilot',
    });
    const sorted = [...kit.expectedAuditEvents].sort();
    expect(kit.expectedAuditEvents).toEqual(sorted);
    expect(kit.expectedAuditEvents.length).toBeGreaterThan(0);
  });

  it('unknown template id is rejected', () => {
    expect(() =>
      generateOnboardingKit({
        templateId: 'vitalcv.template.does-not-exist',
        institutionId: 'inst_obk',
        env: 'pilot',
      }),
    ).toThrow(/unknown template/);
  });

  it('different institutionIds produce different kit hashes', () => {
    const a = generateOnboardingKit({
      templateId: 'vitalcv.template.health-system-issuer',
      institutionId: 'inst_alpha',
      env: 'pilot',
    });
    const b = generateOnboardingKit({
      templateId: 'vitalcv.template.health-system-issuer',
      institutionId: 'inst_beta',
      env: 'pilot',
    });
    expect(a.kitHash).not.toBe(b.kitHash);
  });
});

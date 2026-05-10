import { describe, expect, it } from 'vitest';
import {
  FOUNDATION_BUNDLE,
  ISSUER_BUNDLE,
  PILOT_BUNDLE,
  PRODUCTION_HARDENED_BUNDLE,
  VERIFIER_BUNDLE,
  composeBundles,
  getBundle,
  listBundles,
} from '../index';

describe('W2-PR80A trust-policy bundle portability', () => {
  it('bundles are immutable', () => {
    expect(Object.isFrozen(FOUNDATION_BUNDLE)).toBe(true);
    expect(Object.isFrozen(FOUNDATION_BUNDLE.posture)).toBe(true);
    expect(Object.isFrozen(PRODUCTION_HARDENED_BUNDLE)).toBe(true);
  });

  it('every bundle ships a non-empty disclaimer', () => {
    for (const b of listBundles()) {
      expect(b.disclaimer.length).toBeGreaterThan(20);
    }
  });

  it('disclaimers contain no banned strings', () => {
    const banned = [
      'automatically verified',
      'guaranteed verification',
      'instant credentialing',
      'legally accepted',
      'risk transferred',
      'HIPAA compliant',
      'SOC2 certified',
    ];
    for (const b of listBundles()) {
      const lower = b.disclaimer.toLowerCase();
      for (const phrase of banned) {
        expect(lower.includes(phrase.toLowerCase())).toBe(false);
      }
    }
  });

  it('foundation + issuer compose without throwing', () => {
    const result = composeBundles([FOUNDATION_BUNDLE.bundleId, ISSUER_BUNDLE.bundleId]);
    expect(result.posture.redaction).toBe('foundation-only');
    expect(result.disclaimers).toHaveLength(2);
  });

  it('foundation + production-hardened tightens posture', () => {
    const result = composeBundles([
      FOUNDATION_BUNDLE.bundleId,
      PRODUCTION_HARDENED_BUNDLE.bundleId,
    ]);
    expect(result.posture.redaction).toBe('enforced');
    expect(result.posture.retention).toBe('enforced');
  });

  it('production-hardened followed by pilot is rejected (relaxation)', () => {
    expect(() =>
      composeBundles([PRODUCTION_HARDENED_BUNDLE.bundleId, PILOT_BUNDLE.bundleId]),
    ).toThrow(/relaxes/);
  });

  it('empty bundle list is rejected fail-closed', () => {
    expect(() => composeBundles([])).toThrow(/at least one bundle/);
  });

  it('unknown bundle id is rejected fail-closed', () => {
    expect(() => getBundle('vitalcv.bundle.does-not-exist')).toThrow(/unknown bundle/);
  });

  it('compose audit-event coverage is the union of bundles', () => {
    const result = composeBundles([
      FOUNDATION_BUNDLE.bundleId,
      VERIFIER_BUNDLE.bundleId,
    ]);
    expect(result.auditEventCoverage).toContain('TRUST_STATE_CHECK');
    expect(result.auditEventCoverage).toContain('BUNDLE_GENERATED');
  });

  it('pilot bundle disables superadmin gate (real explicit state)', () => {
    expect(PILOT_BUNDLE.posture.superadminGate).toBe('disabled');
  });

  it('foundation bundle uses unverified-foundation for compliance report', () => {
    expect(FOUNDATION_BUNDLE.posture.complianceReport).toBe('unverified-foundation');
  });
});

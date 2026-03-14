import { determineFreshnessWindowValidity } from '../freshnessEvaluator';

describe('freshnessEvaluator', () => {
  it('marks evidence current when still inside its freshness window', () => {
    const now = new Date('2026-03-13T12:00:00.000Z');
    const result = determineFreshnessWindowValidity({
      canonicalArtifactKey: 'state_license',
      verifiedAt: new Date('2026-01-01T12:00:00.000Z'),
      expiresAt: null,
      psvWindowDeadline: null,
      psvWindowCompliant: null,
      now,
    });

    expect(result).toEqual({
      freshness: 'current',
      valid: true,
      reasons: [],
    });
  });

  it('marks evidence stale exactly after the freshness window', () => {
    const now = new Date('2026-07-01T00:00:01.000Z');
    const result = determineFreshnessWindowValidity({
      canonicalArtifactKey: 'state_license',
      verifiedAt: new Date('2026-01-01T00:00:00.000Z'),
      expiresAt: null,
      psvWindowDeadline: null,
      psvWindowCompliant: null,
      now,
    });

    expect(result.freshness).toBe('stale');
    expect(result.valid).toBe(false);
  });

  it('marks evidence expired exactly at expiresAt', () => {
    const now = new Date('2026-03-13T00:00:00.000Z');
    const result = determineFreshnessWindowValidity({
      canonicalArtifactKey: 'dea_registration',
      verifiedAt: new Date('2026-01-01T00:00:00.000Z'),
      expiresAt: new Date('2026-03-13T00:00:00.000Z'),
      psvWindowDeadline: null,
      psvWindowCompliant: null,
      now,
    });

    expect(result.freshness).toBe('expired');
    expect(result.valid).toBe(false);
  });

  it('marks evidence stale when PSV window is non-compliant', () => {
    const result = determineFreshnessWindowValidity({
      canonicalArtifactKey: 'background_check',
      verifiedAt: new Date('2026-03-01T00:00:00.000Z'),
      expiresAt: null,
      psvWindowDeadline: new Date('2026-03-15T00:00:00.000Z'),
      psvWindowCompliant: false,
      now: new Date('2026-03-13T00:00:00.000Z'),
    });

    expect(result.freshness).toBe('stale');
    expect(result.valid).toBe(false);
  });
});

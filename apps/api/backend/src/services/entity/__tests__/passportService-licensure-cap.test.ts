/**
 * passportService-licensure-cap.test.ts
 *
 * Focused unit tests for the W1.1b licensure cap helper exported from
 * passportService.ts. Tests the pure helper directly — no jest.mock
 * fixtures needed because the helper has no dependencies.
 *
 * Truth contracts:
 *   - When licensureStatus === 'verified', the score is returned unchanged.
 *   - When licensureStatus is anything else (pending / expired / unknown),
 *     the score is clamped at READINESS_LICENSURE_UNVERIFIED_CEILING (45).
 *   - The cap is a hard ceiling: Math.min only — it never raises a lower
 *     score.
 */
import {
  applyReadinessLicensureCap,
  READINESS_LICENSURE_UNVERIFIED_CEILING,
} from '../readinessLicensureCap';

describe('applyReadinessLicensureCap (W1.1b)', () => {
  it('ceiling constant is 45 (aligned with engine-level CRS_LICENSURE_UNVERIFIED_CEILING)', () => {
    expect(READINESS_LICENSURE_UNVERIFIED_CEILING).toBe(45);
  });

  it("returns score unchanged when licensureStatus === 'verified'", () => {
    expect(applyReadinessLicensureCap(100, 'verified')).toBe(100);
    expect(applyReadinessLicensureCap(95, 'verified')).toBe(95);
    expect(applyReadinessLicensureCap(80, 'verified')).toBe(80);
    expect(applyReadinessLicensureCap(45, 'verified')).toBe(45);
    expect(applyReadinessLicensureCap(0, 'verified')).toBe(0);
  });

  it("caps score at 45 when licensureStatus === 'pending'", () => {
    expect(applyReadinessLicensureCap(100, 'pending')).toBe(45);
    expect(applyReadinessLicensureCap(95, 'pending')).toBe(45);
    expect(applyReadinessLicensureCap(80, 'pending')).toBe(45);
    expect(applyReadinessLicensureCap(60, 'pending')).toBe(45);
  });

  it("caps score at 45 when licensureStatus === 'expired'", () => {
    expect(applyReadinessLicensureCap(100, 'expired')).toBe(45);
    expect(applyReadinessLicensureCap(80, 'expired')).toBe(45);
  });

  it("caps score at 45 when licensureStatus === 'unknown'", () => {
    expect(applyReadinessLicensureCap(100, 'unknown')).toBe(45);
    expect(applyReadinessLicensureCap(80, 'unknown')).toBe(45);
  });

  it('cap never raises a lower score (Math.min, not Math.max)', () => {
    // A score already below the ceiling stays below — the cap clamps,
    // it does not normalize upward.
    expect(applyReadinessLicensureCap(20, 'pending')).toBe(20);
    expect(applyReadinessLicensureCap(0, 'pending')).toBe(0);
    expect(applyReadinessLicensureCap(45, 'pending')).toBe(45);
    expect(applyReadinessLicensureCap(44, 'pending')).toBe(44);
  });

  it('cap is exact: a score of 46 with unverified licensure becomes 45', () => {
    expect(applyReadinessLicensureCap(46, 'pending')).toBe(45);
    expect(applyReadinessLicensureCap(45, 'pending')).toBe(45);
  });
});

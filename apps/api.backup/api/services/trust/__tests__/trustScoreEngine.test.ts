import { describe, it, expect } from '@jest/globals';
import { calculateTrustScore, withDefaultMetrics } from '../trustScoreEngine';

describe('trustScoreEngine', () => {
  it('computes anchor tier for near-perfect metrics', () => {
    const metrics = withDefaultMetrics({
      verificationAccuracy: 0.995,
      freshnessHours: 2,
      uptimePercentage: 99.9,
    });

    const score = calculateTrustScore(metrics);
    expect(score.tier).toBe('ANCHOR');
    expect(score.overallScore).toBeGreaterThanOrEqual(90);
    expect(score.reasons).toHaveLength(0);
  });

  it('downgrades tier when freshness degrades', () => {
    const score = calculateTrustScore({
      verificationAccuracy: 0.9,
      freshnessHours: 240,
      uptimePercentage: 98,
    });

    expect(score.tier).toBe('TRUSTED');
    expect(score.components.freshness).toBeLessThan(70);
    expect(score.reasons).toContain('data freshness outside SLA');
  });

  it('flags watchlist for poor accuracy and uptime', () => {
    const score = calculateTrustScore({
      verificationAccuracy: 0.6,
      freshnessHours: 500,
      uptimePercentage: 70,
    });

    expect(score.tier).toBe('WATCHLIST');
    expect(score.overallScore).toBeLessThan(60);
    expect(score.reasons).toContain('verification accuracy trending low');
    expect(score.reasons).toContain('uptime below SLA');
  });
});


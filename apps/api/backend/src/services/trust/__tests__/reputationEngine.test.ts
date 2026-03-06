/**
 * Unit tests for calculateTrustScore() — Wave 121
 *
 * Tests the pure scoring function in isolation.
 * No Prisma / network calls needed.
 */

import { calculateTrustScore, IssuerReputationInput } from '../reputationEngine';

const base: IssuerReputationInput = {
  issuerId: 'test-issuer-001',
  totalCredentialsIssued: 100,
  verificationSuccessCount: 90,
  verificationFailureCount: 10,
  revocationCount: 5,
  trustLevel: 'AUTHORITATIVE',
};

describe('calculateTrustScore', () => {
  it('returns a baseline score for a new issuer with zero credentials', () => {
    const score = calculateTrustScore({ ...base, totalCredentialsIssued: 0, verificationSuccessCount: 0, verificationFailureCount: 0, revocationCount: 0 });
    expect(score).toBe(80); // AUTHORITATIVE baseline
  });

  it('returns a lower baseline for PROVISIONAL issuers with no history', () => {
    const score = calculateTrustScore({ ...base, trustLevel: 'PROVISIONAL', totalCredentialsIssued: 0, verificationSuccessCount: 0, verificationFailureCount: 0, revocationCount: 0 });
    expect(score).toBe(40);
  });

  it('returns a high score for a perfect issuer (no revocations, all verifications succeed)', () => {
    const score = calculateTrustScore({
      ...base,
      verificationSuccessCount: 100,
      verificationFailureCount: 0,
      revocationCount: 0,
    });
    expect(score).toBeGreaterThanOrEqual(90);
    expect(score).toBeLessThanOrEqual(100);
  });

  it('penalises high revocation rates significantly', () => {
    const cleanScore = calculateTrustScore({ ...base, revocationCount: 0 });
    const dirtyScore = calculateTrustScore({ ...base, revocationCount: 50 }); // 50% revocation rate
    expect(cleanScore).toBeGreaterThan(dirtyScore);
    expect(cleanScore - dirtyScore).toBeGreaterThanOrEqual(10);
  });

  it('applies trust level multiplier — UNTRUSTED issuer scores lower than AUTHORITATIVE with identical stats', () => {
    const authoritative = calculateTrustScore({ ...base, trustLevel: 'AUTHORITATIVE' });
    const untrusted = calculateTrustScore({ ...base, trustLevel: 'UNTRUSTED' });
    expect(authoritative).toBeGreaterThan(untrusted);
  });

  it('never returns a score outside 0–100 range', () => {
    const edge1 = calculateTrustScore({ ...base, revocationCount: 999, verificationSuccessCount: 0, verificationFailureCount: 1000 });
    const edge2 = calculateTrustScore({ ...base, revocationCount: 0, verificationSuccessCount: 10000, verificationFailureCount: 0 });
    expect(edge1).toBeGreaterThanOrEqual(0);
    expect(edge1).toBeLessThanOrEqual(100);
    expect(edge2).toBeGreaterThanOrEqual(0);
    expect(edge2).toBeLessThanOrEqual(100);
  });
});

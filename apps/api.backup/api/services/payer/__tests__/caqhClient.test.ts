/**
 * Unit tests for CAQH client
 * B137A-CAQH-004: Tests for fetchCaqhProfile, validateCaqhProfile, needsCaqhRenewal
 */

import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import {
  fetchCaqhProfile,
  validateCaqhProfile,
  needsCaqhRenewal,
  MOCK_CAQH_PROFILE,
  type CaqhProfile,
} from '../caqhClient.js';

describe('CAQH Client', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('fetchCaqhProfile', () => {
    it('should fetch a mock CAQH profile successfully', async () => {
      const result = await fetchCaqhProfile({ caqhId: 'CAQH123456' });

      expect(result.success).toBe(true);
      expect(result.profile).toBeDefined();
      expect(result.profile?.caqhId).toBe('CAQH123456');
      expect(result.profile?.status).toBe('Active');
      expect(result.lastCheckedAt).toBeInstanceOf(Date);
    });

    it('should include NPI in profile', async () => {
      const result = await fetchCaqhProfile({ caqhId: 'CAQH123456' });

      expect(result.profile?.providerId).toBeDefined();
      expect(result.profile?.providerId.length).toBe(10);
    });

    it('should include licenses in profile', async () => {
      const result = await fetchCaqhProfile({ caqhId: 'CAQH123456' });

      expect(result.profile?.profile.licenses).toBeDefined();
      expect(Array.isArray(result.profile?.profile.licenses)).toBe(true);
      expect(result.profile?.profile.licenses.length).toBeGreaterThan(0);
    });

    it('should include education in profile', async () => {
      const result = await fetchCaqhProfile({ caqhId: 'CAQH123456' });

      expect(result.profile?.profile.education).toBeDefined();
      expect(Array.isArray(result.profile?.profile.education)).toBe(true);
    });

    it('should include malpractice insurance in profile', async () => {
      const result = await fetchCaqhProfile({ caqhId: 'CAQH123456' });

      expect(result.profile?.profile.malpracticeInsurance).toBeDefined();
      expect(result.profile?.profile.malpracticeInsurance.carrier).toBeDefined();
      expect(result.profile?.profile.malpracticeInsurance.coverageAmount).toBeGreaterThan(0);
    });

    it('should occasionally simulate API errors (mock)', async () => {
      // Run multiple times to potentially hit error scenario
      const results = await Promise.all(
        Array(20)
          .fill(null)
          .map(() => fetchCaqhProfile({ caqhId: 'CAQH123456' }))
      );

      const errors = results.filter((r) => !r.success);
      // With 10% error rate, we might see some errors in 20 attempts
      // This test just verifies error handling works
      if (errors.length > 0) {
        expect(errors[0].error).toBeDefined();
        expect(errors[0].profile).toBeUndefined();
      }
    });
  });

  describe('validateCaqhProfile', () => {
    it('should validate a valid CAQH profile', () => {
      const result = validateCaqhProfile(MOCK_CAQH_PROFILE);

      expect(result.isValid).toBe(true);
      expect(result.reasons).toHaveLength(0);
    });

    it('should fail validation for inactive status', () => {
      const inactiveProfile: CaqhProfile = {
        ...MOCK_CAQH_PROFILE,
        status: 'Inactive',
      };

      const result = validateCaqhProfile(inactiveProfile);

      expect(result.isValid).toBe(false);
      expect(result.reasons).toContain('CAQH profile status is Inactive, must be Active');
    });

    it('should fail validation for expired profile', () => {
      const expiredProfile: CaqhProfile = {
        ...MOCK_CAQH_PROFILE,
        expirationDate: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(),
      };

      const result = validateCaqhProfile(expiredProfile);

      expect(result.isValid).toBe(false);
      expect(result.reasons).toContain('CAQH profile has expired');
    });

    it('should fail validation for stale attestation (>120 days)', () => {
      const staleProfile: CaqhProfile = {
        ...MOCK_CAQH_PROFILE,
        attestationDate: new Date(Date.now() - 150 * 24 * 60 * 60 * 1000).toISOString(),
      };

      const result = validateCaqhProfile(staleProfile);

      expect(result.isValid).toBe(false);
      expect(result.reasons.some((r) => r.includes('120 days old'))).toBe(true);
    });

    it('should fail validation for no active licenses', () => {
      const noLicenseProfile: CaqhProfile = {
        ...MOCK_CAQH_PROFILE,
        profile: {
          ...MOCK_CAQH_PROFILE.profile,
          licenses: [
            {
              licenseNumber: 'TEST123',
              state: 'CA',
              licenseType: 'MD',
              issueDate: '2010-01-01',
              expirationDate: '2020-12-31', // Expired
              status: 'Expired',
            },
          ],
        },
      };

      const result = validateCaqhProfile(noLicenseProfile);

      expect(result.isValid).toBe(false);
      expect(result.reasons).toContain('No active licenses found in CAQH profile');
    });

    it('should fail for multiple issues', () => {
      const invalidProfile: CaqhProfile = {
        ...MOCK_CAQH_PROFILE,
        status: 'Expired',
        attestationDate: new Date(Date.now() - 200 * 24 * 60 * 60 * 1000).toISOString(),
        profile: {
          ...MOCK_CAQH_PROFILE.profile,
          licenses: [],
        },
      };

      const result = validateCaqhProfile(invalidProfile);

      expect(result.isValid).toBe(false);
      expect(result.reasons.length).toBeGreaterThanOrEqual(2);
    });
  });

  describe('needsCaqhRenewal', () => {
    it('should return true if expiration is within threshold', () => {
      const soonToExpireProfile: CaqhProfile = {
        ...MOCK_CAQH_PROFILE,
        expirationDate: new Date(Date.now() + 45 * 24 * 60 * 60 * 1000).toISOString(),
      };

      const result = needsCaqhRenewal(soonToExpireProfile, 60);

      expect(result).toBe(true);
    });

    it('should return false if expiration is beyond threshold', () => {
      const distantProfile: CaqhProfile = {
        ...MOCK_CAQH_PROFILE,
        expirationDate: new Date(Date.now() + 100 * 24 * 60 * 60 * 1000).toISOString(),
      };

      const result = needsCaqhRenewal(distantProfile, 60);

      expect(result).toBe(false);
    });

    it('should return false if already expired', () => {
      const expiredProfile: CaqhProfile = {
        ...MOCK_CAQH_PROFILE,
        expirationDate: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString(),
      };

      const result = needsCaqhRenewal(expiredProfile, 60);

      expect(result).toBe(false);
    });

    it('should use default threshold of 60 days', () => {
      const profile: CaqhProfile = {
        ...MOCK_CAQH_PROFILE,
        expirationDate: new Date(Date.now() + 50 * 24 * 60 * 60 * 1000).toISOString(),
      };

      const result = needsCaqhRenewal(profile);

      expect(result).toBe(true);
    });

    it('should handle custom thresholds', () => {
      const profile: CaqhProfile = {
        ...MOCK_CAQH_PROFILE,
        expirationDate: new Date(Date.now() + 20 * 24 * 60 * 60 * 1000).toISOString(),
      };

      expect(needsCaqhRenewal(profile, 30)).toBe(true);
      expect(needsCaqhRenewal(profile, 15)).toBe(false);
    });
  });

  describe('MOCK_CAQH_PROFILE fixture', () => {
    it('should have valid structure', () => {
      expect(MOCK_CAQH_PROFILE.caqhId).toBe('CAQH123456');
      expect(MOCK_CAQH_PROFILE.providerId).toBe('1234567890');
      expect(MOCK_CAQH_PROFILE.status).toBe('Active');
      expect(MOCK_CAQH_PROFILE.profile).toBeDefined();
      expect(MOCK_CAQH_PROFILE.profile.personalInfo).toBeDefined();
      expect(MOCK_CAQH_PROFILE.profile.licenses).toBeDefined();
      expect(MOCK_CAQH_PROFILE.profile.education).toBeDefined();
      expect(MOCK_CAQH_PROFILE.profile.malpracticeInsurance).toBeDefined();
    });

    it('should pass validation', () => {
      const result = validateCaqhProfile(MOCK_CAQH_PROFILE);
      expect(result.isValid).toBe(true);
    });
  });
});


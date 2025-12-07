/**
 * S72-STRETCH-E-002: VITA Distribution Engine Tests
 */

import { describe, it, expect } from '@jest/globals';
import { calculateDistribution, testBoundaryCases } from '../vitaDistribution';
import { OrgRevenueShare } from '../models/OrgRevenueShare';

describe('VITA Distribution Engine', () => {
  describe('calculateDistribution', () => {
    it('should split revenue based on basisPoints', () => {
      const revenueShare: OrgRevenueShare = {
        id: 'rs-1',
        orgId: 'org-1',
        basisPoints: 5000, // 50%
        minGuarantee: null,
        maxCap: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const result = calculateDistribution(10000, revenueShare);

      expect(result.orgShare).toBe(5000);
      expect(result.platformShare).toBe(5000);
      expect(result.appliedFloor).toBe(false);
      expect(result.appliedCap).toBe(false);
    });

    it('should apply minimum guarantee (floor)', () => {
      const revenueShare: OrgRevenueShare = {
        id: 'rs-1',
        orgId: 'org-1',
        basisPoints: 1000, // 10% = 100 cents
        minGuarantee: 500, // Floor of 500
        maxCap: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const result = calculateDistribution(1000, revenueShare);

      expect(result.orgShare).toBe(500); // Floor applied
      expect(result.platformShare).toBe(500);
      expect(result.appliedFloor).toBe(true);
      expect(result.appliedCap).toBe(false);
    });

    it('should apply maximum cap', () => {
      const revenueShare: OrgRevenueShare = {
        id: 'rs-1',
        orgId: 'org-1',
        basisPoints: 8000, // 80% = 80000 cents
        minGuarantee: null,
        maxCap: 50000, // Cap of 50000
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const result = calculateDistribution(100000, revenueShare);

      expect(result.orgShare).toBe(50000); // Cap applied
      expect(result.platformShare).toBe(50000);
      expect(result.appliedFloor).toBe(false);
      expect(result.appliedCap).toBe(true);
    });

    it('should handle zero revenue', () => {
      const revenueShare: OrgRevenueShare = {
        id: 'rs-1',
        orgId: 'org-1',
        basisPoints: 5000,
        minGuarantee: null,
        maxCap: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const result = calculateDistribution(0, revenueShare);

      expect(result.orgShare).toBe(0);
      expect(result.platformShare).toBe(0);
    });

    it('should reject negative revenue', () => {
      const revenueShare: OrgRevenueShare = {
        id: 'rs-1',
        orgId: 'org-1',
        basisPoints: 5000,
        minGuarantee: null,
        maxCap: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      expect(() => calculateDistribution(-1000, revenueShare)).toThrow(
        'grossRevenue must be non-negative'
      );
    });
  });

  describe('testBoundaryCases', () => {
    it('should return test cases for boundary scenarios', () => {
      const testCases = testBoundaryCases();

      expect(testCases.length).toBeGreaterThan(0);
      expect(testCases[0]).toHaveProperty('testCase');
      expect(testCases[0]).toHaveProperty('grossRevenue');
      expect(testCases[0]).toHaveProperty('basisPoints');
      expect(testCases[0]).toHaveProperty('expectedOrgShare');
      expect(testCases[0]).toHaveProperty('expectedPlatformShare');
    });

    it('should validate boundary cases', () => {
      const testCases = testBoundaryCases();

      testCases.forEach((testCase) => {
        const revenueShare: OrgRevenueShare = {
          id: 'rs-1',
          orgId: 'org-1',
          basisPoints: testCase.basisPoints,
          minGuarantee: testCase.minGuarantee ?? null,
          maxCap: testCase.maxCap ?? null,
          createdAt: new Date(),
          updatedAt: new Date(),
        };

        const result = calculateDistribution(testCase.grossRevenue, revenueShare);

        expect(result.orgShare).toBe(testCase.expectedOrgShare);
        expect(result.platformShare).toBe(testCase.expectedPlatformShare);
      });
    });
  });
});


/**
 * B209A-STRAT-002: Tests for OrgFeatureExtractor
 */

import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import type { PrismaClient } from '@prisma/client';
import { OrgFeatureExtractor } from '../extractors/orgFeatures.js';

// Mock Prisma client
const mockPrisma = {
  privilegeGranted: {
    findMany: jest.fn(),
  },
  privilegeSetV2: {
    findMany: jest.fn(),
  },
  fppeOppe: {
    findMany: jest.fn(),
  },
} as unknown as PrismaClient;

describe('OrgFeatureExtractor', () => {
  let extractor: OrgFeatureExtractor;

  beforeEach(() => {
    jest.clearAllMocks();
    extractor = new OrgFeatureExtractor(mockPrisma);
  });

  describe('extractCredentialExpirationWindows', () => {
    it('extracts credential expiration windows correctly', async () => {
      const now = new Date();
      const expires30d = new Date(now.getTime() + 20 * 24 * 60 * 60 * 1000);
      const expires60d = new Date(now.getTime() + 45 * 24 * 60 * 60 * 1000);
      const expires90d = new Date(now.getTime() + 75 * 24 * 60 * 60 * 1000);

      (mockPrisma.privilegeGranted.findMany as jest.Mock).mockResolvedValue([
        { expiresAt: expires30d },
        { expiresAt: expires60d },
        { expiresAt: expires90d },
      ]);

      // Access private method via any for testing
      const windows = await (extractor as any).extractCredentialExpirationWindows(
        'org-123',
        365
      );

      expect(windows['0-30d']).toBe(1);
      expect(windows['30-60d']).toBe(1);
      expect(windows['60-90d']).toBe(1);
      expect(windows['90-180d']).toBe(0);
    });

    it('handles empty expirations', async () => {
      (mockPrisma.privilegeGranted.findMany as jest.Mock).mockResolvedValue([]);

      const windows = await (extractor as any).extractCredentialExpirationWindows(
        'org-empty',
        365
      );

      expect(Object.values(windows).every((v) => v === 0)).toBe(true);
    });
  });

  describe('extractPrivilegeGaps', () => {
    it('extracts privilege gaps correctly', async () => {
      (mockPrisma.privilegeSetV2.findMany as jest.Mock).mockResolvedValue([
        {
          orgId: 'org-123',
          isActive: true,
          privileges: [
            { privilegeCode: 'PRIV-001', privilegeMatrix: { code: 'PRIV-001' } },
            { privilegeCode: 'PRIV-002', privilegeMatrix: { code: 'PRIV-002' } },
            { privilegeCode: 'PRIV-003', privilegeMatrix: { code: 'PRIV-003' } },
          ],
        },
      ]);

      (mockPrisma.privilegeGranted.findMany as jest.Mock).mockResolvedValue([
        {
          orgId: 'org-123',
          status: 'ACTIVE',
          privilegeRequest: {
            privilegeSet: {
              privileges: [
                { privilegeCode: 'PRIV-001', privilegeMatrix: { code: 'PRIV-001' } },
              ],
            },
          },
        },
      ]);

      const gaps = await (extractor as any).extractPrivilegeGaps('org-123');

      expect(gaps.totalGaps).toBeGreaterThan(0);
      expect(gaps.gapDetails).toHaveLength(2); // PRIV-002 and PRIV-003 are missing
    });

    it('handles no gaps scenario', async () => {
      (mockPrisma.privilegeSetV2.findMany as jest.Mock).mockResolvedValue([]);
      (mockPrisma.privilegeGranted.findMany as jest.Mock).mockResolvedValue([]);

      const gaps = await (extractor as any).extractPrivilegeGaps('org-no-gaps');

      expect(gaps.totalGaps).toBe(0);
      expect(gaps.criticalGaps).toBe(0);
      expect(gaps.gapDetails).toHaveLength(0);
    });
  });

  describe('extractOPPETrends', () => {
    it('extracts OPPE trends correctly', async () => {
      (mockPrisma.fppeOppe.findMany as jest.Mock).mockResolvedValue([
        {
          orgId: 'org-123',
          createdAt: new Date(),
          oppeMetrics: { trend: 0.5 },
          privilegeRequest: {
            privilegeSet: {
              department: 'Emergency',
              specialty: '207R00000X',
            },
          },
        },
        {
          orgId: 'org-123',
          createdAt: new Date(),
          oppeMetrics: { trend: -0.2 },
          privilegeRequest: {
            privilegeSet: {
              department: 'Surgery',
              specialty: '207Q00000X',
            },
          },
        },
      ]);

      const trends = await (extractor as any).extractOPPETrends('org-123', 365);

      expect(trends.avgTrend).toBeCloseTo(0.15, 2); // (0.5 + -0.2) / 2
      expect(Object.keys(trends.departments).length).toBeGreaterThan(0);
      expect(Object.keys(trends.specialties).length).toBeGreaterThan(0);
    });

    it('handles empty OPPE records', async () => {
      (mockPrisma.fppeOppe.findMany as jest.Mock).mockResolvedValue([]);

      const trends = await (extractor as any).extractOPPETrends('org-empty', 365);

      expect(trends.avgTrend).toBe(0);
      expect(Object.keys(trends.departments)).toHaveLength(0);
      expect(Object.keys(trends.specialties)).toHaveLength(0);
    });
  });

  describe('extractFeatures', () => {
    it('extracts all features successfully', async () => {
      // Mock all methods
      (mockPrisma.privilegeGranted.findMany as jest.Mock).mockResolvedValue([]);
      (mockPrisma.privilegeSetV2.findMany as jest.Mock).mockResolvedValue([]);
      (mockPrisma.fppeOppe.findMany as jest.Mock).mockResolvedValue([]);

      const features = await extractor.extractFeatures('org-123', 365);

      expect(features).toHaveProperty('credentialExpirationWindows');
      expect(features).toHaveProperty('privilegeGaps');
      expect(features).toHaveProperty('oppeTrends');
      expect(features).toHaveProperty('crossOrgMobility');
      expect(features).toHaveProperty('supplyShockRisk');
      expect(features.supplyShockRisk).toHaveProperty('riskScore');
      expect(features.supplyShockRisk).toHaveProperty('factors');
    });
  });
});


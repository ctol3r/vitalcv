/**
 * B149A-FF-002: Feature flag evaluation service tests
 * Tests for precedence (org→user→global) and fallback
 */

import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { clearCache, getAllFlags, getFlag } from '../featureFlagService';

type PrismaClient = Parameters<typeof getFlag>[0];

// Mock Prisma client
const mockPrisma = {
  featureFlag: {
    findUnique: jest.fn(),
    findMany: jest.fn(),
  },
  orgFeatureFlag: {
    findUnique: jest.fn(),
  },
  userFeatureFlag: {
    findUnique: jest.fn(),
  },
} as jest.Mocked<PrismaClient>;

describe('Feature Flag Service', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    clearCache();
  });

  describe('getFlag', () => {
    it('should return default value when no overrides exist', async () => {
      mockPrisma.featureFlag.findUnique.mockResolvedValue({
        key: 'testFlag',
        defaultValue: true,
      });

      mockPrisma.orgFeatureFlag.findUnique.mockResolvedValue(null);
      mockPrisma.userFeatureFlag.findUnique.mockResolvedValue(null);

      const result = await getFlag(mockPrisma, 'testFlag', {
        orgId: 'org-1',
        userId: 'user-1',
      });

      expect(result.value).toBe(true);
      expect(result.source).toBe('global');
      expect(result.flagKey).toBe('testFlag');
    });

    it('should return org override when present (highest precedence)', async () => {
      mockPrisma.featureFlag.findUnique.mockResolvedValue({
        key: 'testFlag',
        defaultValue: false,
      });

      mockPrisma.orgFeatureFlag.findUnique.mockResolvedValue({
        value: true,
      });

      mockPrisma.userFeatureFlag.findUnique.mockResolvedValue({
        value: false, // This should be ignored
      });

      const result = await getFlag(mockPrisma, 'testFlag', {
        orgId: 'org-1',
        userId: 'user-1',
      });

      expect(result.value).toBe(true);
      expect(result.source).toBe('org');
    });

    it('should return user override when no org override exists', async () => {
      mockPrisma.featureFlag.findUnique.mockResolvedValue({
        key: 'testFlag',
        defaultValue: false,
      });

      mockPrisma.orgFeatureFlag.findUnique.mockResolvedValue(null);
      mockPrisma.userFeatureFlag.findUnique.mockResolvedValue({
        value: true,
      });

      const result = await getFlag(mockPrisma, 'testFlag', {
        orgId: 'org-1',
        userId: 'user-1',
      });

      expect(result.value).toBe(true);
      expect(result.source).toBe('user');
    });

    it('should throw error when flag does not exist', async () => {
      mockPrisma.featureFlag.findUnique.mockResolvedValue(null);

      await expect(getFlag(mockPrisma, 'nonexistent', {})).rejects.toThrow(
        "Feature flag 'nonexistent' not found",
      );
    });

    it('should cache results and return cached value', async () => {
      mockPrisma.featureFlag.findUnique.mockResolvedValue({
        key: 'testFlag',
        defaultValue: true,
      });

      mockPrisma.orgFeatureFlag.findUnique.mockResolvedValue(null);
      mockPrisma.userFeatureFlag.findUnique.mockResolvedValue(null);

      // First call
      const result1 = await getFlag(mockPrisma, 'testFlag', {
        orgId: 'org-1',
        userId: 'user-1',
      });

      // Second call should use cache (no additional DB calls)
      const result2 = await getFlag(mockPrisma, 'testFlag', {
        orgId: 'org-1',
        userId: 'user-1',
      });

      expect(result1.value).toBe(true);
      expect(result2.value).toBe(true);
      // Should only call findUnique once (first call)
      expect(mockPrisma.featureFlag.findUnique).toHaveBeenCalledTimes(1);
    });
  });

  describe('getAllFlags', () => {
    it('should return all flags with resolved values', async () => {
      mockPrisma.featureFlag.findMany.mockResolvedValue([
        {
          key: 'flag1',
          defaultValue: true,
        },
        {
          key: 'flag2',
          defaultValue: false,
        },
      ]);

      mockPrisma.featureFlag.findUnique
        .mockResolvedValueOnce({
          key: 'flag1',
          defaultValue: true,
        })
        .mockResolvedValueOnce({
          key: 'flag2',
          defaultValue: false,
        });

      mockPrisma.orgFeatureFlag.findUnique.mockResolvedValue(null);
      mockPrisma.userFeatureFlag.findUnique.mockResolvedValue(null);

      const results = await getAllFlags(mockPrisma, { orgId: 'org-1' });

      expect(results).toHaveLength(2);
      expect(results[0].flagKey).toBe('flag1');
      expect(results[0].value).toBe(true);
      expect(results[1].flagKey).toBe('flag2');
      expect(results[1].value).toBe(false);
    });
  });
});

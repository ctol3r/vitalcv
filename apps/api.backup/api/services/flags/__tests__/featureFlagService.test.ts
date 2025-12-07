/**
 * B149A-FF-002: Feature flag evaluation service tests
 * Tests for precedence (org→user→global) and fallback
 */

import { describe, it, expect, beforeEach } from '@jest/globals';
import { PrismaClient } from '@prisma/client';
import { getFlag, getAllFlags, clearCache } from '../featureFlagService';

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
} as unknown as PrismaClient;

describe('Feature Flag Service', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    clearCache();
  });

  describe('getFlag', () => {
    it('should return default value when no overrides exist', async () => {
      mockPrisma.featureFlag.findUnique = jest.fn().mockResolvedValue({
        key: 'testFlag',
        defaultValue: true,
        allowedValues: null,
        scope: 'GLOBAL',
      });

      mockPrisma.orgFeatureFlag.findUnique = jest.fn().mockResolvedValue(null);
      mockPrisma.userFeatureFlag.findUnique = jest.fn().mockResolvedValue(null);

      const result = await getFlag(mockPrisma, 'testFlag', {
        orgId: 'org-1',
        userId: 'user-1',
      });

      expect(result.value).toBe(true);
      expect(result.source).toBe('global');
      expect(result.flagKey).toBe('testFlag');
    });

    it('should return org override when present (highest precedence)', async () => {
      mockPrisma.featureFlag.findUnique = jest.fn().mockResolvedValue({
        key: 'testFlag',
        defaultValue: false,
        allowedValues: null,
        scope: 'ORG',
      });

      mockPrisma.orgFeatureFlag.findUnique = jest.fn().mockResolvedValue({
        orgId: 'org-1',
        flagKey: 'testFlag',
        value: true,
      });

      mockPrisma.userFeatureFlag.findUnique = jest.fn().mockResolvedValue({
        userId: 'user-1',
        flagKey: 'testFlag',
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
      mockPrisma.featureFlag.findUnique = jest.fn().mockResolvedValue({
        key: 'testFlag',
        defaultValue: false,
        allowedValues: null,
        scope: 'USER',
      });

      mockPrisma.orgFeatureFlag.findUnique = jest.fn().mockResolvedValue(null);
      mockPrisma.userFeatureFlag.findUnique = jest.fn().mockResolvedValue({
        userId: 'user-1',
        flagKey: 'testFlag',
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
      mockPrisma.featureFlag.findUnique = jest.fn().mockResolvedValue(null);

      await expect(getFlag(mockPrisma, 'nonexistent', {})).rejects.toThrow(
        "Feature flag 'nonexistent' not found"
      );
    });

    it('should cache results and return cached value', async () => {
      mockPrisma.featureFlag.findUnique = jest.fn().mockResolvedValue({
        key: 'testFlag',
        defaultValue: true,
        allowedValues: null,
        scope: 'GLOBAL',
      });

      mockPrisma.orgFeatureFlag.findUnique = jest.fn().mockResolvedValue(null);
      mockPrisma.userFeatureFlag.findUnique = jest.fn().mockResolvedValue(null);

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
      mockPrisma.featureFlag.findMany = jest.fn().mockResolvedValue([
        {
          key: 'flag1',
          defaultValue: true,
          allowedValues: null,
          scope: 'GLOBAL',
        },
        {
          key: 'flag2',
          defaultValue: false,
          allowedValues: null,
          scope: 'GLOBAL',
        },
      ]);

      mockPrisma.featureFlag.findUnique = jest
        .fn()
        .mockResolvedValueOnce({
          key: 'flag1',
          defaultValue: true,
          allowedValues: null,
          scope: 'GLOBAL',
        })
        .mockResolvedValueOnce({
          key: 'flag2',
          defaultValue: false,
          allowedValues: null,
          scope: 'GLOBAL',
        });

      mockPrisma.orgFeatureFlag.findUnique = jest.fn().mockResolvedValue(null);
      mockPrisma.userFeatureFlag.findUnique = jest.fn().mockResolvedValue(null);

      const results = await getAllFlags(mockPrisma, { orgId: 'org-1' });

      expect(results).toHaveLength(2);
      expect(results[0].flagKey).toBe('flag1');
      expect(results[0].value).toBe(true);
      expect(results[1].flagKey).toBe('flag2');
      expect(results[1].value).toBe(false);
    });
  });
});


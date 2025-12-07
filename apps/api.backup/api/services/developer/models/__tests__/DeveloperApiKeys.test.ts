/**
 * B227A-DEV-005: DeveloperApiKeys Model Tests
 */

import { PrismaClient } from '@prisma/client';
import {
  createApiKey,
  getApiKey,
  getApiKeysByDeveloper,
  verifyApiKey,
  revokeApiKey,
  revokeAllApiKeys,
  hashApiKey,
  generateApiKey,
} from '../DeveloperApiKeys';

describe('DeveloperApiKeys', () => {
  let mockPrisma: jest.Mocked<PrismaClient>;

  beforeEach(() => {
    mockPrisma = {
      developerApiKeys: {
        create: jest.fn(),
        findUnique: jest.fn(),
        findMany: jest.fn(),
        update: jest.fn(),
        updateMany: jest.fn(),
      },
    } as any;
  });

  describe('generateApiKey', () => {
    it('should generate a valid API key', () => {
      const result = generateApiKey();
      expect(result.key).toMatch(/^vitalcv_[a-f0-9]{64}$/);
      expect(result.hashedKey).toHaveLength(64);
      expect(result.hashedKey).toBe(hashApiKey(result.key));
    });
  });

  describe('hashApiKey', () => {
    it('should hash an API key consistently', () => {
      const key = 'test_key_123';
      const hash1 = hashApiKey(key);
      const hash2 = hashApiKey(key);
      expect(hash1).toBe(hash2);
      expect(hash1).toHaveLength(64);
    });
  });

  describe('createApiKey', () => {
    it('should create a new API key', async () => {
      const mockApiKey = {
        id: 'key-1',
        developerId: 'dev-1',
        key: 'hashed_key',
        createdAt: new Date(),
        lastUsedAt: null,
        revoked: false,
        revokedAt: null,
      };

      mockPrisma.developerApiKeys.create.mockResolvedValue(mockApiKey as any);

      const result = await createApiKey(mockPrisma, { developerId: 'dev-1' });

      expect(result.apiKey).toEqual(mockApiKey);
      expect(result.plainKey).toMatch(/^vitalcv_/);
      expect(mockPrisma.developerApiKeys.create).toHaveBeenCalledWith({
        data: {
          developerId: 'dev-1',
          key: expect.any(String),
          revoked: false,
        },
      });
    });

    it('should throw error if developerId is missing', async () => {
      await expect(createApiKey(mockPrisma, { developerId: '' })).rejects.toThrow(
        'developerId is required'
      );
    });
  });

  describe('getApiKey', () => {
    it('should get API key by ID', async () => {
      const mockApiKey = {
        id: 'key-1',
        developerId: 'dev-1',
        key: 'hashed_key',
        createdAt: new Date(),
        lastUsedAt: null,
        revoked: false,
        revokedAt: null,
      };

      mockPrisma.developerApiKeys.findUnique.mockResolvedValue(mockApiKey as any);

      const result = await getApiKey(mockPrisma, 'key-1');

      expect(result).toEqual(mockApiKey);
      expect(mockPrisma.developerApiKeys.findUnique).toHaveBeenCalledWith({
        where: { id: 'key-1' },
      });
    });

    it('should return null if key not found', async () => {
      mockPrisma.developerApiKeys.findUnique.mockResolvedValue(null);

      const result = await getApiKey(mockPrisma, 'non-existent');

      expect(result).toBeNull();
    });
  });

  describe('getApiKeysByDeveloper', () => {
    it('should get all API keys for a developer', async () => {
      const mockKeys = [
        {
          id: 'key-1',
          developerId: 'dev-1',
          key: 'hashed_key_1',
          createdAt: new Date(),
          lastUsedAt: null,
          revoked: false,
          revokedAt: null,
        },
        {
          id: 'key-2',
          developerId: 'dev-1',
          key: 'hashed_key_2',
          createdAt: new Date(),
          lastUsedAt: new Date(),
          revoked: false,
          revokedAt: null,
        },
      ];

      mockPrisma.developerApiKeys.findMany.mockResolvedValue(mockKeys as any);

      const result = await getApiKeysByDeveloper(mockPrisma, 'dev-1');

      expect(result).toEqual(mockKeys);
      expect(mockPrisma.developerApiKeys.findMany).toHaveBeenCalledWith({
        where: { developerId: 'dev-1', revoked: false },
        orderBy: { createdAt: 'desc' },
      });
    });
  });

  describe('verifyApiKey', () => {
    it('should verify a valid API key', async () => {
      const plainKey = 'vitalcv_test_key';
      const hashedKey = hashApiKey(plainKey);

      const mockApiKey = {
        id: 'key-1',
        developerId: 'dev-1',
        key: hashedKey,
        createdAt: new Date(),
        lastUsedAt: null,
        revoked: false,
        revokedAt: null,
      };

      mockPrisma.developerApiKeys.findUnique.mockResolvedValue(mockApiKey as any);
      mockPrisma.developerApiKeys.update.mockResolvedValue({
        ...mockApiKey,
        lastUsedAt: new Date(),
      } as any);

      const result = await verifyApiKey(mockPrisma, plainKey);

      expect(result).toEqual(expect.objectContaining({ id: 'key-1', developerId: 'dev-1' }));
      expect(mockPrisma.developerApiKeys.update).toHaveBeenCalled();
    });

    it('should return null for revoked key', async () => {
      const plainKey = 'vitalcv_test_key';
      const hashedKey = hashApiKey(plainKey);

      const mockApiKey = {
        id: 'key-1',
        developerId: 'dev-1',
        key: hashedKey,
        createdAt: new Date(),
        lastUsedAt: null,
        revoked: true,
        revokedAt: new Date(),
      };

      mockPrisma.developerApiKeys.findUnique.mockResolvedValue(mockApiKey as any);

      const result = await verifyApiKey(mockPrisma, plainKey);

      expect(result).toBeNull();
    });

    it('should return null for invalid key', async () => {
      mockPrisma.developerApiKeys.findUnique.mockResolvedValue(null);

      const result = await verifyApiKey(mockPrisma, 'invalid_key');

      expect(result).toBeNull();
    });
  });

  describe('revokeApiKey', () => {
    it('should revoke an API key', async () => {
      const mockApiKey = {
        id: 'key-1',
        developerId: 'dev-1',
        key: 'hashed_key',
        createdAt: new Date(),
        lastUsedAt: null,
        revoked: false,
        revokedAt: null,
      };

      const revokedApiKey = {
        ...mockApiKey,
        revoked: true,
        revokedAt: new Date(),
      };

      mockPrisma.developerApiKeys.update.mockResolvedValue(revokedApiKey as any);

      const result = await revokeApiKey(mockPrisma, 'key-1');

      expect(result.revoked).toBe(true);
      expect(result.revokedAt).toBeDefined();
      expect(mockPrisma.developerApiKeys.update).toHaveBeenCalledWith({
        where: { id: 'key-1' },
        data: {
          revoked: true,
          revokedAt: expect.any(Date),
        },
      });
    });
  });

  describe('revokeAllApiKeys', () => {
    it('should revoke all API keys for a developer', async () => {
      mockPrisma.developerApiKeys.updateMany.mockResolvedValue({ count: 3 } as any);

      const result = await revokeAllApiKeys(mockPrisma, 'dev-1');

      expect(result).toBe(3);
      expect(mockPrisma.developerApiKeys.updateMany).toHaveBeenCalledWith({
        where: {
          developerId: 'dev-1',
          revoked: false,
        },
        data: {
          revoked: true,
          revokedAt: expect.any(Date),
        },
      });
    });
  });
});


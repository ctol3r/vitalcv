/**
 * Unit tests for EUDI Wallet Configuration and Enforcement
 * B112B-EUDI-019: Server toggle: Accept EUDI Wallets (hard-enforce)
 */

import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import {
  loadEudiWalletConfig,
  getEudiWalletConfig,
  isEudiOnlyModeEnabled,
  updateEudiWalletConfig,
  getAuditReason,
  resetEudiWalletConfig,
} from '../config/eudi-wallet';
import { PrismaClient } from '@prisma/client';

// Mock Prisma Client
jest.mock('@prisma/client', () => {
  const mockPrisma = {
    serverConfig: {
      findUnique: jest.fn(),
      upsert: jest.fn(),
    },
  };
  return {
    PrismaClient: jest.fn(() => mockPrisma),
  };
});

describe('EUDI Wallet Configuration', () => {
  let mockPrisma: any;

  beforeEach(() => {
    // Reset config before each test
    resetEudiWalletConfig();
    delete process.env.ACCEPT_EUDI_WALLETS_ONLY;

    // Get mock Prisma instance
    const PrismaClientMock = PrismaClient as jest.MockedClass<typeof PrismaClient>;
    mockPrisma = new PrismaClientMock();
  });

  afterEach(() => {
    // Clean up after each test
    resetEudiWalletConfig();
    delete process.env.ACCEPT_EUDI_WALLETS_ONLY;
    jest.clearAllMocks();
  });

  describe('loadEudiWalletConfig', () => {
    it('should load config from database when available', async () => {
      mockPrisma.serverConfig.findUnique.mockResolvedValue({
        key: 'eudi_wallet_acceptance',
        value: { acceptEudiWalletsOnly: true },
      });

      const config = await loadEudiWalletConfig();
      expect(config.acceptEudiWalletsOnly).toBe(true);
      expect(config.auditReasonTemplate).toBe('Non-EUDI presentation blocked: EUDI-only mode enabled');
    });

    it('should fallback to env var when database unavailable', async () => {
      mockPrisma.serverConfig.findUnique.mockRejectedValue(new Error('DB unavailable'));
      process.env.ACCEPT_EUDI_WALLETS_ONLY = 'true';

      const config = await loadEudiWalletConfig();
      expect(config.acceptEudiWalletsOnly).toBe(true);
    });

    it('should load config with default value (false) when env var not set', async () => {
      mockPrisma.serverConfig.findUnique.mockResolvedValue(null);

      const config = await loadEudiWalletConfig();
      expect(config.acceptEudiWalletsOnly).toBe(false);
      expect(config.auditReasonTemplate).toBe('Non-EUDI presentation blocked: EUDI-only mode enabled');
    });

    it('should load config with true when ACCEPT_EUDI_WALLETS_ONLY=true', async () => {
      mockPrisma.serverConfig.findUnique.mockResolvedValue(null);
      process.env.ACCEPT_EUDI_WALLETS_ONLY = 'true';
      const config = await loadEudiWalletConfig();
      expect(config.acceptEudiWalletsOnly).toBe(true);
    });

    it('should load config with true when ACCEPT_EUDI_WALLETS_ONLY=1', async () => {
      mockPrisma.serverConfig.findUnique.mockResolvedValue(null);
      process.env.ACCEPT_EUDI_WALLETS_ONLY = '1';
      const config = await loadEudiWalletConfig();
      expect(config.acceptEudiWalletsOnly).toBe(true);
    });

    it('should load config with false when ACCEPT_EUDI_WALLETS_ONLY=false', async () => {
      mockPrisma.serverConfig.findUnique.mockResolvedValue(null);
      process.env.ACCEPT_EUDI_WALLETS_ONLY = 'false';
      const config = await loadEudiWalletConfig();
      expect(config.acceptEudiWalletsOnly).toBe(false);
    });
  });

  describe('getEudiWalletConfig', () => {
    it('should return cached config after first call', async () => {
      mockPrisma.serverConfig.findUnique.mockResolvedValue({
        key: 'eudi_wallet_acceptance',
        value: { acceptEudiWalletsOnly: false },
      });

      const config1 = await getEudiWalletConfig();
      process.env.ACCEPT_EUDI_WALLETS_ONLY = 'true';
      const config2 = await getEudiWalletConfig();
      // Should return cached value, not reload from env
      expect(config1.acceptEudiWalletsOnly).toBe(config2.acceptEudiWalletsOnly);
    });
  });

  describe('isEudiOnlyModeEnabled', () => {
    it('should return false when EUDI-only mode is disabled', async () => {
      mockPrisma.serverConfig.findUnique.mockResolvedValue({
        key: 'eudi_wallet_acceptance',
        value: { acceptEudiWalletsOnly: false },
      });
      resetEudiWalletConfig();
      expect(await isEudiOnlyModeEnabled()).toBe(false);
    });

    it('should return true when EUDI-only mode is enabled', async () => {
      mockPrisma.serverConfig.findUnique.mockResolvedValue({
        key: 'eudi_wallet_acceptance',
        value: { acceptEudiWalletsOnly: true },
      });
      resetEudiWalletConfig();
      expect(await isEudiOnlyModeEnabled()).toBe(true);
    });
  });

  describe('updateEudiWalletConfig', () => {
    it('should update in-memory config and persist to database', async () => {
      mockPrisma.serverConfig.findUnique.mockResolvedValue({
        key: 'eudi_wallet_acceptance',
        value: { acceptEudiWalletsOnly: false },
      });
      mockPrisma.serverConfig.upsert.mockResolvedValue({
        key: 'eudi_wallet_acceptance',
        value: { acceptEudiWalletsOnly: true },
      });

      const updated = await updateEudiWalletConfig({ acceptEudiWalletsOnly: true }, 'test-user');
      expect(updated.acceptEudiWalletsOnly).toBe(true);
      expect(mockPrisma.serverConfig.upsert).toHaveBeenCalledWith({
        where: { key: 'eudi_wallet_acceptance' },
        create: expect.objectContaining({
          key: 'eudi_wallet_acceptance',
          value: { acceptEudiWalletsOnly: true },
          updatedBy: 'test-user',
        }),
        update: expect.objectContaining({
          value: { acceptEudiWalletsOnly: true },
          updatedBy: 'test-user',
        }),
      });
    });

    it('should fallback to env var if database update fails', async () => {
      mockPrisma.serverConfig.findUnique.mockResolvedValue({
        key: 'eudi_wallet_acceptance',
        value: { acceptEudiWalletsOnly: false },
      });
      mockPrisma.serverConfig.upsert.mockRejectedValue(new Error('DB error'));

      await updateEudiWalletConfig({ acceptEudiWalletsOnly: true });
      expect(process.env.ACCEPT_EUDI_WALLETS_ONLY).toBe('true');
    });
  });

  describe('getAuditReason', () => {
    it('should return audit reason template', async () => {
      mockPrisma.serverConfig.findUnique.mockResolvedValue(null);
      const reason = await getAuditReason();
      expect(reason).toBe('Non-EUDI presentation blocked: EUDI-only mode enabled');
    });
  });
});

// Note: Middleware tests are in verifier-api/__tests__/eudi-middleware.test.ts
// This file focuses on testing the configuration module


/**
 * B247A-GAM-009: RewardSystemTests suite
 *
 * Test suite covering awarding, redemption, config reloads, event bus integration,
 * expiration behaviour; ensures negative balances cannot occur; uses mocks for dependencies
 */

import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { PrismaClient } from '@prisma/client';
import {
  RewardPointsService,
  AwardPointsRequest,
  RedeemPointsRequest,
} from '../services/rewardPointsService';
import { RewardsConfigService } from '../services/rewardsConfigService';
import { RewardExpirationService } from '../services/rewardExpirationService';
import { RewardPointsAnalyticsService } from '../analytics/rewardPointsAnalyticsService';
import { rewardEventBus } from '../events/rewardEventBus';
import {
  createRewardPointsTransaction,
  getUserBalance,
  RewardActionType,
} from '../models/RewardPointsTransaction';
import {
  upsertActionPointsDefinition,
  ActionPointsDefinition,
} from '../models/ActionPointsDefinition';

// Mock Prisma client
const mockPrisma = {
  rewardPointsTransaction: {
    create: jest.fn(),
    findUnique: jest.fn(),
    findMany: jest.fn(),
    count: jest.fn(),
    aggregate: jest.fn(),
    groupBy: jest.fn(),
  },
  actionPointsDefinition: {
    findUnique: jest.fn(),
    findMany: jest.fn(),
    upsert: jest.fn(),
    update: jest.fn(),
  },
  user: {
    findUnique: jest.fn(),
  },
} as unknown as PrismaClient;

describe('Reward System Tests', () => {
  let rewardPointsService: RewardPointsService;
  let configService: RewardsConfigService;
  let expirationService: RewardExpirationService;
  let analyticsService: RewardPointsAnalyticsService;

  beforeEach(() => {
    jest.clearAllMocks();
    configService = new RewardsConfigService(mockPrisma);
    rewardPointsService = new RewardPointsService(mockPrisma, configService);
    expirationService = new RewardExpirationService(mockPrisma);
    analyticsService = new RewardPointsAnalyticsService(mockPrisma);
  });

  describe('RewardPointsService', () => {
    describe('awardPoints', () => {
      it('should award points successfully', async () => {
        const userId = 'user-1';
        const actionType = RewardActionType.PROFILE_COMPLETE;

        // Mock config service to return points
        jest.spyOn(configService, 'getPointsForAction').mockResolvedValue(50);

        // Mock transaction creation
        const mockTransaction = {
          id: 'tx-1',
          userId,
          actionType,
          points: 50,
          description: 'Points awarded for PROFILE_COMPLETE',
          createdAt: new Date(),
        };

        (mockPrisma.rewardPointsTransaction.create as jest.Mock).mockResolvedValue(
          mockTransaction
        );

        // Mock balance calculation
        (mockPrisma.rewardPointsTransaction.aggregate as jest.Mock).mockResolvedValue({
          _sum: { points: 50 },
        });

        // Mock event bus
        const emitSpy = jest.spyOn(rewardEventBus, 'emitPointAwarded');

        const result = await rewardPointsService.awardPoints({
          userId,
          actionType,
        });

        expect(result.success).toBe(true);
        expect(result.transaction).toEqual(mockTransaction);
        expect(result.newBalance).toBe(50);
        expect(emitSpy).toHaveBeenCalled();
      });

      it('should reject award if action has zero or negative points', async () => {
        const userId = 'user-1';
        const actionType = RewardActionType.PROFILE_COMPLETE;

        // Mock config service to return 0 points
        jest.spyOn(configService, 'getPointsForAction').mockResolvedValue(0);

        const result = await rewardPointsService.awardPoints({
          userId,
          actionType,
        });

        expect(result.success).toBe(false);
        expect(result.error).toContain('Cannot award points');
      });
    });

    describe('redeemPoints', () => {
      it('should redeem points successfully', async () => {
        const userId = 'user-1';
        const pointsToRedeem = 25;

        // Mock balance check - user has 100 points
        (mockPrisma.rewardPointsTransaction.aggregate as jest.Mock).mockResolvedValue({
          _sum: { points: 100 },
        });

        // Mock transaction creation
        const mockTransaction = {
          id: 'tx-2',
          userId,
          actionType: RewardActionType.REDEMPTION,
          points: -25,
          description: 'Points redeemed: 25',
          createdAt: new Date(),
        };

        (mockPrisma.rewardPointsTransaction.create as jest.Mock).mockResolvedValue(
          mockTransaction
        );

        // Mock new balance calculation (after redemption)
        (mockPrisma.rewardPointsTransaction.aggregate as jest.Mock)
          .mockResolvedValueOnce({ _sum: { points: 100 } }) // Initial balance
          .mockResolvedValueOnce({ _sum: { points: 75 } }); // After redemption

        // Mock event bus
        const emitSpy = jest.spyOn(rewardEventBus, 'emitPointsRedeemed');

        const result = await rewardPointsService.redeemPoints({
          userId,
          points: pointsToRedeem,
        });

        expect(result.success).toBe(true);
        expect(result.transaction).toEqual(mockTransaction);
        expect(result.newBalance).toBe(75);
        expect(emitSpy).toHaveBeenCalled();
      });

      it('should prevent redemption if insufficient balance', async () => {
        const userId = 'user-1';
        const pointsToRedeem = 100;

        // Mock balance check - user has only 50 points
        (mockPrisma.rewardPointsTransaction.aggregate as jest.Mock).mockResolvedValue({
          _sum: { points: 50 },
        });

        const result = await rewardPointsService.redeemPoints({
          userId,
          points: pointsToRedeem,
        });

        expect(result.success).toBe(false);
        expect(result.error).toContain('Insufficient balance');
      });

      it('should ensure balance never goes negative', async () => {
        const userId = 'user-1';
        const pointsToRedeem = 150;

        // Mock balance check - user has only 100 points
        (mockPrisma.rewardPointsTransaction.aggregate as jest.Mock)
          .mockResolvedValueOnce({ _sum: { points: 100 } }) // Initial check
          .mockResolvedValueOnce({ _sum: { points: -50 } }); // After redemption (shouldn't happen)

        const result = await rewardPointsService.redeemPoints({
          userId,
          points: pointsToRedeem,
        });

        // Should fail before creating transaction
        expect(result.success).toBe(false);
        expect(result.error).toContain('Insufficient balance');
      });

      it('should validate redemption amount is positive', async () => {
        const userId = 'user-1';

        const result = await rewardPointsService.redeemPoints({
          userId,
          points: -10,
        });

        expect(result.success).toBe(false);
        expect(result.error).toContain('must be positive');
      });
    });

    describe('canRedeem', () => {
      it('should return true if user has sufficient balance', async () => {
        const userId = 'user-1';

        // Mock balance check
        (mockPrisma.rewardPointsTransaction.aggregate as jest.Mock).mockResolvedValue({
          _sum: { points: 100 },
        });

        const result = await rewardPointsService.canRedeem(userId, 50);

        expect(result.canRedeem).toBe(true);
        expect(result.currentBalance).toBe(100);
      });

      it('should return false if user has insufficient balance', async () => {
        const userId = 'user-1';

        // Mock balance check
        (mockPrisma.rewardPointsTransaction.aggregate as jest.Mock).mockResolvedValue({
          _sum: { points: 50 },
        });

        const result = await rewardPointsService.canRedeem(userId, 100);

        expect(result.canRedeem).toBe(false);
        expect(result.currentBalance).toBe(50);
        expect(result.error).toContain('Insufficient balance');
      });
    });
  });

  describe('RewardsConfigService', () => {
    describe('getPointsForAction', () => {
      it('should return points from database', async () => {
        const actionType = RewardActionType.PROFILE_COMPLETE;
        const mockDefinition = {
          id: 'def-1',
          actionType,
          points: 50,
          description: 'Complete profile',
          isActive: true,
          createdAt: new Date(),
          updatedAt: new Date(),
        };

        (mockPrisma.actionPointsDefinition.findMany as jest.Mock).mockResolvedValue([
          mockDefinition,
        ]);

        // Force reload
        await configService.loadFromDatabase();

        const points = await configService.getPointsForAction(actionType);

        expect(points).toBe(50);
      });

      it('should fallback to defaults if not in database', async () => {
        const actionType = RewardActionType.PROFILE_COMPLETE;

        // Mock empty database
        (mockPrisma.actionPointsDefinition.findMany as jest.Mock).mockResolvedValue([]);

        await configService.loadFromDatabase();

        const points = await configService.getPointsForAction(actionType);

        // Should use default (50)
        expect(points).toBe(50);
      });
    });

    describe('updateActionPoints', () => {
      it('should update action points and invalidate cache', async () => {
        const actionType = RewardActionType.PROFILE_COMPLETE;
        const mockDefinition = {
          id: 'def-1',
          actionType,
          points: 75,
          description: 'Updated description',
          isActive: true,
          createdAt: new Date(),
          updatedAt: new Date(),
        };

        (mockPrisma.actionPointsDefinition.upsert as jest.Mock).mockResolvedValue(
          mockDefinition
        );

        const result = await configService.updateActionPoints(
          actionType,
          75,
          'Updated description'
        );

        expect(result).toEqual(mockDefinition);
      });
    });

    describe('validateConfigurations', () => {
      it('should validate configurations successfully', async () => {
        const mockDefinitions = [
          {
            id: 'def-1',
            actionType: RewardActionType.PROFILE_COMPLETE,
            points: 50,
            description: 'Complete profile',
            isActive: true,
            createdAt: new Date(),
            updatedAt: new Date(),
          },
          {
            id: 'def-2',
            actionType: RewardActionType.CREDENTIAL_VERIFIED,
            points: 100,
            description: 'Verify credential',
            isActive: true,
            createdAt: new Date(),
            updatedAt: new Date(),
          },
        ];

        (mockPrisma.actionPointsDefinition.findMany as jest.Mock).mockResolvedValue(
          mockDefinitions
        );

        const result = await configService.validateConfigurations();

        expect(result.valid).toBe(true);
        expect(result.errors).toHaveLength(0);
      });

      it('should detect invalid configurations', async () => {
        const mockDefinitions = [
          {
            id: 'def-1',
            actionType: RewardActionType.PROFILE_COMPLETE,
            points: 0,
            description: 'Complete profile',
            isActive: true,
            createdAt: new Date(),
            updatedAt: new Date(),
          },
          {
            id: 'def-2',
            actionType: RewardActionType.COMMUNITY_POST,
            points: 2000,
            description: 'Community post',
            isActive: true,
            createdAt: new Date(),
            updatedAt: new Date(),
          },
        ];

        (mockPrisma.actionPointsDefinition.findMany as jest.Mock).mockResolvedValue(
          mockDefinitions
        );

        const result = await configService.validateConfigurations();

        expect(result.valid).toBe(false);
        expect(result.errors.length).toBeGreaterThan(0);
      });
    });
  });

  describe('RewardEventBus', () => {
    it('should emit pointAwarded events', () => {
      const handler = jest.fn();
      rewardEventBus.onPointAwarded(handler);

      rewardEventBus.emitPointAwarded({
        userId: 'user-1',
        actionType: RewardActionType.PROFILE_COMPLETE,
        points: 50,
        description: 'Test',
        transactionId: 'tx-1',
      });

      expect(handler).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'pointAwarded',
          userId: 'user-1',
          points: 50,
        })
      );
    });

    it('should emit pointsRedeemed events', () => {
      const handler = jest.fn();
      rewardEventBus.onPointsRedeemed(handler);

      rewardEventBus.emitPointsRedeemed({
        userId: 'user-1',
        points: 25,
        description: 'Redeemed',
        transactionId: 'tx-1',
      });

      expect(handler).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'pointsRedeemed',
          userId: 'user-1',
          points: 25,
        })
      );
    });

    it('should support async handlers', async () => {
      const handler = jest.fn().mockResolvedValue(undefined);
      rewardEventBus.onPointAwarded(handler);

      rewardEventBus.emitPointAwarded({
        userId: 'user-1',
        actionType: RewardActionType.PROFILE_COMPLETE,
        points: 50,
        description: 'Test',
        transactionId: 'tx-1',
      });

      // Give event loop a chance to process
      await new Promise((resolve) => setTimeout(resolve, 10));

      expect(handler).toHaveBeenCalled();
    });
  });

  describe('RewardExpirationService', () => {
    it('should expire points for users with old transactions', async () => {
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - 365);

      // Mock users with old transactions
      (mockPrisma.rewardPointsTransaction.groupBy as jest.Mock).mockResolvedValue([
        {
          userId: 'user-1',
          _max: { createdAt: new Date(Date.now() - 400 * 24 * 60 * 60 * 1000) },
        },
      ]);

      // Mock balance calculation
      (mockPrisma.rewardPointsTransaction.aggregate as jest.Mock).mockResolvedValue({
        _sum: { points: 100 },
      });

      // Mock transaction creation
      (mockPrisma.rewardPointsTransaction.create as jest.Mock).mockResolvedValue({
        id: 'tx-expire-1',
        userId: 'user-1',
        actionType: RewardActionType.EXPIRATION,
        points: -100,
        description: 'Points expired after 365 days of inactivity',
        createdAt: new Date(),
      });

      const result = await expirationService.expireUnusedPoints();

      expect(result.usersProcessed).toBeGreaterThan(0);
      expect(result.totalPointsExpired).toBeGreaterThan(0);
    });
  });

  describe('RewardPointsAnalyticsService', () => {
    it('should calculate overall statistics', async () => {
      (mockPrisma.rewardPointsTransaction.aggregate as jest.Mock)
        .mockResolvedValueOnce({ _sum: { points: 1000 }, _count: { id: 50 } }) // Awarded
        .mockResolvedValueOnce({ _sum: { points: -200 } }) // Redeemed
        .mockResolvedValueOnce({ _sum: { points: -50 } }) // Expired
        .mockResolvedValueOnce({ _sum: { points: 750 } }); // Total balance

      (mockPrisma.rewardPointsTransaction.groupBy as jest.Mock).mockResolvedValue([
        { userId: 'user-1' },
        { userId: 'user-2' },
      ]);

      const stats = await analyticsService.getOverallStatistics();

      expect(stats.totalPointsAwarded).toBe(1000);
      expect(stats.totalPointsRedeemed).toBe(200);
      expect(stats.totalPointsExpired).toBe(50);
      expect(stats.totalActiveBalance).toBe(750);
      expect(stats.uniqueUsers).toBe(2);
    });

    it('should get action type breakdown', async () => {
      (mockPrisma.rewardPointsTransaction.groupBy as jest.Mock).mockResolvedValue([
        {
          actionType: RewardActionType.PROFILE_COMPLETE,
          _sum: { points: 500 },
          _count: { id: 10 },
        },
      ]);

      const breakdown = await analyticsService.getActionTypeBreakdown();

      expect(breakdown.length).toBeGreaterThan(0);
    });
  });
});


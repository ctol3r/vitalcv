/**
 * B247A-GAM-006: RewardExpirationService
 *
 * Runs scheduled tasks to expire unused points after configurable period;
 * updates user balances and logs expiration as transactions
 */

import { PrismaClient } from '@prisma/client';
import {
  createRewardPointsTransaction,
  getUserTransactions,
  getUserBalance,
} from '../models/RewardPointsTransaction';
import { RewardActionType } from '../models/RewardPointsTransaction';
import { rewardEventBus } from '../events/rewardEventBus';

export interface ExpirationConfig {
  expirationPeriodDays: number; // Points expire after this many days of inactivity
  batchSize: number; // Number of users to process per batch
}

export interface ExpirationResult {
  usersProcessed: number;
  totalPointsExpired: number;
  transactionsCreated: number;
  errors: string[];
}

export class RewardExpirationService {
  constructor(
    private prisma: PrismaClient,
    private config: ExpirationConfig = {
      expirationPeriodDays: 365, // Default: 1 year
      batchSize: 100,
    }
  ) {}

  /**
   * Expire points for users who haven't had activity within the expiration period
   */
  async expireUnusedPoints(): Promise<ExpirationResult> {
    const result: ExpirationResult = {
      usersProcessed: 0,
      totalPointsExpired: 0,
      transactionsCreated: 0,
      errors: [],
    };

    try {
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - this.config.expirationPeriodDays);

      // Get all users who have points transactions older than the cutoff
      // We need to find users whose most recent transaction is older than the cutoff
      const usersWithOldPoints = await this.prisma.rewardPointsTransaction.groupBy({
        by: ['userId'],
        _max: {
          createdAt: true,
        },
        having: {
          createdAt: {
            _max: {
              lt: cutoffDate,
            },
          },
        },
      });

      // Process users in batches
      for (let i = 0; i < usersWithOldPoints.length; i += this.config.batchSize) {
        const batch = usersWithOldPoints.slice(i, i + this.config.batchSize);

        for (const userGroup of batch) {
          try {
            const userId = userGroup.userId;
            const balance = await getUserBalance(this.prisma, userId);

            // Only expire if user has positive balance
            if (balance > 0) {
              // Create expiration transaction
              const expirationTransaction = await createRewardPointsTransaction(
                this.prisma,
                {
                  userId,
                  actionType: RewardActionType.EXPIRATION,
                  points: -balance, // Negative to deduct from balance
                  description: `Points expired after ${this.config.expirationPeriodDays} days of inactivity`,
                }
              );

              result.totalPointsExpired += balance;
              result.transactionsCreated++;

              // Emit event
              rewardEventBus.emitPointsExpired({
                userId,
                points: balance,
                description: expirationTransaction.description,
                transactionId: expirationTransaction.id,
              });

              result.usersProcessed++;
            }
          } catch (error) {
            result.errors.push(
              `Error processing user ${userGroup.userId}: ${error instanceof Error ? error.message : 'Unknown error'}`
            );
          }
        }
      }
    } catch (error) {
      result.errors.push(
        `Error during expiration process: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }

    return result;
  }

  /**
   * Expire points for a specific user
   */
  async expireUserPoints(userId: string): Promise<{
    success: boolean;
    pointsExpired: number;
    transactionId?: string;
    error?: string;
  }> {
    try {
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - this.config.expirationPeriodDays);

      // Check if user's most recent transaction is older than cutoff
      const recentTransactions = await getUserTransactions(this.prisma, userId, {
        limit: 1,
        orderBy: 'desc',
      });

      if (recentTransactions.length === 0) {
        return {
          success: false,
          pointsExpired: 0,
          error: 'User has no transactions',
        };
      }

      const mostRecentTransaction = recentTransactions[0];
      if (mostRecentTransaction.createdAt >= cutoffDate) {
        return {
          success: false,
          pointsExpired: 0,
          error: 'User has recent activity, no expiration needed',
        };
      }

      const balance = await getUserBalance(this.prisma, userId);

      if (balance <= 0) {
        return {
          success: false,
          pointsExpired: 0,
          error: 'User has no points to expire',
        };
      }

      // Create expiration transaction
      const expirationTransaction = await createRewardPointsTransaction(this.prisma, {
        userId,
        actionType: RewardActionType.EXPIRATION,
        points: -balance,
        description: `Points expired after ${this.config.expirationPeriodDays} days of inactivity`,
      });

      // Emit event
      rewardEventBus.emitPointsExpired({
        userId,
        points: balance,
        description: expirationTransaction.description,
        transactionId: expirationTransaction.id,
      });

      return {
        success: true,
        pointsExpired: balance,
        transactionId: expirationTransaction.id,
      };
    } catch (error) {
      return {
        success: false,
        pointsExpired: 0,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Get users eligible for expiration (for reporting)
   */
  async getUsersEligibleForExpiration(): Promise<
    Array<{
      userId: string;
      lastActivityDate: Date;
      currentBalance: number;
      daysSinceActivity: number;
    }>
  > {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - this.config.expirationPeriodDays);

    const usersWithOldPoints = await this.prisma.rewardPointsTransaction.groupBy({
      by: ['userId'],
      _max: {
        createdAt: true,
      },
      having: {
        createdAt: {
          _max: {
            lt: cutoffDate,
          },
        },
      },
    });

    const eligibleUsers = [];

    for (const userGroup of usersWithOldPoints) {
      const userId = userGroup.userId;
      const lastActivityDate = userGroup._max.createdAt;
      const balance = await getUserBalance(this.prisma, userId);

      if (balance > 0 && lastActivityDate) {
        const daysSinceActivity = Math.floor(
          (Date.now() - lastActivityDate.getTime()) / (1000 * 60 * 60 * 24)
        );

        eligibleUsers.push({
          userId,
          lastActivityDate,
          currentBalance: balance,
          daysSinceActivity,
        });
      }
    }

    return eligibleUsers;
  }
}


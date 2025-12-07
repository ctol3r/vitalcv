/**
 * B247A-GAM-002: RewardPointsService
 *
 * Handles awarding and redeeming points; validates actions against configured point values;
 * ensures no negative balances; emits events on successful awards
 */

import { PrismaClient } from '@prisma/client';
import {
  createRewardPointsTransaction,
  getUserBalance,
  RewardPointsTransaction,
  RewardActionType,
  RewardPointsTransactionInput,
} from '../models/RewardPointsTransaction';
import { RewardsConfigService } from './rewardsConfigService';
import { rewardEventBus } from '../events/rewardEventBus';

export interface AwardPointsRequest {
  userId: string;
  actionType: RewardActionType;
  description?: string;
}

export interface RedeemPointsRequest {
  userId: string;
  points: number;
  description?: string;
}

export interface AwardResult {
  success: boolean;
  transaction?: RewardPointsTransaction;
  newBalance?: number;
  error?: string;
}

export interface RedeemResult {
  success: boolean;
  transaction?: RewardPointsTransaction;
  newBalance?: number;
  error?: string;
}

export class RewardPointsService {
  constructor(
    private prisma: PrismaClient,
    private configService: RewardsConfigService
  ) {}

  /**
   * Award points to a user for an action
   */
  async awardPoints(request: AwardPointsRequest): Promise<AwardResult> {
    try {
      // Get configured points for this action
      const points = await this.configService.getPointsForAction(request.actionType);

      if (points <= 0) {
        return {
          success: false,
          error: `Cannot award points: action ${request.actionType} has points value of ${points}`,
        };
      }

      // Get default description if not provided
      const description =
        request.description || `Points awarded for ${request.actionType}`;

      // Create transaction
      const transaction = await createRewardPointsTransaction(this.prisma, {
        userId: request.userId,
        actionType: request.actionType,
        points,
        description,
      });

      // Get new balance
      const newBalance = await getUserBalance(this.prisma, request.userId);

      // Emit event
      rewardEventBus.emitPointAwarded({
        userId: request.userId,
        actionType: request.actionType,
        points,
        description,
        transactionId: transaction.id,
      });

      return {
        success: true,
        transaction,
        newBalance,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Redeem points from a user's balance
   */
  async redeemPoints(request: RedeemPointsRequest): Promise<RedeemResult> {
    try {
      if (request.points <= 0) {
        return {
          success: false,
          error: 'Points to redeem must be positive',
        };
      }

      // Get current balance
      const currentBalance = await getUserBalance(this.prisma, request.userId);

      // Ensure user has sufficient balance
      if (currentBalance < request.points) {
        return {
          success: false,
          error: `Insufficient balance: ${currentBalance} points available, ${request.points} requested`,
        };
      }

      // Create redemption transaction (negative points)
      const pointsToDeduct = -request.points;
      const description =
        request.description || `Points redeemed: ${request.points}`;

      const transaction = await createRewardPointsTransaction(this.prisma, {
        userId: request.userId,
        actionType: RewardActionType.REDEMPTION,
        points: pointsToDeduct,
        description,
      });

      // Get new balance
      const newBalance = await getUserBalance(this.prisma, request.userId);

      // Ensure balance is not negative (shouldn't happen, but double-check)
      if (newBalance < 0) {
        // This should never happen, but if it does, we need to handle it
        throw new Error('Balance went negative after redemption - data integrity issue');
      }

      // Emit event
      rewardEventBus.emitPointsRedeemed({
        userId: request.userId,
        points: request.points,
        description,
        transactionId: transaction.id,
      });

      return {
        success: true,
        transaction,
        newBalance,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Get user's current balance
   */
  async getBalance(userId: string): Promise<number> {
    return getUserBalance(this.prisma, userId);
  }

  /**
   * Check if user can redeem points
   */
  async canRedeem(userId: string, points: number): Promise<{
    canRedeem: boolean;
    currentBalance: number;
    error?: string;
  }> {
    const currentBalance = await getUserBalance(this.prisma, userId);

    if (points <= 0) {
      return {
        canRedeem: false,
        currentBalance,
        error: 'Points to redeem must be positive',
      };
    }

    if (currentBalance < points) {
      return {
        canRedeem: false,
        currentBalance,
        error: `Insufficient balance: ${currentBalance} points available, ${points} requested`,
      };
    }

    return {
      canRedeem: true,
      currentBalance,
    };
  }

  /**
   * Validate that balance will not go negative
   * This is a safety check that should be used before any point deduction
   */
  async validateBalance(userId: string, pointsToDeduct: number): Promise<{
    valid: boolean;
    currentBalance: number;
    projectedBalance: number;
    error?: string;
  }> {
    const currentBalance = await getUserBalance(this.prisma, userId);
    const projectedBalance = currentBalance - pointsToDeduct;

    if (projectedBalance < 0) {
      return {
        valid: false,
        currentBalance,
        projectedBalance,
        error: `Deduction would result in negative balance: ${currentBalance} - ${pointsToDeduct} = ${projectedBalance}`,
      };
    }

    return {
      valid: true,
      currentBalance,
      projectedBalance,
    };
  }
}


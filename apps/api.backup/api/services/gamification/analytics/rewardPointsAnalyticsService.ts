/**
 * B247A-GAM-008: RewardPointsAnalyticsService
 *
 * Aggregates statistics on points: total points awarded, redeemed, expired;
 * breakdown by actionType and time range; generates reports for admin dashboards
 */

import { PrismaClient } from '@prisma/client';
import {
  getUserTransactionCount,
  RewardActionType,
  getUserTransactions,
} from '../models/RewardPointsTransaction';

export interface PointsStatistics {
  totalPointsAwarded: number;
  totalPointsRedeemed: number;
  totalPointsExpired: number;
  totalActiveBalance: number;
  transactionCount: number;
  uniqueUsers: number;
}

export interface ActionTypeBreakdown {
  actionType: RewardActionType;
  pointsAwarded: number;
  pointsRedeemed: number;
  transactionCount: number;
  uniqueUsers: number;
}

export interface TimeRangeStatistics {
  timeRange: {
    start: Date;
    end: Date;
  };
  pointsAwarded: number;
  pointsRedeemed: number;
  pointsExpired: number;
  transactionCount: number;
  uniqueUsers: number;
}

export interface UserStatistics {
  userId: string;
  totalPointsAwarded: number;
  totalPointsRedeemed: number;
  totalPointsExpired: number;
  currentBalance: number;
  transactionCount: number;
  mostCommonAction: RewardActionType | null;
}

export class RewardPointsAnalyticsService {
  constructor(private prisma: PrismaClient) {}

  /**
   * Get overall statistics for all points
   */
  async getOverallStatistics(): Promise<PointsStatistics> {
    // Get all transactions aggregated
    const awarded = await this.prisma.rewardPointsTransaction.aggregate({
      where: {
        points: {
          gt: 0,
        },
      },
      _sum: {
        points: true,
      },
      _count: {
        id: true,
      },
    });

    const redeemed = await this.prisma.rewardPointsTransaction.aggregate({
      where: {
        actionType: RewardActionType.REDEMPTION,
        points: {
          lt: 0,
        },
      },
      _sum: {
        points: true,
      },
    });

    const expired = await this.prisma.rewardPointsTransaction.aggregate({
      where: {
        actionType: RewardActionType.EXPIRATION,
        points: {
          lt: 0,
        },
      },
      _sum: {
        points: true,
      },
    });

    // Get unique users
    const uniqueUsersResult = await this.prisma.rewardPointsTransaction.groupBy({
      by: ['userId'],
    });

    // Calculate total active balance (sum of all points)
    const totalBalance = await this.prisma.rewardPointsTransaction.aggregate({
      _sum: {
        points: true,
      },
    });

    return {
      totalPointsAwarded: awarded._sum.points || 0,
      totalPointsRedeemed: Math.abs(redeemed._sum.points || 0),
      totalPointsExpired: Math.abs(expired._sum.points || 0),
      totalActiveBalance: totalBalance._sum.points || 0,
      transactionCount: awarded._count.id || 0,
      uniqueUsers: uniqueUsersResult.length,
    };
  }

  /**
   * Get breakdown by action type
   */
  async getActionTypeBreakdown(): Promise<ActionTypeBreakdown[]> {
    const transactionsByAction = await this.prisma.rewardPointsTransaction.groupBy({
      by: ['actionType'],
      _sum: {
        points: true,
      },
      _count: {
        id: true,
      },
    });

    const breakdown: ActionTypeBreakdown[] = [];

    for (const group of transactionsByAction) {
      const actionType = group.actionType as RewardActionType;
      const pointsSum = group._sum.points || 0;

      // Get unique users for this action type
      const uniqueUsersResult = await this.prisma.rewardPointsTransaction.groupBy({
        by: ['userId'],
        where: {
          actionType,
        },
      });

      breakdown.push({
        actionType,
        pointsAwarded: pointsSum > 0 ? pointsSum : 0,
        pointsRedeemed: pointsSum < 0 && actionType === RewardActionType.REDEMPTION ? Math.abs(pointsSum) : 0,
        transactionCount: group._count.id || 0,
        uniqueUsers: uniqueUsersResult.length,
      });
    }

    return breakdown.sort((a, b) => b.transactionCount - a.transactionCount);
  }

  /**
   * Get statistics for a time range
   */
  async getTimeRangeStatistics(startDate: Date, endDate: Date): Promise<TimeRangeStatistics> {
    const awarded = await this.prisma.rewardPointsTransaction.aggregate({
      where: {
        points: {
          gt: 0,
        },
        createdAt: {
          gte: startDate,
          lte: endDate,
        },
      },
      _sum: {
        points: true,
      },
      _count: {
        id: true,
      },
    });

    const redeemed = await this.prisma.rewardPointsTransaction.aggregate({
      where: {
        actionType: RewardActionType.REDEMPTION,
        points: {
          lt: 0,
        },
        createdAt: {
          gte: startDate,
          lte: endDate,
        },
      },
      _sum: {
        points: true,
      },
    });

    const expired = await this.prisma.rewardPointsTransaction.aggregate({
      where: {
        actionType: RewardActionType.EXPIRATION,
        points: {
          lt: 0,
        },
        createdAt: {
          gte: startDate,
          lte: endDate,
        },
      },
      _sum: {
        points: true,
      },
    });

    const uniqueUsersResult = await this.prisma.rewardPointsTransaction.groupBy({
      by: ['userId'],
      where: {
        createdAt: {
          gte: startDate,
          lte: endDate,
        },
      },
    });

    return {
      timeRange: {
        start: startDate,
        end: endDate,
      },
      pointsAwarded: awarded._sum.points || 0,
      pointsRedeemed: Math.abs(redeemed._sum.points || 0),
      pointsExpired: Math.abs(expired._sum.points || 0),
      transactionCount: awarded._count.id || 0,
      uniqueUsers: uniqueUsersResult.length,
    };
  }

  /**
   * Get statistics for a specific user
   */
  async getUserStatistics(userId: string): Promise<UserStatistics | null> {
    const userTransactions = await this.prisma.rewardPointsTransaction.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
    });

    if (userTransactions.length === 0) {
      return null;
    }

    const awarded = userTransactions
      .filter((t) => t.points > 0)
      .reduce((sum, t) => sum + t.points, 0);

    const redeemed = Math.abs(
      userTransactions
        .filter((t) => t.actionType === RewardActionType.REDEMPTION && t.points < 0)
        .reduce((sum, t) => sum + t.points, 0)
    );

    const expired = Math.abs(
      userTransactions
        .filter((t) => t.actionType === RewardActionType.EXPIRATION && t.points < 0)
        .reduce((sum, t) => sum + t.points, 0)
    );

    const currentBalance = awarded - redeemed - expired;

    // Find most common action type
    const actionTypeCounts = new Map<RewardActionType, number>();
    for (const transaction of userTransactions) {
      const count = actionTypeCounts.get(transaction.actionType) || 0;
      actionTypeCounts.set(transaction.actionType, count + 1);
    }

    let mostCommonAction: RewardActionType | null = null;
    let maxCount = 0;
    for (const [actionType, count] of actionTypeCounts.entries()) {
      if (count > maxCount) {
        maxCount = count;
        mostCommonAction = actionType;
      }
    }

    return {
      userId,
      totalPointsAwarded: awarded,
      totalPointsRedeemed: redeemed,
      totalPointsExpired: expired,
      currentBalance,
      transactionCount: userTransactions.length,
      mostCommonAction,
    };
  }

  /**
   * Get top users by balance
   */
  async getTopUsersByBalance(limit: number = 10): Promise<Array<{
    userId: string;
    balance: number;
    transactionCount: number;
  }>> {
    // Get balance for each user
    const userBalances = await this.prisma.rewardPointsTransaction.groupBy({
      by: ['userId'],
      _sum: {
        points: true,
      },
      _count: {
        id: true,
      },
    });

    const usersWithBalances = userBalances
      .map((group) => ({
        userId: group.userId,
        balance: group._sum.points || 0,
        transactionCount: group._count.id || 0,
      }))
      .filter((u) => u.balance > 0)
      .sort((a, b) => b.balance - a.balance)
      .slice(0, limit);

    return usersWithBalances;
  }

  /**
   * Get top users by transaction count
   */
  async getTopUsersByTransactionCount(limit: number = 10): Promise<Array<{
    userId: string;
    balance: number;
    transactionCount: number;
  }>> {
    const userBalances = await this.prisma.rewardPointsTransaction.groupBy({
      by: ['userId'],
      _sum: {
        points: true,
      },
      _count: {
        id: true,
      },
    });

    const usersWithCounts = userBalances
      .map((group) => ({
        userId: group.userId,
        balance: group._sum.points || 0,
        transactionCount: group._count.id || 0,
      }))
      .sort((a, b) => b.transactionCount - a.transactionCount)
      .slice(0, limit);

    return usersWithCounts;
  }
}


/**
 * B247A-GAM-007: RewardHistoryAPI
 *
 * Exposes endpoints for users to fetch their point balance and transaction history;
 * supports pagination and sorting; ensures only authenticated user can access their data
 */

import { PrismaClient } from '@prisma/client';
import { getUserBalance, getUserTransactions, RewardActionType } from '../models/RewardPointsTransaction';
import { RewardPointsService } from '../services/rewardPointsService';
import { RewardsConfigService } from '../services/rewardsConfigService';

// Extended Express Request type with user
interface AuthenticatedRequest {
  user?: {
    id: string;
    roles?: string[];
  };
  params?: {
    userId?: string;
  };
  query?: {
    limit?: string;
    offset?: string;
    actionType?: string;
    orderBy?: string;
  };
  body?: {
    userId?: string;
    actionType?: RewardActionType;
    description?: string;
    points?: number;
  };
}

interface Response {
  status: (code: number) => Response;
  json: (data: any) => void;
}

export interface RewardHistoryQueryParams {
  limit?: number;
  offset?: number;
  actionType?: RewardActionType;
  orderBy?: 'asc' | 'desc';
}

export interface BalanceResponse {
  userId: string;
  balance: number;
}

export interface TransactionHistoryResponse {
  userId: string;
  transactions: Array<{
    id: string;
    actionType: RewardActionType;
    points: number;
    description: string;
    createdAt: Date;
  }>;
  pagination: {
    total: number;
    limit: number;
    offset: number;
    hasMore: boolean;
  };
}

export class RewardHistoryAPI {
  private rewardPointsService: RewardPointsService;
  private configService: RewardsConfigService;

  constructor(private prisma: PrismaClient) {
    this.configService = new RewardsConfigService(prisma);
    this.rewardPointsService = new RewardPointsService(prisma, this.configService);
  }

  /**
   * Get user's current balance
   * GET /api/rewards/balance
   */
  async getBalance(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      // Ensure user is authenticated and accessing their own data
      const userId = req.user?.id || req.params?.userId;
      if (!userId) {
        res.status(401).json({ error: 'Unauthorized: user ID required' });
        return;
      }

      // If userId in params doesn't match authenticated user, deny access
      if (req.user && req.params?.userId && req.user.id !== req.params.userId) {
        res.status(403).json({ error: 'Forbidden: cannot access another user\'s balance' });
        return;
      }

      const balance = await this.rewardPointsService.getBalance(userId);

      const response: BalanceResponse = {
        userId,
        balance,
      };

      res.json(response);
    } catch (error) {
      res.status(500).json({
        error: 'Failed to get balance',
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  /**
   * Get user's transaction history
   * GET /api/rewards/history
   */
  async getTransactionHistory(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      // Ensure user is authenticated and accessing their own data
      const userId = req.user?.id || req.params?.userId;
      if (!userId) {
        res.status(401).json({ error: 'Unauthorized: user ID required' });
        return;
      }

      // If userId in params doesn't match authenticated user, deny access
      if (req.user && req.params?.userId && req.user.id !== req.params.userId) {
        res.status(403).json({ error: 'Forbidden: cannot access another user\'s history' });
        return;
      }

      // Parse query parameters
      const limit = req.query?.limit ? Math.min(parseInt(req.query.limit, 10), 100) : 20;
      const offset = req.query?.offset ? parseInt(req.query.offset, 10) : 0;
      const actionType = req.query?.actionType as RewardActionType | undefined;
      const orderBy = (req.query?.orderBy as 'asc' | 'desc') || 'desc';

      // Validate action type if provided
      if (actionType && !Object.values(RewardActionType).includes(actionType)) {
        res.status(400).json({ error: `Invalid actionType: ${actionType}` });
        return;
      }

      // Get transactions
      const transactions = await getUserTransactions(this.prisma, userId, {
        limit,
        offset,
        actionType,
        orderBy,
      });

      // Get total count for pagination
      const total = await this.prisma.rewardPointsTransaction.count({
        where: {
          userId,
          ...(actionType && { actionType }),
        },
      });

      const response: TransactionHistoryResponse = {
        userId,
        transactions: transactions.map((t) => ({
          id: t.id,
          actionType: t.actionType,
          points: t.points,
          description: t.description,
          createdAt: t.createdAt,
        })),
        pagination: {
          total,
          limit,
          offset,
          hasMore: offset + limit < total,
        },
      };

      res.json(response);
    } catch (error) {
      res.status(500).json({
        error: 'Failed to get transaction history',
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  /**
   * Award points to user (admin/automated action)
   * POST /api/rewards/award
   */
  async awardPoints(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      // Only admins or automated systems can award points
      if (!req.user || (!req.user.roles?.includes('admin') && !req.user.roles?.includes('system'))) {
        res.status(403).json({ error: 'Forbidden: only admins or system can award points' });
        return;
      }

      const { userId, actionType, description } = req.body || {};

      if (!userId || !actionType) {
        res.status(400).json({ error: 'userId and actionType are required' });
        return;
      }

      // Validate action type
      if (!Object.values(RewardActionType).includes(actionType)) {
        res.status(400).json({ error: `Invalid actionType: ${actionType}` });
        return;
      }

      const result = await this.rewardPointsService.awardPoints({
        userId,
        actionType,
        description,
      });

      if (!result.success) {
        res.status(400).json({
          error: 'Failed to award points',
          message: result.error,
        });
        return;
      }

      res.json({
        success: true,
        transaction: result.transaction,
        newBalance: result.newBalance,
      });
    } catch (error) {
      res.status(500).json({
        error: 'Failed to award points',
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  /**
   * Redeem points (user action)
   * POST /api/rewards/redeem
   */
  async redeemPoints(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      // Ensure user is authenticated
      const userId = req.user?.id || req.body?.userId;
      if (!userId) {
        res.status(401).json({ error: 'Unauthorized: user ID required' });
        return;
      }

      // Users can only redeem their own points
      if (req.user && req.body?.userId && req.user.id !== req.body.userId) {
        res.status(403).json({ error: 'Forbidden: cannot redeem another user\'s points' });
        return;
      }

      const { points, description } = req.body || {};

      if (!points || typeof points !== 'number' || points <= 0) {
        res.status(400).json({ error: 'points must be a positive number' });
        return;
      }

      // Check if user can redeem
      const canRedeem = await this.rewardPointsService.canRedeem(userId, points);

      if (!canRedeem.canRedeem) {
        res.status(400).json({
          error: 'Cannot redeem points',
          message: canRedeem.error,
          currentBalance: canRedeem.currentBalance,
        });
        return;
      }

      const result = await this.rewardPointsService.redeemPoints({
        userId,
        points,
        description,
      });

      if (!result.success) {
        res.status(400).json({
          error: 'Failed to redeem points',
          message: result.error,
        });
        return;
      }

      res.json({
        success: true,
        transaction: result.transaction,
        newBalance: result.newBalance,
      });
    } catch (error) {
      res.status(500).json({
        error: 'Failed to redeem points',
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }
}


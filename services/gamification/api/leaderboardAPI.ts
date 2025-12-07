/**
 * B247C-GAM-023: LeaderboardAPI
 *
 * Endpoints to fetch leaderboards (top N) for each period; returns user's rank if allowed;
 * enforces data anonymization for opted-out users; supports pagination.
 */

import { Request, Response, Router } from 'express';
import { z } from 'zod';
import { PrismaClient, LeaderboardPeriod } from '@prisma/client';
import { LeaderboardService } from '../services/leaderboardService';
import { AuthenticatedRequest } from '../../../../backend/src/middleware/accessGuards';

const router = Router();

/**
 * Helper to check if user is authenticated
 */
function requireAuth(req: Request, res: Response, next: () => void) {
  const authReq = req as AuthenticatedRequest;

  if (!authReq.user) {
    return res.status(401).json({ error: 'Authentication required' });
  }

  next();
}

/**
 * Validate period parameter
 */
function validatePeriod(period: string): LeaderboardPeriod | null {
  const validPeriods: LeaderboardPeriod[] = ['DAILY', 'WEEKLY', 'MONTHLY', 'ALL_TIME'];
  return validPeriods.includes(period as LeaderboardPeriod) ? (period as LeaderboardPeriod) : null;
}

/**
 * GET /api/gamification/leaderboards
 * Get top leaderboard entries for a period
 * Query params: period (DAILY|WEEKLY|MONTHLY|ALL_TIME), limit (default 100, max 500)
 */
router.get('/', async (req: Request, res: Response) => {
  const prisma = new PrismaClient();
  try {
    const periodParam = (req.query.period as string) || 'ALL_TIME';
    const period = validatePeriod(periodParam);

    if (!period) {
      return res.status(400).json({
        error: 'Invalid period',
        message: 'Period must be one of: DAILY, WEEKLY, MONTHLY, ALL_TIME',
      });
    }

    const limit = Math.min(parseInt(req.query.limit as string, 10) || 100, 500);

    const service = new LeaderboardService(prisma);
    const result = await service.getTopLeaderboard(period, limit);

    // Anonymize opted-out users
    const anonymizedEntries = await Promise.all(
      result.entries.map(async (entry) => {
        const preferences = await prisma.userGamificationPreferences.findUnique({
          where: { userId: entry.userId },
        });

        if (preferences && !preferences.leaderboardOptIn) {
          return {
            ...entry,
            userName: undefined,
            userEmail: undefined,
            userId: 'anonymous', // Anonymize user ID
          };
        }
        return entry;
      })
    );

    res.json({
      period: result.period,
      entries: anonymizedEntries,
      totalEntries: result.totalEntries,
    });
  } catch (error: any) {
    console.error('[LeaderboardAPI] Error fetching leaderboard:', error);
    res.status(500).json({ error: 'Failed to fetch leaderboard' });
  } finally {
    await prisma.$disconnect();
  }
});

/**
 * GET /api/gamification/leaderboards/:period
 * Get top leaderboard entries for a specific period
 * Path param: period (DAILY|WEEKLY|MONTHLY|ALL_TIME)
 * Query params: limit (default 100, max 500), page (for pagination)
 */
router.get('/:period', async (req: Request, res: Response) => {
  const prisma = new PrismaClient();
  try {
    const period = validatePeriod(req.params.period.toUpperCase());

    if (!period) {
      return res.status(400).json({
        error: 'Invalid period',
        message: 'Period must be one of: DAILY, WEEKLY, MONTHLY, ALL_TIME',
      });
    }

    const limit = Math.min(parseInt(req.query.limit as string, 10) || 100, 500);
    const page = Math.max(1, parseInt(req.query.page as string, 10) || 1);

    const service = new LeaderboardService(prisma);
    const result = await service.getTopLeaderboard(period, limit * page);

    // Apply pagination
    const start = (page - 1) * limit;
    const end = start + limit;
    const paginatedEntries = result.entries.slice(start, end);

    // Anonymize opted-out users
    const anonymizedEntries = await Promise.all(
      paginatedEntries.map(async (entry) => {
        const preferences = await prisma.userGamificationPreferences.findUnique({
          where: { userId: entry.userId },
        });

        if (preferences && !preferences.leaderboardOptIn) {
          return {
            ...entry,
            userName: undefined,
            userEmail: undefined,
            userId: 'anonymous',
          };
        }
        return entry;
      })
    );

    res.json({
      period: result.period,
      entries: anonymizedEntries,
      pagination: {
        page,
        limit,
        total: result.totalEntries,
        totalPages: Math.ceil(result.totalEntries / limit),
      },
    });
  } catch (error: any) {
    console.error('[LeaderboardAPI] Error fetching leaderboard:', error);
    res.status(500).json({ error: 'Failed to fetch leaderboard' });
  } finally {
    await prisma.$disconnect();
  }
});

/**
 * GET /api/gamification/leaderboards/:period/my-rank
 * Get current user's rank for a period (requires authentication)
 */
router.get('/:period/my-rank', requireAuth, async (req: Request, res: Response) => {
  const prisma = new PrismaClient();
  try {
    const authReq = req as AuthenticatedRequest;
    const userId = authReq.user.id;

    const period = validatePeriod(req.params.period.toUpperCase());

    if (!period) {
      return res.status(400).json({
        error: 'Invalid period',
        message: 'Period must be one of: DAILY, WEEKLY, MONTHLY, ALL_TIME',
      });
    }

    const service = new LeaderboardService(prisma);
    const userRank = await service.getUserRank(userId, period);

    if (!userRank) {
      return res.json({
        period,
        rank: null,
        pointsTotal: 0,
        message: 'No ranking found for this period',
      });
    }

    res.json({
      period: userRank.period,
      rank: userRank.isPrivate ? null : userRank.rank,
      pointsTotal: userRank.pointsTotal,
      isPrivate: userRank.isPrivate,
    });
  } catch (error: any) {
    console.error('[LeaderboardAPI] Error fetching user rank:', error);
    res.status(500).json({ error: 'Failed to fetch user rank' });
  } finally {
    await prisma.$disconnect();
  }
});

/**
 * GET /api/gamification/leaderboards/:period/context
 * Get leaderboard with user's rank context (requires authentication)
 * Shows top entries plus entries around user's rank
 */
router.get('/:period/context', requireAuth, async (req: Request, res: Response) => {
  const prisma = new PrismaClient();
  try {
    const authReq = req as AuthenticatedRequest;
    const userId = authReq.user.id;

    const period = validatePeriod(req.params.period.toUpperCase());

    if (!period) {
      return res.status(400).json({
        error: 'Invalid period',
        message: 'Period must be one of: DAILY, WEEKLY, MONTHLY, ALL_TIME',
      });
    }

    const topLimit = Math.min(parseInt(req.query.topLimit as string, 10) || 50, 200);
    const contextSize = Math.min(parseInt(req.query.contextSize as string, 10) || 5, 20);

    const service = new LeaderboardService(prisma);
    const result = await service.getLeaderboardWithUserContext(
      period,
      userId,
      topLimit,
      contextSize
    );

    // Anonymize opted-out users in top entries
    const anonymizedTopEntries = await Promise.all(
      result.topEntries.map(async (entry) => {
        if (entry.userId === 'anonymous') {
          return entry; // Already anonymized
        }
        const preferences = await prisma.userGamificationPreferences.findUnique({
          where: { userId: entry.userId },
        });
        if (preferences && !preferences.leaderboardOptIn) {
          return {
            ...entry,
            userName: undefined,
            userEmail: undefined,
            userId: 'anonymous',
          };
        }
        return entry;
      })
    );

    res.json({
      period,
      topEntries: anonymizedTopEntries,
      userRank: result.isPrivate ? null : result.userRank,
      userPoints: result.userPoints,
      contextEntries: result.contextEntries,
      isPrivate: result.isPrivate,
    });
  } catch (error: any) {
    console.error('[LeaderboardAPI] Error fetching leaderboard context:', error);
    res.status(500).json({ error: 'Failed to fetch leaderboard context' });
  } finally {
    await prisma.$disconnect();
  }
});

export default router;


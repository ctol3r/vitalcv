/**
 * B247C-GAM-028: GamificationPreferences API
 *
 * Endpoints to get and update user gamification preferences (leaderboard opt-in, notifications opt-in)
 */

import { Request, Response, Router } from 'express';
import { PrismaClient } from '@prisma/client';
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
 * GET /api/gamification/preferences
 * Get current user's gamification preferences
 */
router.get('/', requireAuth, async (req: Request, res: Response) => {
  const prisma = new PrismaClient();
  try {
    const authReq = req as AuthenticatedRequest;
    const userId = authReq.user.id;

    const preferences = await prisma.userGamificationPreferences.findUnique({
      where: { userId },
    });

    if (!preferences) {
      // Return defaults if no preferences exist
      return res.json({
        leaderboardOptIn: true,
        notificationsOptIn: true,
      });
    }

    res.json({
      leaderboardOptIn: preferences.leaderboardOptIn,
      notificationsOptIn: preferences.notificationsOptIn,
    });
  } catch (error: any) {
    console.error('[PreferencesAPI] Error fetching preferences:', error);
    res.status(500).json({ error: 'Failed to fetch preferences' });
  } finally {
    await prisma.$disconnect();
  }
});

/**
 * PUT /api/gamification/preferences
 * Update current user's gamification preferences
 */
router.put('/', requireAuth, async (req: Request, res: Response) => {
  const prisma = new PrismaClient();
  try {
    const authReq = req as AuthenticatedRequest;
    const userId = authReq.user.id;

    const { leaderboardOptIn, notificationsOptIn } = req.body;

    if (typeof leaderboardOptIn !== 'boolean' || typeof notificationsOptIn !== 'boolean') {
      return res.status(400).json({
        error: 'Invalid request',
        message: 'leaderboardOptIn and notificationsOptIn must be boolean values',
      });
    }

    const preferences = await prisma.userGamificationPreferences.upsert({
      where: { userId },
      create: {
        userId,
        leaderboardOptIn,
        notificationsOptIn,
      },
      update: {
        leaderboardOptIn,
        notificationsOptIn,
      },
    });

    res.json({
      leaderboardOptIn: preferences.leaderboardOptIn,
      notificationsOptIn: preferences.notificationsOptIn,
    });
  } catch (error: any) {
    console.error('[PreferencesAPI] Error updating preferences:', error);
    res.status(500).json({ error: 'Failed to update preferences' });
  } finally {
    await prisma.$disconnect();
  }
});

export default router;


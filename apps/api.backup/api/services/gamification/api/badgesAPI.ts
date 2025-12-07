/**
 * BadgesAPI
 * B247B-GAM-016: Endpoints to list available badges, show user's earned badges, and progress; ensures authorization; returns badge icons and descriptions; supports pagination; unit tests validate responses
 */

import { Request, Response, Router } from 'express';
import { z } from 'zod';
import { PrismaClient } from '@prisma/client';
import { BadgeModel } from '../models/Badge';
import { AchievementProgressModel } from '../models/AchievementProgress';
import { BadgeAssignmentService } from '../services/badgeAssignmentService';
import { BadgeDefinitionLoader } from '../services/badgeDefinitionLoader';
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
 * GET /api/gamification/badges
 * List all available badges (public endpoint, but can be filtered)
 */
router.get('/', async (req: Request, res: Response) => {
  const prisma = new PrismaClient();
  try {
    const badgeModel = new BadgeModel(prisma);
    const loader = new BadgeDefinitionLoader(prisma);

    const filters: {
      isActive?: boolean;
      level?: number;
      minLevel?: number;
      maxLevel?: number;
    } = {};

    if (req.query.isActive !== undefined) {
      filters.isActive = req.query.isActive === 'true';
    } else {
      filters.isActive = true; // Default to active only
    }

    if (req.query.level) {
      filters.level = parseInt(req.query.level as string, 10);
    }

    if (req.query.minLevel) {
      filters.minLevel = parseInt(req.query.minLevel as string, 10);
    }

    if (req.query.maxLevel) {
      filters.maxLevel = parseInt(req.query.maxLevel as string, 10);
    }

    const badges = await badgeModel.list(filters);

    // Pagination
    const page = parseInt(req.query.page as string, 10) || 1;
    const limit = Math.min(parseInt(req.query.limit as string, 10) || 50, 100);
    const start = (page - 1) * limit;
    const end = start + limit;

    const paginatedBadges = badges.slice(start, end);

    res.json({
      badges: paginatedBadges,
      pagination: {
        page,
        limit,
        total: badges.length,
        totalPages: Math.ceil(badges.length / limit),
      },
    });
  } catch (error: any) {
    console.error('[BadgesAPI] Error listing badges:', error);
    res.status(500).json({ error: 'Failed to list badges' });
  } finally {
    await prisma.$disconnect();
  }
});

/**
 * GET /api/gamification/badges/:id
 * Get a specific badge by ID or slug
 */
router.get('/:id', async (req: Request, res: Response) => {
  const prisma = new PrismaClient();
  try {
    const { id } = req.params;
    const loader = new BadgeDefinitionLoader(prisma);

    const badge = await loader.loadByIdOrSlug(id);

    if (!badge) {
      return res.status(404).json({ error: 'Badge not found' });
    }

    res.json(badge);
  } catch (error: any) {
    console.error('[BadgesAPI] Error getting badge:', error);
    res.status(500).json({ error: 'Failed to get badge' });
  } finally {
    await prisma.$disconnect();
  }
});

/**
 * GET /api/gamification/badges/user/earned
 * Get user's earned badges (requires authentication)
 */
router.get('/user/earned', requireAuth, async (req: Request, res: Response) => {
  const prisma = new PrismaClient();
  try {
    const authReq = req as AuthenticatedRequest;
    const userId = authReq.user!.id;

    const assignmentService = new BadgeAssignmentService(prisma);
    const badges = await assignmentService.getUserBadges(userId);

    res.json({
      badges: badges.map((b) => ({
        id: b.badge.id,
        name: b.badge.name,
        slug: b.badge.slug,
        description: b.badge.description,
        iconId: b.badge.iconId,
        level: b.badge.level,
        awardedAt: b.awardedAt,
      })),
      count: badges.length,
    });
  } catch (error: any) {
    console.error('[BadgesAPI] Error getting user badges:', error);
    res.status(500).json({ error: 'Failed to get user badges' });
  } finally {
    await prisma.$disconnect();
  }
});

/**
 * GET /api/gamification/badges/user/progress
 * Get user's progress for all badges (requires authentication)
 */
router.get('/user/progress', requireAuth, async (req: Request, res: Response) => {
  const prisma = new PrismaClient();
  try {
    const authReq = req as AuthenticatedRequest;
    const userId = authReq.user!.id;

    const assignmentService = new BadgeAssignmentService(prisma);
    const progress = await assignmentService.getUserProgress(userId);

    res.json({
      progress: progress.map((p) => ({
        badge: {
          id: p.badge.id,
          name: p.badge.name,
          slug: p.badge.slug,
          description: p.badge.description,
          iconId: p.badge.iconId,
          level: p.badge.level,
        },
        progress: p.progress,
        completed: p.completed,
      })),
    });
  } catch (error: any) {
    console.error('[BadgesAPI] Error getting user progress:', error);
    res.status(500).json({ error: 'Failed to get user progress' });
  } finally {
    await prisma.$disconnect();
  }
});

/**
 * GET /api/gamification/badges/user/progress/:badgeId
 * Get user's progress for a specific badge (requires authentication)
 */
router.get('/user/progress/:badgeId', requireAuth, async (req: Request, res: Response) => {
  const prisma = new PrismaClient();
  try {
    const authReq = req as AuthenticatedRequest;
    const userId = authReq.user!.id;
    const { badgeId } = req.params;

    const assignmentService = new BadgeAssignmentService(prisma);
    const progress = await assignmentService.getBadgeProgress(userId, badgeId);

    if (!progress) {
      return res.status(404).json({ error: 'Badge not found' });
    }

    res.json({
      badge: {
        id: progress.badge.id,
        name: progress.badge.name,
        slug: progress.badge.slug,
        description: progress.badge.description,
        iconId: progress.badge.iconId,
        level: progress.badge.level,
      },
      progress: progress.progress,
      completed: progress.completed,
      progressPercentage: progress.progressPercentage,
    });
  } catch (error: any) {
    console.error('[BadgesAPI] Error getting badge progress:', error);
    res.status(500).json({ error: 'Failed to get badge progress' });
  } finally {
    await prisma.$disconnect();
  }
});

export default router;


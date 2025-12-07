/**
 * B137A-ENROLL-007: API to list payers available for enrollment
 *
 * GET /api/payers
 *
 * Query parameters:
 * - state: Filter by state (e.g., CA, NY)
 * - specialty: Filter by specialty taxonomy code (e.g., 207R00000X)
 * - planType: Filter by plan type (e.g., HMO, PPO)
 * - page: Page number (default: 1)
 * - limit: Results per page (default: 20, max: 100)
 */

import { Router, Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { loadUserSession, requireAuth } from '../../../../../backend/src/middleware/accessGuards';
import { ActiveOrgRequest, requireActiveOrg } from '../../../middleware/requireActiveOrg';
import { filterPayersForClinician } from '../../../../../services/payer/models/Payer.js';

const router = Router();
router.use(loadUserSession, requireAuth, requireActiveOrg);
const prisma = new PrismaClient();

interface PayerListQuery {
  state?: string;
  specialty?: string;
  planType?: string;
  page?: string;
  limit?: string;
}

router.get('/list', async (req: Request<{}, {}, {}, PayerListQuery>, res: Response) => {
  try {
    const { state, specialty, planType, page = '1', limit = '20' } = req.query;
    const activeOrgId = (req as ActiveOrgRequest).activeOrgId;

    // Parse pagination
    const pageNum = Math.max(1, parseInt(page, 10));
    const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10)));
    const skip = (pageNum - 1) * limitNum;

    // Build filter
    const where: any = {
      isActive: true,
    };

    // Add filters if provided
    if (state) {
      where.OR = [
        { states: { has: state.toUpperCase() } },
        { states: { has: 'ALL' } },
        { states: { isEmpty: true } },
      ];
    }

    if (specialty) {
      where.OR = where.OR || [];
      where.OR.push(
        { specialty: { has: specialty } },
        { specialty: { isEmpty: true } }
      );
    }

    if (planType) {
      where.planTypes = { has: planType };
    }

    // Get payers with pagination
    const [payers, total] = await Promise.all([
      prisma.payer.findMany({
        where,
        skip,
        take: limitNum,
        orderBy: { name: 'asc' },
        select: {
          id: true,
          payerId: true,
          name: true,
          planTypes: true,
          enrollmentEndpoint: true,
          contactInfo: true,
          requiresCaqh: true,
          requiresPecos: true,
          specialty: true,
          states: true,
          metadata: true,
        },
      }),
      prisma.payer.count({ where }),
    ]);

    // Apply client-side filtering for more complex logic
    const filteredPayers = filterPayersForClinician(payers as any, {
      state,
      specialty,
      planType,
    });

    const totalPages = Math.ceil(total / limitNum);

    res.json({
      success: true,
      data: filteredPayers,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total,
        totalPages,
        hasMore: pageNum < totalPages,
      },
      filters: {
        state: state || null,
        specialty: specialty || null,
        planType: planType || null,
      },
      activeOrgId: activeOrgId || null,
    });
  } catch (error) {
    console.error('Error listing payers:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to list payers',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * GET /api/payers/:id
 * Get single payer details
 */
router.get('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const activeOrgId = (req as ActiveOrgRequest).activeOrgId || null;

    const payer = await prisma.payer.findUnique({
      where: { id },
      include: {
        _count: {
          select: {
            enrollments: true,
          },
        },
      },
    });

    if (!payer) {
      return res.status(404).json({
        success: false,
        error: 'Payer not found',
      });
    }

    res.json({
      success: true,
      data: payer,
      activeOrgId,
    });
  } catch (error) {
    console.error('Error fetching payer:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch payer',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * GET /api/payers/search/:query
 * Search payers by name
 */
router.get('/search/:query', async (req: Request, res: Response) => {
  try {
    const { query } = req.params;
    const activeOrgId = (req as ActiveOrgRequest).activeOrgId || null;

    const payers = await prisma.payer.findMany({
      where: {
        isActive: true,
        name: {
          contains: query,
          mode: 'insensitive',
        },
      },
      take: 10,
      orderBy: { name: 'asc' },
    });

    res.json({
      success: true,
      data: payers,
      query,
      activeOrgId,
    });
  } catch (error) {
    console.error('Error searching payers:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to search payers',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

export default router;


/**
 * S72-POST-3B-003: API endpoint to list GAP backlog grouped by area
 *
 * GET /api/gaps
 * Returns GapTickets grouped by area (identity, psv, privileging, jobs, payer, ehr, governance)
 * Supports ?status=OPEN filter
 *
 * Response format:
 * {
 *   "identity": [...],
 *   "psv": [...],
 *   "privileging": [...],
 *   ...
 * }
 */

import { Router, Request, Response } from 'express';
import { PrismaClient, GapTicketStatus } from '@prisma/client';
import { listGapTicketsGroupedByArea } from '../../../../services/gaps/models/GapTicket';

const router = Router();
const prisma = new PrismaClient();

/**
 * GET /api/gaps
 *
 * List GapTickets grouped by area.
 * Query parameters:
 *   - status: Filter by status (OPEN, IN_PROGRESS, RESOLVED)
 *
 * Response:
 * {
 *   "identity": [
 *     {
 *       "id": "...",
 *       "area": "identity",
 *       "severity": "CRITICAL",
 *       "description": "...",
 *       "status": "OPEN",
 *       "filePath": "...",
 *       "lineNumber": 42,
 *       "createdAt": "...",
 *       "updatedAt": "...",
 *       "resolvedAt": null
 *     }
 *   ],
 *   "psv": [...],
 *   ...
 * }
 */
router.get('/', async (req: Request, res: Response) => {
  try {
    const { status } = req.query;

    // Validate status if provided
    let statusFilter: GapTicketStatus | undefined;
    if (status) {
      const statusStr = String(status).toUpperCase();
      if (!['OPEN', 'IN_PROGRESS', 'RESOLVED'].includes(statusStr)) {
        return res.status(400).json({
          error: 'invalid_status',
          message: `Invalid status: ${status}. Must be one of: OPEN, IN_PROGRESS, RESOLVED`,
        });
      }
      statusFilter = statusStr as GapTicketStatus;
    }

    // Get grouped tickets
    const grouped = await listGapTicketsGroupedByArea(prisma, {
      status: statusFilter,
    });

    // Ensure all areas are present (even if empty)
    const allAreas = ['identity', 'psv', 'privileging', 'jobs', 'payer', 'ehr', 'governance'];
    const response: Record<string, any[]> = {};
    for (const area of allAreas) {
      response[area] = grouped[area] || [];
    }

    return res.status(200).json(response);
  } catch (error) {
    console.error('[Gaps API] Error listing gaps:', error);
    return res.status(500).json({
      error: 'internal_error',
      message: error instanceof Error ? error.message : 'Failed to list gaps',
    });
  }
});

export default router;


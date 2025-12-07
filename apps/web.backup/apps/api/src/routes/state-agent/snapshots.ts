/**
 * Snapshots API Route
 * GET /api/state-agent/snapshots
 *
 * List available state snapshots
 */

import { Router, Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { listSnapshots } from '@vitalcv/state-agent';

const router = Router();
const prisma = new PrismaClient();

interface SnapshotsRequest extends Request {
  user?: {
    id: string;
    email: string;
    roles: string[];
  };
}

function requireStateAgentAccess(req: Request, res: Response, next: () => void) {
  const snapReq = req as SnapshotsRequest;
  const roles = snapReq.user?.roles || [];
  const isAuthorized =
    roles.includes('admin') ||
    roles.includes('ADMIN') ||
    roles.includes('state-agent') ||
    roles.includes('internal-ai') ||
    req.headers['x-internal-ai-agent'] === 'true';

  if (!snapReq.user && !req.headers['x-internal-ai-agent']) {
    return res.status(401).json({
      error: 'Authentication required',
      message: 'Snapshots access requires authentication or internal AI agent header',
    });
  }

  if (!isAuthorized) {
    return res.status(403).json({
      error: 'Insufficient permissions',
      message: 'Snapshots access requires admin, state-agent, or internal-ai role',
    });
  }

  return next();
}

/**
 * GET /api/state-agent/snapshots
 *
 * Query parameters:
 * - waveNumber: number (optional)
 * - limit: number (default: 50)
 * - offset: number (default: 0)
 */
router.get('/', requireStateAgentAccess, async (req: Request, res: Response) => {
  try {
    const waveNumber = req.query.waveNumber
      ? parseInt(req.query.waveNumber as string, 10)
      : undefined;
    const limit = req.query.limit
      ? parseInt(req.query.limit as string, 10)
      : 50;
    const offset = req.query.offset
      ? parseInt(req.query.offset as string, 10)
      : 0;

    const snapshots = await listSnapshots(prisma, {
      waveNumber,
      limit,
      offset,
    });

    return res.json(snapshots);
  } catch (error) {
    console.error('[state-agent:snapshots] Failed to list snapshots:', error);
    return res.status(500).json({
      error: 'snapshots_list_failed',
      message: error instanceof Error ? error.message : 'Unexpected error',
    });
  }
});

export default router;


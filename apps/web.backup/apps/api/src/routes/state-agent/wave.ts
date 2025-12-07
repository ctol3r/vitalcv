/**
 * Wave Completion API Route
 * POST /api/state-agent/wave/complete
 *
 * Manually trigger wave completion to generate state snapshot
 */

import { Router, Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { triggerWaveCompletion } from '../../services/state-agent/waveHook';

const router = Router();
const prisma = new PrismaClient();

interface WaveRequest extends Request {
  user?: {
    id: string;
    email: string;
    roles: string[];
  };
}

function requireStateAgentAccess(req: Request, res: Response, next: () => void) {
  const waveReq = req as WaveRequest;
  const roles = waveReq.user?.roles || [];
  const isAuthorized =
    roles.includes('admin') ||
    roles.includes('ADMIN') ||
    roles.includes('state-agent') ||
    roles.includes('internal-ai') ||
    req.headers['x-internal-ai-agent'] === 'true';

  if (!waveReq.user && !req.headers['x-internal-ai-agent']) {
    return res.status(401).json({
      error: 'Authentication required',
      message: 'Wave completion requires authentication or internal AI agent header',
    });
  }

  if (!isAuthorized) {
    return res.status(403).json({
      error: 'Insufficient permissions',
      message: 'Wave completion requires admin, state-agent, or internal-ai role',
    });
  }

  return next();
}

/**
 * POST /api/state-agent/wave/complete
 *
 * Body:
 * {
 *   "waveNumber": number (required)
 *   "triggeredBy"?: string
 * }
 */
router.post('/complete', requireStateAgentAccess, async (req: Request, res: Response) => {
  try {
    const { waveNumber, triggeredBy } = req.body;

    if (!waveNumber || typeof waveNumber !== 'number') {
      return res.status(400).json({
        error: 'invalid_request',
        message: 'waveNumber (number) is required',
      });
    }

    const userEmail = (req as WaveRequest).user?.email;
    const result = await triggerWaveCompletion(waveNumber, triggeredBy || userEmail);

    if (!result.success) {
      return res.status(500).json({
        error: 'wave_completion_failed',
        message: result.error || 'Failed to complete wave',
      });
    }

    return res.json({
      success: true,
      waveNumber,
      snapshotPath: result.snapshotPath,
      reportId: result.reportId,
      message: `Wave ${waveNumber} snapshot generated successfully`,
    });
  } catch (error) {
    console.error('[state-agent:wave] Failed to complete wave:', error);
    return res.status(500).json({
      error: 'wave_completion_error',
      message: error instanceof Error ? error.message : 'Unexpected error',
    });
  }
});

export default router;


/**
 * S72-D3-B-005: /demo/pilot/status route
 *
 * GET /demo/pilot/status - Returns current pilot status
 *
 * Returns {ok, lastRunAt, summary}
 * If no run yet, returns ok=false & reason='not_run'
 * Always returns 200 (even if status is not ok)
 */

import { Router, Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { getPilotSlo } from '../../../services/pilotSloStub.js';

const router = Router();
const prisma = new PrismaClient();

/**
 * GET /demo/pilot/status
 *
 * Returns current pilot readiness status
 */
router.get('/status', async (req: Request, res: Response) => {
  try {
    // Get latest PilotStatus
    const pilotStatus = await prisma.pilotStatus.findFirst({
      where: {
        orgId: null, // Global/demo
      },
      orderBy: {
        lastRunAt: 'desc',
      },
    });

    // If no status found, return not_run
    if (!pilotStatus) {
      return res.status(200).json({
        ok: false,
        lastRunAt: null,
        reason: 'not_run',
        summary: 'No smoke test has been run yet. Run /demo/pilot/smoke to initialize.',
      });
    }

    // Get SLO evaluation (checks if last run is recent enough)
    const sloResult = await getPilotSlo();

    // Extract details from stored JSON
    const details = pilotStatus.details as any;

    // Build response
    const response = {
      ok: sloResult.ok,
      lastRunAt: pilotStatus.lastRunAt.toISOString(),
      lastOk: pilotStatus.lastOk,
      slo: {
        ok: sloResult.ok,
        reason: sloResult.reason,
        lastRunAge: sloResult.lastRunAge,
        threshold: sloResult.threshold,
      },
      summary: sloResult.ok
        ? 'Pilot is ready. Last smoke test passed and is within 24h threshold.'
        : `Pilot not ready: ${sloResult.reason}`,
      lastRun: details ? {
        totalDuration: details.totalDuration,
        stepsCount: details.steps?.length || 0,
        errorMessage: details.errorMessage,
      } : null,
    };

    return res.status(200).json(response);

  } catch (error: any) {
    console.error('❌ [Pilot Status] Error:', error);
    return res.status(200).json({
      ok: false,
      lastRunAt: null,
      reason: 'error',
      summary: `Error fetching pilot status: ${error.message}`,
      error: error.message,
    });
  }
});

export default router;


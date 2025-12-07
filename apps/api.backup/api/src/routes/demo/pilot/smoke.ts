/**
 * S72-D3-B-002: /demo/pilot/smoke route
 *
 * GET /demo/pilot/smoke - Triggers runPilotSmoke() and returns detailed results
 *
 * Returns JSON {ok, steps, startedAt, finishedAt, totalDuration}
 * Returns 500 on unexpected error
 * Logs audit event for each run
 */

import { Router, Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { runPilotSmoke, PilotSmokeResult } from '../../../services/pilotSmoke.js';

const router = Router();
const prisma = new PrismaClient();

/**
 * Update PilotStatus after smoke test run
 * S72-D3-B-004: Write lastOk + details into PilotStatus
 */
async function updatePilotStatus(result: PilotSmokeResult): Promise<void> {
  try {
    // Find or create PilotStatus record (global/demo org)
    const existingStatus = await prisma.pilotStatus.findFirst({
      where: {
        orgId: null, // Global/demo status
      },
    });

    const statusData = {
      lastOk: result.ok,
      lastRunAt: new Date(result.finishedAt),
      details: {
        ok: result.ok,
        steps: result.steps,
        startedAt: result.startedAt,
        finishedAt: result.finishedAt,
        totalDuration: result.totalDuration,
        errorMessage: result.errorMessage,
      },
    };

    if (existingStatus) {
      // Update existing status
      await prisma.pilotStatus.update({
        where: { id: existingStatus.id },
        data: statusData,
      });
    } else {
      // Create new status
      await prisma.pilotStatus.create({
        data: {
          ...statusData,
          orgId: null, // Global/demo
        },
      });
    }

    console.log(`✅ [Pilot Smoke] Updated PilotStatus: lastOk=${result.ok}`);
  } catch (error) {
    console.error('❌ [Pilot Smoke] Failed to update PilotStatus:', error);
    // Don't fail the smoke test if status update fails
  }
}

/**
 * Log audit event for smoke test run
 */
async function logAuditEvent(result: PilotSmokeResult): Promise<void> {
  try {
    await prisma.auditEvent.create({
      data: {
        type: 'pilot_smoke_test',
        subjectNpi: null,
        userId: null,
        data: {
          ok: result.ok,
          totalDuration: result.totalDuration,
          stepsCount: result.steps.length,
          successSteps: result.steps.filter(s => s.status === 'success').length,
          failureSteps: result.steps.filter(s => s.status === 'failure').length,
          errorMessage: result.errorMessage,
        },
      },
    });
  } catch (error) {
    console.error('❌ [Pilot Smoke] Failed to log audit event:', error);
    // Don't fail the smoke test if audit logging fails
  }
}

/**
 * GET /demo/pilot/smoke
 *
 * Runs the pilot smoke test and returns detailed results
 */
router.get('/smoke', async (req: Request, res: Response) => {
  console.log('🚀 [Pilot Smoke] Starting smoke test via API...');

  try {
    // Run the smoke test
    const result = await runPilotSmoke();

    // Update PilotStatus
    await updatePilotStatus(result);

    // Log audit event
    await logAuditEvent(result);

    // Return results
    if (result.ok) {
      console.log(`✅ [Pilot Smoke] Smoke test passed in ${result.totalDuration}ms`);
      return res.status(200).json(result);
    } else {
      console.error(`❌ [Pilot Smoke] Smoke test failed: ${result.errorMessage}`);
      return res.status(500).json(result);
    }

  } catch (error: any) {
    console.error('❌ [Pilot Smoke] Unexpected error:', error);

    const errorResult: PilotSmokeResult = {
      ok: false,
      steps: [],
      startedAt: new Date().toISOString(),
      finishedAt: new Date().toISOString(),
      totalDuration: 0,
      errorMessage: error.message || 'Unexpected error during smoke test',
    };

    // Try to update status even on error
    await updatePilotStatus(errorResult);

    return res.status(500).json(errorResult);
  }
});

export default router;


/**
 * B141D-FF-004: Kill-switch endpoint for emergencies
 *
 * POST /admin/kill-switch/{key} adds key to in-memory kill set
 * Logs high-priority event
 * Optional 'confirm' body field for safety
 */

import { Router, Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { recordFlagChange } from '../../../../services/audit/flagEvents';

const router = Router();
const prisma = new PrismaClient();

// In-memory kill switch set (survives process restarts via database)
// For true emergencies, consider Redis or similar for persistence
const killSwitchSet = new Set<string>();

/**
 * Initialize kill switches from database on startup
 */
async function initializeKillSwitches() {
  try {
    const serverConfig = await prisma.serverConfig.findUnique({
      where: { key: 'kill_switches' },
    });

    if (serverConfig) {
      const killSwitches = (serverConfig.value as any).keys || [];
      killSwitches.forEach((key: string) => killSwitchSet.add(key));
      console.log(`[kill-switch] Initialized ${killSwitches.length} kill switches`);
    }
  } catch (error) {
    console.error('[kill-switch] Failed to initialize from database:', error);
  }
}

// Initialize on module load
initializeKillSwitches();

/**
 * Check if a kill switch is active
 */
export function isKillSwitchActive(key: string): boolean {
  return killSwitchSet.has(key);
}

/**
 * POST /admin/kill-switch/:key
 * Activate a kill switch
 */
router.post('/admin/kill-switch/:key', async (req: Request, res: Response) => {
  try {
    const { key } = req.params;
    const { confirm } = req.body;

    // Require confirmation for safety
    if (!confirm) {
      return res.status(400).json({
        error: 'confirmation_required',
        message: 'Must provide confirm=true in request body to activate kill switch',
      });
    }

    // Get actor from request (should be set by auth middleware)
    const actorId = (req as any).user?.id || 'system';
    const actorName = (req as any).user?.name || 'System';

    // Check if kill switch is already active
    const wasActive = killSwitchSet.has(key);

    if (!wasActive) {
      // Add to in-memory set
      killSwitchSet.add(key);

      // Persist to database
      const serverConfig = await prisma.serverConfig.findUnique({
        where: { key: 'kill_switches' },
      });

      const currentKillSwitches = serverConfig
        ? ((serverConfig.value as any).keys || [])
        : [];

      if (!currentKillSwitches.includes(key)) {
        await prisma.serverConfig.upsert({
          where: { key: 'kill_switches' },
          create: {
            key: 'kill_switches',
            value: {
              keys: [key],
              updatedBy: actorId,
              updatedAt: new Date().toISOString(),
            },
            description: 'Emergency kill switches for system features',
            updatedBy: actorId,
          },
          update: {
            value: {
              keys: [...currentKillSwitches, key],
              updatedBy: actorId,
              updatedAt: new Date().toISOString(),
            },
            updatedBy: actorId,
          },
        });
      }

      // Log high-priority audit event
      await recordFlagChange({
        flagKey: key,
        scope: 'GLOBAL',
        oldValue: false,
        newValue: true,
        actorId,
        actorName,
      });

      // Log high-priority console event
      console.error(
        `[KILL-SWITCH] 🚨 ACTIVATED: ${key} by ${actorName} (${actorId}) at ${new Date().toISOString()}`
      );
    }

    return res.json({
      success: true,
      key,
      active: true,
      message: wasActive
        ? 'Kill switch was already active'
        : 'Kill switch activated successfully',
      timestamp: new Date().toISOString(),
      activatedBy: actorId,
    });
  } catch (error: any) {
    console.error('[kill-switch] Error:', error);
    return res.status(500).json({
      error: 'internal_error',
      message: 'Failed to activate kill switch',
      details: error.message,
    });
  }
});

/**
 * DELETE /admin/kill-switch/:key
 * Deactivate a kill switch
 */
router.delete('/admin/kill-switch/:key', async (req: Request, res: Response) => {
  try {
    const { key } = req.params;

    // Get actor from request
    const actorId = (req as any).user?.id || 'system';
    const actorName = (req as any).user?.name || 'System';

    // Check if kill switch is active
    const wasActive = killSwitchSet.has(key);

    if (wasActive) {
      // Remove from in-memory set
      killSwitchSet.delete(key);

      // Update database
      const serverConfig = await prisma.serverConfig.findUnique({
        where: { key: 'kill_switches' },
      });

      if (serverConfig) {
        const currentKillSwitches = ((serverConfig.value as any).keys || []).filter(
          (k: string) => k !== key
        );

        await prisma.serverConfig.update({
          where: { key: 'kill_switches' },
          data: {
            value: {
              keys: currentKillSwitches,
              updatedBy: actorId,
              updatedAt: new Date().toISOString(),
            },
            updatedBy: actorId,
          },
        });
      }

      // Log audit event
      await recordFlagChange({
        flagKey: key,
        scope: 'GLOBAL',
        oldValue: true,
        newValue: false,
        actorId,
        actorName,
      });

      console.log(
        `[KILL-SWITCH] ✅ DEACTIVATED: ${key} by ${actorName} (${actorId}) at ${new Date().toISOString()}`
      );
    }

    return res.json({
      success: true,
      key,
      active: false,
      message: wasActive
        ? 'Kill switch deactivated successfully'
        : 'Kill switch was not active',
      timestamp: new Date().toISOString(),
      deactivatedBy: actorId,
    });
  } catch (error: any) {
    console.error('[kill-switch] Error:', error);
    return res.status(500).json({
      error: 'internal_error',
      message: 'Failed to deactivate kill switch',
      details: error.message,
    });
  }
});

/**
 * GET /admin/kill-switch
 * List all active kill switches
 */
router.get('/admin/kill-switch', async (req: Request, res: Response) => {
  try {
    const activeKeys = Array.from(killSwitchSet);

    return res.json({
      active: activeKeys,
      count: activeKeys.length,
      timestamp: new Date().toISOString(),
    });
  } catch (error: any) {
    console.error('[kill-switch] Error:', error);
    return res.status(500).json({
      error: 'internal_error',
      message: 'Failed to list kill switches',
    });
  }
});

/**
 * GET /admin/kill-switch/:key
 * Check if a specific kill switch is active
 */
router.get('/admin/kill-switch/:key', async (req: Request, res: Response) => {
  try {
    const { key } = req.params;
    const active = killSwitchSet.has(key);

    return res.json({
      key,
      active,
      timestamp: new Date().toISOString(),
    });
  } catch (error: any) {
    console.error('[kill-switch] Error:', error);
    return res.status(500).json({
      error: 'internal_error',
      message: 'Failed to check kill switch status',
    });
  }
});

export default router;
export { isKillSwitchActive };


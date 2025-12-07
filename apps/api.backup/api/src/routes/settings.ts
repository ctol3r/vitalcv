/**
 * Settings API Routes
 * B112B-EUDI-019: Server toggle: Accept EUDI Wallets (hard-enforce)
 *
 * Provides endpoints for managing server configuration settings,
 * including EUDI wallet acceptance policy.
 */

import express, { Request, Response } from 'express';
import { getEudiWalletConfig, updateEudiWalletConfig } from '../../apps/api/config/eudi-wallet';
import { PrismaClient } from '@prisma/client';

const router = express.Router();
const prisma = new PrismaClient();

/**
 * GET /api/settings/eudi-accept
 * Get current EUDI wallet acceptance setting
 */
router.get('/eudi-accept', async (_req: Request, res: Response) => {
  try {
    const config = await getEudiWalletConfig();
    res.json({
      acceptEudiWalletsOnly: config.acceptEudiWalletsOnly,
      auditReasonTemplate: config.auditReasonTemplate,
    });
  } catch (error) {
    console.error('Error fetching EUDI setting:', error);
    res.status(500).json({
      error: 'failed_to_fetch_setting',
      error_description: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * PUT /api/settings/eudi-accept
 * Update EUDI wallet acceptance setting
 */
router.put('/eudi-accept', async (req: Request, res: Response) => {
  try {
    const { acceptEudiWalletsOnly } = req.body;
    const userId = (req as any).user?.id || req.headers['x-user-id'] || 'system';

    if (typeof acceptEudiWalletsOnly !== 'boolean') {
      return res.status(400).json({
        error: 'invalid_request',
        error_description: 'acceptEudiWalletsOnly must be a boolean',
      });
    }

    // Update configuration (persists to database)
    const updatedConfig = await updateEudiWalletConfig(
      { acceptEudiWalletsOnly },
      userId
    );

    // Log audit event
    try {
      await prisma.auditEvent.create({
        data: {
          type: 'SETTING_CHANGED',
          userId: userId !== 'system' ? userId : null,
          data: {
            setting: 'eudi_wallet_acceptance',
            value: acceptEudiWalletsOnly,
            changedBy: userId,
            timestamp: new Date().toISOString(),
          },
        },
      });
    } catch (auditError) {
      // Non-fatal: log but don't fail the request
      console.warn('Failed to log audit event:', auditError);
    }

    res.json({
      acceptEudiWalletsOnly: updatedConfig.acceptEudiWalletsOnly,
      message: acceptEudiWalletsOnly
        ? 'EUDI-only mode enabled. Non-EUDI presentations will be blocked.'
        : 'EUDI-only mode disabled. All wallet types are accepted.',
    });
  } catch (error) {
    console.error('Error updating EUDI setting:', error);
    res.status(500).json({
      error: 'failed_to_update_setting',
      error_description: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

export default router;

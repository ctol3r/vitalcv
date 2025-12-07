/**
 * Feature Flags API Endpoint
 *
 * Provides public endpoint for frontend to check feature flag status
 * Used by ApplyWithVcButton and other frontend components
 */

import { Router, Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { checkFeatureFlag, getFeatureFlagService } from '../../../services/flags/featureFlags';

const router = Router();
const prisma = new PrismaClient();

/**
 * GET /api/feature-flags/:flagKey
 * Check if a feature flag is enabled
 *
 * Query params:
 * - orgId: Optional organization ID for per-org flags
 *
 * Response:
 * {
 *   enabled: boolean,
 *   flagKey: string,
 *   orgId?: string
 * }
 */
router.get('/:flagKey', async (req: Request, res: Response) => {
  try {
    const { flagKey } = req.params;
    const orgId = req.query.orgId as string | undefined;

    // Validate flag key
    const validFlagKeys = [
      'applyWithVC.enabled',
      'eudi.verify.enabled',
      'ehr.facade.enabled',
      'payer.enrollment.enabled',
      'notifications.enabled',
      'billing.vita.enabled',
    ];

    if (!validFlagKeys.includes(flagKey)) {
      return res.status(400).json({
        error: 'INVALID_FLAG_KEY',
        message: `Invalid feature flag key: ${flagKey}`,
        validKeys: validFlagKeys,
      });
    }

    // Check feature flag
    const enabled = await checkFeatureFlag(prisma, flagKey as any, orgId);

    res.json({
      enabled,
      flagKey,
      orgId: orgId || null,
    });
  } catch (error: any) {
    console.error('[feature-flags] Error:', error);
    res.status(500).json({
      error: 'INTERNAL_ERROR',
      message: 'Failed to check feature flag',
    });
  }
});

export default router;


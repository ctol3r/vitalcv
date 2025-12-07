/**
 * B136A-TEFCA-008: TEFCA Configuration API
 *
 * POST /tefca/config - Create TEFCA/QHIN configuration
 * GET /tefca/config/:orgId - Get QHIN configuration
 * PATCH /tefca/config/:orgId - Update QHIN configuration
 * DELETE /tefca/config/:orgId - Deactivate QHIN configuration
 * POST /tefca/config/:orgId/test - Test QHIN connectivity
 */

import { Router, Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import {
  CreateQhinConfigSchema,
  UpdateQhinConfigSchema,
} from '../../../../services/tefca/models/QhinConfig';
import { TefcaFacade } from '../../../../services/tefca/tefcaFacade';

const router = Router();
const prisma = new PrismaClient();

/**
 * POST /tefca/config
 * Create new TEFCA/QHIN configuration for an organization
 */
router.post('/config', async (req: Request, res: Response) => {
  try {
    const validation = CreateQhinConfigSchema.safeParse(req.body);

    if (!validation.success) {
      return res.status(400).json({
        error: 'Validation failed',
        details: validation.error.errors,
      });
    }

    const data = validation.data;

    // Check if config already exists
    const existing = await prisma.qhinConfig.findUnique({
      where: { orgId: data.orgId },
    });

    if (existing) {
      return res.status(409).json({
        error: 'QHIN configuration already exists for this organization',
        existingId: existing.id,
      });
    }

    // Create QHIN config
    const config = await prisma.qhinConfig.create({
      data: {
        orgId: data.orgId,
        qhinEndpoint: data.qhinEndpoint,
        allowedPurposes: data.allowedPurposes,
        orgIdentifier: data.orgIdentifier,
        authConfig: data.authConfig || {},
        isActive: data.isActive ?? true,
      },
    });

    res.status(201).json({
      success: true,
      config,
    });
  } catch (error) {
    console.error('[TEFCA Config] Error creating config:', error);
    res.status(500).json({
      error: 'Failed to create QHIN configuration',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * GET /tefca/config/:orgId
 * Get QHIN configuration for an organization
 */
router.get('/config/:orgId', async (req: Request, res: Response) => {
  try {
    const { orgId } = req.params;

    const config = await prisma.qhinConfig.findUnique({
      where: { orgId },
    });

    if (!config) {
      return res.status(404).json({
        error: 'QHIN configuration not found for this organization',
      });
    }

    res.json({
      success: true,
      config,
    });
  } catch (error) {
    console.error('[TEFCA Config] Error fetching config:', error);
    res.status(500).json({
      error: 'Failed to fetch QHIN configuration',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * PATCH /tefca/config/:orgId
 * Update QHIN configuration
 */
router.patch('/config/:orgId', async (req: Request, res: Response) => {
  try {
    const { orgId } = req.params;

    const validation = UpdateQhinConfigSchema.safeParse({
      ...req.body,
      orgId,
    });

    if (!validation.success) {
      return res.status(400).json({
        error: 'Validation failed',
        details: validation.error.errors,
      });
    }

    const data = validation.data;

    // Update config
    const config = await prisma.qhinConfig.update({
      where: { orgId },
      data: {
        ...(data.qhinEndpoint && { qhinEndpoint: data.qhinEndpoint }),
        ...(data.allowedPurposes && { allowedPurposes: data.allowedPurposes }),
        ...(data.orgIdentifier && { orgIdentifier: data.orgIdentifier }),
        ...(data.authConfig !== undefined && { authConfig: data.authConfig }),
        ...(data.isActive !== undefined && { isActive: data.isActive }),
      },
    });

    res.json({
      success: true,
      config,
    });
  } catch (error) {
    console.error('[TEFCA Config] Error updating config:', error);

    if ((error as any).code === 'P2025') {
      return res.status(404).json({
        error: 'QHIN configuration not found',
      });
    }

    res.status(500).json({
      error: 'Failed to update QHIN configuration',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * DELETE /tefca/config/:orgId
 * Deactivate QHIN configuration (soft delete)
 */
router.delete('/config/:orgId', async (req: Request, res: Response) => {
  try {
    const { orgId } = req.params;

    await prisma.qhinConfig.update({
      where: { orgId },
      data: { isActive: false },
    });

    res.json({
      success: true,
      message: 'QHIN configuration deactivated',
    });
  } catch (error) {
    console.error('[TEFCA Config] Error deactivating config:', error);

    if ((error as any).code === 'P2025') {
      return res.status(404).json({
        error: 'QHIN configuration not found',
      });
    }

    res.status(500).json({
      error: 'Failed to deactivate QHIN configuration',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * POST /tefca/config/:orgId/test
 * Test TEFCA QHIN connectivity
 */
router.post('/config/:orgId/test', async (req: Request, res: Response) => {
  try {
    const { orgId } = req.params;

    const config = await prisma.qhinConfig.findUnique({
      where: { orgId },
    });

    if (!config) {
      return res.status(404).json({
        error: 'QHIN configuration not found',
      });
    }

    const facade = new TefcaFacade(config as any);
    const testResult = await facade.testConnection();

    res.json({
      success: testResult.success,
      ...(testResult.error && { error: testResult.error }),
      ...(testResult.metadata && { metadata: testResult.metadata }),
    });
  } catch (error) {
    console.error('[TEFCA Config] Error testing connection:', error);
    res.status(500).json({
      error: 'Failed to test QHIN connection',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * GET /tefca/config/:orgId/purposes
 * Get allowed purposes of use for an organization
 */
router.get('/config/:orgId/purposes', async (req: Request, res: Response) => {
  try {
    const { orgId } = req.params;

    const config = await prisma.qhinConfig.findUnique({
      where: { orgId },
    });

    if (!config) {
      return res.status(404).json({
        error: 'QHIN configuration not found',
      });
    }

    res.json({
      success: true,
      allowedPurposes: config.allowedPurposes,
    });
  } catch (error) {
    console.error('[TEFCA Config] Error fetching purposes:', error);
    res.status(500).json({
      error: 'Failed to fetch allowed purposes',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

export { router as tefcaConfigRouter };


/**
 * B136A-EHR-004: EHR Configuration API
 *
 * POST /ehr/config - Create EHR configuration
 * GET /ehr/config/:orgId - Get EHR configuration
 * PATCH /ehr/config/:orgId - Update EHR configuration
 * DELETE /ehr/config/:orgId - Deactivate EHR configuration
 * POST /ehr/config/:orgId/test - Test EHR connectivity
 */

import { Router, Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import {
  CreateEhrConfigSchema,
  UpdateEhrConfigSchema,
  validateEhrAuthConfig,
} from '../../../../services/ehr/models/EhrConfig';
import { EhrFacade } from '../../../../services/ehr/ehrFacade';

const router = Router();
const prisma = new PrismaClient();

/**
 * POST /ehr/config
 * Create new EHR configuration for an organization
 */
router.post('/config', async (req: Request, res: Response) => {
  try {
    // Validate request body
    const validation = CreateEhrConfigSchema.safeParse(req.body);

    if (!validation.success) {
      return res.status(400).json({
        error: 'Validation failed',
        details: validation.error.errors,
      });
    }

    const data = validation.data;

    // Validate auth configuration
    const authValidation = validateEhrAuthConfig(data);
    if (!authValidation.valid) {
      return res.status(400).json({
        error: 'Auth configuration invalid',
        details: authValidation.errors,
      });
    }

    // Check if config already exists
    const existing = await prisma.ehrConfig.findUnique({
      where: { orgId: data.orgId },
    });

    if (existing) {
      return res.status(409).json({
        error: 'EHR configuration already exists for this organization',
        existingId: existing.id,
      });
    }

    // Create EHR config
    const config = await prisma.ehrConfig.create({
      data: {
        orgId: data.orgId,
        ehrType: data.ehrType,
        fhirBaseUrl: data.fhirBaseUrl,
        authType: data.authType,
        clientId: data.clientId,
        clientSecret: data.clientSecret, // TODO: Encrypt in production
        jwtKey: data.jwtKey, // TODO: Encrypt in production
        metadata: data.metadata || {},
        isActive: data.isActive ?? true,
      },
    });

    // Don't return secrets in response
    const { clientSecret, jwtKey, ...safeConfig } = config;

    res.status(201).json({
      success: true,
      config: safeConfig,
    });
  } catch (error) {
    console.error('[EHR Config] Error creating config:', error);
    res.status(500).json({
      error: 'Failed to create EHR configuration',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * GET /ehr/config/:orgId
 * Get EHR configuration for an organization
 */
router.get('/config/:orgId', async (req: Request, res: Response) => {
  try {
    const { orgId } = req.params;

    const config = await prisma.ehrConfig.findUnique({
      where: { orgId },
    });

    if (!config) {
      return res.status(404).json({
        error: 'EHR configuration not found for this organization',
      });
    }

    // Don't return secrets in response
    const { clientSecret, jwtKey, ...safeConfig } = config;

    res.json({
      success: true,
      config: safeConfig,
    });
  } catch (error) {
    console.error('[EHR Config] Error fetching config:', error);
    res.status(500).json({
      error: 'Failed to fetch EHR configuration',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * PATCH /ehr/config/:orgId
 * Update EHR configuration
 */
router.patch('/config/:orgId', async (req: Request, res: Response) => {
  try {
    const { orgId } = req.params;

    const validation = UpdateEhrConfigSchema.safeParse({
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

    // Validate auth configuration if authType is being updated
    if (data.authType) {
      const authValidation = validateEhrAuthConfig(data);
      if (!authValidation.valid) {
        return res.status(400).json({
          error: 'Auth configuration invalid',
          details: authValidation.errors,
        });
      }
    }

    // Update config
    const config = await prisma.ehrConfig.update({
      where: { orgId },
      data: {
        ...(data.ehrType && { ehrType: data.ehrType }),
        ...(data.fhirBaseUrl && { fhirBaseUrl: data.fhirBaseUrl }),
        ...(data.authType && { authType: data.authType }),
        ...(data.clientId && { clientId: data.clientId }),
        ...(data.clientSecret && { clientSecret: data.clientSecret }), // TODO: Encrypt
        ...(data.jwtKey && { jwtKey: data.jwtKey }), // TODO: Encrypt
        ...(data.metadata !== undefined && { metadata: data.metadata }),
        ...(data.isActive !== undefined && { isActive: data.isActive }),
      },
    });

    const { clientSecret, jwtKey, ...safeConfig } = config;

    res.json({
      success: true,
      config: safeConfig,
    });
  } catch (error) {
    console.error('[EHR Config] Error updating config:', error);

    if ((error as any).code === 'P2025') {
      return res.status(404).json({
        error: 'EHR configuration not found',
      });
    }

    res.status(500).json({
      error: 'Failed to update EHR configuration',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * DELETE /ehr/config/:orgId
 * Deactivate EHR configuration (soft delete)
 */
router.delete('/config/:orgId', async (req: Request, res: Response) => {
  try {
    const { orgId } = req.params;

    await prisma.ehrConfig.update({
      where: { orgId },
      data: { isActive: false },
    });

    res.json({
      success: true,
      message: 'EHR configuration deactivated',
    });
  } catch (error) {
    console.error('[EHR Config] Error deactivating config:', error);

    if ((error as any).code === 'P2025') {
      return res.status(404).json({
        error: 'EHR configuration not found',
      });
    }

    res.status(500).json({
      error: 'Failed to deactivate EHR configuration',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * POST /ehr/config/:orgId/test
 * Test EHR connectivity
 */
router.post('/config/:orgId/test', async (req: Request, res: Response) => {
  try {
    const { orgId } = req.params;

    const config = await prisma.ehrConfig.findUnique({
      where: { orgId },
    });

    if (!config) {
      return res.status(404).json({
        error: 'EHR configuration not found',
      });
    }

    const facade = new EhrFacade(config as any);
    const testResult = await facade.testConnection();

    res.json({
      success: testResult.success,
      ...(testResult.error && { error: testResult.error }),
      ...(testResult.metadata && { metadata: testResult.metadata }),
    });
  } catch (error) {
    console.error('[EHR Config] Error testing connection:', error);
    res.status(500).json({
      error: 'Failed to test EHR connection',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

export { router as ehrConfigRouter };


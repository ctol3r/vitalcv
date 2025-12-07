/**
 * B136A-EHR-004: Org-level EHR Configuration API
 *
 * Provides GET/POST/PATCH endpoints for managing organization EHR configurations.
 * Validates input, stores secrets securely, and validates FHIR capability on save.
 */

import express, { Request, Response, Router } from 'express';
import { PrismaClient } from '@prisma/client';
import {
  CreateEhrConfigSchema,
  UpdateEhrConfigSchema,
  validateEhrAuthConfig
} from '../../../../../services/ehr/models/EhrConfig.js';
import { validateFhirCapability } from '../../../../../services/ehr/validateCapability.js';

const router: Router = express.Router();
const prisma = new PrismaClient();

/**
 * GET /org/:orgId/ehr-config
 *
 * Get EHR configuration for an organization
 */
router.get('/:orgId/ehr-config', async (req: Request, res: Response) => {
  try {
    const { orgId } = req.params;

    // TODO: Add auth check to ensure requester has access to this org

    const config = await prisma.ehrConfig.findUnique({
      where: { orgId },
      select: {
        id: true,
        orgId: true,
        ehrType: true,
        fhirBaseUrl: true,
        authType: true,
        clientId: true,
        // Exclude secrets from response
        metadata: true,
        isActive: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    if (!config) {
      res.status(404).json({
        error: 'NotFound',
        message: 'EHR configuration not found for this organization',
      });
      return;
    }

    res.json(config);
  } catch (error) {
    console.error('Error fetching EHR config:', error);
    res.status(500).json({
      error: 'InternalServerError',
      message: 'Failed to fetch EHR configuration',
    });
  }
});

/**
 * POST /org/:orgId/ehr-config
 *
 * Create EHR configuration for an organization
 */
router.post('/:orgId/ehr-config', async (req: Request, res: Response) => {
  try {
    const { orgId } = req.params;

    // TODO: Add auth check to ensure requester has admin access to this org

    // Validate input
    const input = { ...req.body, orgId };
    const validation = CreateEhrConfigSchema.safeParse(input);

    if (!validation.success) {
      res.status(400).json({
        error: 'ValidationError',
        message: 'Invalid EHR configuration',
        details: validation.error.errors,
      });
      return;
    }

    // Validate auth config
    const authValidation = validateEhrAuthConfig(validation.data);
    if (!authValidation.valid) {
      res.status(400).json({
        error: 'ValidationError',
        message: 'Invalid authentication configuration',
        details: authValidation.errors,
      });
      return;
    }

    // Check if config already exists
    const existing = await prisma.ehrConfig.findUnique({ where: { orgId } });
    if (existing) {
      res.status(409).json({
        error: 'Conflict',
        message: 'EHR configuration already exists for this organization. Use PATCH to update.',
      });
      return;
    }

    // Validate FHIR capability (non-blocking warnings)
    const capabilityResult = await validateFhirCapability(validation.data as any);

    // TODO: Encrypt secrets before storing (use Vault or AWS Secrets Manager)
    const encryptedConfig = {
      ...validation.data,
      clientSecret: validation.data.clientSecret ? await encryptSecret(validation.data.clientSecret) : null,
      jwtKey: validation.data.jwtKey ? await encryptSecret(validation.data.jwtKey) : null,
    };

    // Create config
    const config = await prisma.ehrConfig.create({
      data: encryptedConfig as any,
      select: {
        id: true,
        orgId: true,
        ehrType: true,
        fhirBaseUrl: true,
        authType: true,
        clientId: true,
        metadata: true,
        isActive: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    res.status(201).json({
      config,
      capabilityValidation: {
        valid: capabilityResult.valid,
        fhirVersion: capabilityResult.fhirVersion,
        warnings: capabilityResult.warnings,
        errors: capabilityResult.errors,
      },
    });
  } catch (error) {
    console.error('Error creating EHR config:', error);
    res.status(500).json({
      error: 'InternalServerError',
      message: 'Failed to create EHR configuration',
    });
  }
});

/**
 * PATCH /org/:orgId/ehr-config
 *
 * Update EHR configuration for an organization
 */
router.patch('/:orgId/ehr-config', async (req: Request, res: Response) => {
  try {
    const { orgId } = req.params;

    // TODO: Add auth check to ensure requester has admin access to this org

    // Validate input
    const input = { ...req.body, orgId };
    const validation = UpdateEhrConfigSchema.safeParse(input);

    if (!validation.success) {
      res.status(400).json({
        error: 'ValidationError',
        message: 'Invalid EHR configuration',
        details: validation.error.errors,
      });
      return;
    }

    // Check if config exists
    const existing = await prisma.ehrConfig.findUnique({ where: { orgId } });
    if (!existing) {
      res.status(404).json({
        error: 'NotFound',
        message: 'EHR configuration not found for this organization',
      });
      return;
    }

    // Validate auth config if authType is being updated
    if (validation.data.authType) {
      const authValidation = validateEhrAuthConfig(validation.data);
      if (!authValidation.valid) {
        res.status(400).json({
          error: 'ValidationError',
          message: 'Invalid authentication configuration',
          details: authValidation.errors,
        });
        return;
      }
    }

    // Validate FHIR capability if fhirBaseUrl is being updated
    let capabilityResult;
    if (validation.data.fhirBaseUrl) {
      const mergedConfig = { ...existing, ...validation.data };
      capabilityResult = await validateFhirCapability(mergedConfig as any);
    }

    // Encrypt secrets if provided
    const updateData: any = { ...validation.data };
    if (validation.data.clientSecret) {
      updateData.clientSecret = await encryptSecret(validation.data.clientSecret);
    }
    if (validation.data.jwtKey) {
      updateData.jwtKey = await encryptSecret(validation.data.jwtKey);
    }

    // Remove orgId from update data (can't update unique constraint)
    delete updateData.orgId;

    // Update config
    const config = await prisma.ehrConfig.update({
      where: { orgId },
      data: updateData,
      select: {
        id: true,
        orgId: true,
        ehrType: true,
        fhirBaseUrl: true,
        authType: true,
        clientId: true,
        metadata: true,
        isActive: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    res.json({
      config,
      ...(capabilityResult && {
        capabilityValidation: {
          valid: capabilityResult.valid,
          fhirVersion: capabilityResult.fhirVersion,
          warnings: capabilityResult.warnings,
          errors: capabilityResult.errors,
        },
      }),
    });
  } catch (error) {
    console.error('Error updating EHR config:', error);
    res.status(500).json({
      error: 'InternalServerError',
      message: 'Failed to update EHR configuration',
    });
  }
});

/**
 * Encrypt secret (placeholder - implement with Vault or AWS Secrets Manager)
 */
async function encryptSecret(secret: string): Promise<string> {
  // TODO: Implement actual encryption with Vault or AWS Secrets Manager
  // For now, just base64 encode as a placeholder
  return Buffer.from(secret).toString('base64');
}

/**
 * Decrypt secret (placeholder)
 */
async function decryptSecret(encrypted: string): Promise<string> {
  // TODO: Implement actual decryption
  return Buffer.from(encrypted, 'base64').toString('utf-8');
}

export default router;


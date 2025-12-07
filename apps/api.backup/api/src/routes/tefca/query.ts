/**
 * B136A-TEFCA-009: TEFCA Query API
 *
 * POST /tefca/query/practitioner - Search for Practitioner in QHIN
 * POST /tefca/query/practitioner-role - Search for PractitionerRole in QHIN
 */

import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { createTefcaFacade, validatePurposeOfUse } from '../../../../services/tefca/tefcaFacade';
import { TefcaPurposeOfUse } from '../../../../services/tefca/models/QhinConfig';

const router = Router();

// Validation schemas
const TefcaPractitionerSearchSchema = z.object({
  orgId: z.string().min(1, 'Organization ID is required'),
  purposeOfUse: z.nativeEnum(TefcaPurposeOfUse),
  searchParams: z.record(z.string()),
});

const TefcaPractitionerRoleSearchSchema = z.object({
  orgId: z.string().min(1, 'Organization ID is required'),
  purposeOfUse: z.nativeEnum(TefcaPurposeOfUse),
  searchParams: z.record(z.string()),
});

/**
 * POST /tefca/query/practitioner
 * Search for Practitioner in TEFCA QHIN network
 */
router.post('/query/practitioner', async (req: Request, res: Response) => {
  try {
    const validation = TefcaPractitionerSearchSchema.safeParse(req.body);

    if (!validation.success) {
      return res.status(400).json({
        error: 'Validation failed',
        details: validation.error.errors,
      });
    }

    const { orgId, purposeOfUse, searchParams } = validation.data;

    // Validate Purpose of Use
    const pouValidation = await validatePurposeOfUse(orgId, purposeOfUse);

    if (!pouValidation.valid) {
      return res.status(403).json({
        error: pouValidation.error,
      });
    }

    // Create TEFCA facade
    const facade = await createTefcaFacade(orgId);

    if (!facade) {
      return res.status(404).json({
        error: 'TEFCA/QHIN configuration not found for this organization',
      });
    }

    // Execute query
    const result = await facade.searchPractitioner(searchParams, purposeOfUse);

    if (!result.success) {
      return res.status(result.statusCode || 500).json({
        error: result.error,
        duration: result.duration,
      });
    }

    res.json({
      success: true,
      data: result.data,
      duration: result.duration,
      source: 'tefca',
      purposeOfUse,
    });
  } catch (error) {
    console.error('[TEFCA Query] Error searching practitioner:', error);
    res.status(500).json({
      error: 'Failed to search practitioner in QHIN',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * POST /tefca/query/practitioner-role
 * Search for PractitionerRole in TEFCA QHIN network
 */
router.post('/query/practitioner-role', async (req: Request, res: Response) => {
  try {
    const validation = TefcaPractitionerRoleSearchSchema.safeParse(req.body);

    if (!validation.success) {
      return res.status(400).json({
        error: 'Validation failed',
        details: validation.error.errors,
      });
    }

    const { orgId, purposeOfUse, searchParams } = validation.data;

    // Validate Purpose of Use
    const pouValidation = await validatePurposeOfUse(orgId, purposeOfUse);

    if (!pouValidation.valid) {
      return res.status(403).json({
        error: pouValidation.error,
      });
    }

    // Create TEFCA facade
    const facade = await createTefcaFacade(orgId);

    if (!facade) {
      return res.status(404).json({
        error: 'TEFCA/QHIN configuration not found for this organization',
      });
    }

    // Execute query
    const result = await facade.searchPractitionerRole(searchParams, purposeOfUse);

    if (!result.success) {
      return res.status(result.statusCode || 500).json({
        error: result.error,
        duration: result.duration,
      });
    }

    res.json({
      success: true,
      data: result.data,
      duration: result.duration,
      source: 'tefca',
      purposeOfUse,
    });
  } catch (error) {
    console.error('[TEFCA Query] Error searching practitioner role:', error);
    res.status(500).json({
      error: 'Failed to search practitioner role in QHIN',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * GET /tefca/purposes
 * Get list of all valid TEFCA Purpose of Use values
 */
router.get('/purposes', (_req: Request, res: Response) => {
  res.json({
    success: true,
    purposes: Object.values(TefcaPurposeOfUse),
  });
});

export { router as tefcaQueryRouter };


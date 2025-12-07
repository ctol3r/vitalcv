/**
 * B136A-EHR-005: EHR Query API
 *
 * POST /ehr/query/practitioner - Search for Practitioner
 * POST /ehr/query/practitioner-role - Search for PractitionerRole
 * GET /ehr/query/practitioner/:id - Get Practitioner by ID
 */

import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { createEhrFacade } from '../../../../services/ehr/ehrFacade';

const router = Router();

// Validation schemas
const PractitionerSearchSchema = z.object({
  orgId: z.string().min(1, 'Organization ID is required'),
  npi: z.string().optional(),
  name: z.string().optional(),
  identifier: z.string().optional(),
});

const PractitionerRoleSearchSchema = z.object({
  orgId: z.string().min(1, 'Organization ID is required'),
  practitioner: z.string().optional(),
  organization: z.string().optional(),
  specialty: z.string().optional(),
});

/**
 * POST /ehr/query/practitioner
 * Search for Practitioner in EHR
 */
router.post('/query/practitioner', async (req: Request, res: Response) => {
  try {
    const validation = PractitionerSearchSchema.safeParse(req.body);

    if (!validation.success) {
      return res.status(400).json({
        error: 'Validation failed',
        details: validation.error.errors,
      });
    }

    const { orgId, ...searchParams } = validation.data;

    // Create EHR facade
    const facade = await createEhrFacade(orgId);

    if (!facade) {
      return res.status(404).json({
        error: 'EHR configuration not found for this organization',
      });
    }

    // Execute query
    const result = await facade.searchPractitioner(searchParams);

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
      source: 'ehr',
    });
  } catch (error) {
    console.error('[EHR Query] Error searching practitioner:', error);
    res.status(500).json({
      error: 'Failed to search practitioner',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * POST /ehr/query/practitioner-role
 * Search for PractitionerRole in EHR
 */
router.post('/query/practitioner-role', async (req: Request, res: Response) => {
  try {
    const validation = PractitionerRoleSearchSchema.safeParse(req.body);

    if (!validation.success) {
      return res.status(400).json({
        error: 'Validation failed',
        details: validation.error.errors,
      });
    }

    const { orgId, ...searchParams } = validation.data;

    // Create EHR facade
    const facade = await createEhrFacade(orgId);

    if (!facade) {
      return res.status(404).json({
        error: 'EHR configuration not found for this organization',
      });
    }

    // Execute query
    const result = await facade.searchPractitionerRole(searchParams);

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
      source: 'ehr',
    });
  } catch (error) {
    console.error('[EHR Query] Error searching practitioner role:', error);
    res.status(500).json({
      error: 'Failed to search practitioner role',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * GET /ehr/query/practitioner/:id
 * Get Practitioner by ID from EHR
 */
router.get('/query/practitioner/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { orgId } = req.query;

    if (!orgId || typeof orgId !== 'string') {
      return res.status(400).json({
        error: 'Organization ID is required as query parameter',
      });
    }

    // Create EHR facade
    const facade = await createEhrFacade(orgId);

    if (!facade) {
      return res.status(404).json({
        error: 'EHR configuration not found for this organization',
      });
    }

    // Execute query
    const result = await facade.getPractitionerById(id);

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
      source: 'ehr',
    });
  } catch (error) {
    console.error('[EHR Query] Error getting practitioner:', error);
    res.status(500).json({
      error: 'Failed to get practitioner',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

export { router as ehrQueryRouter };


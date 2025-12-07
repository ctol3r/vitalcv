/**
 * B138A-IMLC-003: IMLC Status API Endpoint
 *
 * GET /api/compacts/imlc/status/:clinicianDid
 * Returns IMLC eligibility status, compact states, and last checked timestamp.
 *
 * Returns 404 if eligibility has not been computed yet.
 */

import { Router, Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { z } from 'zod';

const router = Router();
const prisma = new PrismaClient();

// Request validation schema
const ClinicianDidParamSchema = z.object({
  clinicianDid: z.string().min(1, 'Clinician DID is required'),
});

// Response schema
export interface IMLCStatusResponse {
  clinicianDid: string;
  status: 'NOT_ELIGIBLE' | 'ELIGIBLE' | 'LICENSED';
  homeState?: string;
  compactStates: string[];
  lastCheckedAt: string;
  metadata?: Record<string, any>;
}

/**
 * GET /api/compacts/imlc/status/:clinicianDid
 * Get IMLC eligibility status for a clinician
 */
router.get('/:clinicianDid', async (req: Request, res: Response) => {
  try {
    // Validate request
    const params = ClinicianDidParamSchema.parse(req.params);

    // Query IMLC eligibility from database
    const eligibility = await prisma.iMLCEligibility.findUnique({
      where: { clinicianDid: params.clinicianDid },
    });

    // Return 404 if not computed yet
    if (!eligibility) {
      return res.status(404).json({
        error: 'IMLC_NOT_COMPUTED',
        message: 'IMLC eligibility has not been computed for this clinician',
        clinicianDid: params.clinicianDid,
      });
    }

    // Return IMLC status
    const response: IMLCStatusResponse = {
      clinicianDid: eligibility.clinicianDid,
      status: eligibility.status as 'NOT_ELIGIBLE' | 'ELIGIBLE' | 'LICENSED',
      homeState: eligibility.homeState,
      compactStates: eligibility.compactStates,
      lastCheckedAt: eligibility.lastCheckedAt.toISOString(),
      metadata: eligibility.metadata as Record<string, any> | undefined,
    };

    res.json(response);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        error: 'VALIDATION_ERROR',
        message: 'Invalid clinician DID',
        details: error.errors,
      });
    }

    console.error('Error fetching IMLC status:', error);
    res.status(500).json({
      error: 'INTERNAL_ERROR',
      message: 'Failed to fetch IMLC eligibility status',
    });
  }
});

/**
 * POST /api/compacts/imlc/compute
 * Compute IMLC eligibility for a clinician
 *
 * Request body:
 * {
 *   clinicianDid: string;
 *   homeState: string;
 *   licenseHistory: LicenseHistory[];
 * }
 */
router.post('/compute', async (req: Request, res: Response) => {
  try {
    const { clinicianDid, homeState, licenseHistory } = req.body;

    if (!clinicianDid || !homeState || !Array.isArray(licenseHistory)) {
      return res.status(400).json({
        error: 'VALIDATION_ERROR',
        message: 'Missing required fields: clinicianDid, homeState, licenseHistory',
      });
    }

    // Import engine dynamically to avoid circular dependencies
    const { determineIMLCEligibility } = await import('../../../../../services/compacts/imlcEngine.js');
    const { recordIMLCEligibilityEvent } = await import('../../../../../services/audit/compactsEvents.js');

    // Compute IMLC eligibility
    const eligibilityData = await determineIMLCEligibility(clinicianDid, homeState, licenseHistory);

    // Upsert to database
    const eligibility = await prisma.iMLCEligibility.upsert({
      where: { clinicianDid },
      update: {
        homeState: eligibilityData.homeState,
        compactStates: eligibilityData.compactStates,
        status: eligibilityData.status,
        licenseHistory: eligibilityData.licenseHistory as any,
        metadata: eligibilityData.metadata as any,
        lastCheckedAt: new Date(),
      },
      create: {
        clinicianDid: eligibilityData.clinicianDid,
        homeState: eligibilityData.homeState,
        compactStates: eligibilityData.compactStates,
        status: eligibilityData.status,
        licenseHistory: eligibilityData.licenseHistory as any,
        metadata: eligibilityData.metadata as any,
        lastCheckedAt: new Date(),
      },
    });

    // Record audit event
    await recordIMLCEligibilityEvent(
      prisma,
      clinicianDid,
      eligibilityData.status,
      eligibilityData.homeState,
      eligibilityData.compactStates
    );

    // Return computed status
    const response: IMLCStatusResponse = {
      clinicianDid: eligibility.clinicianDid,
      status: eligibility.status as 'NOT_ELIGIBLE' | 'ELIGIBLE' | 'LICENSED',
      homeState: eligibility.homeState,
      compactStates: eligibility.compactStates,
      lastCheckedAt: eligibility.lastCheckedAt.toISOString(),
      metadata: eligibility.metadata as Record<string, any> | undefined,
    };

    res.status(200).json(response);
  } catch (error) {
    console.error('Error computing IMLC eligibility:', error);
    res.status(500).json({
      error: 'COMPUTATION_ERROR',
      message: 'Failed to compute IMLC eligibility',
    });
  }
});

export default router;


/**
 * B138A-COMPACT-009: Unified Compacts Status API Endpoint
 *
 * GET /api/compacts/status/:clinicianDid
 * Returns combined status for IMLC, PSYPACT, and Counseling Compact.
 * Implements 24-hour caching with automatic refresh.
 */

import { Router, Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import type {
  CounselingCompact,
  CompactsStatus as PrismaCompactsStatus,
  IMLCEligibility,
  PSYPACTCompact,
} from '@prisma/client';
import { z } from 'zod';
import { buildCompactConsentSet } from '../../../../services/compacts/models/CompactConsent.js';
import type { CompactConsentType } from '../../../../services/compacts/models/CompactConsent.js';

const router = Router();
const prisma = new PrismaClient();

// Cache TTL: 24 hours
const CACHE_TTL_MS = 24 * 60 * 60 * 1000;

// Request validation schema
const ClinicianDidParamSchema = z.object({
  clinicianDid: z.string().min(1, 'Clinician DID is required'),
});

const CONSENT_ERROR_CODE = 'COMPACT_CONSENT_REQUIRED';

function buildConsentError(clinicianDid: string, clinicianId?: string) {
  return {
    error: CONSENT_ERROR_CODE,
    message: 'Clinician must opt into sharing compact eligibility data.',
    clinicianDid,
    clinicianId,
  };
}

async function resolveClinicianProfileId(clinicianDid: string): Promise<string | null> {
  const user = await prisma.user.findFirst({
    where: {
      OR: [
        { did: clinicianDid },
        { didLinks: { some: { did: clinicianDid } } },
      ],
    },
    select: {
      clinicianProfile: { select: { id: true } },
    },
  });
  return user?.clinicianProfile?.id ?? null;
}

async function fetchCompactConsentSet(clinicianId: string): Promise<Set<CompactConsentType>> {
  const rows = await prisma.compactConsent.findMany({
    where: { clinicianId },
  });
  return buildCompactConsentSet(rows);
}

async function requireCompactConsents(
  clinicianId: string,
  clinicianDid: string,
  res: Response,
): Promise<Set<CompactConsentType> | null> {
  const consentSet = await fetchCompactConsentSet(clinicianId);
  if (consentSet.size === 0) {
    res.status(403).json(buildConsentError(clinicianDid, clinicianId));
    return null;
  }
  return consentSet;
}

// Response schema
export interface CompactsStatusResponse {
  clinicianDid: string;
  imlc: {
    status: string;
    homeState?: string;
    compactStates: string[];
    lastCheckedAt: string | null;
    consentRequired: boolean;
  };
  psypact: {
    status: string;
    primaryState?: string;
    participatingStates: string[];
    ePassportId?: string;
    lastCheckedAt: string | null;
    consentRequired: boolean;
  };
  counseling: {
    status: string;
    homeState?: string;
    compactStates: string[];
    lastCheckedAt: string | null;
    consentRequired: boolean;
  };
  unified: {
    lastComputedAt: string;
    nextRefreshAt?: string;
    cacheHit: boolean;
    consentedCompactTypes: CompactConsentType[];
  };
}

interface BuildResponseArgs {
  clinicianDid: string;
  compactsStatus: PrismaCompactsStatus;
  consentSet: Set<CompactConsentType>;
  cacheHit: boolean;
  cacheExpiry: Date;
  imlcRecord?: IMLCEligibility | null;
  psypactRecord?: PSYPACTCompact | null;
  counselingRecord?: CounselingCompact | null;
}

function buildCompactsStatusResponse({
  clinicianDid,
  compactsStatus,
  consentSet,
  cacheHit,
  cacheExpiry,
  imlcRecord,
  psypactRecord,
  counselingRecord,
}: BuildResponseArgs): CompactsStatusResponse {
  const imlcAllowed = consentSet.has('IMLC');
  const psypactAllowed = consentSet.has('PSYPACT');
  const counselingAllowed = consentSet.has('COUNSELING');

  const imlcSection = imlcAllowed
    ? {
        status: compactsStatus.imlcStatus,
        homeState: compactsStatus.imlcHomeState || undefined,
        compactStates: compactsStatus.imlcCompactStates,
        lastCheckedAt: imlcRecord?.lastCheckedAt?.toISOString() || compactsStatus.lastComputedAt.toISOString(),
        consentRequired: false,
      }
    : {
        status: 'CONSENT_REQUIRED',
        homeState: undefined,
        compactStates: [],
        lastCheckedAt: null,
        consentRequired: true,
      };

  const psypactSection = psypactAllowed
    ? {
        status: compactsStatus.psypactStatus,
        primaryState: psypactRecord?.primaryState || undefined,
        participatingStates: compactsStatus.psypactStates,
        ePassportId: psypactRecord?.ePassportId || undefined,
        lastCheckedAt: psypactRecord?.lastCheckedAt?.toISOString() || compactsStatus.lastComputedAt.toISOString(),
        consentRequired: false,
      }
    : {
        status: 'CONSENT_REQUIRED',
        primaryState: undefined,
        participatingStates: [],
        ePassportId: undefined,
        lastCheckedAt: null,
        consentRequired: true,
      };

  const counselingSection = counselingAllowed
    ? {
        status: compactsStatus.counselingStatus,
        homeState: compactsStatus.counselingHomeState || undefined,
        compactStates: compactsStatus.counselingStates,
        lastCheckedAt: counselingRecord?.lastCheckedAt?.toISOString() || compactsStatus.lastComputedAt.toISOString(),
        consentRequired: false,
      }
    : {
        status: 'CONSENT_REQUIRED',
        homeState: undefined,
        compactStates: [],
        lastCheckedAt: null,
        consentRequired: true,
      };

  return {
    clinicianDid,
    imlc: imlcSection,
    psypact: psypactSection,
    counseling: counselingSection,
    unified: {
      lastComputedAt: compactsStatus.lastComputedAt.toISOString(),
      nextRefreshAt: cacheExpiry.toISOString(),
      cacheHit,
      consentedCompactTypes: Array.from(consentSet),
    },
  };
}

/**
 * GET /api/compacts/status/:clinicianDid
 * Get unified compacts status for a clinician
 */
router.get('/:clinicianDid', async (req: Request, res: Response) => {
  try {
    const params = ClinicianDidParamSchema.parse(req.params);
    const clinicianDid = params.clinicianDid;

    const compactsStatus = await prisma.compactsStatus.findUnique({
      where: { clinicianDid },
    });

    if (!compactsStatus) {
      return res.status(404).json({
        error: 'COMPACTS_STATUS_NOT_COMPUTED',
        message: 'Compacts status has not been computed for this clinician',
        clinicianDid,
      });
    }

    const clinicianProfileId = await resolveClinicianProfileId(clinicianDid);
    if (!clinicianProfileId) {
      return res.status(404).json({
        error: 'CLINICIAN_PROFILE_NOT_FOUND',
        message: 'Unable to resolve clinician profile for this DID',
        clinicianDid,
      });
    }

    const consentSet = await requireCompactConsents(clinicianProfileId, clinicianDid, res);
    if (!consentSet) {
      return;
    }

    const now = new Date();
    const cacheExpiry = compactsStatus.nextRefreshAt
      || new Date(compactsStatus.lastComputedAt.getTime() + CACHE_TTL_MS);
    const cacheHit = now < cacheExpiry;

    const imlcStatus = consentSet.has('IMLC')
      ? await prisma.iMLCEligibility.findUnique({ where: { clinicianDid } })
      : null;
    const psypactStatus = consentSet.has('PSYPACT')
      ? await prisma.pSYPACTCompact.findUnique({ where: { clinicianDid } })
      : null;
    const counselingStatus = consentSet.has('COUNSELING')
      ? await prisma.counselingCompact.findUnique({ where: { clinicianDid } })
      : null;

    const response = buildCompactsStatusResponse({
      clinicianDid,
      compactsStatus,
      consentSet,
      cacheHit,
      cacheExpiry,
      imlcRecord: imlcStatus,
      psypactRecord: psypactStatus,
      counselingRecord: counselingStatus,
    });

    res.set('Cache-Control', `public, max-age=${Math.floor(CACHE_TTL_MS / 1000)}`);
    res.set('X-Cache', cacheHit ? 'HIT' : 'MISS');
    res.json(response);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        error: 'VALIDATION_ERROR',
        message: 'Invalid clinician DID',
        details: error.errors,
      });
    }

    console.error('Error fetching compacts status:', error);
    res.status(500).json({
      error: 'INTERNAL_ERROR',
      message: 'Failed to fetch compacts status',
    });
  }
});


/**
 * POST /api/compacts/status/compute
 * Compute unified compacts status for a clinician
 *
 * Request body:
 * {
 *   clinicianDid: string;
 *   licenseData: {
 *     medical?: LicenseHistory[];
 *     psychology?: PsychologyLicense[];
 *     counseling?: CounselingLicense[];
 *   };
 * }
 */
router.post('/compute', async (req: Request, res: Response) => {
  try {
    const { clinicianDid, licenseData } = req.body;

    if (!clinicianDid || !licenseData) {
      return res.status(400).json({
        error: 'VALIDATION_ERROR',
        message: 'Missing required fields: clinicianDid, licenseData',
      });
    }

    const clinicianProfileId = await resolveClinicianProfileId(clinicianDid);
    if (!clinicianProfileId) {
      return res.status(404).json({
        error: 'CLINICIAN_PROFILE_NOT_FOUND',
        message: 'Unable to resolve clinician profile for this DID',
        clinicianDid,
      });
    }

    const consentSet = await requireCompactConsents(clinicianProfileId, clinicianDid, res);
    if (!consentSet) {
      return;
    }

    const { determineIMLCEligibility } = await import('../../../../services/compacts/imlcEngine.js');
    const { determinePSYPACTEligibility } = await import('../../../../services/compacts/psyEngine.js');
    const { determineCounselingCompactEligibility } = await import('../../../../services/compacts/counselingEngine.js');
    const { recordCompactComputedEvent } = await import('../../../../services/audit/compactsEvents.js');

    const canComputeIMLC = consentSet.has('IMLC') && licenseData.medical?.length > 0;
    const canComputePSYPACT = consentSet.has('PSYPACT') && licenseData.psychology?.length > 0;
    const canComputeCounseling = consentSet.has('COUNSELING') && licenseData.counseling?.length > 0;

    const imlcResult = canComputeIMLC
      ? await determineIMLCEligibility(clinicianDid, licenseData.medical[0].state, licenseData.medical)
      : null;
    const psypactResult = canComputePSYPACT
      ? await determinePSYPACTEligibility(clinicianDid, licenseData.psychology[0].state, licenseData.psychology)
      : null;
    const counselingResult = canComputeCounseling
      ? await determineCounselingCompactEligibility(
          clinicianDid,
          licenseData.counseling[0].state,
          licenseData.counseling,
        )
      : null;

    const now = new Date();
    const nextRefreshAt = new Date(now.getTime() + CACHE_TTL_MS);

    const baseData = {
      imlcStatus: imlcResult?.status || 'NOT_ELIGIBLE',
      imlcHomeState: canComputeIMLC ? imlcResult?.homeState : null,
      imlcCompactStates: canComputeIMLC ? imlcResult?.compactStates || [] : [],
      psypactStatus: psypactResult?.status || 'NOT_ELIGIBLE',
      psypactStates: canComputePSYPACT ? psypactResult?.participatingStates || [] : [],
      counselingStatus: counselingResult?.status || 'NOT_ELIGIBLE',
      counselingHomeState: canComputeCounseling ? counselingResult?.homeState : null,
      counselingStates: canComputeCounseling ? counselingResult?.compactStates || [] : [],
      lastComputedAt: now,
      nextRefreshAt,
    };

    const compactsStatus = await prisma.compactsStatus.upsert({
      where: { clinicianDid },
      update: baseData,
      create: {
        clinicianDid,
        ...baseData,
      },
    });

    await recordCompactComputedEvent(
      prisma,
      clinicianDid,
      {
        clinicianDid,
        imlcStatus: compactsStatus.imlcStatus,
        imlcHomeState: compactsStatus.imlcHomeState,
        imlcCompactStates: compactsStatus.imlcCompactStates,
        psypactStatus: compactsStatus.psypactStatus,
        psypactStates: compactsStatus.psypactStates,
        counselingStatus: compactsStatus.counselingStatus,
        counselingHomeState: compactsStatus.counselingHomeState,
        counselingStates: compactsStatus.counselingStates,
      },
    );

    const response = buildCompactsStatusResponse({
      clinicianDid,
      compactsStatus,
      consentSet,
      cacheHit: false,
      cacheExpiry: nextRefreshAt,
    });

    res.status(200).json(response);
  } catch (error) {
    console.error('Error computing compacts status:', error);
    res.status(500).json({
      error: 'COMPUTATION_ERROR',
      message: 'Failed to compute compacts status',
    });
  }
});


/**
 * POST /api/compacts/status/:clinicianDid/refresh
 * Force refresh of compacts status (bypasses cache)
 */
router.post('/:clinicianDid/refresh', async (req: Request, res: Response) => {
  try {
    const params = ClinicianDidParamSchema.parse(req.params);
    const clinicianDid = params.clinicianDid;
    const clinicianProfileId = await resolveClinicianProfileId(clinicianDid);
    if (!clinicianProfileId) {
      return res.status(404).json({
        error: 'CLINICIAN_PROFILE_NOT_FOUND',
        message: 'Unable to resolve clinician profile for this DID',
        clinicianDid,
      });
    }

    if (!(await requireCompactConsents(clinicianProfileId, clinicianDid, res))) {
      return;
    }

    // This would trigger recomputation - for now, just invalidate cache
    await prisma.compactsStatus.update({
      where: { clinicianDid },
      data: {
        nextRefreshAt: new Date(), // Force immediate refresh on next request
      },
    });

    res.json({
      success: true,
      message: 'Compacts status cache invalidated',
      clinicianDid,
    });
  } catch (error) {
    console.error('Error refreshing compacts status:', error);
    res.status(500).json({
      error: 'REFRESH_ERROR',
      message: 'Failed to refresh compacts status',
    });
  }
});

export default router;


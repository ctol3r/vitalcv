/**
 * B137A-ENROLL-008: API to create PayerEnrollment draft
 *
 * POST /api/payer/enroll/draft
 *
 * Creates a DRAFT enrollment entry, pulls CAQH fields if available,
 * and stores evidence IDs (VCs).
 */

import { Router, Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { loadUserSession, requireAuth } from '../../../../../../backend/src/middleware/accessGuards';
import { ActiveOrgRequest, requireActiveOrg } from '../../../middleware/requireActiveOrg';
import {
  validateEnrollment
} from '../../../../../../services/payer/models/PayerEnrollment.js';
import { EnrollmentStatus } from '@domain-common/payer/enrollment';
import { fetchCaqhProfile, validateCaqhProfile } from '../../../../../../services/payer/caqhClient.js';
import { getPecosStatus, validatePecosStatus } from '../../../../../../services/payer/pecosClient.js';
import { checkEnrollmentRequirements } from '../../../../../../services/payer/requirementsEngine.js';
import {
  logCaqhCheck,
  logPecosCheck,
  logEvidenceSubmission,
} from '../../../../../../services/audit/payerEnrollmentEvents.js';
import { featureFlagGuard } from '../../../../../../services/flags/featureFlags.js';

const router = Router();
const prisma = new PrismaClient();

interface CreateDraftRequest {
  payerId: string;
  clinicianDid: string;
  caqhId?: string;
  pecosId?: string;
  evidenceIds?: string[];
  evidenceBundle?: any;
  metadata?: any;
}

/**
 * B149B-FF-012: Guard PayerEnrollment APIs with `payer.enrollment.enabled` flag
 * POST /api/payer/enroll/draft
 * When disabled, POST/PATCH blocked; GET still allowed for existing records
 */
router.post(
  '/draft',
  loadUserSession,
  requireAuth,
  requireActiveOrg,
  featureFlagGuard('payer.enrollment.enabled', {
    statusCode: 503,
    errorCode: 'FEATURE_DISABLED',
    errorMessage: 'Payer enrollment feature is currently disabled.',
  }),
  async (req: Request<{}, {}, CreateDraftRequest>, res: Response) => {
  try {
    const orgReq = req as ActiveOrgRequest;
    const orgId = orgReq.activeOrgId as string;

    // Validate request body
    const enrollmentData = validateEnrollment({ ...req.body, orgId });

    // Check if payer exists
    const payer = await prisma.payer.findUnique({
      where: { id: enrollmentData.payerId },
    });

    if (!payer) {
      return res.status(404).json({
        success: false,
        error: 'Payer not found',
      });
    }

    // Check if enrollment already exists
    const existingEnrollment = await prisma.payerEnrollment.findFirst({
      where: {
        orgId: enrollmentData.orgId,
        payerId: enrollmentData.payerId,
        clinicianDid: enrollmentData.clinicianDid,
        status: {
          in: [EnrollmentStatus.DRAFT, EnrollmentStatus.SUBMITTED, EnrollmentStatus.APPROVED],
        },
      },
    });

    if (existingEnrollment) {
      return res.status(409).json({
        success: false,
        error: 'Active enrollment already exists for this clinician and payer',
        enrollmentId: existingEnrollment.id,
      });
    }

    // Fetch CAQH profile if CAQH ID provided
    let caqhProfile;
    let caqhValidation;
    if (enrollmentData.caqhId) {
      const caqhResult = await fetchCaqhProfile({
        caqhId: enrollmentData.caqhId,
      });

      if (caqhResult.success && caqhResult.profile) {
        caqhProfile = caqhResult.profile;
        caqhValidation = validateCaqhProfile(caqhProfile);
      }
    }

    // Fetch PECOS status if PECOS ID provided
    let pecosStatus;
    let pecosValidation;
    if (enrollmentData.pecosId) {
      const pecosResult = await getPecosStatus({
        enrollmentId: enrollmentData.pecosId,
      });

      if (pecosResult.success && pecosResult.status) {
        pecosStatus = pecosResult.status;
        pecosValidation = validatePecosStatus(pecosStatus);
      }
    }

    // Create draft enrollment
    const enrollment = await prisma.payerEnrollment.create({
      data: {
        orgId: enrollmentData.orgId,
        payerId: enrollmentData.payerId,
        clinicianDid: enrollmentData.clinicianDid,
        caqhId: enrollmentData.caqhId,
        pecosId: enrollmentData.pecosId,
        pecosEnrollmentId: pecosStatus?.pecosEnrollmentId,
        pecosStatus: pecosStatus?.status,
        status: EnrollmentStatus.DRAFT,
        evidenceIds: enrollmentData.evidenceIds || [],
        evidenceBundle: enrollmentData.evidenceBundle,
        metadata: enrollmentData.metadata,
      },
      include: {
        payer: true,
      },
    });

    // Log evidence events
    if (caqhProfile && caqhValidation) {
      await logCaqhCheck(enrollment.id, caqhProfile, caqhValidation);
    }

    if (pecosStatus && pecosValidation) {
      await logPecosCheck(enrollment.id, pecosStatus, pecosValidation);
    }

    if (enrollmentData.evidenceIds && enrollmentData.evidenceIds.length > 0) {
      await logEvidenceSubmission(
        enrollment.id,
        enrollmentData.evidenceIds,
        enrollmentData.evidenceBundle
      );
    }

    // Check requirements (optional for draft)
    let requirementsCheck;
    try {
      requirementsCheck = await checkEnrollmentRequirements(
        {
          payerId: enrollmentData.payerId,
          clinicianDid: enrollmentData.clinicianDid,
          specialty: '207R00000X', // TODO: Get from clinician profile
          state: 'CA', // TODO: Get from clinician profile
          caqhProfile,
          pecosStatus,
        },
        payer
      );
    } catch (error) {
      console.error('Error checking requirements:', error);
      requirementsCheck = null;
    }

    res.status(201).json({
      success: true,
      data: {
        enrollment: {
          id: enrollment.id,
          orgId: enrollment.orgId,
          payerId: enrollment.payerId,
          clinicianDid: enrollment.clinicianDid,
          caqhId: enrollment.caqhId,
          pecosId: enrollment.pecosId,
          status: enrollment.status,
          evidenceIds: enrollment.evidenceIds,
          createdAt: enrollment.createdAt,
        },
        payer: {
          id: enrollment.payer.id,
          name: enrollment.payer.name,
          requiresCaqh: enrollment.payer.requiresCaqh,
          requiresPecos: enrollment.payer.requiresPecos,
        },
        validation: {
          caqh: caqhValidation || null,
          pecos: pecosValidation || null,
        },
        requirements: requirementsCheck
          ? {
              eligible: requirementsCheck.eligibleForEnrollment,
              status: requirementsCheck.overallStatus,
              criticalFailures: requirementsCheck.criticalFailures,
              warnings: requirementsCheck.warnings,
            }
          : null,
      },
      message: 'Draft enrollment created successfully',
    });
  } catch (error) {
    console.error('Error creating draft enrollment:', error);

    if (error instanceof Error && error.name === 'ZodError') {
      return res.status(400).json({
        success: false,
        error: 'Validation error',
        details: error.message,
      });
    }

    res.status(500).json({
      success: false,
      error: 'Failed to create draft enrollment',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
  }
);

export default router;


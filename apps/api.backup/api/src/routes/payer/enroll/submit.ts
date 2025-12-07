/**
 * B137A-ENROLL-009: API to submit PayerEnrollment
 *
 * PATCH /api/payer/enroll/:id/submit
 *
 * Changes enrollment status from DRAFT to SUBMITTED.
 * Logs timestamp and optionally anchors hash on-chain.
 */

import { Router, Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { loadUserSession, requireAuth } from '../../../../../../backend/src/middleware/accessGuards';
import { ActiveOrgRequest, requireActiveOrg } from '../../../middleware/requireActiveOrg';
import { createHash } from 'crypto';
import {
  calculateRevalidationDate
} from '../../../../../../services/payer/models/PayerEnrollment.js';
import { EnrollmentStatus, canTransitionStatus } from '@domain-common/payer/enrollment';
import { checkEnrollmentRequirements } from '../../../../../../services/payer/requirementsEngine.js';
import { fetchCaqhProfile } from '../../../../../../services/payer/caqhClient.js';
import { getPecosStatus } from '../../../../../../services/payer/pecosClient.js';
import { logStatusChange } from '../../../../../../services/audit/payerEnrollmentEvents.js';
import { featureFlagGuard } from '../../../../../../services/flags/featureFlags.js';
import { rateLimitApply } from '../../../middleware/rateLimitApply.js';
import { riskGate } from '../../../middleware/riskGate.js';
import { eventBus } from '../../../../../../backend/src/services/notifications/eventBus';

const router = Router();

router.use(loadUserSession, requireAuth, requireActiveOrg);
const prisma = new PrismaClient();

interface SubmitEnrollmentRequest {
  reason?: string;
  anchorOnChain?: boolean;
}

/**
 * B149B-FF-012: Guard PayerEnrollment APIs with `payer.enrollment.enabled` flag
 * PATCH /api/payer/enroll/:id/submit
 * When disabled, POST/PATCH blocked; GET still allowed for existing records
 */
router.patch(
  '/:id/submit',
  rateLimitApply, // B143E-SPAM-003: Rate limit payer enrollment submissions
  riskGate('payerEnroll'), // B143F-LOOP-002: Risk gate middleware for high-value endpoint
  featureFlagGuard('payer.enrollment.enabled', {
    statusCode: 503,
    errorCode: 'FEATURE_DISABLED',
    errorMessage: 'Payer enrollment feature is currently disabled.',
  }),
  async (req: Request<{ id: string }, {}, SubmitEnrollmentRequest>, res: Response) => {
  try {
    const { id } = req.params;
    const { reason, anchorOnChain = false } = req.body;
    const activeOrgId = (req as ActiveOrgRequest).activeOrgId as string;

    // Get enrollment
    const enrollment = await prisma.payerEnrollment.findUnique({
      where: { id },
      include: {
        payer: true,
      },
    });

    if (!enrollment) {
      return res.status(404).json({
        success: false,
        error: 'Enrollment not found',
      });
    }

    if (enrollment.orgId !== activeOrgId) {
      return res.status(403).json({
        success: false,
        error: 'org_mismatch',
        message: 'Enrollment does not belong to the active organization',
      });
    }

    // Check if status transition is valid
    if (!canTransitionStatus(enrollment.status as EnrollmentStatus, EnrollmentStatus.SUBMITTED)) {
      return res.status(400).json({
        success: false,
        error: `Cannot transition from ${enrollment.status} to SUBMITTED`,
      });
    }

    // Fetch latest CAQH profile if available
    let caqhProfile;
    if (enrollment.caqhId) {
      const caqhResult = await fetchCaqhProfile({
        caqhId: enrollment.caqhId,
      });
      if (caqhResult.success && caqhResult.profile) {
        caqhProfile = caqhResult.profile;
      }
    }

    // Fetch latest PECOS status if available
    let pecosStatus;
    if (enrollment.pecosId) {
      const pecosResult = await getPecosStatus({
        enrollmentId: enrollment.pecosId,
      });
      if (pecosResult.success && pecosResult.status) {
        pecosStatus = pecosResult.status;
      }
    }

    // Run requirements check
    const requirementsCheck = await checkEnrollmentRequirements(
      {
        payerId: enrollment.payerId,
        clinicianDid: enrollment.clinicianDid,
        specialty: '207R00000X', // TODO: Get from clinician profile
        state: 'CA', // TODO: Get from clinician profile
        caqhProfile,
        pecosStatus,
      },
      enrollment.payer
    );

    // Block submission if critical requirements not met
    if (!requirementsCheck.eligibleForEnrollment) {
      return res.status(422).json({
        success: false,
        error: 'Enrollment requirements not met',
        requirements: {
          eligible: false,
          status: requirementsCheck.overallStatus,
          criticalFailures: requirementsCheck.criticalFailures,
          warnings: requirementsCheck.warnings,
        },
      });
    }

    // Create hash of enrollment data
    const enrollmentHash = createHash('sha256')
      .update(
        JSON.stringify({
          id: enrollment.id,
          orgId: enrollment.orgId,
          payerId: enrollment.payerId,
          clinicianDid: enrollment.clinicianDid,
          caqhId: enrollment.caqhId,
          pecosId: enrollment.pecosId,
          evidenceIds: enrollment.evidenceIds,
          submittedAt: new Date().toISOString(),
        })
      )
      .digest('hex');

    // TODO: Implement on-chain anchoring
    let anchoredHash: string | null = null;
    if (anchorOnChain) {
      // Placeholder for blockchain anchoring
      anchoredHash = `0x${enrollmentHash}`;
      console.log('TODO: Anchor hash on-chain:', anchoredHash);
    }

    // Calculate revalidation date if payer requires PECOS
    let revalidationDueAt: Date | null = null;
    if (enrollment.payer.requiresPecos && pecosStatus) {
      revalidationDueAt = calculateRevalidationDate(
        new Date(),
        pecosStatus.cycle === '3year' ? 'DMEPOS' : 'STANDARD'
      );
    }

    // Update enrollment status
    const updatedEnrollment = await prisma.payerEnrollment.update({
      where: { id },
      data: {
        status: EnrollmentStatus.SUBMITTED,
        submittedAt: new Date(),
        anchoredHash: enrollmentHash,
        revalidationDueAt,
        pecosStatus: pecosStatus?.status,
        lastCheckedAt: new Date(),
      },
      include: {
        payer: true,
      },
    });

    // Log status change
    await logStatusChange(
      enrollment.id,
      enrollment.status,
      EnrollmentStatus.SUBMITTED,
      reason
    );

    eventBus.emitEvent('PayerEnrollmentSubmitted', {
      enrollmentId: updatedEnrollment.id,
      orgId: updatedEnrollment.orgId,
      payerId: updatedEnrollment.payerId,
      clinicianDid: updatedEnrollment.clinicianDid,
      submittedAt: updatedEnrollment.submittedAt?.toISOString(),
    });

    res.json({
      success: true,
      data: {
        enrollment: {
          id: updatedEnrollment.id,
          status: updatedEnrollment.status,
          submittedAt: updatedEnrollment.submittedAt,
          anchoredHash: updatedEnrollment.anchoredHash,
          revalidationDueAt: updatedEnrollment.revalidationDueAt,
        },
        requirements: {
          eligible: requirementsCheck.eligibleForEnrollment,
          status: requirementsCheck.overallStatus,
          warnings: requirementsCheck.warnings,
        },
      },
      message: 'Enrollment submitted successfully',
    });
  } catch (error) {
    console.error('Error submitting enrollment:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to submit enrollment',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
  }
);

/**
 * B149B-FF-012: Guard PayerEnrollment APIs with `payer.enrollment.enabled` flag
 * PATCH /api/payer/enroll/:id/approve
 * Approve an enrollment (for admin/payer use)
 * When disabled, POST/PATCH blocked; GET still allowed for existing records
 */
router.patch(
  '/:id/approve',
  featureFlagGuard('payer.enrollment.enabled', {
    statusCode: 503,
    errorCode: 'FEATURE_DISABLED',
    errorMessage: 'Payer enrollment feature is currently disabled.',
  }),
  async (req: Request<{ id: string }>, res: Response) => {
  try {
    const { id } = req.params;
    const activeOrgId = (req as ActiveOrgRequest).activeOrgId as string;

    const enrollment = await prisma.payerEnrollment.findUnique({
      where: { id },
    });

    if (!enrollment) {
      return res.status(404).json({
        success: false,
        error: 'Enrollment not found',
      });
    }

    if (enrollment.orgId !== activeOrgId) {
      return res.status(403).json({
        success: false,
        error: 'org_mismatch',
        message: 'Enrollment does not belong to the active organization',
      });
    }

    if (!canTransitionStatus(enrollment.status as EnrollmentStatus, EnrollmentStatus.APPROVED)) {
      return res.status(400).json({
        success: false,
        error: `Cannot transition from ${enrollment.status} to APPROVED`,
      });
    }

    const updatedEnrollment = await prisma.payerEnrollment.update({
      where: { id },
      data: {
        status: EnrollmentStatus.APPROVED,
        approvedAt: new Date(),
      },
    });

    await logStatusChange(enrollment.id, enrollment.status, EnrollmentStatus.APPROVED);

    res.json({
      success: true,
      data: updatedEnrollment,
      message: 'Enrollment approved successfully',
    });
  } catch (error) {
    console.error('Error approving enrollment:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to approve enrollment',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
  }
);

/**
 * B149B-FF-012: Guard PayerEnrollment APIs with `payer.enrollment.enabled` flag
 * GET /api/payer/enroll/:id
 * Get enrollment details
 * Note: GET is allowed even when feature is disabled to read existing records
 */
router.get('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const activeOrgId = (req as ActiveOrgRequest).activeOrgId as string;

    const enrollment = await prisma.payerEnrollment.findUnique({
      where: { id },
      include: {
        payer: true,
        auditEvents: {
          orderBy: { createdAt: 'desc' },
          take: 20,
        },
      },
    });

    if (!enrollment) {
      return res.status(404).json({
        success: false,
        error: 'Enrollment not found',
      });
    }

    if (enrollment.orgId !== activeOrgId) {
      return res.status(403).json({
        success: false,
        error: 'org_mismatch',
        message: 'Enrollment does not belong to the active organization',
      });
    }

    res.json({
      success: true,
      data: enrollment,
    });
  } catch (error) {
    console.error('Error fetching enrollment:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch enrollment',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

export default router;


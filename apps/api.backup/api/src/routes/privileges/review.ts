/**
 * B134A-PRIV-006: API endpoint for privilege reviewers to approve/deny requests
 * PATCH /privileges/:id
 */

import { Router, Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { z } from 'zod';
import { RequirementsEngine, parseEvidenceFromRequest } from '../../services/privileging/requirementsEngine';
import { onPrivilegeReviewed } from '../../services/privileging/hooks/onPrivilegeReviewed';
import { NCQARunner } from '../../services/compliance/runner';
const router = Router();
const prisma = new PrismaClient();

// Validation schema
const ReviewRequestSchema = z.object({
  status: z.enum(['APPROVED', 'DENIED', 'UNDER_REVIEW']),
  reviewerDid: z.string().min(1, 'Reviewer DID is required'),
  reviewNotes: z.string().optional(),
  initiateFppe: z.boolean().optional(), // Start FPPE if approved
});

/**
 * PATCH /privileges/:id
 * Review and approve/deny a privilege request
 */
router.patch('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    // Validate request body
    const validationResult = ReviewRequestSchema.safeParse(req.body);

    if (!validationResult.success) {
      return res.status(400).json({
        error: 'Validation failed',
        details: validationResult.error.errors,
      });
    }

    const data = validationResult.data;

    // Fetch privilege request
    const privilegeRequest = await prisma.privilegeRequest.findUnique({
      where: { id },
      include: {
        privilegeSet: true,
      },
    });

    if (!privilegeRequest) {
      return res.status(404).json({
        error: 'Privilege request not found',
      });
    }

    // Validate that request is in reviewable state
    if (privilegeRequest.status === 'APPROVED' || privilegeRequest.status === 'DENIED') {
      return res.status(400).json({
        error: 'Privilege request has already been reviewed',
        currentStatus: privilegeRequest.status,
      });
    }

    // If approving, run requirements engine to validate
    let requirementsCheck: any = null;
    if (data.status === 'APPROVED') {
      const evidenceBundle = await parseEvidenceFromRequest(
        privilegeRequest.evidenceIds,
        privilegeRequest.evidenceBundle
      );

      requirementsCheck = await RequirementsEngine.evaluateRequirements(
        privilegeRequest.privilegeSet.requirements as any,
        evidenceBundle
      );

      // Optionally enforce requirements check
      if (!requirementsCheck.passed && process.env.ENFORCE_REQUIREMENTS_CHECK === 'true') {
        return res.status(400).json({
          error: 'Cannot approve: Requirements not met',
          requirementsCheck: {
            passed: false,
            reasons: requirementsCheck.reasons,
            details: requirementsCheck.details,
          },
        });
      }
    }

    // Update privilege request
    const updated = await prisma.privilegeRequest.update({
      where: { id },
      data: {
        status: data.status,
        reviewerDid: data.reviewerDid,
        reviewNotes: data.reviewNotes,
        reviewedAt: new Date(),
      },
    });

    // If approved and FPPE requested, create FPPE/OPPE tracking
    let fppeOppe = null;
    if (data.status === 'APPROVED' && data.initiateFppe) {
      fppeOppe = await initiateFppeTracking(privilegeRequest);
    }

    // Create audit event
    await prisma.auditEvent.create({
      data: {
        type: 'PRIVILEGE_REQUEST_REVIEWED',
        data: {
          privilegeRequestId: id,
          status: data.status,
          reviewerDid: data.reviewerDid,
          orgId: privilegeRequest.orgId,
          clinicianDid: privilegeRequest.clinicianDid,
          privilegeSetName: privilegeRequest.privilegeSet.name,
          requirementsCheck: requirementsCheck
            ? {
                passed: requirementsCheck.passed,
                reasons: requirementsCheck.reasons,
              }
            : null,
          fppeInitiated: !!fppeOppe,
        },
      },
    });

    // If approved, optionally issue PrivilegeGranted VC
    let privilegeGrantedVc = null;
    if (data.status === 'APPROVED' && process.env.AUTO_ISSUE_PRIVILEGE_VC === 'true') {
      privilegeGrantedVc = await issuePrivilegeGrantedVC(privilegeRequest, updated);
    }

    // B148B-HOOK-002: Trigger hook to create notification and send email to clinician
    onPrivilegeReviewed({
      privilegeRequestId: id,
      orgId: privilegeRequest.orgId,
      clinicianDid: privilegeRequest.clinicianDid,
      status: data.status as 'APPROVED' | 'DENIED',
      privilegeSetName: privilegeRequest.privilegeSet.name,
      reviewerDid: data.reviewerDid,
      reviewNotes: data.reviewNotes,
    }).catch((error) => {
      console.error('[PrivilegeReview] Hook error:', error);
    });

    res.json({
      success: true,
      privilegeRequest: {
        id: updated.id,
        orgId: updated.orgId,
        clinicianDid: updated.clinicianDid,
        privilegeSetId: updated.privilegeSetId,
        status: updated.status,
        reviewerDid: updated.reviewerDid,
        reviewNotes: updated.reviewNotes,
        reviewedAt: updated.reviewedAt,
        requirementsCheck,
        fppeOppe,
        privilegeGrantedVc,
      },
    });
  } catch (error) {
    console.error('Error reviewing privilege request:', error);
    res.status(500).json({
      error: 'Failed to review privilege request',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * GET /privileges/:id/history
 * Get review history for a privilege request
 */
router.get('/:id/history', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    // Verify privilege request exists
    const privilegeRequest = await prisma.privilegeRequest.findUnique({
      where: { id },
    });

    if (!privilegeRequest) {
      return res.status(404).json({
        error: 'Privilege request not found',
      });
    }

    // Fetch audit events for this request
    const auditEvents = await prisma.auditEvent.findMany({
      where: {
        type: {
          in: [
            'PRIVILEGE_REQUEST_SUBMITTED',
            'PRIVILEGE_REQUEST_REVIEWED',
            'PRIVILEGE_AUTO_HOLD',
          ],
        },
        data: {
          path: ['privilegeRequestId'],
          equals: id,
        },
      },
      orderBy: { createdAt: 'asc' },
    });

    res.json({
      success: true,
      history: auditEvents.map((event) => ({
        id: event.id,
        type: event.type,
        data: event.data,
        createdAt: event.createdAt,
        chainTxHash: event.chainTxHash,
      })),
    });
  } catch (error) {
    console.error('Error fetching privilege request history:', error);
    res.status(500).json({
      error: 'Failed to fetch history',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * POST /privileges/:id/revoke
 * Revoke an approved privilege
 */
router.post('/:id/revoke', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { reviewerDid, reason } = req.body;

    if (!reviewerDid || !reason) {
      return res.status(400).json({
        error: 'reviewerDid and reason are required',
      });
    }

    const privilegeRequest = await prisma.privilegeRequest.findUnique({
      where: { id },
    });

    if (!privilegeRequest) {
      return res.status(404).json({
        error: 'Privilege request not found',
      });
    }

    if (privilegeRequest.status !== 'APPROVED') {
      return res.status(400).json({
        error: 'Can only revoke approved privileges',
        currentStatus: privilegeRequest.status,
      });
    }

    // Update to DENIED status (or could create a REVOKED status)
    const updated = await prisma.privilegeRequest.update({
      where: { id },
      data: {
        status: 'DENIED',
        reviewerDid,
        reviewNotes: `REVOKED: ${reason}`,
        reviewedAt: new Date(),
      },
    });

    // Update OPPE status to HOLD if exists
    await prisma.fppeOppe.updateMany({
      where: { privilegeRequestId: id },
      data: {
        oppeStatus: 'HOLD',
        notes: `Privilege revoked: ${reason}`,
      },
    });

    // Audit event
    await prisma.auditEvent.create({
      data: {
        type: 'PRIVILEGE_REVOKED',
        data: {
          privilegeRequestId: id,
          reviewerDid,
          reason,
          orgId: privilegeRequest.orgId,
          clinicianDid: privilegeRequest.clinicianDid,
        },
      },
    });

    res.json({
      success: true,
      message: 'Privilege revoked successfully',
      privilegeRequest: updated,
    });
  } catch (error) {
    console.error('Error revoking privilege:', error);
    res.status(500).json({
      error: 'Failed to revoke privilege',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * Initiate FPPE tracking for an approved privilege request
 */
async function initiateFppeTracking(privilegeRequest: any) {
  const fppeStartDate = new Date();
  const fppeEndDate = new Date();
  fppeEndDate.setDate(fppeEndDate.getDate() + 90); // 90-day FPPE period

  const oppeStartDate = new Date(fppeEndDate);
  const oppeNextReviewDue = new Date(oppeStartDate);
  oppeNextReviewDue.setMonth(oppeNextReviewDue.getMonth() + 12); // First OPPE in 12 months

  const fppeOppe = await prisma.fppeOppe.create({
    data: {
      privilegeRequestId: privilegeRequest.id,
      clinicianDid: privilegeRequest.clinicianDid,
      orgId: privilegeRequest.orgId,
      fppeStartDate,
      fppeEndDate,
      fppeStatus: 'IN_PROGRESS',
      oppeStartDate,
      oppeNextReviewDue,
      oppeIntervalMonths: 12,
      oppeStatus: 'NOT_STARTED',
    },
  });

  return fppeOppe;
}

/**
 * Issue a PrivilegeGranted Verifiable Credential
 */
async function issuePrivilegeGrantedVC(
  privilegeRequest: any,
  updatedRequest: any
): Promise<any> {
  // TODO: Implement actual VC issuance
  // This would use your VC issuance service

  const vc = {
    '@context': [
      'https://www.w3.org/2018/credentials/v1',
      'https://vitalcv.com/schemas/privilegeGranted/v1',
    ],
    type: ['VerifiableCredential', 'PrivilegeGrantedCredential'],
    issuer: {
      id: `did:web:${privilegeRequest.orgId}`,
      name: 'Healthcare Organization',
    },
    issuanceDate: new Date().toISOString(),
    credentialSubject: {
      id: privilegeRequest.clinicianDid,
      privileges: privilegeRequest.privilegeSet,
      grantedAt: updatedRequest.reviewedAt.toISOString(),
      reviewerDid: updatedRequest.reviewerDid,
    },
  };

  // Store as credential
  const newCredential = await prisma.credential.create({
    data: {
      name: `Privilege Granted: ${privilegeRequest.privilegeSet.name}`,
      issuer: privilegeRequest.orgId,
      issuerDid: `did:web:${privilegeRequest.orgId}`,
      holderDid: privilegeRequest.clinicianDid,
      type: 'PrivilegeGranted',
      status: 'active',
      userId: privilegeRequest.clinicianDid, // This should map to actual user ID
    },
  });

  // Run NCQA compliance checks on the newly issued credential
  try {
    await NCQARunner.runForCredential(newCredential.id);
  } catch (error) {
    console.error(`Failed to run NCQA checks for new credential ${newCredential.id}:`, error);
  }

  return vc;
}

export { router as privilegeReviewRouter };


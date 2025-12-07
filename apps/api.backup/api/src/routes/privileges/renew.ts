/**
 * B135A-PRIV-008: API endpoint for completing privilege renewals
 * PATCH /privileges/:id/renew - Approve or deny privilege renewal
 */

import { Router, Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { z } from 'zod';
import { evaluateRenewalCriteria } from '../../../services/privileging/renewalEngine';
import { logRenewalCompleted } from '../../../services/audit/privilegeRenewalEvents';

const router = Router();
const prisma = new PrismaClient();

// Validation schema
const RenewalDecisionSchema = z.object({
  renewalId: z.string().min(1, 'Renewal ID is required'),
  approved: z.boolean(),
  reviewerDid: z.string().min(1, 'Reviewer DID is required'),
  reviewNotes: z.string().optional(),
  currentEvidenceIds: z.array(z.string()).optional(), // Updated evidence for renewal
});

/**
 * PATCH /privileges/:id/renew
 * Complete a privilege renewal (approve or deny)
 */
router.patch('/:id/renew', async (req: Request, res: Response) => {
  try {
    const { id } = req.params; // This is privilegeGrantedId

    console.info(`[PrivilegeRenewal] Processing renewal for privilege ${id}`);

    // Validate request body
    const validationResult = RenewalDecisionSchema.safeParse(req.body);

    if (!validationResult.success) {
      return res.status(400).json({
        error: 'Validation failed',
        details: validationResult.error.errors,
      });
    }

    const data = validationResult.data;

    // Fetch the privilege
    const privilegeGranted = await prisma.privilegeGranted.findUnique({
      where: { id },
      include: {
        privilegeRequest: {
          include: {
            privilegeSet: true,
          },
        },
        renewals: {
          where: {
            id: data.renewalId,
          },
        },
      },
    });

    if (!privilegeGranted) {
      return res.status(404).json({
        error: 'Privilege not found',
      });
    }

    // Find the renewal record
    const renewal = privilegeGranted.renewals.find((r) => r.id === data.renewalId);

    if (!renewal) {
      return res.status(404).json({
        error: 'Renewal record not found',
      });
    }

    if (renewal.status !== 'PENDING' && renewal.status !== 'OVERDUE') {
      return res.status(400).json({
        error: 'Renewal is not in a reviewable state',
        currentStatus: renewal.status,
      });
    }

    // Evaluate renewal criteria if evidence provided
    let criteriaResult = null;
    if (data.currentEvidenceIds && data.currentEvidenceIds.length > 0) {
      criteriaResult = await evaluateRenewalCriteria(
        privilegeGranted.id,
        data.currentEvidenceIds
      );
    }

    // Update renewal record
    const updatedRenewal = await prisma.privilegeRenewal.update({
      where: { id: data.renewalId },
      data: {
        status: 'COMPLETE',
        renewalCriteriaMet: data.approved,
        renewalCriteriaDetails: criteriaResult,
        reviewerDid: data.reviewerDid,
        reviewNotes: data.reviewNotes,
        completedAt: new Date(),
      },
    });

    // If approved, extend privilege expiration
    if (data.approved) {
      // Calculate new expiration date (e.g., 2 years from now)
      const newExpirationDate = new Date();
      newExpirationDate.setFullYear(newExpirationDate.getFullYear() + 2);

      const newRenewalDue = new Date(newExpirationDate);
      newRenewalDue.setDate(newRenewalDue.getDate() - 90); // 90 days before expiration

      await prisma.privilegeGranted.update({
        where: { id: privilegeGranted.id },
        data: {
          expiresAt: newExpirationDate,
          renewalDue: newRenewalDue,
          status: 'ACTIVE',
          updatedAt: new Date(),
        },
      });

      // Create next renewal record for future cycle
      const nextRenewal = await prisma.privilegeRenewal.create({
        data: {
          privilegeGrantedId: privilegeGranted.id,
          dueDate: newExpirationDate,
          status: 'PENDING',
          notificationsSent: 0,
        },
      });

      // Link current renewal to next cycle
      await prisma.privilegeRenewal.update({
        where: { id: data.renewalId },
        data: {
          nextRenewalId: nextRenewal.id,
        },
      });
    } else {
      // If denied, suspend privilege
      await prisma.privilegeGranted.update({
        where: { id: privilegeGranted.id },
        data: {
          status: 'SUSPENDED',
          revocationReason: data.reviewNotes || 'Renewal denied',
          updatedAt: new Date(),
        },
      });
    }

    // Log audit event
    await logRenewalCompleted(
      data.renewalId,
      privilegeGranted.id,
      privilegeGranted.clinicianDid,
      privilegeGranted.orgId,
      data.reviewerDid,
      data.approved,
      data.reviewNotes
    );

    // Send notification to clinician and org
    await sendRenewalDecisionNotification(
      privilegeGranted.orgId,
      privilegeGranted.clinicianDid,
      privilegeGranted.id,
      data.renewalId,
      data.approved,
      data.reviewNotes
    );

    res.json({
      success: true,
      message: data.approved ? 'Renewal approved' : 'Renewal denied',
      renewal: {
        id: updatedRenewal.id,
        privilegeGrantedId: privilegeGranted.id,
        status: updatedRenewal.status,
        approved: data.approved,
        reviewerDid: data.reviewerDid,
        reviewNotes: data.reviewNotes,
        renewalCriteriaMet: updatedRenewal.renewalCriteriaMet,
        renewalCriteriaDetails: updatedRenewal.renewalCriteriaDetails,
        completedAt: updatedRenewal.completedAt,
      },
      privilegeStatus: data.approved ? 'ACTIVE' : 'SUSPENDED',
      ...(data.approved && {
        newExpirationDate: (await prisma.privilegeGranted.findUnique({
          where: { id: privilegeGranted.id },
          select: { expiresAt: true },
        }))?.expiresAt,
      }),
    });
  } catch (error) {
    console.error('Error completing renewal:', error);
    res.status(500).json({
      error: 'Failed to complete renewal',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * GET /privileges/:id/renewals
 * Get renewal history for a privilege
 */
router.get('/:id/renewals', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const renewals = await prisma.privilegeRenewal.findMany({
      where: {
        privilegeGrantedId: id,
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    res.json({
      success: true,
      count: renewals.length,
      renewals: renewals.map((r) => ({
        id: r.id,
        dueDate: r.dueDate,
        status: r.status,
        notificationsSent: r.notificationsSent,
        lastNotifiedAt: r.lastNotifiedAt,
        renewalCriteriaMet: r.renewalCriteriaMet,
        reviewerDid: r.reviewerDid,
        completedAt: r.completedAt,
        createdAt: r.createdAt,
      })),
    });
  } catch (error) {
    console.error('Error fetching renewal history:', error);
    res.status(500).json({
      error: 'Failed to fetch renewal history',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * GET /privileges/renewals/pending
 * Get all pending renewals (org admin view)
 */
router.get('/renewals/pending', async (req: Request, res: Response) => {
  try {
    const { orgId } = req.query;

    const where: any = {
      status: {
        in: ['PENDING', 'OVERDUE'],
      },
    };

    if (orgId) {
      where.privilegeGranted = {
        orgId: orgId as string,
      };
    }

    const pendingRenewals = await prisma.privilegeRenewal.findMany({
      where,
      include: {
        privilegeGranted: {
          include: {
            privilegeRequest: {
              include: {
                privilegeSet: {
                  select: {
                    id: true,
                    name: true,
                    department: true,
                  },
                },
              },
            },
          },
        },
      },
      orderBy: {
        dueDate: 'asc',
      },
    });

    // Calculate days until due for each
    const now = new Date();
    const renewalsWithDaysUntilDue = pendingRenewals.map((renewal) => ({
      id: renewal.id,
      privilegeGrantedId: renewal.privilegeGrantedId,
      clinicianDid: renewal.privilegeGranted.clinicianDid,
      orgId: renewal.privilegeGranted.orgId,
      privilegeSet: renewal.privilegeGranted.privilegeRequest.privilegeSet,
      dueDate: renewal.dueDate,
      status: renewal.status,
      notificationsSent: renewal.notificationsSent,
      lastNotifiedAt: renewal.lastNotifiedAt,
      daysUntilDue: Math.ceil((renewal.dueDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)),
      isOverdue: renewal.status === 'OVERDUE',
    }));

    res.json({
      success: true,
      count: renewalsWithDaysUntilDue.length,
      pendingRenewals: renewalsWithDaysUntilDue,
    });
  } catch (error) {
    console.error('Error fetching pending renewals:', error);
    res.status(500).json({
      error: 'Failed to fetch pending renewals',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * Send renewal decision notification
 */
async function sendRenewalDecisionNotification(
  orgId: string,
  clinicianDid: string,
  privilegeGrantedId: string,
  renewalId: string,
  approved: boolean,
  reviewNotes?: string
): Promise<void> {
  // TODO: Integrate with notification service
  console.info('[PrivilegeRenewal] NOTIFICATION:', {
    type: 'RENEWAL_DECISION',
    orgId,
    clinicianDid,
    privilegeGrantedId,
    renewalId,
    approved,
    reviewNotes,
    message: approved
      ? 'Privilege renewal approved - privilege extended'
      : 'Privilege renewal denied - privilege suspended',
  });

  // In production, send:
  // 1. Email to clinician
  // 2. Notification to org admin
  // 3. Update credentialing dashboard
}

export { router as privilegeRenewalRouter };


/**
 * B135A-PRIV-004: API endpoint for requesting temporary privileges
 * POST /privileges/temp - Create temporary/emergency privilege requests
 */

import { Router, Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { z } from 'zod';
import {
  validateTemporaryPrivilegeRequest,
  calculateTemporaryEndDate,
  validateEmergencyCriteria,
  MAX_TEMPORARY_DAYS,
  TemporaryPrivilegeRequest
} from '../../../services/privileging/tempPrivileges';
import { logTemporaryPrivilegeGranted } from '../../../services/audit/privilegeRenewalEvents';
import crypto from 'crypto';

const router = Router();
const prisma = new PrismaClient();

// Validation schema
const TempPrivilegeRequestSchema = z.object({
  orgId: z.string().min(1, 'Organization ID is required'),
  clinicianDid: z.string().min(1, 'Clinician DID is required'),
  privilegeSetId: z.string().min(1, 'Privilege Set ID is required'),
  emergencyReason: z.string().min(20, 'Emergency reason must be at least 20 characters'),
  requestedDurationDays: z.number().int().min(1).max(MAX_TEMPORARY_DAYS),
  evidenceIds: z.array(z.string()).optional(),
  evidenceBundle: z.any().optional(),
  emergencyCriteria: z.object({
    hospitalDisasterMode: z.boolean().optional(),
    naturalDisaster: z.boolean().optional(),
    pandemicEmergency: z.boolean().optional(),
    criticalStaffShortage: z.boolean().optional(),
    specificEmergencyType: z.string().optional(),
  }).optional(),
});

/**
 * POST /privileges/temp
 * Request temporary/emergency privileges (max 120 days)
 */
router.post('/temp', async (req: Request, res: Response) => {
  try {
    console.info('[TempPrivileges] Received temporary privilege request');

    // Validate request body
    const validationResult = TempPrivilegeRequestSchema.safeParse(req.body);

    if (!validationResult.success) {
      return res.status(400).json({
        error: 'Validation failed',
        details: validationResult.error.errors,
      });
    }

    const data = validationResult.data;

    // Validate temporary privilege rules
    const tempValidation = validateTemporaryPrivilegeRequest({
      orgId: data.orgId,
      clinicianDid: data.clinicianDid,
      privilegeSetId: data.privilegeSetId,
      emergencyReason: data.emergencyReason,
      requestedDurationDays: data.requestedDurationDays,
      evidenceIds: data.evidenceIds,
      evidenceBundle: data.evidenceBundle,
    });

    if (!tempValidation.isValid) {
      return res.status(400).json({
        error: 'Temporary privilege validation failed',
        errors: tempValidation.errors,
        warnings: tempValidation.warnings,
      });
    }

    // Validate emergency criteria
    const emergencyCriteriaValid = validateEmergencyCriteria(
      data.emergencyReason,
      data.emergencyCriteria
    );

    if (!emergencyCriteriaValid) {
      return res.status(400).json({
        error: 'Emergency criteria not met',
        message: 'Temporary privileges require valid emergency justification',
      });
    }

    // Fetch privilege set
    const privilegeSet = await prisma.privilegeSet.findUnique({
      where: { id: data.privilegeSetId },
    });

    if (!privilegeSet) {
      return res.status(404).json({
        error: 'Privilege set not found',
      });
    }

    if (!privilegeSet.isActive) {
      return res.status(400).json({
        error: 'Privilege set is not active',
      });
    }

    // Verify organization matches
    if (privilegeSet.orgId !== data.orgId) {
      return res.status(400).json({
        error: 'Privilege set does not belong to specified organization',
      });
    }

    // Calculate end date
    const startDate = new Date();
    const temporaryEndDate = calculateTemporaryEndDate(startDate, data.requestedDurationDays);

    // Create privilege request (marked as temporary)
    const privilegeRequest = await prisma.privilegeRequest.create({
      data: {
        orgId: data.orgId,
        clinicianDid: data.clinicianDid,
        privilegeSetId: data.privilegeSetId,
        evidenceIds: data.evidenceIds || [],
        evidenceBundle: data.evidenceBundle,
        status: 'UNDER_REVIEW', // Temporary privileges go through expedited review
      },
    });

    // Create temporary privilege grant (fast-track approval)
    const privilegeGranted = await prisma.privilegeGranted.create({
      data: {
        privilegeRequestId: privilegeRequest.id,
        orgId: data.orgId,
        clinicianDid: data.clinicianDid,
        privilegeSetId: data.privilegeSetId,
        status: 'ACTIVE',
        grantedAt: startDate,
        expiresAt: temporaryEndDate,
        isTemporary: true,
        temporaryEndDate: temporaryEndDate,
        emergencyReason: data.emergencyReason,
      },
    });

    // Generate evidence hash
    const evidenceHash = crypto
      .createHash('sha256')
      .update(JSON.stringify({
        emergencyReason: data.emergencyReason,
        emergencyCriteria: data.emergencyCriteria,
        durationDays: data.requestedDurationDays,
      }))
      .digest('hex');

    // Create audit event
    await logTemporaryPrivilegeGranted(
      privilegeGranted.id,
      data.clinicianDid,
      data.orgId,
      data.emergencyReason,
      data.requestedDurationDays
    );

    // Send notifications to organization and compliance team
    await sendTemporaryPrivilegeNotifications(
      data.orgId,
      data.clinicianDid,
      privilegeGranted.id,
      data.emergencyReason,
      temporaryEndDate
    );

    res.status(201).json({
      success: true,
      message: 'Temporary privilege granted',
      privilegeGranted: {
        id: privilegeGranted.id,
        orgId: privilegeGranted.orgId,
        clinicianDid: privilegeGranted.clinicianDid,
        privilegeSetId: privilegeGranted.privilegeSetId,
        status: privilegeGranted.status,
        isTemporary: privilegeGranted.isTemporary,
        grantedAt: privilegeGranted.grantedAt,
        expiresAt: privilegeGranted.expiresAt,
        temporaryEndDate: privilegeGranted.temporaryEndDate,
        emergencyReason: privilegeGranted.emergencyReason,
        durationDays: data.requestedDurationDays,
        evidenceHash,
      },
      warnings: tempValidation.warnings,
    });
  } catch (error) {
    console.error('Error creating temporary privilege:', error);
    res.status(500).json({
      error: 'Failed to create temporary privilege',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * GET /privileges/temp/active
 * Get all active temporary privileges (org admin view)
 */
router.get('/temp/active', async (req: Request, res: Response) => {
  try {
    const { orgId } = req.query;

    const where: any = {
      isTemporary: true,
      status: 'ACTIVE',
    };

    if (orgId) {
      where.orgId = orgId;
    }

    const tempPrivileges = await prisma.privilegeGranted.findMany({
      where,
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
      orderBy: { temporaryEndDate: 'asc' },
    });

    // Calculate days remaining for each
    const now = new Date();
    const privilegesWithDaysRemaining = tempPrivileges.map((priv) => ({
      id: priv.id,
      orgId: priv.orgId,
      clinicianDid: priv.clinicianDid,
      privilegeSet: priv.privilegeRequest.privilegeSet,
      status: priv.status,
      grantedAt: priv.grantedAt,
      expiresAt: priv.expiresAt,
      temporaryEndDate: priv.temporaryEndDate,
      emergencyReason: priv.emergencyReason,
      daysRemaining: priv.temporaryEndDate
        ? Math.ceil((priv.temporaryEndDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
        : null,
    }));

    res.json({
      success: true,
      count: privilegesWithDaysRemaining.length,
      tempPrivileges: privilegesWithDaysRemaining,
    });
  } catch (error) {
    console.error('Error fetching active temporary privileges:', error);
    res.status(500).json({
      error: 'Failed to fetch temporary privileges',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * Send notifications about temporary privilege grant
 */
async function sendTemporaryPrivilegeNotifications(
  orgId: string,
  clinicianDid: string,
  privilegeGrantedId: string,
  emergencyReason: string,
  expiresAt: Date
): Promise<void> {
  // TODO: Integrate with notification service
  console.warn('[TempPrivileges] NOTIFICATION:', {
    type: 'TEMPORARY_PRIVILEGE_GRANTED',
    orgId,
    clinicianDid,
    privilegeGrantedId,
    emergencyReason,
    expiresAt,
    message: 'Temporary privilege granted under emergency criteria',
  });

  // In production, send:
  // 1. Email to org admin and compliance team
  // 2. Alert to credentialing staff
  // 3. Calendar reminder for expiration
}

export { router as tempPrivilegeRequestRouter };


/**
 * B134A-PRIV-004: API endpoint for clinicians to request privileges
 * POST /privileges/request
 */

import { Router, Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { z } from 'zod';
import { RequirementsEngine, parseEvidenceFromRequest } from '../../services/privileging/requirementsEngine';
import { onPrivilegeRequested } from '../../services/privileging/hooks/onPrivilegeRequested';
import crypto from 'crypto';

const router = Router();
const prisma = new PrismaClient();

// Validation schema
const PrivilegeRequestSchema = z.object({
  orgId: z.string().min(1, 'Organization ID is required'),
  clinicianDid: z.string().min(1, 'Clinician DID is required'),
  privilegeSetId: z.string().min(1, 'Privilege Set ID is required'),
  evidenceIds: z.array(z.string()).min(1, 'At least one evidence credential is required'),
  evidenceBundle: z.any().optional(), // Full VC bundle
});

/**
 * POST /privileges/request
 * Submit a privilege request with VC evidence bundle
 */
router.post('/request', async (req: Request, res: Response) => {
  try {
    // Validate request body
    const validationResult = PrivilegeRequestSchema.safeParse(req.body);

    if (!validationResult.success) {
      return res.status(400).json({
        error: 'Validation failed',
        details: validationResult.error.errors,
      });
    }

    const data = validationResult.data;

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

    // Validate VC bundle - ensure all credentials exist and are active
    const credentials = await prisma.credential.findMany({
      where: {
        id: { in: data.evidenceIds },
        status: 'active',
      },
    });

    if (credentials.length !== data.evidenceIds.length) {
      return res.status(400).json({
        error: 'One or more credentials are invalid or inactive',
        providedCount: data.evidenceIds.length,
        validCount: credentials.length,
      });
    }

    // Parse evidence bundle
    const evidenceBundle = await parseEvidenceFromRequest(
      data.evidenceIds,
      data.evidenceBundle
    );

    // Run preliminary requirements check
    const requirementsCheck = await RequirementsEngine.evaluateRequirements(
      privilegeSet.requirements as any,
      evidenceBundle
    );

    // Generate evidence hash for anchoring
    const evidenceHash = crypto
      .createHash('sha256')
      .update(JSON.stringify(data.evidenceBundle || data.evidenceIds))
      .digest('hex');

    // Create privilege request
    const privilegeRequest = await prisma.privilegeRequest.create({
      data: {
        orgId: data.orgId,
        clinicianDid: data.clinicianDid,
        privilegeSetId: data.privilegeSetId,
        evidenceIds: data.evidenceIds,
        evidenceBundle: data.evidenceBundle,
        status: 'PENDING',
      },
    });

    // Anchor evidence hash on-chain (optional, based on config)
    let chainTxHash: string | undefined;
    if (process.env.ANCHOR_PRIVILEGE_REQUESTS === 'true') {
      chainTxHash = await anchorEvidenceHash(evidenceHash);
    }

    // Create audit event
    await prisma.auditEvent.create({
      data: {
        type: 'PRIVILEGE_REQUEST_SUBMITTED',
        data: {
          privilegeRequestId: privilegeRequest.id,
          orgId: data.orgId,
          clinicianDid: data.clinicianDid,
          privilegeSetId: data.privilegeSetId,
          evidenceCount: data.evidenceIds.length,
          evidenceHash,
          requirementsPreCheck: {
            passed: requirementsCheck.passed,
            reasons: requirementsCheck.reasons,
          },
        },
        chainTxHash,
      },
    });

    // B148B-HOOK-001: Trigger hook to create notification for org admins
    onPrivilegeRequested({
      privilegeRequestId: privilegeRequest.id,
      orgId: data.orgId,
      clinicianDid: data.clinicianDid,
      privilegeSetId: data.privilegeSetId,
    }).catch((error) => {
      console.error('[PrivilegeRequest] Hook error:', error);
    });

    res.status(201).json({
      success: true,
      privilegeRequest: {
        id: privilegeRequest.id,
        orgId: privilegeRequest.orgId,
        clinicianDid: privilegeRequest.clinicianDid,
        privilegeSetId: privilegeRequest.privilegeSetId,
        status: privilegeRequest.status,
        evidenceHash,
        chainTxHash,
        requirementsPreCheck: {
          passed: requirementsCheck.passed,
          reasons: requirementsCheck.reasons,
          details: requirementsCheck.details,
        },
        createdAt: privilegeRequest.createdAt,
      },
    });
  } catch (error) {
    console.error('Error submitting privilege request:', error);
    res.status(500).json({
      error: 'Failed to submit privilege request',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * GET /privileges/request/:id
 * Get privilege request details
 */
router.get('/request/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const privilegeRequest = await prisma.privilegeRequest.findUnique({
      where: { id },
      include: {
        privilegeSet: true,
        fppeOppe: true,
      },
    });

    if (!privilegeRequest) {
      return res.status(404).json({
        error: 'Privilege request not found',
      });
    }

    res.json({
      success: true,
      privilegeRequest: {
        id: privilegeRequest.id,
        orgId: privilegeRequest.orgId,
        clinicianDid: privilegeRequest.clinicianDid,
        privilegeSet: {
          id: privilegeRequest.privilegeSet.id,
          name: privilegeRequest.privilegeSet.name,
          department: privilegeRequest.privilegeSet.department,
        },
        status: privilegeRequest.status,
        evidenceIds: privilegeRequest.evidenceIds,
        reviewerDid: privilegeRequest.reviewerDid,
        reviewNotes: privilegeRequest.reviewNotes,
        reviewedAt: privilegeRequest.reviewedAt,
        fppeOppe: privilegeRequest.fppeOppe,
        createdAt: privilegeRequest.createdAt,
        updatedAt: privilegeRequest.updatedAt,
      },
    });
  } catch (error) {
    console.error('Error fetching privilege request:', error);
    res.status(500).json({
      error: 'Failed to fetch privilege request',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * GET /privileges/clinician/:did
 * Get all privilege requests for a clinician
 */
router.get('/clinician/:did', async (req: Request, res: Response) => {
  try {
    const { did } = req.params;
    const { status, orgId } = req.query;

    const where: any = {
      clinicianDid: did,
    };

    if (status) {
      where.status = status;
    }

    if (orgId) {
      where.orgId = orgId;
    }

    const requests = await prisma.privilegeRequest.findMany({
      where,
      include: {
        privilegeSet: {
          select: {
            id: true,
            name: true,
            department: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    res.json({
      success: true,
      requests: requests.map((req) => ({
        id: req.id,
        orgId: req.orgId,
        privilegeSet: req.privilegeSet,
        status: req.status,
        reviewedAt: req.reviewedAt,
        createdAt: req.createdAt,
      })),
    });
  } catch (error) {
    console.error('Error fetching clinician requests:', error);
    res.status(500).json({
      error: 'Failed to fetch privilege requests',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * Anchor evidence hash on blockchain
 */
async function anchorEvidenceHash(hash: string): Promise<string> {
  // TODO: Implement actual blockchain anchoring
  // This would use Substrate/Polkadot or Ethereum

  // For now, return a mock transaction hash
  return `0x${crypto.randomBytes(32).toString('hex')}`;
}

export { router as privilegeRequestRouter };


/**
 * S72-D3-A-005: OrgPolicyAcceptance MVP API
 * POST /demo/org/accept-policy
 */

import { Router, Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { requireAuth } from '../../../../../backend/src/middleware/accessGuards';
import { requireOrgAdmin } from '../../../../middleware/requireOrgAdmin';

const router = Router();
const prisma = new PrismaClient();

/**
 * POST /demo/org/accept-policy
 * Stores policy acceptance with orgId, userId, policyVersionId, acceptedAt
 * Logs audit event
 *
 * Request body:
 * {
 *   orgId: string,
 *   policyVersionId: string
 * }
 *
 * Response:
 * {
 *   acceptanceId: string,
 *   acceptedAt: string
 * }
 */
router.post(
  '/demo/org/accept-policy',
  requireAuth,
  requireOrgAdmin,
  async (req: Request, res: Response) => {
    try {
      const { orgId, policyVersionId } = req.body;
      const authReq = req as any; // AuthenticatedRequest from requireAuth

      if (!orgId || !policyVersionId) {
        return res.status(400).json({ error: 'orgId and policyVersionId are required' });
      }

      // Verify policy version exists
      const policyVersion = await prisma.platformPolicyVersion.findUnique({
        where: { id: policyVersionId },
      });

      if (!policyVersion) {
        return res.status(404).json({ error: 'Policy version not found' });
      }

      // Check if already accepted
      const existingAcceptance = await prisma.orgPolicyAcceptance.findUnique({
        where: {
          orgId_policyVersionId: {
            orgId,
            policyVersionId,
          },
        },
      });

      if (existingAcceptance) {
        return res.status(200).json({
          acceptanceId: existingAcceptance.id,
          acceptedAt: existingAcceptance.acceptedAt.toISOString(),
          message: 'Policy already accepted',
        });
      }

      // Get user info for audit
      const user = await prisma.user.findUnique({
        where: { id: String(authReq.user.id) },
      });

      // Create acceptance
      const acceptance = await prisma.orgPolicyAcceptance.create({
        data: {
          orgId,
          policyVersionId,
          acceptedBy: String(authReq.user.id),
          acceptedByName: user?.name || user?.email || 'Unknown',
          ipAddress: req.ip || req.headers['x-forwarded-for'] as string || undefined,
          userAgent: req.headers['user-agent'] || undefined,
        },
      });

      // Log audit event
      await prisma.auditEvent.create({
        data: {
          type: 'POLICY_ACCEPTED',
          userId: String(authReq.user.id),
          data: {
            orgId,
            policyVersionId,
            policyName: policyVersion.name,
            policyVersion: policyVersion.version,
            acceptanceId: acceptance.id,
          },
        },
      });

      res.status(200).json({
        acceptanceId: acceptance.id,
        acceptedAt: acceptance.acceptedAt.toISOString(),
        message: 'Policy accepted successfully',
      });
    } catch (error: any) {
      console.error('Error in /demo/org/accept-policy:', error);
      res.status(500).json({ error: 'Failed to accept policy' });
    }
  }
);

export default router;


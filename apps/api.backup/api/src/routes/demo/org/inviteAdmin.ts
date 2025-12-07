/**
 * S72-D3-A-003: OrgAdmin invite API (email-only, demo mode stub)
 * POST /demo/org/invite-admin
 */

import { Router, Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { requireAuth } from '../../../../../backend/src/middleware/accessGuards';
import { requireOrgAdmin } from '../../../../middleware/requireOrgAdmin';
import { OrgMembershipRole, upsertOrgMembership } from '../../../../../services/org/models/OrgMembership';

const router = Router();
const prisma = new PrismaClient();

/**
 * POST /demo/org/invite-admin
 * Upserts an OrgMembership with ADMIN role and a demo user stub
 * Returns a fake invite URL with token
 *
 * Request body:
 * {
 *   email: string,
 *   orgId: string
 * }
 *
 * Response:
 * {
 *   inviteUrl: string,
 *   token: string
 * }
 */
router.post(
  '/demo/org/invite-admin',
  requireAuth,
  requireOrgAdmin,
  async (req: Request, res: Response) => {
    try {
      const { email, orgId } = req.body;

      if (!email || !orgId) {
        return res.status(400).json({ error: 'Email and orgId are required' });
      }

      // Validate email format
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(email)) {
        return res.status(400).json({ error: 'Invalid email format' });
      }

      // Check if user exists, create stub if not
      let user = await prisma.user.findUnique({
        where: { email },
      });

      if (!user) {
        // Create demo user stub
        user = await prisma.user.create({
          data: {
            email,
            name: email.split('@')[0], // Use email prefix as name
          },
        });
      }

      // Check if link already exists
      await upsertOrgMembership(user.id, orgId, OrgMembershipRole.ADMIN);

      // Generate fake token (demo mode)
      const token = `demo-invite-${Date.now()}-${Math.random().toString(36).substring(7)}`;
      const inviteUrl = `${process.env.FRONTEND_URL || 'http://localhost:3000'}/demo/org/invite?token=${token}`;

      res.status(200).json({
        inviteUrl,
        token,
        message: 'Admin invite created successfully',
      });
    } catch (error: any) {
      console.error('Error in /demo/org/invite-admin:', error);
      res.status(500).json({ error: 'Failed to create admin invite' });
    }
  }
);

export default router;


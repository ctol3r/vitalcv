/**
 * S72-D3-A-002: requireOrgAdmin middleware
 * Middleware to require user to be an organization admin
 */

import { NextFunction, Request, Response } from 'express';
import { OrgMembershipRole, PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

/**
 * Extended Request type with user and org information
 */
export interface OrgAdminRequest extends Request {
  user?: {
    id: string | number;
    email: string;
    roles: string[];
  };
  orgId?: string;
}

/**
 * Require user to be an organization admin.
 * Expects:
 * - req.user to be set (from authentication middleware)
 * - req.orgId or req.body.orgId or req.params.orgId to contain the organization ID
 */
export function requireOrgAdmin(req: Request, res: Response, next: NextFunction) {
  const orgReq = req as OrgAdminRequest;

  // Check authentication
  if (!orgReq.user) {
    return res.status(401).json({ error: 'Authentication required' });
  }

  // Get orgId from various sources
  const orgId = orgReq.orgId || orgReq.body.orgId || orgReq.params.orgId || orgReq.query.orgId;

  if (!orgId) {
    return res.status(400).json({ error: 'Organization ID required' });
  }

  // Check if user is linked to org and is admin
  prisma.orgMembership
    .findUnique({
      where: {
        userId_orgId: {
          userId: String(orgReq.user.id),
          orgId: orgId as string,
        },
      },
    })
    .then((membership) => {
      if (!membership) {
        return res.status(403).json({
          error: 'Access denied',
          details: 'User is not linked to this organization',
        });
      }

      if (membership.role !== OrgMembershipRole.ADMIN) {
        return res.status(403).json({
          error: 'Access denied',
          details: 'Organization admin access required',
        });
      }

      // User is admin, continue
      // Store orgId in request for downstream handlers
      orgReq.orgId = orgId as string;
      next();
    })
    .catch((error) => {
      console.error('Error checking org admin status:', error);
      return res.status(500).json({ error: 'Failed to verify organization admin status' });
    });
}

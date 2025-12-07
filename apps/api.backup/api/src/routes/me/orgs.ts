import { Router, Request, Response } from 'express';
import {
  AuthenticatedRequest,
  loadUserSession,
  requireAuth,
} from '../../../../backend/src/middleware/accessGuards';
import { listMembershipsForUser } from '../../../../services/org/models/OrgMembership';

const router = Router();

router.get('/me/orgs', loadUserSession, requireAuth, async (req: Request, res: Response) => {
  try {
    const authReq = req as AuthenticatedRequest;
    const userId = String(authReq.user!.id);

    const memberships = await listMembershipsForUser(userId);

    return res.json({
      orgs: memberships.map((membership) => ({
        orgId: membership.orgId,
        name:
          membership.org?.partnerName ||
          membership.org?.partnerId ||
          membership.orgId,
        role: membership.role,
      })),
    });
  } catch (error) {
    console.error('[GET /me/orgs] Failed to load memberships', error);
    return res.status(500).json({
      error: 'failed_to_list_orgs',
      message: 'Unable to load organization memberships',
    });
  }
});

export default router;

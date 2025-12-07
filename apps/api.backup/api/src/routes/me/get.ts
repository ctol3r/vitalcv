import { Router, Request, Response } from 'express';
import { PrismaClient, UserRole } from '@prisma/client';

const router = Router();
const prisma = new PrismaClient();

function serializeUser(user: {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  demoUser: boolean;
  createdAt: Date;
}) {
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    role: user.role,
    demoUser: user.demoUser,
    createdAt: user.createdAt.toISOString(),
  };
}

router.get('/', async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.id || (req as any).userId;

    if (!userId) {
      return res.status(401).json({
        error: 'UNAUTHORIZED',
        message: 'Active session required',
      });
    }

    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: {
        clinicianProfile: true,
        didLinks: true,
      },
    });

    if (!user) {
      return res.status(404).json({
        error: 'NOT_FOUND',
        message: 'User not found',
      });
    }

    let orgProfile = null;
    if (user.role === UserRole.ORG_ADMIN) {
      const orgLink = await prisma.userOrgLink.findFirst({
        where: { userId: user.id },
        orderBy: { createdAt: 'desc' },
      });

      if (orgLink) {
        orgProfile = await prisma.orgProfile.findUnique({
          where: { orgId: orgLink.orgId },
        });
      }
    }

    return res.json({
      user: serializeUser(user),
      clinicianProfile: user.role === UserRole.CLINICIAN ? user.clinicianProfile : null,
      orgProfile,
      dids: user.didLinks.map((link) => ({
        did: link.did,
        linkedAt: link.createdAt.toISOString(),
      })),
    });
  } catch (error) {
    console.error('[GET /me] Failed to load current user', error);
    return res.status(500).json({
      error: 'INTERNAL_ERROR',
      message: 'Failed to load profile',
    });
  }
});

export default router;


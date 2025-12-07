import { Router, Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { RevalidationTaskStatus } from '../../../../services/revalidation/models/RevalidationTask.js';

const prisma = new PrismaClient();
const router = Router();

const ALLOWED_ROLES = new Set(['admin', 'org_admin', 'credentialing_specialist', 'revalidation_viewer']);

interface AuthenticatedRequest extends Request {
  user?: {
    id: string;
    roles?: string[];
  };
}

router.get('/:clinicianId', async (req: AuthenticatedRequest, res: Response) => {
  const { clinicianId } = req.params;
  const user = req.user;

  if (!user) {
    return res.status(401).json({
      error: 'UNAUTHORIZED',
      message: 'Active session required',
    });
  }

  const isSelf = user.id === clinicianId;
  const hasRole = (user.roles || []).some((role) => ALLOWED_ROLES.has(role));

  if (!isSelf && !hasRole) {
    return res.status(403).json({
      error: 'FORBIDDEN',
      message: 'Only credentialing roles may view revalidation tasks for other clinicians',
    });
  }

  const tasks = await prisma.revalidationTask.findMany({
    where: {
      clinicianId,
      status: {
        in: [
          RevalidationTaskStatus.OPEN,
          RevalidationTaskStatus.IN_PROGRESS,
          RevalidationTaskStatus.OVERDUE,
        ],
      },
    },
    orderBy: [{ dueDate: 'asc' }],
  });

  return res.status(200).json({
    clinicianId,
    count: tasks.length,
    tasks: tasks.map((task) => ({
      id: task.id,
      type: task.type,
      status: task.status,
      source: task.source,
      dueDate: task.dueDate?.toISOString(),
      notes: task.notes,
      metadata: task.metadata,
      lastNotifiedAt: task.lastNotifiedAt?.toISOString() ?? null,
      notificationCount: task.notificationCount,
    })),
  });
});

export default router;


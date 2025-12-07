import { Router, Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import {
  AuthenticatedRequest,
  loadUserSession,
  requireAuth,
} from '../../../../../backend/src/middleware/accessGuards';
import { listClinicianTasks } from '../../../../../services/revalidation/revalidationTaskService.js';
import { serializeRevalidationTask } from '../../../../../services/revalidation/models/RevalidationTask.js';

const router = Router();
const prisma = new PrismaClient();
const ADMIN_ROLES = new Set(['ORG_ADMIN', 'INTERNAL_ADMIN']);

router.use(loadUserSession, requireAuth);

router.get('/:clinicianId', async (req: Request, res: Response) => {
  const clinicianId = req.params.clinicianId;
  const authReq = req as AuthenticatedRequest;
  const user = authReq.user;

  if (!clinicianId) {
    return res.status(400).json({
      success: false,
      error: 'clinicianId_required',
    });
  }

  try {
    const clinician = await prisma.clinicianProfile.findUnique({
      where: { id: clinicianId },
      select: { id: true, userId: true },
    });

    if (!clinician) {
      return res.status(200).json({
        success: true,
        clinicianId,
        tasks: [],
        count: 0,
        warning: 'CLINICIAN_NOT_FOUND',
      });
    }

    const roles = user?.roles ?? [];
    const isAdmin = roles.some((role) => ADMIN_ROLES.has(role));
    const isSelf = user?.id === clinician.userId;

    if (!isAdmin && !isSelf) {
      return res.status(403).json({
        success: false,
        error: 'forbidden',
        message: 'Only clinician owners or org/internal admins can view revalidation tasks.',
      });
    }

    const tasks = await listClinicianTasks(clinicianId);

    return res.status(200).json({
      success: true,
      clinicianId,
      count: tasks.length,
      tasks: tasks.map(serializeRevalidationTask),
    });
  } catch (error) {
    console.error('Failed to list revalidation tasks', error);
    return res.status(500).json({
      success: false,
      error: 'internal_error',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

export default router;

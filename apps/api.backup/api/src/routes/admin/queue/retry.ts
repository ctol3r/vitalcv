import { Router, Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import {
  getJobById,
  markJobFailedFinal,
  resetJobToPending,
} from '../../../../../services/queue/models/JobQueue.js';
import type { JobQueueRecord } from '../../../../../services/queue/models/JobQueue.js';

const router = Router();
const prisma = new PrismaClient();

interface AdminRequest extends Request {
  user?: {
    id: string;
    roles: string[];
    email?: string;
  };
}

function requireAdmin(req: Request, res: Response, next: any) {
  const adminReq = req as AdminRequest;
  if (!adminReq.user || !Array.isArray(adminReq.user.roles)) {
    return res.status(401).json({ error: 'Authentication required' });
  }

  const isAdmin = adminReq.user.roles.some((role) =>
    ['ADMIN', 'admin', 'internal_admin'].includes(role)
  );

  if (!isAdmin) {
    return res.status(403).json({
      error: 'Insufficient permissions',
      message: 'Admin access required',
    });
  }

  return next();
}

function serializeJob(job: JobQueueRecord) {
  return {
    id: job.id,
    type: job.type,
    status: job.status,
    attempts: job.attempts,
    maxAttempts: job.maxAttempts,
    lastError: job.lastError,
    createdAt: job.createdAt.toISOString(),
    updatedAt: job.updatedAt.toISOString(),
    startedAt: job.startedAt?.toISOString() ?? null,
    completedAt: job.completedAt?.toISOString() ?? null,
  };
}

router.patch('/:id/retry', requireAdmin, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const job = await getJobById(id);

    if (!job) {
      return res.status(404).json({ error: 'JobNotFound' });
    }

    if (!['FAILED', 'FAILED_FINAL'].includes(job.status)) {
      return res.status(400).json({
        error: 'InvalidStatus',
        message: 'Only failed jobs can be retried',
      });
    }

    const updated = await resetJobToPending(id);

    await prisma.auditEvent.create({
      data: {
        type: 'QUEUE_JOB_RETRY',
        userId: (req as AdminRequest).user?.id,
        data: {
          jobId: id,
          previousStatus: job.status,
          attempts: job.attempts,
        },
      },
    });

    res.json({
      success: true,
      job: serializeJob(updated),
    });
  } catch (error: any) {
    console.error('[QueueRetry] Failed to retry job', error);
    res.status(500).json({
      error: 'RetryFailed',
      message: error?.message || 'Unable to retry job',
    });
  }
});

router.patch('/:id/mark-fail', requireAdmin, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { reason } = req.body || {};

    const job = await getJobById(id);
    if (!job) {
      return res.status(404).json({ error: 'JobNotFound' });
    }

    const updated = await markJobFailedFinal(id, reason || job.lastError || 'Marked failed by admin');

    await prisma.auditEvent.create({
      data: {
        type: 'QUEUE_JOB_FAILED_FINAL',
        userId: (req as AdminRequest).user?.id,
        data: {
          jobId: id,
          previousStatus: job.status,
          reason: reason || job.lastError,
        },
      },
    });

    res.json({
      success: true,
      job: serializeJob(updated),
    });
  } catch (error: any) {
    console.error('[QueueRetry] Failed to mark job failed', error);
    res.status(500).json({
      error: 'MarkFailedError',
      message: error?.message || 'Unable to mark job failed',
    });
  }
});

export default router;

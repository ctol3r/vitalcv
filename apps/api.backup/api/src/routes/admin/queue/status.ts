import { Router, Request, Response } from 'express';
import {
  getJobCountsByStatus,
  getOldestPendingJob,
} from '../../../../../services/queue/models/JobQueue.js';

const router = Router();
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

router.get('/status', requireAdmin, async (_req: Request, res: Response) => {
  try {
    const [counts, oldestPending] = await Promise.all([
      getJobCountsByStatus(),
      getOldestPendingJob(),
    ]);

    const workersRunning = Number(process.env.QUEUE_WORKERS || '1');
    const runningJobs = counts.RUNNING;

    res.json({
      statusCounts: counts,
      oldestPendingAt: oldestPending?.createdAt.toISOString() ?? null,
      workersRunning,
      runningJobs,
    });
  } catch (error: any) {
    console.error('[QueueStatus] Failed to load status', error);
    res.status(500).json({
      error: 'QueueStatusUnavailable',
      message: error?.message || 'Unable to get queue status',
    });
  }
});

export default router;

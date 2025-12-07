import { Router, Request, Response } from 'express';
import {
  getQueueHealthSnapshot,
  type QueueHealthSnapshot,
} from '../../../../../services/queue/models/JobQueue.js';
import { recordQueueHealth } from '../../../../../services/queue/metrics.js';

const router = Router();

interface AdminRequest extends Request {
  user?: {
    id: string;
    roles: string[];
  };
}

function requireAdmin(req: Request, res: Response, next: () => void) {
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

function serializeSnapshot(snapshot: QueueHealthSnapshot) {
  return {
    jobsRunning: snapshot.running,
    jobsWaiting: snapshot.waiting,
    deadLetterSize: snapshot.deadLetter,
    avgLatencyMs: snapshot.avgLatencyMs,
    latencySampleSize: snapshot.latencySampleSize,
    lastErrors: snapshot.lastErrors.map((entry) => ({
      id: entry.id,
      type: entry.type,
      attempts: entry.attempts,
      lastError: entry.lastError,
      updatedAt: entry.updatedAt.toISOString(),
    })),
  };
}

router.get('/health', requireAdmin, async (_req: Request, res: Response) => {
  try {
    const snapshot = await getQueueHealthSnapshot();
    recordQueueHealth(snapshot);

    res.json({
      ...serializeSnapshot(snapshot),
      refreshedAt: new Date().toISOString(),
    });
  } catch (error: any) {
    console.error('[QueueHealth] Failed to load queue health', error);
    res.status(500).json({
      error: 'QueueHealthUnavailable',
      message: error?.message ?? 'Unable to compute queue health snapshot',
    });
  }
});

export default router;



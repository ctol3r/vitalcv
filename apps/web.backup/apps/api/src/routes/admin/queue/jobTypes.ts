import { Router, Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { listQueueRoutes } from '../../../../../services/queue/router.js';

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
    ['ADMIN', 'admin', 'internal_admin'].includes(role),
  );

  if (!isAdmin) {
    return res.status(403).json({
      error: 'Insufficient permissions',
      message: 'Admin access required',
    });
  }

  return next();
}

router.get('/job-types', requireAdmin, async (_req: Request, res: Response) => {
  try {
    const routes = listQueueRoutes();

    const [dlqCounts, recentErrors] = await Promise.all([
      prisma.dLQJobQueue.groupBy({
        by: ['type'],
        _count: { _all: true },
      }),
      prisma.jobQueue.findMany({
        where: { lastError: { not: null } },
        orderBy: { updatedAt: 'desc' },
        take: 100,
      }),
    ]);

    const dlqMap = dlqCounts.reduce<Record<string, number>>((acc, entry) => {
      acc[entry.type] = entry._count._all;
      return acc;
    }, {});

    const errorMap = new Map<string, typeof recentErrors>();
    for (const job of recentErrors) {
      const bucket = errorMap.get(job.type) ?? [];
      if (bucket.length < 3) {
        bucket.push(job);
      }
      errorMap.set(job.type, bucket);
    }

    const payload = routes.map((route) => ({
      type: route.type,
      description: route.description,
      category: route.category,
      concurrency: route.concurrency,
      critical: Boolean(route.critical),
      dlqCount: dlqMap[route.type] ?? 0,
      lastErrors: (errorMap.get(route.type) ?? []).map((job) => ({
        id: job.id,
        status: job.status,
        attempts: job.attempts,
        message: job.lastError,
        updatedAt: job.updatedAt.toISOString(),
      })),
    }));

    res.json({ jobTypes: payload });
  } catch (error: any) {
    // eslint-disable-next-line no-console
    console.error('[QueueJobTypes] Failed to load job metadata', error);
    res.status(500).json({
      error: 'JobTypesUnavailable',
      message: error?.message ?? 'Unable to list queue job types',
    });
  }
});

export default router;


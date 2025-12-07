import { Router, type Request, type Response } from 'express';
import { PrismaClient } from '@prisma/client';

const router = Router();
const prisma = new PrismaClient();
const MAX_HISTORY_LIMIT = 200;

router.get('/api/ats/history', async (req: Request, res: Response) => {
  try {
    const limit = coerceLimit(req.query.limit);
    const events = await prisma.candidateSyncQueue.findMany({
      orderBy: { createdAt: 'desc' },
      take: limit,
    });

    return res.json({
      limit,
      events: events.map((event) => ({
        id: event.id,
        clinicianId: event.clinicianId,
        orgId: event.orgId,
        event: event.event,
        processed: event.processed,
        createdAt: event.createdAt,
        payload: (event.payload as Record<string, unknown>) ?? {},
      })),
    });
  } catch (error) {
    console.error('[ATS] history fetch failed', error);
    return res.status(500).json({
      error: 'ats_history_failed',
      error_description: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

function coerceLimit(input: unknown): number {
  if (!input) return 100;
  const parsed = Number(Array.isArray(input) ? input[0] : input);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return 100;
  }
  return Math.min(Math.floor(parsed), MAX_HISTORY_LIMIT);
}

export default router;












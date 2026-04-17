import type { Express, Request, Response } from 'express';
import prisma from '../graphql/prisma_client';
const NPI_RE = /^\d{10}$/;

export function registerReuseSignalRoutes(app: Express): void {

  // GET /api/pilot/reuse-signal/:npi — social proof from prior employer actions
  app.get('/api/pilot/reuse-signal/:npi', async (req: Request, res: Response) => {
    const { npi } = req.params;

    if (!npi || !NPI_RE.test(npi)) {
      res.status(400).json({ error: 'Invalid NPI format' });
      return;
    }

    try {
      const now = new Date();
      const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

      const [grouped, latest, recent7d, recent30d] = await Promise.all([
        prisma.pilotMetric.groupBy({
          by: ['actionTaken'],
          where: { npi },
          _count: { actionTaken: true },
          _max: { createdAt: true },
        }),
        prisma.pilotMetric.findFirst({
          where: { npi },
          orderBy: { createdAt: 'desc' },
          select: { actionTaken: true, createdAt: true },
        }),
        prisma.pilotMetric.groupBy({
          by: ['actionTaken'],
          where: { npi, createdAt: { gte: sevenDaysAgo } },
          _count: { actionTaken: true },
        }),
        prisma.pilotMetric.groupBy({
          by: ['actionTaken'],
          where: { npi, createdAt: { gte: thirtyDaysAgo } },
          _count: { actionTaken: true },
        }),
      ]);

      const countBy = (grouped: { actionTaken: string; _count: { actionTaken: number } }[], action: string) =>
        grouped.find(g => g.actionTaken === action)?._count.actionTaken ?? 0;

      const signal = {
        npi,
        accepted_count: countBy(grouped, 'accept'),
        flagged_count: countBy(grouped, 'flag'),
        request_data_count: countBy(grouped, 'request_data'),
        last_action: latest?.actionTaken ?? null,
        last_action_at: latest?.createdAt?.toISOString() ?? null,
        total_actions: grouped.reduce((sum, g) => sum + g._count.actionTaken, 0),
        recent_accepts_7d: countBy(recent7d, 'accept'),
        recent_accepts_30d: countBy(recent30d, 'accept'),
        recent_flags_7d: countBy(recent7d, 'flag'),
        recent_flags_30d: countBy(recent30d, 'flag'),
        recent_data_requests_7d: countBy(recent7d, 'request_data'),
        recent_data_requests_30d: countBy(recent30d, 'request_data'),
      };

      res.json(signal);
    } catch (err) {
      res.status(500).json({ error: 'Failed to load reuse signal' });
    }
  });
}

import type { Express, Request, Response } from 'express';
import prisma from '../graphql/prisma_client';

export function registerPilotTelemetryRoutes(app: Express): void {

  // POST /api/pilot/telemetry — log employer action
  app.post('/api/pilot/telemetry', async (req: Request, res: Response) => {
    try {
      const { npi, employerId, actionTaken, timeToDecisionMs, decisionStatus } = req.body as Record<string, unknown>;
      if (!npi || !actionTaken) {
        res.status(400).json({ error: 'npi and actionTaken are required' });
        return;
      }
      const metric = await prisma.pilotMetric.create({
        data: {
          npi: String(npi),
          employerId: employerId ? String(employerId) : null,
          actionTaken: String(actionTaken),
          timeToDecisionMs: typeof timeToDecisionMs === 'number' ? timeToDecisionMs : null,
          decisionStatus: decisionStatus ? String(decisionStatus) : null,
        },
      });
      res.status(201).json({ id: metric.id });
    } catch (err) {
      res.status(500).json({ error: 'Failed to log telemetry' });
    }
  });

  // POST /api/pilot/friction — log user confusion
  app.post('/api/pilot/friction', async (req: Request, res: Response) => {
    try {
      const { npi, employerId, contextPhase, userComment } = req.body as Record<string, unknown>;
      const log = await prisma.frictionLog.create({
        data: {
          npi: npi ? String(npi) : null,
          employerId: employerId ? String(employerId) : null,
          contextPhase: contextPhase ? String(contextPhase) : null,
          userComment: userComment ? String(userComment) : null,
        },
      });
      res.status(201).json({ id: log.id });
    } catch (err) {
      res.status(500).json({ error: 'Failed to log friction' });
    }
  });

  // GET /api/pilot/dashboard — aggregated pilot metrics
  app.get('/api/pilot/dashboard', async (_req: Request, res: Response) => {
    try {
      const [total, byDecision, byAction, avgTime, openFriction] = await Promise.all([
        prisma.pilotMetric.count(),
        prisma.pilotMetric.groupBy({ by: ['decisionStatus'], _count: true }),
        prisma.pilotMetric.groupBy({ by: ['actionTaken'], _count: true }),
        prisma.pilotMetric.aggregate({ _avg: { timeToDecisionMs: true } }),
        prisma.frictionLog.findMany({
          where: { resolved: false },
          orderBy: { createdAt: 'desc' },
          take: 5,
        }),
      ]);

      const openFrictionCount = await prisma.frictionLog.count({ where: { resolved: false } });

      res.json({
        totalNpisProcessed: total,
        decisionDistribution: byDecision.map((d) => ({
          status: d.decisionStatus,
          count: d._count,
        })),
        actionsDistribution: byAction.map((a) => ({
          action: a.actionTaken,
          count: a._count,
        })),
        avgTimeToDecisionMs: avgTime._avg.timeToDecisionMs ?? null,
        openFrictionLogs: {
          count: openFrictionCount,
          recent: openFriction.map((f) => ({
            id: f.id,
            npi: f.npi,
            contextPhase: f.contextPhase,
            userComment: f.userComment,
            createdAt: f.createdAt,
          })),
        },
      });
    } catch (err) {
      res.status(500).json({ error: 'Failed to load dashboard' });
    }
  });
}

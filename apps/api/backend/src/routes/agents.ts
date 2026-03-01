import type { Express, Request, Response } from 'express';
import { AgentOrchestrator } from '../agents';

export function registerAgentRoutes(app: Express): void {
  app.get('/api/agents/telemetry', (req: Request, res: Response) => {
    const orchestrator = AgentOrchestrator.getInstance();

    const limitParam = Number(req.query.limit) || 10;
    const limit = Math.min(Math.max(1, limitParam), 100);

    const entries = orchestrator.getRecentTelemetry(limit);

    return res.json({
      count: entries.length,
      limit,
      entries,
      generatedAt: new Date().toISOString(),
    });
  });

  app.get('/api/agents/status', (_req: Request, res: Response) => {
    const orchestrator = AgentOrchestrator.getInstance();

    return res.json({
      started: orchestrator.started,
      agents: orchestrator.getAgentStatuses(),
      generatedAt: new Date().toISOString(),
    });
  });
}

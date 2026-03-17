/**
 * detailAgents.ts — Detail Agent API
 *
 * Routes:
 *   GET  /api/system-health              — System health summary
 *   GET  /api/system-health/reports      — Recent detail reports
 *   GET  /api/system-health/agents       — Agent configurations
 *   POST /api/system-health/scan         — Run all agents manually
 *   POST /api/system-health/scan/:agent  — Run specific agent
 */

import type { Express, Request, Response } from 'express';
import {
  getSystemHealthSummary,
  getRecentReports,
  getDetailAgentConfigs,
  runAllDetailAgents,
  runDetailAgent,
  type DetailAgentId,
} from '../services/detailAgents/detailAgentEngine';
import { log } from '../obs/logger';
import { generateSystemPulse } from '../services/system/pulseService';

const VALID_AGENTS: DetailAgentId[] = ['qa', 'data-sanity', 'performance', 'schema-consistency', 'api-validation'];

export function registerDetailAgentRoutes(app: Express): void {

  app.get('/api/system-health', async (_req: Request, res: Response) => {
    try {
      const [summary, pulse] = await Promise.all([
        Promise.resolve(getSystemHealthSummary()),
        generateSystemPulse(),
      ]);

      res.json({
        schema: 'https://vitalcv.com/system-health/v1',
        ...summary,
        providers: pulse.providers,
        findings: pulse.findings,
        storylines: pulse.storylines,
        status: pulse.findings > 0 ? 'HEALTHY' : 'WARMING',
        systemState: pulse.systemState,
        lastEventAt: pulse.lastEventAt,
        generatedAt: new Date().toISOString(),
      });
    } catch (err) {
      log('error', `[DetailAgents] system health failed: ${(err as Error)?.message}`);
      res.status(500).json({ error: 'System health unavailable' });
    }
  });

  app.get('/api/system-health/reports', (req: Request, res: Response) => {
    const limit = typeof req.query.limit === 'string' ? parseInt(req.query.limit) : 20;
    res.json({ reports: getRecentReports(limit) });
  });

  app.get('/api/system-health/agents', (_req: Request, res: Response) => {
    res.json({ agents: getDetailAgentConfigs() });
  });

  app.post('/api/system-health/scan', async (_req: Request, res: Response) => {
    try {
      const reports = await runAllDetailAgents();
      const summary = {
        agentsRun: reports.length,
        totalIssues: reports.reduce((s, r) => s + r.issuesFound, 0),
        totalAutoRepaired: reports.reduce((s, r) => s + r.autoRepaired, 0),
        totalSurfaced: reports.reduce((s, r) => s + r.surfaced, 0),
        totalDurationMs: reports.reduce((s, r) => s + r.durationMs, 0),
      };
      res.json({ schema: 'https://vitalcv.com/system-health-scan/v1', summary, reports });
    } catch (err) {
      log('error', `[DetailAgents] Full scan failed: ${(err as Error)?.message}`);
      res.status(500).json({ error: 'System health scan failed' });
    }
  });

  app.post('/api/system-health/scan/:agent', async (req: Request, res: Response) => {
    const agentId = req.params.agent as DetailAgentId;
    if (!VALID_AGENTS.includes(agentId)) {
      return res.status(400).json({ error: `agent must be one of: ${VALID_AGENTS.join(', ')}` });
    }
    try {
      const report = await runDetailAgent(agentId);
      if (!report) return res.status(404).json({ error: 'Agent not found' });
      res.json(report);
    } catch (err) {
      log('error', `[DetailAgents] Agent ${agentId} failed: ${(err as Error)?.message}`);
      res.status(500).json({ error: `Agent ${agentId} scan failed` });
    }
  });
}

/**
 * verificationAgents.ts — Wave 500+: AI Verification Agent Routes
 *
 * POST /api/agents/run/:npi              — run full agent swarm (all 5 agents)
 * POST /api/agents/:agent/run/:npi       — run single named agent
 * GET  /api/agents/status/:npi           — last swarm run + agent status per agent
 * GET  /api/agents/schedule              — monitoring schedule (with next-run times)
 * GET  /api/agents/schedule/:npi         — NPI-specific schedule with last-run history
 * GET  /api/agents/anomalies/:npi        — all anomalies from last swarm run
 * GET  /api/agents/history/:npi          — swarm run history (last 10 runs)
 */

import type { Express, Request, Response } from 'express';
import { agentSwarm } from '../services/agents/AgentSwarm';
import { AGENT_SCHEDULES } from '../services/agents/types';
import type { AgentName } from '../services/agents/types';
import { log } from '../obs/logger';

const VALID_AGENTS: AgentName[] = [
  'license_verification',
  'sanctions_monitoring',
  'board_certification',
  'training_verification',
  'privilege_verification',
];

// Simple in-flight guard — prevent duplicate concurrent swarm runs per NPI
const inFlight = new Set<string>();

export function registerVerificationAgentRoutes(app: Express): void {

  /**
   * POST /api/agents/run/:npi
   * Run the full agent swarm for a clinician.
   * Responds immediately if a run is already in progress for this NPI.
   */
  app.post('/api/agents/run/:npi([0-9]{10})', async (req: Request, res: Response) => {
    const { npi } = req.params;

    if (inFlight.has(npi)) {
      res.status(409).json({
        error: 'Swarm run already in progress for this NPI',
        npi,
        inFlight: true,
      });
      return;
    }

    inFlight.add(npi);
    log('info', 'agents: swarm run requested', { npi });

    try {
      const result = await agentSwarm.run(npi);

      log('info', 'agents: swarm run complete', {
        npi,
        durationMs: result.durationMs,
        artifacts: result.totalArtifactsCreated,
        anomalies: result.totalAnomalies,
        critical: result.anomaliesBySeverity.CRITICAL,
      });

      res.json(result);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      log('error', 'agents: swarm run failed', { npi, error: message });
      res.status(500).json({ error: 'Swarm run failed', detail: message });
    } finally {
      inFlight.delete(npi);
    }
  });

  /**
   * POST /api/agents/:agent/run/:npi
   * Run a single named agent.
   */
  app.post('/api/agents/:agent/run/:npi([0-9]{10})', async (req: Request, res: Response) => {
    const { agent, npi } = req.params;

    if (!VALID_AGENTS.includes(agent as AgentName)) {
      res.status(400).json({
        error: `Unknown agent: ${agent}`,
        valid: VALID_AGENTS,
      });
      return;
    }

    const key = `${agent}:${npi}`;
    if (inFlight.has(key)) {
      res.status(409).json({ error: 'Agent run already in progress', agent, npi });
      return;
    }

    inFlight.add(key);
    try {
      const result = await agentSwarm.runAgent(agent as AgentName, npi);
      res.json(result);
    } catch (err) {
      res.status(500).json({ error: String(err) });
    } finally {
      inFlight.delete(key);
    }
  });

  /**
   * GET /api/agents/status/:npi
   * Returns the last swarm run result and per-agent status summary.
   */
  app.get('/api/agents/status/:npi([0-9]{10})', (req: Request, res: Response) => {
    const { npi } = req.params;
    const history = agentSwarm.getHistory(npi, 1);
    const lastRun = history[0];

    if (!lastRun) {
      res.json({
        npi,
        lastRun: null,
        agents: VALID_AGENTS.map(name => ({
          name,
          status: 'never_run',
          description: AGENT_SCHEDULES[name].description,
          intervalHours: AGENT_SCHEDULES[name].intervalHours,
        })),
        inFlight: inFlight.has(npi),
      });
      return;
    }

    const agentStatusMap = Object.fromEntries(
      lastRun.agentResults.map(r => [r.agentName, {
        status: r.status,
        evidenceBundles: r.evidenceBundles.length,
        anomalies: r.anomalies.length,
        artifactsCreated: r.artifactsCreated,
        durationMs: r.durationMs,
        completedAt: r.completedAt,
        error: r.error,
      }])
    );

    res.json({
      npi,
      inFlight: inFlight.has(npi),
      lastRun: {
        swarmId: lastRun.swarmId,
        startedAt: lastRun.startedAt,
        completedAt: lastRun.completedAt,
        durationMs: lastRun.durationMs,
        totalEvidenceBundles: lastRun.totalEvidenceBundles,
        totalAnomalies: lastRun.totalAnomalies,
        totalArtifactsCreated: lastRun.totalArtifactsCreated,
        anomaliesBySeverity: lastRun.anomaliesBySeverity,
        trustStateRefreshed: lastRun.trustStateRefreshed,
      },
      agents: VALID_AGENTS.map(name => ({
        name,
        description: AGENT_SCHEDULES[name].description,
        intervalHours: AGENT_SCHEDULES[name].intervalHours,
        ...(agentStatusMap[name] ?? { status: 'not_run_in_last_swarm' }),
      })),
    });
  });

  /**
   * GET /api/agents/schedule
   * Global monitoring schedule for all agents (without NPI context).
   */
  app.get('/api/agents/schedule', (_req: Request, res: Response) => {
    res.json({
      agents: Object.values(AGENT_SCHEDULES),
      description: 'Monitoring schedules for all AI verification agents',
    });
  });

  /**
   * GET /api/agents/schedule/:npi
   * NPI-specific schedule showing last-run times and next expected runs.
   */
  app.get('/api/agents/schedule/:npi([0-9]{10})', (req: Request, res: Response) => {
    const { npi } = req.params;
    const schedule = agentSwarm.getSchedule(npi);

    res.json({
      npi,
      schedule,
      overdue: schedule.filter(s => {
        if (!s.nextRunAt) return false;
        return new Date(s.nextRunAt).getTime() < Date.now();
      }).map(s => s.agentName),
    });
  });

  /**
   * GET /api/agents/anomalies/:npi
   * All anomalies from the last swarm run, sorted by severity.
   */
  app.get('/api/agents/anomalies/:npi([0-9]{10})', (req: Request, res: Response) => {
    const { npi } = req.params;
    const history = agentSwarm.getHistory(npi, 1);
    const lastRun = history[0];

    if (!lastRun) {
      res.json({ npi, anomalies: [], swarmId: null });
      return;
    }

    const severityOrder: Record<string, number> = { CRITICAL: 0, HIGH: 1, MEDIUM: 2, LOW: 3 };
    const allAnomalies = lastRun.agentResults
      .flatMap(r => r.anomalies)
      .sort((a, b) => (severityOrder[a.severity] ?? 9) - (severityOrder[b.severity] ?? 9));

    res.json({
      npi,
      swarmId: lastRun.swarmId,
      runAt: lastRun.completedAt,
      anomaliesBySeverity: lastRun.anomaliesBySeverity,
      total: allAnomalies.length,
      anomalies: allAnomalies,
    });
  });

  /**
   * GET /api/agents/history/:npi
   * Swarm run history (last 10 runs) for observability.
   */
  app.get('/api/agents/history/:npi([0-9]{10})', (req: Request, res: Response) => {
    const { npi } = req.params;
    const limit = Math.min(Number(req.query.limit ?? 10), 10);
    const history = agentSwarm.getHistory(npi, limit);

    res.json({
      npi,
      total: history.length,
      runs: history.map(r => ({
        swarmId: r.swarmId,
        startedAt: r.startedAt,
        completedAt: r.completedAt,
        durationMs: r.durationMs,
        totalEvidenceBundles: r.totalEvidenceBundles,
        totalAnomalies: r.totalAnomalies,
        totalArtifactsCreated: r.totalArtifactsCreated,
        anomaliesBySeverity: r.anomaliesBySeverity,
        agentStatuses: Object.fromEntries(r.agentResults.map(a => [a.agentName, a.status])),
      })),
    });
  });
}

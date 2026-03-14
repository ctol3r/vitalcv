/**
 * AgentSwarm.ts — Wave 500+
 *
 * Orchestrates all verification agents for a given NPI.
 * Runs agents in parallel (Promise.allSettled — one failure never blocks others).
 * After all agents complete, runs InconsistencyDetector for cross-source analysis.
 * Persists swarm run summary for monitoring dashboard.
 *
 * Usage:
 *   const swarm = new AgentSwarm();
 *   const result = await swarm.run(npi);
 */

import { randomUUID } from 'crypto';
import { log } from '../../obs/logger';
import { LicenseVerificationAgent } from './LicenseVerificationAgent';
import { SanctionsMonitoringAgent } from './SanctionsMonitoringAgent';
import { BoardCertificationAgent } from './BoardCertificationAgent';
import { TrainingVerificationAgent } from './TrainingVerificationAgent';
import { PrivilegeVerificationAgent } from './PrivilegeVerificationAgent';
import { detectCrossSourceInconsistencies } from './InconsistencyDetector';
import type { SwarmRunResult, AgentName, AgentScheduleEntry, AnomalySeverity } from './types';
import { AGENT_SCHEDULES } from './types';

// In-memory run history (last 100 swarm runs per NPI)
const swarmHistory = new Map<string, SwarmRunResult[]>();
const HISTORY_LIMIT = 10;

export class AgentSwarm {
  private readonly agents = [
    new LicenseVerificationAgent(),
    new SanctionsMonitoringAgent(),
    new BoardCertificationAgent(),
    new TrainingVerificationAgent(),
    new PrivilegeVerificationAgent(),
  ];

  /**
   * Run all agents for a given NPI in parallel.
   * Never rejects — failed agents are captured in AgentRunResult.status = 'failed'.
   */
  async run(npi: string): Promise<SwarmRunResult> {
    const swarmId = randomUUID();
    const startedAt = new Date().toISOString();
    const startMs = Date.now();

    log('info', 'swarm: starting', { npi, swarmId, agents: this.agents.length });

    // Run all agents in parallel
    const settledResults = await Promise.allSettled(
      this.agents.map(agent => agent.run(npi))
    );

    const agentResults = settledResults.map((r, i) => {
      if (r.status === 'fulfilled') return r.value;
      // Shouldn't happen (agents catch internally), but handle gracefully
      const agent = this.agents[i]!;
      return {
        agentName: agent.name,
        npi,
        status: 'failed' as const,
        startedAt,
        completedAt: new Date().toISOString(),
        durationMs: Date.now() - startMs,
        evidenceBundles: [],
        anomalies: [],
        artifactsCreated: 0,
        trustStateRefreshed: false,
        error: String(r.reason),
      };
    });

    // Cross-source inconsistency detection
    const crossSourceReport = await detectCrossSourceInconsistencies(npi, agentResults).catch(err => {
      log('warn', 'swarm: cross-source detection failed', { npi, error: String(err) });
      return { npi, generatedAt: new Date().toISOString(), anomalies: [], summary: { critical: 0, high: 0, medium: 0, low: 0, total: 0 } };
    });

    const anomaliesBySeverity = crossSourceReport.summary as unknown as Record<AnomalySeverity, number>;

    const result: SwarmRunResult = {
      npi,
      swarmId,
      startedAt,
      completedAt: new Date().toISOString(),
      durationMs: Date.now() - startMs,
      agentResults,
      totalEvidenceBundles: agentResults.reduce((n, r) => n + r.evidenceBundles.length, 0),
      totalAnomalies: crossSourceReport.anomalies.length,
      totalArtifactsCreated: agentResults.reduce((n, r) => n + r.artifactsCreated, 0),
      anomaliesBySeverity: {
        CRITICAL: crossSourceReport.summary.critical ?? 0,
        HIGH: crossSourceReport.summary.high ?? 0,
        MEDIUM: crossSourceReport.summary.medium ?? 0,
        LOW: crossSourceReport.summary.low ?? 0,
      },
      trustStateRefreshed: agentResults.some(r => r.trustStateRefreshed),
    };

    // Store in-memory history
    const history = swarmHistory.get(npi) ?? [];
    history.unshift(result);
    if (history.length > HISTORY_LIMIT) history.splice(HISTORY_LIMIT);
    swarmHistory.set(npi, history);

    log('info', 'swarm: completed', {
      npi,
      swarmId,
      durationMs: result.durationMs,
      evidenceBundles: result.totalEvidenceBundles,
      artifacts: result.totalArtifactsCreated,
      anomalies: result.totalAnomalies,
      critical: result.anomaliesBySeverity.CRITICAL,
    });

    return result;
  }

  /** Run a single named agent */
  async runAgent(agentName: AgentName, npi: string) {
    const agent = this.agents.find(a => a.name === agentName);
    if (!agent) throw new Error(`Unknown agent: ${agentName}`);
    return agent.run(npi);
  }

  /** Get last N swarm run results for an NPI */
  getHistory(npi: string, limit = 5): SwarmRunResult[] {
    return (swarmHistory.get(npi) ?? []).slice(0, limit);
  }

  /** Get monitoring schedule with last-run times populated from history */
  getSchedule(npi: string): AgentScheduleEntry[] {
    const history = swarmHistory.get(npi) ?? [];
    return Object.values(AGENT_SCHEDULES).map(schedule => {
      const lastRun = history
        .flatMap(r => r.agentResults)
        .find(r => r.agentName === schedule.agentName && r.status === 'completed');

      const lastRunAt = lastRun?.completedAt;
      const nextRunAt = lastRunAt
        ? new Date(new Date(lastRunAt).getTime() + schedule.intervalHours * 3_600_000).toISOString()
        : undefined;

      return { ...schedule, lastRunAt, nextRunAt };
    });
  }
}

// Singleton for reuse across requests
export const agentSwarm = new AgentSwarm();

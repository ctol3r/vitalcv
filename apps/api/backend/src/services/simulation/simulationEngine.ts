/**
 * simulationEngine.ts — Wave 84: Trust Simulation Engine
 *
 * Simulates credential changes and forecasts operational impact.
 * Composes graphEngine + graphSimulation to produce impact reports.
 */

import { generateTrustGraph } from '../graph/graphEngine';
import { applyEvent, type SimulationEvent } from './graphSimulation';
import { log } from '../../obs/logger';

// ── Types ─────────────────────────────────────────────────────────────

export type RiskLevel = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';

export interface SimulationImpactReport {
  npi: string;
  eventType: SimulationEvent['type'];
  affectedDecisions: Array<{ id: string; label: string; previousStatus?: string; newRisk: string }>;
  affectedEmployers: Array<{ id: string; label: string }>;
  cascadeDepth: number;
  riskLevel: RiskLevel;
  totalAffected: number;
  simulatedAt: string;
}

// ── Risk Calculation ──────────────────────────────────────────────────

function calculateRiskLevel(affectedCount: number, cascadeDepth: number, eventType: string): RiskLevel {
  if (eventType === 'credential_revoked' || eventType === 'issuer_revoked') {
    return affectedCount > 5 ? 'CRITICAL' : affectedCount > 2 ? 'HIGH' : 'MEDIUM';
  }
  if (eventType === 'credential_expired') {
    return affectedCount > 5 ? 'HIGH' : affectedCount > 2 ? 'MEDIUM' : 'LOW';
  }
  return 'LOW'; // credential_added is positive
}

// ── Main Simulation ───────────────────────────────────────────────────

export async function runTrustSimulation(
  npi: string,
  event: SimulationEvent,
): Promise<SimulationImpactReport> {
  const graph = await generateTrustGraph(npi);
  const simResult = applyEvent(graph, event);

  const affectedDecisions = simResult.nodes
    .filter((n) => n.group === 'decision' && simResult.affectedNodeIds.has(n.id))
    .map((n) => ({
      id: n.id,
      label: n.label,
      previousStatus: graph.nodes.find((orig) => orig.id === n.id)?.status,
      newRisk: n.decisionRisk ?? 'UNKNOWN',
    }));

  const affectedEmployers = simResult.nodes
    .filter((n) => n.group === 'employer' && simResult.affectedNodeIds.has(n.id))
    .map((n) => ({ id: n.id, label: n.label }));

  const riskLevel = calculateRiskLevel(
    simResult.affectedNodeIds.size,
    simResult.cascadeDepth,
    event.type,
  );

  log('info', 'simulation_engine: completed', {
    npi,
    eventType: event.type,
    affected: simResult.affectedNodeIds.size,
    cascadeDepth: simResult.cascadeDepth,
    riskLevel,
  });

  return {
    npi,
    eventType: event.type,
    affectedDecisions,
    affectedEmployers,
    cascadeDepth: simResult.cascadeDepth,
    riskLevel,
    totalAffected: simResult.affectedNodeIds.size,
    simulatedAt: new Date().toISOString(),
  };
}

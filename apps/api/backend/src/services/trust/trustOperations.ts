/**
 * trustOperations.ts — Wave 87: Unified Trust Operations Layer
 *
 * Aggregates graph state, decision insights, monitoring alerts,
 * and simulation impact into a single operational view.
 */

import { generateTrustGraph, type IntelligentGraph } from '../graph/graphEngine';
import { analyzeGraph, type GraphInsightReport } from '../graph/graphInsights';
import { generateDecisionInsights, type DecisionInsightReport } from '../decision/decisionEngine';
import { getAlertsByNpi, type MonitoringAlert } from '../monitoring/alertEngine';
import { log } from '../../obs/logger';

// ── Types ─────────────────────────────────────────────────────────────

export type OperationalStatus = 'HEALTHY' | 'DEGRADED' | 'CRITICAL';

export interface TrustOperationsState {
  npi: string;
  status: OperationalStatus;
  graph: IntelligentGraph;
  graphInsights: GraphInsightReport;
  decisionInsights: DecisionInsightReport;
  alerts: MonitoringAlert[];
  summary: {
    totalNodes: number;
    totalEdges: number;
    criticalAlerts: number;
    activeRisks: number;
    readiness: string;
  };
  generatedAt: string;
}

// ── Status Calculation ────────────────────────────────────────────────

function computeStatus(
  insights: GraphInsightReport,
  decisions: DecisionInsightReport,
  alerts: MonitoringAlert[],
): OperationalStatus {
  const criticalAlerts = alerts.filter((a) => a.severity === 'CRITICAL').length;
  if (criticalAlerts > 0 || decisions.readinessLevel === 'BLOCKED') return 'CRITICAL';
  if (insights.summary.warnings > 0 || decisions.readinessLevel === 'AT_RISK') return 'DEGRADED';
  return 'HEALTHY';
}

// ── Main Aggregator ───────────────────────────────────────────────────

export async function generateTrustOperationsState(npi: string): Promise<TrustOperationsState> {
  const [graph, decisionInsights, alerts] = await Promise.all([
    generateTrustGraph(npi),
    generateDecisionInsights(npi),
    getAlertsByNpi(npi),
  ]);

  const graphInsights = analyzeGraph(graph);
  const status = computeStatus(graphInsights, decisionInsights, alerts);

  log('info', 'trust_operations: state generated', {
    npi,
    status,
    nodes: graph.nodes.length,
    alerts: alerts.length,
  });

  return {
    npi,
    status,
    graph,
    graphInsights,
    decisionInsights,
    alerts,
    summary: {
      totalNodes: graph.nodes.length,
      totalEdges: graph.edges.length,
      criticalAlerts: alerts.filter((a) => a.severity === 'CRITICAL').length,
      activeRisks: decisionInsights.riskFactors.length,
      readiness: decisionInsights.readinessLevel,
    },
    generatedAt: new Date().toISOString(),
  };
}

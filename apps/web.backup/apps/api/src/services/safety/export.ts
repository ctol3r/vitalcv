import { PrismaClient } from '@prisma/client';
import { getOrCreateSafetyGraph, correlateAdverseEvents, generateSanctionsLineage } from './graph';
import { detectSafetyAnomalies } from './anomaly-alerting';

const prisma = new PrismaClient();

export interface SafetyGraphExport {
  clinicianId: string;
  generatedAt: string;
  graph: {
    nodes: unknown[];
    edges: unknown[];
    riskScore?: number;
  };
  events: Array<{
    type: string;
    source: string;
    severity: string;
    timestamp: string;
    details: Record<string, unknown>;
  }>;
  sanctionsLineage: Record<string, unknown>;
  anomalies: Array<{
    type: string;
    severity: string;
    message: string;
    detectedAt: string;
  }>;
  summary: {
    totalEvents: number;
    riskLevel: string;
    criticalFlags: number;
    recommendations: string[];
  };
}

/**
 * Generate comprehensive safety graph export for audits/regulators
 */
export async function generateSafetyGraphExport(clinicianId: string): Promise<SafetyGraphExport> {
  const [graph, events, lineage, anomalies] = await Promise.all([
    getOrCreateSafetyGraph(clinicianId),
    correlateAdverseEvents(clinicianId),
    generateSanctionsLineage(clinicianId),
    detectSafetyAnomalies(clinicianId),
  ]);

  const criticalFlags = events.filter((e) => e.severity === 'critical').length;
  const riskLevel = graph.riskScore
    ? graph.riskScore >= 0.8
      ? 'critical'
      : graph.riskScore >= 0.6
        ? 'high'
        : graph.riskScore >= 0.4
          ? 'medium'
          : 'low'
    : 'low';

  const recommendations: string[] = [];
  if (criticalFlags > 0) {
    recommendations.push('Immediate review required due to critical safety flags');
  }
  if (graph.riskScore && graph.riskScore >= 0.6) {
    recommendations.push('Enhanced monitoring recommended');
  }
  if (anomalies.length > 0) {
    recommendations.push('Recent anomalies detected - investigate patterns');
  }
  if (recommendations.length === 0) {
    recommendations.push('No immediate safety concerns identified');
  }

  return {
    clinicianId,
    generatedAt: new Date().toISOString(),
    graph: {
      nodes: graph.nodes,
      edges: graph.edges,
      riskScore: graph.riskScore,
    },
    events: events.map((e) => ({
      type: e.type,
      source: e.source,
      severity: e.severity,
      timestamp: e.timestamp,
      details: e.details,
    })),
    sanctionsLineage: lineage,
    anomalies: anomalies.map((a) => ({
      type: a.type,
      severity: a.severity,
      message: a.message,
      detectedAt: a.detectedAt.toISOString(),
    })),
    summary: {
      totalEvents: events.length,
      riskLevel,
      criticalFlags,
      recommendations,
    },
  };
}


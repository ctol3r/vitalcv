import { PrismaClient } from '@prisma/client';
import { getOrCreateSafetyGraph } from './graph';

const prisma = new PrismaClient();

export interface SafetyAnomaly {
  id: string;
  clinicianId: string;
  type: 'new_sanction' | 'severity_spike' | 'pattern_anomaly' | 'cluster_risk';
  severity: 'low' | 'medium' | 'high' | 'critical';
  message: string;
  details: Record<string, unknown>;
  detectedAt: Date;
}

/**
 * Detect new critical flags in real-time
 */
export async function detectSafetyAnomalies(clinicianId: string): Promise<SafetyAnomaly[]> {
  const anomalies: SafetyAnomaly[] = [];

  // Check for new sanctions in last 24 hours
  const recentSanctions = await prisma.riskEvent.findMany({
    where: {
      clinicianId,
      type: 'sanctions',
      createdAt: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) },
    },
  });

  for (const sanction of recentSanctions) {
    anomalies.push({
      id: `anomaly-${sanction.id}`,
      clinicianId,
      type: 'new_sanction',
      severity: sanction.severity >= 0.8 ? 'critical' : sanction.severity >= 0.6 ? 'high' : 'medium',
      message: `New sanction detected: ${sanction.type}`,
      details: {
        eventId: sanction.id,
        severity: sanction.severity,
        metadata: sanction.metadata,
      },
      detectedAt: sanction.createdAt,
    });
  }

  // Check for severity spikes
  const graph = await getOrCreateSafetyGraph(clinicianId);
  const currentRisk = graph.riskScore ?? 0;

  // Get historical risk scores
  const historicalGraphs = await prisma.safetyGraph.findMany({
    where: { clinicianId },
    orderBy: { updatedAt: 'desc' },
    take: 7, // Last week
  });

  if (historicalGraphs.length >= 2) {
    const previousRisk = (historicalGraphs[1].signals as any).riskScore ?? 0;
    const riskDelta = currentRisk - previousRisk;

    if (riskDelta > 0.3) {
      anomalies.push({
        id: `anomaly-spike-${Date.now()}`,
        clinicianId,
        type: 'severity_spike',
        severity: riskDelta > 0.5 ? 'critical' : 'high',
        message: `Risk score increased by ${(riskDelta * 100).toFixed(1)}%`,
        details: {
          previousRisk,
          currentRisk,
          delta: riskDelta,
        },
        detectedAt: new Date(),
      });
    }
  }

  // Check for pattern anomalies (unusual event clustering)
  const recentEvents = await prisma.riskEvent.findMany({
    where: {
      clinicianId,
      createdAt: { gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) }, // Last week
    },
  });

  if (recentEvents.length > 5) {
    anomalies.push({
      id: `anomaly-pattern-${Date.now()}`,
      clinicianId,
      type: 'pattern_anomaly',
      severity: recentEvents.length > 10 ? 'high' : 'medium',
      message: `Unusual event clustering: ${recentEvents.length} events in last 7 days`,
      details: {
        eventCount: recentEvents.length,
        eventTypes: [...new Set(recentEvents.map((e) => e.type))],
      },
      detectedAt: new Date(),
    });
  }

  return anomalies.sort((a, b) => {
    const severityOrder = { critical: 4, high: 3, medium: 2, low: 1 };
    return severityOrder[b.severity] - severityOrder[a.severity];
  });
}

/**
 * Monitor clinician for safety anomalies (call periodically)
 */
export async function monitorClinicianSafety(clinicianId: string): Promise<SafetyAnomaly[]> {
  return detectSafetyAnomalies(clinicianId);
}


import { PrismaClient } from '@prisma/client';
import { createHash } from 'crypto';

const prisma = new PrismaClient();

export interface AdverseEvent {
  type: 'npdb' | 'safety_signal' | 'facility_history';
  source: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  details: Record<string, unknown>;
  timestamp: string;
}

export interface SafetyGraphNode {
  id: string;
  type: 'clinician' | 'event' | 'facility' | 'sanction';
  label: string;
  metadata: Record<string, unknown>;
}

export interface SafetyGraphEdge {
  from: string;
  to: string;
  type: string;
  weight: number;
  metadata?: Record<string, unknown>;
}

export interface SafetyGraphData {
  nodes: SafetyGraphNode[];
  edges: SafetyGraphEdge[];
  clusters?: string[][];
  riskScore?: number;
}

/**
 * Correlate adverse events from multiple sources
 */
export async function correlateAdverseEvents(clinicianId: string): Promise<AdverseEvent[]> {
  const events: AdverseEvent[] = [];

  // NPDB events
  const npdbEvents = await prisma.riskEvent.findMany({
    where: {
      clinicianId,
      type: 'npdb',
    },
    orderBy: { createdAt: 'desc' },
    take: 50,
  });

  for (const event of npdbEvents) {
    events.push({
      type: 'npdb',
      source: 'NPDB',
      severity: event.severity >= 0.8 ? 'critical' : event.severity >= 0.6 ? 'high' : event.severity >= 0.4 ? 'medium' : 'low',
      details: event.metadata as Record<string, unknown>,
      timestamp: event.createdAt.toISOString(),
    });
  }

  // Safety signals
  const safetySignals = await prisma.safetySignal.findMany({
    where: { clinicianId },
    orderBy: { reportedAt: 'desc' },
    take: 50,
  });

  for (const signal of safetySignals) {
    events.push({
      type: 'safety_signal',
      source: 'SafetySignal',
      severity: signal.severity as 'low' | 'medium' | 'high' | 'critical',
      details: signal.metadata as Record<string, unknown>,
      timestamp: signal.reportedAt.toISOString(),
    });
  }

  // Facility histories (from privilege signals)
  const facilitySignals = await prisma.privilegeSafetySignal.findMany({
    where: { clinicianId },
    orderBy: { detectedAt: 'desc' },
    take: 50,
  });

  for (const signal of facilitySignals) {
    events.push({
      type: 'facility_history',
      source: 'PrivilegeSafetySignal',
      severity: signal.severity === 'CRITICAL' ? 'critical' : signal.severity === 'HIGH' ? 'high' : signal.severity === 'MED' ? 'medium' : 'low',
      details: {
        signalType: signal.signalType,
        summary: signal.summary,
        privilegeCodes: signal.privilegeCodes,
        ...(signal.details as Record<string, unknown>),
      },
      timestamp: signal.detectedAt.toISOString(),
    });
  }

  return events.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
}

/**
 * Generate multi-year lineage of sanctions risk
 */
export async function generateSanctionsLineage(clinicianId: string, years: number = 5): Promise<Record<string, unknown>> {
  const now = new Date();
  const startDate = new Date(now.getFullYear() - years, 0, 1);

  const sanctions = await prisma.riskEvent.findMany({
    where: {
      clinicianId,
      type: 'sanctions',
      createdAt: { gte: startDate },
    },
    orderBy: { createdAt: 'asc' },
  });

  const lineage: Array<{
    year: number;
    quarter: number;
    severity: number;
    count: number;
    events: Array<{ date: string; severity: number; details: Record<string, unknown> }>;
  }> = [];

  const byQuarter: Record<string, typeof sanctions> = {};

  for (const sanction of sanctions) {
    const date = new Date(sanction.createdAt);
    const year = date.getFullYear();
    const quarter = Math.floor(date.getMonth() / 3) + 1;
    const key = `${year}-Q${quarter}`;

    if (!byQuarter[key]) {
      byQuarter[key] = [];
    }
    byQuarter[key].push(sanction);
  }

  for (const [key, events] of Object.entries(byQuarter)) {
    const [year, quarter] = key.split('-Q').map(Number);
    const avgSeverity = events.reduce((sum, e) => sum + e.severity, 0) / events.length;

    lineage.push({
      year,
      quarter,
      severity: avgSeverity,
      count: events.length,
      events: events.map((e) => ({
        date: e.createdAt.toISOString(),
        severity: e.severity,
        details: e.metadata as Record<string, unknown>,
      })),
    });
  }

  return {
    clinicianId,
    period: { start: startDate.toISOString(), end: now.toISOString(), years },
    lineage,
    totalEvents: sanctions.length,
    maxSeverity: sanctions.length > 0 ? Math.max(...sanctions.map((s) => s.severity)) : 0,
    trend: lineage.length > 1 ? (lineage[lineage.length - 1].severity - lineage[0].severity) : 0,
  };
}

/**
 * Detect clusters of clinicians with similar risks
 */
export async function detectSafetyClusters(
  clinicianIds: string[],
  similarityThreshold: number = 0.7
): Promise<string[][]> {
  const clusters: string[][] = [];
  const processed = new Set<string>();

  for (const clinicianId of clinicianIds) {
    if (processed.has(clinicianId)) continue;

    const cluster = [clinicianId];
    const clinicianSignals = await getClinicianSignalVector(clinicianId);

    for (const otherId of clinicianIds) {
      if (otherId === clinicianId || processed.has(otherId)) continue;

      const otherSignals = await getClinicianSignalVector(otherId);
      const similarity = calculateSimilarity(clinicianSignals, otherSignals);

      if (similarity >= similarityThreshold) {
        cluster.push(otherId);
        processed.add(otherId);
      }
    }

    if (cluster.length > 1) {
      clusters.push(cluster);
      cluster.forEach((id) => processed.add(id));
    }
  }

  return clusters;
}

async function getClinicianSignalVector(clinicianId: string): Promise<Record<string, number>> {
  const [npdbCount, safetyCount, sanctionCount] = await Promise.all([
    prisma.riskEvent.count({ where: { clinicianId, type: 'npdb' } }),
    prisma.safetySignal.count({ where: { clinicianId } }),
    prisma.riskEvent.count({ where: { clinicianId, type: 'sanctions' } }),
  ]);

  return {
    npdb: npdbCount,
    safety: safetyCount,
    sanctions: sanctionCount,
  };
}

function calculateSimilarity(a: Record<string, number>, b: Record<string, number>): number {
  const keys = new Set([...Object.keys(a), ...Object.keys(b)]);
  let dotProduct = 0;
  let normA = 0;
  let normB = 0;

  for (const key of keys) {
    const valA = a[key] ?? 0;
    const valB = b[key] ?? 0;
    dotProduct += valA * valB;
    normA += valA * valA;
    normB += valB * valB;
  }

  if (normA === 0 || normB === 0) return 0;
  return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
}

/**
 * Build complete safety graph
 */
export async function buildSafetyGraph(clinicianId: string): Promise<SafetyGraphData> {
  const events = await correlateAdverseEvents(clinicianId);
  const nodes: SafetyGraphNode[] = [];
  const edges: SafetyGraphEdge[] = [];

  // Add clinician node
  nodes.push({
    id: clinicianId,
    type: 'clinician',
    label: `Clinician ${clinicianId}`,
    metadata: {},
  });

  // Add event nodes and edges
  for (const event of events) {
    const eventId = `event-${createHash('sha256').update(JSON.stringify(event)).digest('hex').substring(0, 8)}`;
    nodes.push({
      id: eventId,
      type: 'event',
      label: `${event.type} - ${event.severity}`,
      metadata: event.details,
    });

    edges.push({
      from: clinicianId,
      to: eventId,
      type: event.type,
      weight: event.severity === 'critical' ? 1.0 : event.severity === 'high' ? 0.75 : event.severity === 'medium' ? 0.5 : 0.25,
      metadata: { timestamp: event.timestamp },
    });
  }

  // Calculate risk score
  const riskScore = events.length > 0
    ? events.reduce((sum, e) => {
        const weight = e.severity === 'critical' ? 1.0 : e.severity === 'high' ? 0.75 : e.severity === 'medium' ? 0.5 : 0.25;
        return sum + weight;
      }, 0) / events.length
    : 0;

  return {
    nodes,
    edges,
    riskScore,
  };
}

/**
 * Get or create safety graph for clinician
 */
export async function getOrCreateSafetyGraph(clinicianId: string): Promise<SafetyGraphData> {
  let graph = await prisma.safetyGraph.findFirst({
    where: { clinicianId },
    orderBy: { updatedAt: 'desc' },
  });

  if (!graph || isGraphStale(graph.updatedAt)) {
    const graphData = await buildSafetyGraph(clinicianId);

    if (graph) {
      graph = await prisma.safetyGraph.update({
        where: { id: graph.id },
        data: {
          signals: graphData as unknown as any,
          edges: graphData as unknown as any,
          updatedAt: new Date(),
        },
      });
    } else {
      graph = await prisma.safetyGraph.create({
        data: {
          clinicianId,
          signals: graphData as unknown as any,
          edges: graphData as unknown as any,
        },
      });
    }
  }

  return {
    nodes: (graph.signals as any).nodes ?? [],
    edges: (graph.edges as any).edges ?? [],
    clusters: (graph.signals as any).clusters,
    riskScore: (graph.signals as any).riskScore,
  };
}

function isGraphStale(updatedAt: Date): boolean {
  const hoursSinceUpdate = (Date.now() - updatedAt.getTime()) / (1000 * 60 * 60);
  return hoursSinceUpdate > 24; // Refresh if older than 24 hours
}


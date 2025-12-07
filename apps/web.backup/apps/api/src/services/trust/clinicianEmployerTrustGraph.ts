import { PrismaClient } from '@prisma/client';
import { ChainClient } from '../chain/client';

const prisma = new PrismaClient();
const chainClient = new ChainClient();

export interface TrustGraphData {
  nodes: Array<{
    id: string;
    type: 'clinician' | 'employer';
    score: number;
    metadata: Record<string, unknown>;
  }>;
  edges: Array<{
    from: string;
    to: string;
    trustScore: number;
    asymmetry?: number;
    metadata: Record<string, unknown>;
  }>;
  overallScore: number;
  evolution: Array<{
    timestamp: string;
    event: string;
    impact: number;
  }>;
}

/**
 * Task 340.2 — Clinician→employer trust scorer v4
 * Score based on past performance & safety.
 */
export async function scoreClinicianToEmployerTrust(
  clinicianId: string,
  employerId: string,
): Promise<number> {
  // Check past performance metrics
  const hiringEvents = await prisma.hiringEvent.findMany({
    where: {
      clinicianId,
      employerId,
    },
    orderBy: { createdAt: 'desc' },
    take: 10,
  });

  // Check safety signals
  const safetySignals = await prisma.safetySignal.findMany({
    where: { clinicianId },
    orderBy: { reportedAt: 'desc' },
    take: 5,
  });

  // Calculate trust score based on:
  // - Positive hiring outcomes (offer accepted, onboarded)
  // - Low safety incidents
  // - Long tenure relationships
  let score = 0.5; // Base score

  const positiveOutcomes = hiringEvents.filter(
    (e) => e.eventType === 'offerAccepted' || e.eventType === 'onboarded',
  ).length;
  score += positiveOutcomes * 0.1;

  const negativeSignals = safetySignals.filter((s) => s.severity === 'high').length;
  score -= negativeSignals * 0.15;

  return Math.max(0, Math.min(1, score));
}

/**
 * Task 340.3 — Employer→clinician trust scorer v3
 * Measure employer trust in clinician reliability.
 */
export async function scoreEmployerToClinicianTrust(
  employerId: string,
  clinicianId: string,
): Promise<number> {
  // Check onboarding kinetics (faster = more trust)
  const onboarding = await prisma.onboardingKinetics.findFirst({
    where: { clinicianId },
    orderBy: { timestamp: 'desc' },
  });

  // Check privilege assignments (more privileges = more trust)
  const privileges = await prisma.privilegeSet.findMany({
    where: { hospitalId: employerId },
  });

  // Check compliance checks
  const complianceChecks = await prisma.complianceCheck.findMany({
    where: { clinicianId },
    orderBy: { createdAt: 'desc' },
    take: 10,
  });

  let score = 0.5;

  if (onboarding && onboarding.durationDays < 30) {
    score += 0.2; // Fast onboarding indicates trust
  }

  const passedChecks = complianceChecks.filter((c) => (c.result as any)?.status === 'pass').length;
  score += (passedChecks / complianceChecks.length) * 0.2;

  return Math.max(0, Math.min(1, score));
}

/**
 * Task 340.4 — Trust asymmetry detector
 * Detect asymmetric trust relationships.
 */
export async function detectTrustAsymmetry(
  clinicianId: string,
  employerId: string,
): Promise<{ asymmetry: number; direction: 'clinician' | 'employer' | 'balanced' }> {
  const clinicianScore = await scoreClinicianToEmployerTrust(clinicianId, employerId);
  const employerScore = await scoreEmployerToClinicianTrust(employerId, clinicianId);

  const asymmetry = Math.abs(clinicianScore - employerScore);
  let direction: 'clinician' | 'employer' | 'balanced' = 'balanced';

  if (asymmetry > 0.3) {
    direction = clinicianScore > employerScore ? 'clinician' : 'employer';
  }

  return { asymmetry, direction };
}

/**
 * Task 340.6 — Trust propagation engine
 * Propagate trust across connected employers.
 */
export async function propagateTrust(clinicianId: string): Promise<void> {
  const graph = await prisma.clinicianEmployerTrustGraph.findUnique({
    where: { clinicianId },
  });

  if (!graph) {
    return;
  }

  const graphData = graph.graph as TrustGraphData;
  const employers = graphData.edges
    .filter((e) => e.from === clinicianId)
    .map((e) => e.to);

  // Propagate trust scores to connected employers
  for (const employerId of employers) {
    const trustScore = await scoreClinicianToEmployerTrust(clinicianId, employerId);
    // Update graph with propagated scores
    // This is simplified - real implementation would update graph structure
  }
}

/**
 * Task 340.7 — Trust break event detector
 * Spot sudden trust loss events.
 */
export async function detectTrustBreaks(clinicianId: string): Promise<Array<{ event: string; severity: string; timestamp: string }>> {
  const breaks: Array<{ event: string; severity: string; timestamp: string }> = [];

  // Check for recent safety signals
  const recentSignals = await prisma.safetySignal.findMany({
    where: {
      clinicianId,
      reportedAt: {
        gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000), // Last 30 days
      },
    },
  });

  for (const signal of recentSignals) {
    if (signal.severity === 'high') {
      breaks.push({
        event: `Safety signal: ${signal.type}`,
        severity: signal.severity,
        timestamp: signal.reportedAt.toISOString(),
      });
    }
  }

  // Check for compliance failures
  const complianceFailures = await prisma.complianceCheck.findMany({
    where: {
      clinicianId,
      createdAt: {
        gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
      },
    },
  });

  for (const check of complianceFailures) {
    const result = check.result as any;
    if (result?.status === 'fail') {
      breaks.push({
        event: `Compliance failure: ${check.type}`,
        severity: 'high',
        timestamp: check.createdAt.toISOString(),
      });
    }
  }

  return breaks;
}

/**
 * Task 340.8 — Trust contract compliance engine
 * Ensure trust rules align with compliance.
 */
export async function validateTrustCompliance(clinicianId: string): Promise<{
  compliant: boolean;
  violations: Array<{ rule: string; severity: string }>;
}> {
  const violations: Array<{ rule: string; severity: string }> = [];

  // Check if trust scores align with compliance status
  const complianceChecks = await prisma.complianceCheck.findMany({
    where: { clinicianId },
    orderBy: { createdAt: 'desc' },
    take: 5,
  });

  const graph = await prisma.clinicianEmployerTrustGraph.findUnique({
    where: { clinicianId },
  });

  if (graph) {
    const graphData = graph.graph as TrustGraphData;
    const highTrustEdges = graphData.edges.filter((e) => e.trustScore > 0.8);

    // If high trust but recent compliance failures, flag violation
    const recentFailures = complianceChecks.filter((c) => {
      const result = c.result as any;
      return result?.status === 'fail';
    });

    if (highTrustEdges.length > 0 && recentFailures.length > 0) {
      violations.push({
        rule: 'Trust score inconsistent with compliance status',
        severity: 'high',
      });
    }
  }

  return {
    compliant: violations.length === 0,
    violations,
  };
}

/**
 * Task 340.9 — Trust evolution timeline
 * Track trust shifts across career.
 */
export async function buildTrustTimeline(clinicianId: string): Promise<TrustGraphData['evolution']> {
  const timeline: TrustGraphData['evolution'] = [];

  // Get hiring events
  const hiringEvents = await prisma.hiringEvent.findMany({
    where: { clinicianId },
    orderBy: { createdAt: 'asc' },
  });

  for (const event of hiringEvents) {
    timeline.push({
      timestamp: event.createdAt.toISOString(),
      event: event.eventType,
      impact: event.eventType === 'onboarded' ? 0.2 : event.eventType === 'offerAccepted' ? 0.15 : 0.1,
    });
  }

  // Get safety signals
  const safetySignals = await prisma.safetySignal.findMany({
    where: { clinicianId },
    orderBy: { reportedAt: 'asc' },
  });

  for (const signal of safetySignals) {
    timeline.push({
      timestamp: signal.reportedAt.toISOString(),
      event: `Safety signal: ${signal.type}`,
      impact: signal.severity === 'high' ? -0.3 : signal.severity === 'moderate' ? -0.15 : -0.05,
    });
  }

  return timeline.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
}

/**
 * Task 340.1 — Get or create trust graph
 */
export async function getOrCreateTrustGraph(clinicianId: string): Promise<TrustGraphData> {
  let graph = await prisma.clinicianEmployerTrustGraph.findUnique({
    where: { clinicianId },
  });

  if (!graph) {
    // Get all employers this clinician has worked with
    const hiringEvents = await prisma.hiringEvent.findMany({
      where: { clinicianId },
      select: { employerId: true },
      distinct: ['employerId'],
    });

    const employers = hiringEvents.map((e) => e.employerId);

    const nodes = [
      {
        id: clinicianId,
        type: 'clinician' as const,
        score: 0.5,
        metadata: {},
      },
      ...employers.map((empId) => ({
        id: empId,
        type: 'employer' as const,
        score: 0.5,
        metadata: {},
      })),
    ];

    const edges = await Promise.all(
      employers.map(async (empId) => {
        const clinicianScore = await scoreClinicianToEmployerTrust(clinicianId, empId);
        const employerScore = await scoreEmployerToClinicianTrust(empId, clinicianId);
        const asymmetry = await detectTrustAsymmetry(clinicianId, empId);

        return {
          from: clinicianId,
          to: empId,
          trustScore: (clinicianScore + employerScore) / 2,
          asymmetry: asymmetry.asymmetry,
          metadata: {},
        };
      }),
    );

    const evolution = await buildTrustTimeline(clinicianId);

    const graphData: TrustGraphData = {
      nodes,
      edges,
      overallScore: edges.length > 0 ? edges.reduce((sum, e) => sum + e.trustScore, 0) / edges.length : 0.5,
      evolution,
    };

    graph = await prisma.clinicianEmployerTrustGraph.create({
      data: {
        clinicianId,
        graph: graphData,
      },
    });
  }

  return graph.graph as TrustGraphData;
}

/**
 * Task 340.10 — Anchor trust graph snapshot
 */
export async function anchorTrustGraphSnapshot(clinicianId: string): Promise<string | null> {
  try {
    const graph = await prisma.clinicianEmployerTrustGraph.findUnique({
      where: { clinicianId },
    });

    if (!graph) {
      return null;
    }

    const graphData = graph.graph as TrustGraphData;

    const receipt = await chainClient.submitAuditEvent({
      eventType: 'clinicianEmployerTrustAnchored',
      payload: {
        clinicianId,
        overallScore: graphData.overallScore,
        nodeCount: graphData.nodes.length,
        edgeCount: graphData.edges.length,
        evolutionEvents: graphData.evolution.length,
      },
    });

    return receipt.txHash;
  } catch (error) {
    console.error('[trustGraph] anchor failed', error);
    return null;
  }
}


import { PrismaClient } from '@prisma/client';
import { AuditAnchorService } from '../audit/anchor';
import { ChainClient } from '../chain/client';

const prisma = new PrismaClient();
const chainClient = new ChainClient();
const anchorService = new AuditAnchorService();

export interface RoutingGridNode {
  nodeId: string;
  nodeType: 'clinician' | 'region' | 'specialty' | 'employer' | 'shortage';
  metadata: Record<string, unknown>;
}

export interface RoutingGridEdge {
  from: string;
  to: string;
  weight: number;
  factors: {
    readiness?: number;
    specialty?: number;
    shortage?: number;
    employerTrust?: number;
  };
}

export interface RoutingGrid {
  nodes: RoutingGridNode[];
  edges: RoutingGridEdge[];
  updatedAt: string;
}

/**
 * Task 274.2 — Regional routing inference engine v3
 * Infer optimal paths for clinician deployment
 */
export async function inferOptimalPaths(
  clinicianId: string,
  targetRegion: string,
  specialty: string,
): Promise<Array<{ path: string[]; score: number; factors: Record<string, number> }>> {
  const grid = await getOrCreateGrid();

  // Find clinician node
  const clinicianNode = grid.nodes.find(
    (n) => n.nodeType === 'clinician' && n.metadata.clinicianId === clinicianId,
  );

  if (!clinicianNode) {
    return [];
  }

  // Find target region node
  const targetNode = grid.nodes.find(
    (n) => n.nodeType === 'region' && n.metadata.region === targetRegion,
  );

  if (!targetNode) {
    return [];
  }

  // Simple pathfinding (Dijkstra-like)
  const paths: Array<{ path: string[]; score: number; factors: Record<string, number> }> = [];
  const visited = new Set<string>();
  const queue: Array<{ nodeId: string; path: string[]; score: number; factors: Record<string, number> }> = [
    { nodeId: clinicianNode.nodeId, path: [clinicianNode.nodeId], score: 1.0, factors: {} },
  ];

  while (queue.length > 0 && paths.length < 10) {
    const current = queue.shift()!;

    if (visited.has(current.nodeId)) continue;
    visited.add(current.nodeId);

    if (current.nodeId === targetNode.nodeId) {
      paths.push(current);
      continue;
    }

    // Find outgoing edges
    const edges = grid.edges.filter((e) => e.from === current.nodeId);

    for (const edge of edges) {
      if (visited.has(edge.to)) continue;

      const newScore = current.score * edge.weight;
      const newFactors = {
        ...current.factors,
        ...edge.factors,
      };

      queue.push({
        nodeId: edge.to,
        path: [...current.path, edge.to],
        score: newScore,
        factors: newFactors,
      });
    }
  }

  return paths.sort((a, b) => b.score - a.score);
}

/**
 * Task 274.3 — Multi-factor routing weights
 * Weights: readiness, specialty, shortage, employer trust
 */
export async function calculateRoutingWeights(
  clinicianId: string,
  targetRegion: string,
  specialty: string,
): Promise<{ readiness: number; specialty: number; shortage: number; employerTrust: number }> {
  // Fetch readiness score
  const readinessScore = await prisma.clinicianReadinessScore.findUnique({
    where: { clinicianId },
  });

  // Check specialty match
  const specialtyMatch = 0.9; // Simplified - would check actual specialty

  // Check shortage in target region
  const shortageSignal = await prisma.marketSignal.findFirst({
    where: { region: targetRegion, specialty },
  });

  // Check employer trust (simplified)
  const employerTrust = 0.8; // Would check actual employer reputation

  return {
    readiness: readinessScore?.score ?? 0.5,
    specialty: specialtyMatch,
    shortage: shortageSignal ? shortageSignal.demand / (shortageSignal.supply + 1) : 0.5,
    employerTrust,
  };
}

/**
 * Task 274.4 — Constraint-aware routing logic
 * Respect compacts, visas, hospital policies
 */
export async function applyRoutingConstraints(
  clinicianId: string,
  targetRegion: string,
): Promise<{ eligible: boolean; constraints: string[]; method?: string }> {
  const constraints: string[] = [];

  // Check compact eligibility
  const compact = await prisma.compactEligibility.findFirst({
    where: { clinicianId, eligible: true },
  });

  // Check licenses
  const licenses = await prisma.globalLicense.findMany({
    where: { clinicianId, status: 'active' },
  });

  const hasDirectLicense = licenses.some(
    (l) => l.state === targetRegion || l.country === targetRegion,
  );

  if (!hasDirectLicense && !compact) {
    constraints.push('No direct license or compact eligibility');
    return { eligible: false, constraints };
  }

  // Check visa status (simplified - would check actual visa records)
  // Check hospital policies (simplified)

  return {
    eligible: true,
    constraints,
    method: hasDirectLicense ? 'direct' : 'compact',
  };
}

/**
 * Task 274.6 — Cross-system coordination engine
 * Coordinate routing across multiple health systems
 */
export async function coordinateCrossSystemRouting(
  clinicianId: string,
  systems: string[],
): Promise<Record<string, { status: string; routeId?: string }>> {
  const results: Record<string, { status: string; routeId?: string }> = {};

  for (const systemId of systems) {
    try {
      // Create routing request
      const request = await prisma.routingRequest.create({
        data: {
          clinicianId,
          targetSystem: systemId,
          method: 'OIDC4VC',
          payload: {},
          status: 'pending',
        },
      });

      results[systemId] = {
        status: 'pending',
        routeId: request.id,
      };
    } catch (error) {
      results[systemId] = {
        status: 'failed',
      };
    }
  }

  return results;
}

/**
 * Task 274.7 — Routing feedback loop
 * Learn from hiring outcomes
 */
export async function recordRoutingOutcome(
  routeId: string,
  outcome: 'hired' | 'rejected' | 'withdrawn',
  metadata?: Record<string, unknown>,
): Promise<void> {
  // Update routing request with outcome
  await prisma.routingRequest.update({
    where: { id: routeId },
    data: {
      status: outcome === 'hired' ? 'acked' : 'failed',
      payload: metadata as any,
    },
  });

  // Update grid weights based on outcome (simplified)
  // In production, would adjust edge weights in the grid
}

/**
 * Task 274.8 — Clinician preference integration v2
 * Match personal preferences into routing logic
 */
export async function applyClinicianPreferences(
  clinicianId: string,
  preferences: {
    preferredRegions?: string[];
    preferredSpecialties?: string[];
    travelRadius?: number;
    scheduleFit?: number;
  },
): Promise<{ adjustedScore: number; factors: Record<string, number> }> {
  const baseWeights = await calculateRoutingWeights(clinicianId, '', '');

  let adjustedScore = 1.0;
  const factors: Record<string, number> = {};

  if (preferences.preferredRegions && preferences.preferredRegions.length > 0) {
    factors.regionPreference = 1.2; // Boost for preferred regions
    adjustedScore *= 1.2;
  }

  if (preferences.travelRadius) {
    factors.travelFit = 0.9; // Slight penalty for travel
    adjustedScore *= 0.9;
  }

  if (preferences.scheduleFit) {
    factors.scheduleFit = preferences.scheduleFit;
    adjustedScore *= preferences.scheduleFit;
  }

  return {
    adjustedScore,
    factors: {
      ...baseWeights,
      ...factors,
    },
  };
}

/**
 * Task 274.9 — Routing stress-test simulator
 * Simulate heavy-demand surge events
 */
export async function simulateSurgeEvent(
  region: string,
  specialty: string,
  demandMultiplier: number,
): Promise<{
  availableClinicians: number;
  routingCapacity: number;
  bottlenecks: string[];
}> {
  const grid = await getOrCreateGrid();

  // Find clinicians in region with specialty
  const availableNodes = grid.nodes.filter(
    (n) =>
      n.nodeType === 'clinician' &&
      n.metadata.region === region &&
      n.metadata.specialty === specialty,
  );

  const bottlenecks: string[] = [];

  // Check routing capacity
  const routingCapacity = availableNodes.length * 0.8; // 80% utilization

  if (routingCapacity < demandMultiplier * 10) {
    bottlenecks.push('Insufficient routing capacity');
  }

  return {
    availableClinicians: availableNodes.length,
    routingCapacity,
    bottlenecks,
  };
}

/**
 * Get or create routing grid
 */
async function getOrCreateGrid(): Promise<RoutingGrid> {
  let gridRecord = await prisma.workforceRoutingGrid.findFirst({
    orderBy: { updatedAt: 'desc' },
  });

  if (!gridRecord) {
    gridRecord = await prisma.workforceRoutingGrid.create({
      data: {
        grid: {
          nodes: [],
          edges: [],
        },
      },
    });
  }

  return gridRecord.grid as RoutingGrid;
}

/**
 * Task 274.10 — Anchor routing grid snapshot
 */
export async function anchorRoutingGridSnapshot(): Promise<string | null> {
  try {
    const grid = await getOrCreateGrid();

    const receipt = await chainClient.submitAuditEvent({
      eventType: 'routingGridAnchored',
      payload: {
        nodeCount: grid.nodes.length,
        edgeCount: grid.edges.length,
        updatedAt: grid.updatedAt,
      },
    });

    return receipt.txHash;
  } catch (error) {
    console.error('[WorkforceRoutingGrid] Failed to anchor grid snapshot', error);
    return null;
  }
}


import { PrismaClient } from '@prisma/client';
import { ChainClient } from '../chain/client';

const prisma = new PrismaClient();
const chainClient = new ChainClient();

export interface ReputationMeshData {
  nodes: Array<{
    employerId: string;
    score: number;
    signals: Array<{ type: string; weight: number; timestamp: string }>;
  }>;
  edges: Array<{
    from: string;
    to: string;
    influence: number;
    type: string;
  }>;
  updatedAt: string;
}

/**
 * Task 276.2 — Employer behavior ingestion v3
 * Ingest completion rates, fairness, compliance behavior
 */
export async function ingestEmployerBehavior(
  employerId: string,
  behavior: {
    completionRate?: number;
    fairnessScore?: number;
    complianceEvents?: number;
    hiringOutcomes?: Array<{ outcome: string; timestamp: string }>;
  },
): Promise<void> {
  const mesh = await getOrCreateMesh();

  // Find or create employer node
  let node = mesh.nodes.find((n) => n.employerId === employerId);

  if (!node) {
    node = {
      employerId,
      score: 0.5,
      signals: [],
    };
    mesh.nodes.push(node);
  }

  // Add signals
  if (behavior.completionRate !== undefined) {
    node.signals.push({
      type: 'completion_rate',
      weight: behavior.completionRate,
      timestamp: new Date().toISOString(),
    });
  }

  if (behavior.fairnessScore !== undefined) {
    node.signals.push({
      type: 'fairness',
      weight: behavior.fairnessScore,
      timestamp: new Date().toISOString(),
    });
  }

  if (behavior.complianceEvents !== undefined) {
    node.signals.push({
      type: 'compliance',
      weight: 1.0 - Math.min(1.0, behavior.complianceEvents / 10), // Penalty for compliance issues
      timestamp: new Date().toISOString(),
    });
  }

  // Recalculate score
  node.score = calculateReputationScore(node.signals);

  await saveMesh(mesh);
}

/**
 * Task 276.3 — Inter-employer influence mapping
 * Graph influence between hospitals
 */
export async function mapEmployerInfluence(
  fromEmployerId: string,
  toEmployerId: string,
  influenceType: 'partnership' | 'acquisition' | 'referral' | 'shared_network',
  strength: number,
): Promise<void> {
  const mesh = await getOrCreateMesh();

  // Find or create edge
  const existingEdge = mesh.edges.find(
    (e) => e.from === fromEmployerId && e.to === toEmployerId,
  );

  if (existingEdge) {
    existingEdge.influence = strength;
    existingEdge.type = influenceType;
  } else {
    mesh.edges.push({
      from: fromEmployerId,
      to: toEmployerId,
      influence: strength,
      type: influenceType,
    });
  }

  await saveMesh(mesh);
}

/**
 * Task 276.5 — Network reputation blending engine
 * Blend multiple signals into unified score
 */
export function calculateReputationScore(
  signals: Array<{ type: string; weight: number; timestamp: string }>,
): number {
  if (signals.length === 0) {
    return 0.5;
  }

  // Weight recent signals more heavily
  const now = Date.now();
  const weightedSum = signals.reduce((sum, signal) => {
    const age = (now - new Date(signal.timestamp).getTime()) / (1000 * 60 * 60 * 24); // days
    const recencyWeight = Math.max(0.1, 1.0 - age / 365); // Decay over 1 year
    return sum + signal.weight * recencyWeight;
  }, 0);

  const totalWeight = signals.reduce((sum, signal) => {
    const age = (now - new Date(signal.timestamp).getTime()) / (1000 * 60 * 60 * 24);
    const recencyWeight = Math.max(0.1, 1.0 - age / 365);
    return sum + recencyWeight;
  }, 0);

  return Math.max(0, Math.min(1, weightedSum / totalWeight));
}

/**
 * Task 276.6 — Reputational drift analysis
 * Detect shifts in employer behavior
 */
export async function analyzeReputationalDrift(
  employerId: string,
  windowDays: number = 90,
): Promise<{
  drift: number;
  direction: 'improving' | 'declining' | 'stable';
  factors: string[];
}> {
  const mesh = await getOrCreateMesh();
  const node = mesh.nodes.find((n) => n.employerId === employerId);

  if (!node || node.signals.length < 2) {
    return { drift: 0, direction: 'stable', factors: [] };
  }

  const cutoff = new Date(Date.now() - windowDays * 24 * 60 * 60 * 1000);
  const recentSignals = node.signals.filter(
    (s) => new Date(s.timestamp) >= cutoff,
  );
  const olderSignals = node.signals.filter((s) => new Date(s.timestamp) < cutoff);

  if (recentSignals.length === 0 || olderSignals.length === 0) {
    return { drift: 0, direction: 'stable', factors: [] };
  }

  const recentScore = calculateReputationScore(recentSignals);
  const olderScore = calculateReputationScore(olderSignals);
  const drift = recentScore - olderScore;

  const factors: string[] = [];
  if (Math.abs(drift) > 0.1) {
    factors.push(`Score changed by ${(drift * 100).toFixed(1)}%`);
  }

  return {
    drift,
    direction: drift > 0.05 ? 'improving' : drift < -0.05 ? 'declining' : 'stable',
    factors,
  };
}

/**
 * Task 276.7 — Systemic risk detector
 * Find clusters of unsafe recruiters/employers
 */
export async function detectSystemicRisk(): Promise<
  Array<{ clusterId: string; employers: string[]; riskLevel: string; factors: string[] }>
> {
  const mesh = await getOrCreateMesh();

  // Find low-reputation employers
  const lowRepEmployers = mesh.nodes
    .filter((n) => n.score < 0.4)
    .map((n) => n.employerId);

  // Find connected clusters
  const clusters: Array<{
    clusterId: string;
    employers: string[];
    riskLevel: string;
    factors: string[];
  }> = [];

  const visited = new Set<string>();

  for (const employerId of lowRepEmployers) {
    if (visited.has(employerId)) continue;

    const cluster = findConnectedEmployers(mesh, employerId, visited);
    if (cluster.length >= 2) {
      clusters.push({
        clusterId: `cluster_${clusters.length + 1}`,
        employers: cluster,
        riskLevel: cluster.length >= 5 ? 'high' : 'medium',
        factors: ['Low reputation scores', 'Connected network'],
      });
    }
  }

  return clusters;
}

function findConnectedEmployers(
  mesh: ReputationMeshData,
  startId: string,
  visited: Set<string>,
): string[] {
  const cluster: string[] = [];
  const queue = [startId];

  while (queue.length > 0) {
    const current = queue.shift()!;
    if (visited.has(current)) continue;
    visited.add(current);
    cluster.push(current);

    // Find connected employers
    const connected = mesh.edges
      .filter((e) => (e.from === current || e.to === current) && e.influence > 0.5)
      .map((e) => (e.from === current ? e.to : e.from));

    for (const connectedId of connected) {
      if (!visited.has(connectedId)) {
        queue.push(connectedId);
      }
    }
  }

  return cluster;
}

/**
 * Task 276.8 — Positive-outlier booster
 * Lift high-integrity employers
 */
export async function boostHighIntegrityEmployers(): Promise<
  Array<{ employerId: string; boost: number; rationale: string[] }>
> {
  const mesh = await getOrCreateMesh();

  const boosters: Array<{ employerId: string; boost: number; rationale: string[] }> = [];

  for (const node of mesh.nodes) {
    if (node.score >= 0.85) {
      const boost = (node.score - 0.85) * 0.2; // Additional boost for high scores
      boosters.push({
        employerId: node.employerId,
        boost,
        rationale: ['High reputation score', 'Consistent positive signals'],
      });
    }
  }

  return boosters;
}

/**
 * Task 276.9 — Employer reputation prediction
 * Forecast employer reputation changes
 */
export async function predictReputationChange(
  employerId: string,
  horizonDays: number = 30,
): Promise<{ predictedScore: number; confidence: number; factors: string[] }> {
  const mesh = await getOrCreateMesh();
  const node = mesh.nodes.find((n) => n.employerId === employerId);

  if (!node) {
    return { predictedScore: 0.5, confidence: 0, factors: ['No historical data'] };
  }

  // Simple trend analysis
  const recentSignals = node.signals
    .slice(-10)
    .map((s) => ({ weight: s.weight, time: new Date(s.timestamp).getTime() }));

  if (recentSignals.length < 3) {
    return { predictedScore: node.score, confidence: 0.3, factors: ['Insufficient data'] };
  }

  // Calculate trend
  const trend =
    (recentSignals[recentSignals.length - 1].weight - recentSignals[0].weight) /
    (recentSignals[recentSignals.length - 1].time - recentSignals[0].time);

  const predictedScore = Math.max(
    0,
    Math.min(1, node.score + trend * horizonDays * 24 * 60 * 60 * 1000),
  );

  return {
    predictedScore,
    confidence: 0.7,
    factors: [`Trend: ${trend > 0 ? 'improving' : 'declining'}`],
  };
}

/**
 * Get or create reputation mesh
 */
async function getOrCreateMesh(): Promise<ReputationMeshData> {
  let meshRecord = await prisma.reputationMesh.findFirst({
    orderBy: { updatedAt: 'desc' },
  });

  if (!meshRecord) {
    meshRecord = await prisma.reputationMesh.create({
      data: {
        mesh: {
          nodes: [],
          edges: [],
          updatedAt: new Date().toISOString(),
        },
      },
    });
  }

  return meshRecord.mesh as ReputationMeshData;
}

async function saveMesh(mesh: ReputationMeshData): Promise<void> {
  const existing = await prisma.reputationMesh.findFirst({
    orderBy: { updatedAt: 'desc' },
  });

  if (existing) {
    await prisma.reputationMesh.update({
      where: { id: existing.id },
      data: {
        mesh: mesh as any,
        updatedAt: new Date(),
      },
    });
  } else {
    await prisma.reputationMesh.create({
      data: {
        mesh: mesh as any,
      },
    });
  }
}

/**
 * Task 276.10 — Anchor reputation mesh snapshot
 */
export async function anchorReputationMeshSnapshot(): Promise<string | null> {
  try {
    const mesh = await getOrCreateMesh();

    const receipt = await chainClient.submitAuditEvent({
      eventType: 'reputationMeshAnchored',
      payload: {
        nodeCount: mesh.nodes.length,
        edgeCount: mesh.edges.length,
        avgScore: mesh.nodes.length > 0
          ? mesh.nodes.reduce((sum, n) => sum + n.score, 0) / mesh.nodes.length
          : 0,
        updatedAt: mesh.updatedAt,
      },
    });

    return receipt.txHash;
  } catch (error) {
    console.error('[ReputationMesh] Failed to anchor mesh snapshot', error);
    return null;
  }
}


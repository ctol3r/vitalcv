import { prisma } from '@/lib/prisma';
import { anchorEvent } from '../audit/anchor';
import { createHash } from 'crypto';

/**
 * Batch 220 — Global Trust Intelligence Layer v5
 * Unified trust scoring across issuers, employers, clinicians, verifiers, and regulators
 */

export interface TrustNode {
  id: string;
  type: 'issuer' | 'verifier' | 'employer' | 'clinician' | 'regulator';
  score: number;
  metadata?: Record<string, unknown>;
}

export interface TrustEdge {
  from: string;
  to: string;
  weight: number;
  type: string;
  metadata?: Record<string, unknown>;
}

export interface TrustGraph {
  nodes: TrustNode[];
  edges: TrustEdge[];
}

/**
 * Collect trust signals from various sources
 */
export async function collectTrustSignals(): Promise<{
  issuers: Array<{ id: string; score: number; signals: Record<string, unknown> }>;
  verifiers: Array<{ id: string; score: number; signals: Record<string, unknown> }>;
  employers: Array<{ id: string; score: number; signals: Record<string, unknown> }>;
  clinicians: Array<{ id: string; score: number; signals: Record<string, unknown> }>;
  chainAnchors: Array<{ hash: string; score: number; signals: Record<string, unknown> }>;
}> {
  // Collect from issuers
  const issuers = await prisma.trustedIssuer.findMany({
    take: 100,
  });

  // Collect from verifiers (using VerifierGateway)
  const verifiers = await prisma.verifierGateway.findMany({
    take: 100,
  });

  // Collect from employers (using EmployerTrust)
  const employers = await prisma.employerTrust.findMany({
    take: 100,
  });

  // Collect from clinicians (using ClinicianProfile and related trust signals)
  const clinicians = await prisma.clinicianProfile.findMany({
    take: 100,
    select: {
      id: true,
    },
  });

  // Collect chain anchor signals
  const chainAnchors: Array<{ hash: string; score: number; signals: Record<string, unknown> }> = [];

  return {
    issuers: issuers.map((issuer) => ({
      id: issuer.did,
      score: 0.8, // Default trust score
      signals: {
        orgNpi: issuer.orgNpi,
        orgName: issuer.orgName,
        addedAt: issuer.addedAt,
      },
    })),
    verifiers: verifiers.map((v) => ({
      id: v.id,
      score: 0.7,
      signals: {
        orgId: v.orgId,
        rateLimit: v.rateLimit,
        createdAt: v.createdAt,
      },
    })),
    employers: employers.map((e) => ({
      id: e.orgId,
      score: e.score,
      signals: e.metrics as Record<string, unknown>,
    })),
    clinicians: clinicians.map((c) => ({
      id: c.id,
      score: 0.6,
      signals: {},
    })),
    chainAnchors,
  };
}

/**
 * Detect trust clusters in the network
 */
export function detectTrustClusters(graph: TrustGraph): {
  highTrust: string[];
  lowTrust: string[];
  anomalies: Array<{ nodeId: string; reason: string }>;
} {
  const highTrust: string[] = [];
  const lowTrust: string[] = [];
  const anomalies: Array<{ nodeId: string; reason: string }> = [];

  graph.nodes.forEach((node) => {
    if (node.score >= 0.8) {
      highTrust.push(node.id);
    } else if (node.score < 0.3) {
      lowTrust.push(node.id);
    }

    // Detect anomalies (sudden drops, isolated nodes)
    const connectedEdges = graph.edges.filter((e) => e.from === node.id || e.to === node.id);
    if (connectedEdges.length === 0 && node.score < 0.5) {
      anomalies.push({
        nodeId: node.id,
        reason: 'isolated_low_trust',
      });
    }
  });

  return { highTrust, lowTrust, anomalies };
}

/**
 * Calculate trust confidence index (probability-based)
 */
export function calculateTrustConfidence(
  nodeId: string,
  graph: TrustGraph,
): {
  confidence: number;
  factors: Array<{ factor: string; weight: number }>;
} {
  const node = graph.nodes.find((n) => n.id === nodeId);
  if (!node) {
    return { confidence: 0, factors: [] };
  }

  const factors: Array<{ factor: string; weight: number }> = [];

  // Direct trust score
  factors.push({ factor: 'direct_score', weight: node.score * 0.4 });

  // Connected nodes influence
  const connectedEdges = graph.edges.filter((e) => e.from === nodeId || e.to === nodeId);
  const avgEdgeWeight =
    connectedEdges.length > 0
      ? connectedEdges.reduce((sum, e) => sum + e.weight, 0) / connectedEdges.length
      : 0;
  factors.push({ factor: 'network_influence', weight: avgEdgeWeight * 0.3 });

  // Node type bonus
  const typeBonuses: Record<string, number> = {
    regulator: 0.2,
    issuer: 0.15,
    verifier: 0.1,
    employer: 0.05,
    clinician: 0.0,
  };
  factors.push({ factor: 'type_bonus', weight: typeBonuses[node.type] || 0 });

  const confidence = factors.reduce((sum, f) => sum + f.weight, 0);
  return { confidence: Math.min(1, Math.max(0, confidence)), factors };
}

/**
 * Detect trust scoring anomalies
 */
export function detectTrustAnomalies(
  currentGraph: TrustGraph,
  previousGraph?: TrustGraph,
): Array<{
  nodeId: string;
  anomaly: string;
  severity: 'low' | 'medium' | 'high';
  details: Record<string, unknown>;
}> {
  const anomalies: Array<{
    nodeId: string;
    anomaly: string;
    severity: 'low' | 'medium' | 'high';
    details: Record<string, unknown>;
  }> = [];

  if (!previousGraph) {
    return anomalies;
  }

  currentGraph.nodes.forEach((currentNode) => {
    const previousNode = previousGraph.nodes.find((n) => n.id === currentNode.id);
    if (!previousNode) return;

    const scoreDelta = currentNode.score - previousNode.score;

    // Sudden drop
    if (scoreDelta < -0.3) {
      anomalies.push({
        nodeId: currentNode.id,
        anomaly: 'sudden_trust_drop',
        severity: scoreDelta < -0.5 ? 'high' : 'medium',
        details: {
          previousScore: previousNode.score,
          currentScore: currentNode.score,
          delta: scoreDelta,
        },
      });
    }

    // Sudden increase (potential manipulation)
    if (scoreDelta > 0.4) {
      anomalies.push({
        nodeId: currentNode.id,
        anomaly: 'unexpected_trust_increase',
        severity: 'medium',
        details: {
          previousScore: previousNode.score,
          currentScore: currentNode.score,
          delta: scoreDelta,
        },
      });
    }
  });

  return anomalies;
}

/**
 * Weight proofs based on trust paths
 */
export function calculateTrustWeightedVerification(
  verifierId: string,
  issuerId: string,
  graph: TrustGraph,
): {
  weight: number;
  path: string[];
  confidence: number;
} {
  // Find shortest trust path
  const path = findTrustPath(issuerId, verifierId, graph);
  const pathWeight = path.length > 0 ? calculatePathWeight(path, graph) : 0;

  return {
    weight: pathWeight,
    path,
    confidence: pathWeight,
  };
}

function findTrustPath(from: string, to: string, graph: TrustGraph): string[] {
  // Simple BFS to find path
  const queue: Array<{ node: string; path: string[] }> = [{ node: from, path: [from] }];
  const visited = new Set<string>([from]);

  while (queue.length > 0) {
    const { node, path } = queue.shift()!;

    if (node === to) {
      return path;
    }

    graph.edges
      .filter((e) => e.from === node || e.to === node)
      .forEach((edge) => {
        const nextNode = edge.from === node ? edge.to : edge.from;
        if (!visited.has(nextNode)) {
          visited.add(nextNode);
          queue.push({ node: nextNode, path: [...path, nextNode] });
        }
      });
  }

  return [];
}

function calculatePathWeight(path: string[], graph: TrustGraph): number {
  if (path.length < 2) return 0;

  let weight = 1;
  for (let i = 0; i < path.length - 1; i++) {
    const edge = graph.edges.find(
      (e) => (e.from === path[i] && e.to === path[i + 1]) || (e.from === path[i + 1] && e.to === path[i]),
    );
    if (edge) {
      weight *= edge.weight;
    } else {
      weight *= 0.5; // Penalty for missing edge
    }
  }

  return weight;
}

/**
 * Generate regulator trust audit pack
 */
export async function generateRegulatorTrustAuditPack(regulatorId: string): Promise<{
  packId: string;
  regulatorId: string;
  trustProofs: Array<{ entityId: string; proof: Record<string, unknown> }>;
  summary: Record<string, unknown>;
}> {
  const signals = await collectTrustSignals();
  const graph = await buildTrustGraph();

  const regulatorNode = graph.nodes.find((n) => n.id === regulatorId && n.type === 'regulator');
  if (!regulatorNode) {
    throw new Error(`Regulator ${regulatorId} not found`);
  }

  const trustProofs = graph.nodes
    .filter((n) => n.type !== 'regulator')
    .map((node) => {
      const path = findTrustPath(regulatorId, node.id, graph);
      return {
        entityId: node.id,
        proof: {
          nodeId: node.id,
          trustScore: node.score,
          trustPath: path,
          pathWeight: calculatePathWeight(path, graph),
        },
      };
    });

  return {
    packId: `trust_audit_${regulatorId}_${Date.now()}`,
    regulatorId,
    trustProofs,
    summary: {
      totalEntities: graph.nodes.length,
      highTrustCount: graph.nodes.filter((n) => n.score >= 0.8).length,
      lowTrustCount: graph.nodes.filter((n) => n.score < 0.3).length,
      averageTrust: graph.nodes.reduce((sum, n) => sum + n.score, 0) / graph.nodes.length,
    },
  };
}

/**
 * Propagate trust changes through graph
 */
export function propagateTrustInfluence(
  nodeId: string,
  newScore: number,
  graph: TrustGraph,
): TrustGraph {
  const updatedGraph = { ...graph };
  const node = updatedGraph.nodes.find((n) => n.id === nodeId);
  if (!node) return updatedGraph;

  const oldScore = node.score;
  node.score = newScore;

  // Propagate to connected nodes (damped influence)
  const connectedEdges = updatedGraph.edges.filter((e) => e.from === nodeId || e.to === nodeId);
  const scoreDelta = newScore - oldScore;
  const dampingFactor = 0.1; // Only 10% influence propagates

  connectedEdges.forEach((edge) => {
    const connectedNodeId = edge.from === nodeId ? edge.to : edge.from;
    const connectedNode = updatedGraph.nodes.find((n) => n.id === connectedNodeId);
    if (connectedNode) {
      connectedNode.score = Math.max(
        0,
        Math.min(1, connectedNode.score + scoreDelta * dampingFactor * edge.weight),
      );
    }
  });

  return updatedGraph;
}

/**
 * Build trust graph from collected signals
 */
export async function buildTrustGraph(): Promise<TrustGraph> {
  const signals = await collectTrustSignals();
  const nodes: TrustNode[] = [];
  const edges: TrustEdge[] = [];

  // Add issuer nodes
  signals.issuers.forEach((issuer) => {
    nodes.push({
      id: issuer.id,
      type: 'issuer',
      score: issuer.score,
      metadata: issuer.signals,
    });
  });

  // Add verifier nodes
  signals.verifiers.forEach((verifier) => {
    nodes.push({
      id: verifier.id,
      type: 'verifier',
      score: verifier.score,
      metadata: verifier.signals,
    });
  });

  // Add employer nodes
  signals.employers.forEach((employer) => {
    nodes.push({
      id: employer.id,
      type: 'employer',
      score: employer.score,
      metadata: employer.signals,
    });
  });

  // Add clinician nodes
  signals.clinicians.forEach((clinician) => {
    nodes.push({
      id: clinician.id,
      type: 'clinician',
      score: clinician.score,
      metadata: clinician.signals,
    });
  });

  // Create edges based on relationships (simplified)
  // In production, this would use actual relationship data
  for (let i = 0; i < nodes.length; i++) {
    for (let j = i + 1; j < nodes.length; j++) {
      if (Math.random() > 0.9) {
        // Random connections for demo
        edges.push({
          from: nodes[i].id,
          to: nodes[j].id,
          weight: Math.random(),
          type: 'trust_relationship',
        });
      }
    }
  }

  return { nodes, edges };
}

/**
 * Update and anchor global trust graph
 */
export async function updateGlobalTrustGraph(): Promise<void> {
  const graph = await buildTrustGraph();
  const graphHash = createHash('sha256').update(JSON.stringify(graph)).digest('hex');

  await prisma.globalTrustGraph.upsert({
    where: { id: 'current' },
    create: {
      id: 'current',
      nodes: graph.nodes as any,
      edges: graph.edges as any,
      updatedAt: new Date(),
    },
    update: {
      nodes: graph.nodes as any,
      edges: graph.edges as any,
      updatedAt: new Date(),
    },
  });

  // Anchor to blockchain
  anchorEvent('globalTrustAnchored', {
    graphHash,
    nodeCount: graph.nodes.length,
    edgeCount: graph.edges.length,
    timestamp: new Date().toISOString(),
  });
}









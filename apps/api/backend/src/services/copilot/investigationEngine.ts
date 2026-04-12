/**
 * investigationEngine.ts — VitalCV Investigation Engine
 *
 * Deep provider intelligence investigations. Composes:
 *   - Trust Score V1 (dimensional breakdown)
 *   - Freshness Model (verification recency)
 *   - Divergence Engine (cross-source conflicts)
 *   - Graph Engine (network topology)
 *   - Intelligence Engine (anomalies, insights)
 *   - Identity Pipeline (artifact history)
 */

import { log } from '../../obs/logger';
import { computeTrustScoreV1, type TrustScoreV1 } from '../trust/trustScoreV1';
import { computeTrustFreshness, type ClaimFreshnessReport } from '../identity/freshnessModel';
import { detectDivergence, type DivergenceReport } from '../identity/divergenceEngine';
import {
  getGraphNodeNeighbors,
  searchGraphNodes,
} from '../graph-engine/queryService';
import type { GraphNode, GraphEdge, GraphQueryResult } from '../graph-engine/schema';
import { generateInsights, runAnomalyLoop, type Insight, type AnomalyReport } from '../intelligence/intelligenceEngine';
import prisma from '../../graphql/prisma_client';

// ── Types ──────────────────────────────────────────────────────────────────────

export interface ProviderProfile {
  npi:                string;
  graphNode:          GraphNode | null;
  trustScore:         TrustScoreV1;
  freshness:          ClaimFreshnessReport;
  divergence:         DivergenceReport;
  anomalyReport:      AnomalyReport;
  artifactCount:      number;
  recentArtifacts:    ArtifactSummary[];
}

export interface ArtifactSummary {
  id:          string;
  source:      string;
  status:      string;
  verifiedAt:  string | null;
  createdAt:   string;
}

export interface NetworkAnalysis {
  rootNpi:             string;
  rootNode:            GraphNode | null;
  graph:               GraphQueryResult | null;
  collaborators:       CollaboratorNode[];
  institutions:        InstitutionCluster[];
  researchClusters:    ResearchCluster[];
  networkStats:        NetworkStats;
}

export interface CollaboratorNode {
  nodeId:       string;
  label:        string;
  type:         string;
  trustBand:    string | null;
  degree:       number;
  sharedEdges:  number;
  edgeTypes:    string[];
}

export interface InstitutionCluster {
  institutionId:    string;
  name:             string;
  memberCount:      number;
  memberNodeIds:    string[];
}

export interface ResearchCluster {
  clusterId:     string;
  label:         string;
  nodeIds:       string[];
  nodeCount:     number;
  edgeCount:     number;
  dominantType:  string;
}

export interface NetworkStats {
  totalNodes:         number;
  totalEdges:         number;
  avgDegree:          number;
  maxDegree:          number;
  clinicianCount:     number;
  institutionCount:   number;
  credentialCount:    number;
  isolatedNodes:      number;
}

export interface InvestigationReport {
  investigationId:   string;
  type:              'provider' | 'network' | 'comparison' | 'anomaly';
  startedAt:         string;
  completedAt:       string;
  durationMs:        number;
  profile:           ProviderProfile | null;
  network:           NetworkAnalysis | null;
  comparison:        ComparisonResult | null;
  insights:          Insight[];
  recommendations:   string[];
}

export interface ComparisonResult {
  providers:        ProviderProfile[];
  ranking:          { npi: string; score: number; band: string }[];
  strengthDelta:    { dimension: string; spread: number; leader: string }[];
  commonGaps:       string[];
}

// ── Helpers ────────────────────────────────────────────────────────────────────

/** Get edge type from GraphEdge (uses `type` field) */
function edgeType(e: GraphEdge): string {
  return e.type ?? 'unknown';
}

// ── Provider Profile ───────────────────────────────────────────────────────────

async function buildProviderProfile(npi: string): Promise<ProviderProfile> {
  const [trustScore, freshness, divergence, anomalyReport, graphNodes, artifacts] = await Promise.all([
    computeTrustScoreV1(npi),
    computeTrustFreshness(npi),
    detectDivergence(npi),
    runAnomalyLoop(npi),
    searchGraphNodes(npi),
    prisma.verificationArtifact.findMany({
      where: { npi },
      orderBy: { createdAt: 'desc' },
      take: 20,
      select: {
        id: true,
        source: true,
        status: true,
        verifiedAt: true,
        createdAt: true,
      },
    }),
  ]);

  const graphNode = graphNodes.length > 0 ? graphNodes[0]! : null;

  return {
    npi,
    graphNode,
    trustScore,
    freshness,
    divergence,
    anomalyReport,
    artifactCount: artifacts.length,
    recentArtifacts: artifacts.map(a => ({
      id: a.id,
      source: a.source,
      status: a.status ?? 'UNKNOWN',
      verifiedAt: a.verifiedAt?.toISOString() ?? null,
      createdAt: a.createdAt.toISOString(),
    })),
  };
}

// ── Network Analysis ───────────────────────────────────────────────────────────

async function analyzeNetwork(npi: string, depth = 2): Promise<NetworkAnalysis> {
  const graphNodes = await searchGraphNodes(npi);
  const rootNode = graphNodes.length > 0 ? graphNodes[0]! : null;

  if (!rootNode) {
    return {
      rootNpi: npi,
      rootNode: null,
      graph: null,
      collaborators: [],
      institutions: [],
      researchClusters: [],
      networkStats: {
        totalNodes: 0, totalEdges: 0, avgDegree: 0, maxDegree: 0,
        clinicianCount: 0, institutionCount: 0, credentialCount: 0, isolatedNodes: 0,
      },
    };
  }

  const graph = await getGraphNodeNeighbors(rootNode.id, depth);
  const nodes = graph.chunk.nodes;
  const edges = graph.chunk.edges;

  // Build collaborator list
  const collaborators: CollaboratorNode[] = [];
  const edgesByNode = new Map<string, { count: number; types: Set<string> }>();

  for (const edge of edges) {
    const otherId = edge.source === rootNode.id ? edge.target : edge.source;
    if (otherId === rootNode.id) continue;
    const entry = edgesByNode.get(otherId) ?? { count: 0, types: new Set<string>() };
    entry.count++;
    entry.types.add(edgeType(edge));
    edgesByNode.set(otherId, entry);
  }

  for (const node of nodes) {
    if (node.id === rootNode.id) continue;
    const edgeInfo = edgesByNode.get(node.id);
    collaborators.push({
      nodeId: node.id,
      label: node.label,
      type: node.type,
      trustBand: node.trustBand ?? null,
      degree: node.degree,
      sharedEdges: edgeInfo?.count ?? 0,
      edgeTypes: edgeInfo ? [...edgeInfo.types] : [],
    });
  }

  collaborators.sort((a, b) => b.sharedEdges - a.sharedEdges);

  // Identify institution clusters
  const institutionMap = new Map<string, { name: string; members: Set<string> }>();
  for (const node of nodes) {
    if (node.type === 'organization' || node.type === 'institution') {
      institutionMap.set(node.id, { name: node.label, members: new Set() });
    }
  }

  const instEdgeTypes = ['works_at', 'affiliated_with', 'trained_at', 'employed_by'];
  for (const edge of edges) {
    if (!instEdgeTypes.includes(edgeType(edge))) continue;
    for (const [instId, cluster] of institutionMap) {
      if (edge.source === instId || edge.target === instId) {
        const memberId = edge.source === instId ? edge.target : edge.source;
        cluster.members.add(memberId);
      }
    }
  }

  const institutions: InstitutionCluster[] = [...institutionMap.entries()]
    .filter(([, c]) => c.members.size > 0)
    .map(([id, c]) => ({
      institutionId: id,
      name: c.name,
      memberCount: c.members.size,
      memberNodeIds: [...c.members],
    }))
    .sort((a, b) => b.memberCount - a.memberCount);

  // Identify research clusters
  const researchEdgeTypes = ['co_author', 'co_investigator', 'cited_by', 'co_pi'];
  const researchEdges = edges.filter(e => researchEdgeTypes.includes(edgeType(e)));
  const researchNodeIds = new Set<string>();
  for (const e of researchEdges) {
    researchNodeIds.add(e.source);
    researchNodeIds.add(e.target);
  }

  const researchClusters: ResearchCluster[] = [];
  if (researchNodeIds.size > 0) {
    researchClusters.push({
      clusterId: `research-${rootNode.id}`,
      label: `Research network of ${rootNode.label}`,
      nodeIds: [...researchNodeIds],
      nodeCount: researchNodeIds.size,
      edgeCount: researchEdges.length,
      dominantType: 'publication',
    });
  }

  // Network stats
  const degrees = nodes.map(n => n.degree);
  const networkStats: NetworkStats = {
    totalNodes: nodes.length,
    totalEdges: edges.length,
    avgDegree: nodes.length > 0 ? degrees.reduce((a, b) => a + b, 0) / nodes.length : 0,
    maxDegree: nodes.length > 0 ? Math.max(...degrees) : 0,
    clinicianCount: nodes.filter(n => n.type === 'clinician').length,
    institutionCount: nodes.filter(n => n.type === 'organization' || n.type === 'institution').length,
    credentialCount: nodes.filter(n => n.type === 'credential' || n.type === 'license').length,
    isolatedNodes: nodes.filter(n => n.degree === 0).length,
  };

  return {
    rootNpi: npi,
    rootNode,
    graph,
    collaborators: collaborators.slice(0, 50),
    institutions,
    researchClusters,
    networkStats,
  };
}

// ── Comparison ─────────────────────────────────────────────────────────────────

async function compareProviders(npis: string[]): Promise<ComparisonResult> {
  const profiles = await Promise.all(npis.slice(0, 5).map(buildProviderProfile));

  const ranking = profiles
    .map(p => ({ npi: p.npi, score: p.trustScore.score, band: p.trustScore.band }))
    .sort((a, b) => b.score - a.score);

  const dimensionKeys = Object.keys(profiles[0]?.trustScore.dimensions ?? {});
  const strengthDelta = dimensionKeys.map(dim => {
    const scores = profiles.map(p => {
      const d = p.trustScore.dimensions[dim as keyof typeof p.trustScore.dimensions];
      return { npi: p.npi, score: d?.score ?? 0 };
    });
    scores.sort((a, b) => b.score - a.score);
    return {
      dimension: dim,
      spread: (scores[0]?.score ?? 0) - (scores[scores.length - 1]?.score ?? 0),
      leader: scores[0]?.npi ?? '',
    };
  }).filter(d => d.spread > 0).sort((a, b) => b.spread - a.spread);

  const gapSets = profiles.map(p => new Set(p.trustScore.gaps));
  const commonGaps = profiles[0]?.trustScore.gaps.filter(
    g => gapSets.every(s => s.has(g))
  ) ?? [];

  return { providers: profiles, ranking, strengthDelta, commonGaps };
}

// ── Main Entry Points ──────────────────────────────────────────────────────────

export async function investigateProvider(npi: string): Promise<InvestigationReport> {
  const startMs = Date.now();
  const id = `inv-${npi}-${Date.now()}`;

  log('info', `[Investigation] Starting provider investigation: NPI ${npi}`);

  const [profile, network, insights] = await Promise.all([
    buildProviderProfile(npi),
    analyzeNetwork(npi, 2),
    generateInsights({ limit: 5 }),
  ]);

  const recommendations: string[] = [];

  if (profile.trustScore.band === 'L0' || profile.trustScore.band === 'L1') {
    recommendations.push(`Trust score is ${profile.trustScore.bandLabel} (${profile.trustScore.score}/100). Priority: resolve gaps to reach L2+.`);
  }

  if (profile.divergence.conflicts.length > 0) {
    const blocking = profile.divergence.conflicts.filter(c => c.active && c.severity === 'HIGH');
    if (blocking.length > 0) {
      recommendations.push(`${blocking.length} HIGH conflict(s) detected. Immediate review required.`);
    }
  }

  if (profile.freshness.staleDimensions.length > 0) {
    recommendations.push(`${profile.freshness.staleDimensions.length} stale verification(s). Re-verify: ${profile.freshness.staleDimensions.map(d => d.label).join(', ')}.`);
  }

  if (network.networkStats.totalNodes < 3) {
    recommendations.push('Sparse graph network. Consider ingesting additional sources to build connections.');
  }

  if (network.collaborators.length > 20) {
    recommendations.push(`High-connectivity provider (${network.collaborators.length} collaborators). Monitor for influence propagation risk.`);
  }

  const endMs = Date.now();

  return {
    investigationId: id,
    type: 'provider',
    startedAt: new Date(startMs).toISOString(),
    completedAt: new Date(endMs).toISOString(),
    durationMs: endMs - startMs,
    profile,
    network,
    comparison: null,
    insights,
    recommendations,
  };
}

export async function investigateNetwork(npi: string, depth = 2): Promise<InvestigationReport> {
  const startMs = Date.now();
  const id = `inv-net-${npi}-${Date.now()}`;

  log('info', `[Investigation] Starting network investigation: NPI ${npi}, depth ${depth}`);

  const network = await analyzeNetwork(npi, depth);

  const recommendations: string[] = [];
  if (network.institutions.length > 0) {
    const topInst = network.institutions[0]!;
    recommendations.push(`Strongest institutional connection: ${topInst.name} (${topInst.memberCount} linked providers).`);
  }
  if (network.researchClusters.length > 0) {
    recommendations.push(`${network.researchClusters.length} research cluster(s) identified in network.`);
  }
  if (network.networkStats.isolatedNodes > 0) {
    recommendations.push(`${network.networkStats.isolatedNodes} isolated node(s) in neighborhood — potential data gaps.`);
  }

  const endMs = Date.now();

  return {
    investigationId: id,
    type: 'network',
    startedAt: new Date(startMs).toISOString(),
    completedAt: new Date(endMs).toISOString(),
    durationMs: endMs - startMs,
    profile: null,
    network,
    comparison: null,
    insights: [],
    recommendations,
  };
}

export async function investigateComparison(npis: string[]): Promise<InvestigationReport> {
  const startMs = Date.now();
  const id = `inv-cmp-${Date.now()}`;

  log('info', `[Investigation] Starting comparison: ${npis.length} providers`);

  const comparison = await compareProviders(npis);

  const recommendations: string[] = [];
  if (comparison.ranking.length >= 2) {
    const [best, worst] = [comparison.ranking[0]!, comparison.ranking[comparison.ranking.length - 1]!];
    recommendations.push(`Trust score spread: ${best.score - worst.score} pts. Best: NPI ${best.npi} (${best.score}), lowest: NPI ${worst.npi} (${worst.score}).`);
  }
  if (comparison.commonGaps.length > 0) {
    recommendations.push(`Common gaps across all providers: ${comparison.commonGaps.join(', ')}.`);
  }
  if (comparison.strengthDelta.length > 0) {
    const biggest = comparison.strengthDelta[0]!;
    recommendations.push(`Biggest differentiation: ${biggest.dimension} (${biggest.spread} pt spread, led by NPI ${biggest.leader}).`);
  }

  const endMs = Date.now();

  return {
    investigationId: id,
    type: 'comparison',
    startedAt: new Date(startMs).toISOString(),
    completedAt: new Date(endMs).toISOString(),
    durationMs: endMs - startMs,
    profile: null,
    network: null,
    comparison,
    insights: [],
    recommendations,
  };
}

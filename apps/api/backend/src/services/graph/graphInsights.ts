/**
 * graphInsights.ts — Wave 82: Graph Insight Engine
 *
 * Analyzes the trust graph to detect credential dependencies,
 * revocation blast radius, and issuer influence patterns.
 *
 * Read-only analysis — no database mutations.
 */

import type { IntelligentGraph, IntelligentNode, IntelligentEdge } from './graphEngine';

// ── Types ─────────────────────────────────────────────────────────────

export type InsightSeverity = 'INFO' | 'WARNING' | 'CRITICAL';

export interface GraphInsight {
  id: string;
  type:
    | 'CREDENTIAL_DEPENDENCY'
    | 'REVOCATION_BLAST_RADIUS'
    | 'ISSUER_INFLUENCE'
    | 'SINGLE_POINT_OF_FAILURE'
    | 'CHAIN_INCOMPLETE'
    | 'RISK_PROPAGATION'
    | 'CREDENTIAL_CENTRALITY';
  severity: InsightSeverity;
  title: string;
  description: string;
  affectedNodeIds: string[];
  score?: number;
}

export interface GraphInsightReport {
  npi: string;
  insights: GraphInsight[];
  summary: {
    totalInsights: number;
    critical: number;
    warnings: number;
    info: number;
  };
  generatedAt: string;
}

// ── Adjacency Helpers ─────────────────────────────────────────────────

function buildAdjacency(edges: IntelligentEdge[]): Map<string, Set<string>> {
  const adj = new Map<string, Set<string>>();
  for (const e of edges) {
    if (!adj.has(e.source)) adj.set(e.source, new Set());
    if (!adj.has(e.target)) adj.set(e.target, new Set());
    adj.get(e.source)!.add(e.target);
    adj.get(e.target)!.add(e.source);
  }
  return adj;
}

// ── Insight Detectors ─────────────────────────────────────────────────

function detectCredentialDependencies(graph: IntelligentGraph): GraphInsight[] {
  const insights: GraphInsight[] = [];
  const decisions = graph.nodes.filter((n) => n.group === 'decision');
  const dependsOnEdges = graph.edges.filter((e) => e.label === 'depends_on');

  for (const dec of decisions) {
    const deps = dependsOnEdges.filter((e) => e.source === dec.id);
    if (deps.length === 0) continue;

    const depNodes = deps.map((d) => graph.nodes.find((n) => n.id === d.target)).filter(Boolean) as IntelligentNode[];
    const atRiskDeps = depNodes.filter((n) => n.decisionRisk === 'HIGH' || n.decisionRisk === 'CRITICAL');

    if (atRiskDeps.length > 0) {
      insights.push({
        id: `dep-risk-${dec.id}`,
        type: 'CREDENTIAL_DEPENDENCY',
        severity: 'CRITICAL',
        title: `Decision "${dec.label}" depends on at-risk credentials`,
        description: `${atRiskDeps.length} of ${deps.length} credential dependencies are expiring, revoked, or suspended.`,
        affectedNodeIds: [dec.id, ...atRiskDeps.map((n) => n.id)],
      });
    }
  }

  return insights;
}

function detectRevocationBlastRadius(graph: IntelligentGraph): GraphInsight[] {
  const insights: GraphInsight[] = [];
  const adj = buildAdjacency(graph.edges);

  const atRiskCreds = graph.nodes.filter(
    (n) => n.group === 'credential' && (n.decisionRisk === 'HIGH' || n.decisionRisk === 'CRITICAL'),
  );

  for (const cred of atRiskCreds) {
    // BFS from at-risk credential
    const visited = new Set<string>();
    const queue = [cred.id];
    while (queue.length > 0) {
      const id = queue.shift()!;
      if (visited.has(id)) continue;
      visited.add(id);
      const neighbors = adj.get(id);
      if (neighbors) for (const n of neighbors) if (!visited.has(n)) queue.push(n);
    }

    if (visited.size > 3) {
      insights.push({
        id: `blast-${cred.id}`,
        type: 'REVOCATION_BLAST_RADIUS',
        severity: cred.decisionRisk === 'CRITICAL' ? 'CRITICAL' : 'WARNING',
        title: `Credential "${cred.label}" revocation would affect ${visited.size - 1} nodes`,
        description: `If this credential is revoked, ${visited.size - 1} connected nodes (decisions, employers, issuers) would be impacted.`,
        affectedNodeIds: [...visited],
      });
    }
  }

  return insights;
}

function detectIssuerInfluence(graph: IntelligentGraph): GraphInsight[] {
  const insights: GraphInsight[] = [];
  const issuers = graph.nodes.filter((n) => n.group === 'issuer');

  for (const issuer of issuers) {
    const issuedEdges = graph.edges.filter((e) => e.source === issuer.id);
    const authEdges = graph.edges.filter((e) => e.source === issuer.id && e.label === 'authorized_by');
    const totalInfluence = issuedEdges.length + authEdges.length;

    if (totalInfluence >= 3) {
      const connectedIds = [...new Set([...issuedEdges.map((e) => e.target), ...authEdges.map((e) => e.target)])];
      insights.push({
        id: `influence-${issuer.id}`,
        type: 'ISSUER_INFLUENCE',
        severity: totalInfluence >= 5 ? 'WARNING' : 'INFO',
        title: `Issuer "${issuer.label}" has high influence (${totalInfluence} connections)`,
        description: `This issuer is connected to ${connectedIds.length} nodes. Loss of trust in this issuer would have wide-ranging impact.`,
        affectedNodeIds: [issuer.id, ...connectedIds],
      });
    }
  }

  return insights;
}

function detectSinglePointsOfFailure(graph: IntelligentGraph): GraphInsight[] {
  const insights: GraphInsight[] = [];
  const credentials = graph.nodes.filter((n) => n.group === 'credential');

  // If clinician has only one active credential, it's a single point of failure
  const activeCreds = credentials.filter((c) => c.decisionRisk === 'LOW' || c.decisionRisk === 'MEDIUM');
  if (activeCreds.length === 1 && credentials.length >= 1) {
    insights.push({
      id: 'spof-single-cred',
      type: 'SINGLE_POINT_OF_FAILURE',
      severity: 'WARNING',
      title: 'Single active credential — single point of failure',
      description: `Only "${activeCreds[0].label}" is currently active. If revoked, all dependent decisions become invalid.`,
      affectedNodeIds: [activeCreds[0].id],
    });
  }

  return insights;
}

// ── Risk Propagation ──────────────────────────────────────────────────

function detectRiskPropagation(graph: IntelligentGraph): GraphInsight[] {
  const insights: GraphInsight[] = [];
  const atRiskNodes = graph.nodes.filter(
    (n) => n.decisionRisk === 'HIGH' || n.decisionRisk === 'CRITICAL',
  );

  for (const node of atRiskNodes) {
    // Follow depends_on and verified_by edges to find propagation chain
    const visited = new Set<string>([node.id]);
    const queue = [node.id];
    const propagationChain: string[] = [];

    while (queue.length > 0) {
      const currentId = queue.shift()!;
      const dependentEdges = graph.edges.filter(
        (e) => e.target === currentId && (e.label === 'depends_on' || e.label === 'authorized_by'),
      );

      for (const edge of dependentEdges) {
        if (!visited.has(edge.source)) {
          visited.add(edge.source);
          propagationChain.push(edge.source);
          queue.push(edge.source);
        }
      }
    }

    if (propagationChain.length > 0) {
      const riskScore = propagationChain.length / Math.max(1, graph.nodes.length);
      insights.push({
        id: `risk-prop-${node.id}`,
        type: 'RISK_PROPAGATION',
        severity: propagationChain.length >= 3 ? 'CRITICAL' : 'WARNING',
        title: `Risk from "${node.label}" propagates to ${propagationChain.length} dependent nodes`,
        description: `This ${node.group}'s risk status cascades through ${propagationChain.length} dependencies via depends_on/authorized_by chains.`,
        affectedNodeIds: [node.id, ...propagationChain],
        score: riskScore,
      });
    }
  }

  return insights;
}

// ── Credential Centrality ─────────────────────────────────────────────

function detectCredentialCentrality(graph: IntelligentGraph): GraphInsight[] {
  const insights: GraphInsight[] = [];
  const credentials = graph.nodes.filter((n) => n.group === 'credential');

  for (const cred of credentials) {
    const inbound = graph.edges.filter((e) => e.target === cred.id).length;
    const outbound = graph.edges.filter((e) => e.source === cred.id).length;
    const degree = inbound + outbound;
    const centrality = degree / Math.max(1, graph.edges.length);

    if (centrality >= 0.15) {
      insights.push({
        id: `centrality-${cred.id}`,
        type: 'CREDENTIAL_CENTRALITY',
        severity: centrality >= 0.3 ? 'WARNING' : 'INFO',
        title: `Credential "${cred.label}" is highly central (${(centrality * 100).toFixed(0)}%)`,
        description: `This credential has ${degree} connections (${inbound} inbound, ${outbound} outbound). High centrality means its status change has outsized impact.`,
        affectedNodeIds: [cred.id],
        score: centrality,
      });
    }
  }

  return insights;
}

// ── Main Analysis ─────────────────────────────────────────────────────

export function analyzeGraph(graph: IntelligentGraph): GraphInsightReport {
  const insights = [
    ...detectCredentialDependencies(graph),
    ...detectRevocationBlastRadius(graph),
    ...detectIssuerInfluence(graph),
    ...detectSinglePointsOfFailure(graph),
    ...detectRiskPropagation(graph),
    ...detectCredentialCentrality(graph),
  ];

  const critical = insights.filter((i) => i.severity === 'CRITICAL').length;
  const warnings = insights.filter((i) => i.severity === 'WARNING').length;
  const info = insights.filter((i) => i.severity === 'INFO').length;

  return {
    npi: graph.npi,
    insights,
    summary: { totalInsights: insights.length, critical, warnings, info },
    generatedAt: new Date().toISOString(),
  };
}

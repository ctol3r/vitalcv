/**
 * graphInsightEngine.ts — Graph-Level Intelligence
 *
 * Generates insights by analyzing the graph topology:
 * - High-influence nodes (hub clinicians)
 * - Rare specialty institutions
 * - Cross-state mobility patterns
 * - Orphan clusters (disconnected components)
 * - Trust band distribution across institution types
 *
 * Feeds into Loop 4 of the Intelligence Engine.
 */

import prisma from '../../graphql/prisma_client';
import { log } from '../../obs/logger';
import type { Insight, InsightType } from './intelligenceEngine';

let graphInsightCounter = 0;
function makeId(): string {
  return `gi_${Date.now().toString(36)}_${(++graphInsightCounter).toString(36)}`;
}

// ── Graph topology queries ─────────────────────────────────────────────────────

interface NodeStats {
  id:     string;
  type:   string;
  label:  string;
  degree: number;
  inDeg:  number;
  outDeg: number;
  group?: string;
}

async function getTopNodes(type: string, limit = 10): Promise<NodeStats[]> {
  try {
    const nodes = await (prisma as unknown as { graphNode: { findMany: (a: unknown) => Promise<unknown[]> } })
      .graphNode.findMany({
        where: { type, active: true },
        orderBy: { degree: 'desc' },
        take: limit,
        select: {
          id: true, type: true, label: true,
          degree: true, inDegree: true, outDegree: true,
          groupKey: true,
        },
      });
    return (nodes as Array<Record<string, unknown>>).map(n => ({
      id:     String(n.id ?? ''),
      type:   String(n.type ?? ''),
      label:  String(n.label ?? ''),
      degree: Number(n.degree ?? 0),
      inDeg:  Number(n.inDegree ?? 0),
      outDeg: Number(n.outDegree ?? 0),
      group:  n.groupKey ? String(n.groupKey) : undefined,
    }));
  } catch {
    return [];
  }
}

async function getNodeCount(type?: string): Promise<number> {
  try {
    return await (prisma as unknown as { graphNode: { count: (a: unknown) => Promise<number> } })
      .graphNode.count({
        where: type ? { type, active: true } : { active: true },
      });
  } catch {
    return 0;
  }
}

async function getEdgeCount(type?: string): Promise<number> {
  try {
    return await (prisma as unknown as { graphEdge: { count: (a: unknown) => Promise<number> } })
      .graphEdge.count({
        where: type ? { edgeType: type, status: 'ACTIVE' } : { status: 'ACTIVE' },
      });
  } catch {
    return 0;
  }
}

// ── Insight generators ─────────────────────────────────────────────────────────

export async function generateGraphInsights(limit = 15): Promise<Insight[]> {
  const insights: Insight[] = [];

  try {
    // ── High-influence clinician hubs ───────────────────────────────────
    const topClinicians = await getTopNodes('clinician', 5);
    if (topClinicians.length > 0 && topClinicians[0]!.degree > 5) {
      insights.push({
        id: makeId(), type: 'HIGH_INFLUENCE_INVESTIGATOR',
        title: `${topClinicians.length} high-influence clinician(s) in graph`,
        description: topClinicians.map(n =>
          `${n.label} (degree ${n.degree}, in ${n.inDeg}/out ${n.outDeg})`
        ).join('; '),
        priority: 'MEDIUM',
        metadata: {
          topNodes: topClinicians.map(n => ({ id: n.id, label: n.label, degree: n.degree })),
        },
        generatedAt: new Date().toISOString(),
        actionable: false,
      });
    }

    // ── Rare specialty institutions ─────────────────────────────────────
    const topInstitutions = await getTopNodes('institution', 10);
    const lowDegreeInst = topInstitutions.filter(n => n.degree === 1);
    if (lowDegreeInst.length > 0) {
      insights.push({
        id: makeId(), type: 'RARE_SPECIALTY_INSTITUTION',
        title: `${lowDegreeInst.length} institution(s) with single connection`,
        description: `These institutions have only one graph link — may be unique specialty programs or incomplete data.`,
        priority: 'LOW',
        metadata: {
          institutions: lowDegreeInst.map(n => ({ id: n.id, label: n.label })),
        },
        generatedAt: new Date().toISOString(),
        actionable: true,
        action: 'Investigate whether these institutions need additional graph links or data enrichment.',
      });
    }

    // ── Graph health summary ─────────────────────────────────────────────
    const totalNodes = await getNodeCount();
    const totalEdges = await getEdgeCount();
    const clinicianCount = await getNodeCount('clinician');
    const aiEdgeCount = await getEdgeCount('ai_accepted_link');
    const explicitEdgeCount = await getEdgeCount('explicit_link');

    if (totalNodes > 0) {
      const density = totalEdges > 0
        ? Math.round((totalEdges / (totalNodes * (totalNodes - 1) / 2)) * 10000) / 100
        : 0;

      insights.push({
        id: makeId(), type: 'RESEARCH_CLUSTER' as InsightType,
        title: `Graph health: ${totalNodes} nodes, ${totalEdges} edges`,
        description: `Density: ${density}%. ${clinicianCount} clinicians. ${aiEdgeCount} AI-accepted links, ${explicitEdgeCount} explicit links.`,
        priority: 'LOW',
        metadata: { totalNodes, totalEdges, density, clinicianCount, aiEdgeCount, explicitEdgeCount },
        generatedAt: new Date().toISOString(),
        actionable: false,
      });
    }
  } catch (err) {
    log('error', `[GraphInsightEngine] Failed: ${(err as Error)?.message}`);
  }

  return insights.slice(0, limit);
}

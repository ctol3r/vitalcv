/**
 * decisionGraphExtension.ts — Wave 54: Decision Capsule Graph Extension
 *
 * Extends the trust graph with decision capsule nodes and
 * DECISION_DEPENDS_ON edges linking decisions to their supporting credentials.
 *
 * Used by the Trust Graph Explorer (Wave 53) to visualize the
 * institutional decision layer on top of the credential graph.
 */

import prisma from '../../graphql/prisma_client';
import type { GraphNode, GraphEdge } from './trustGraph';

// ── Types ─────────────────────────────────────────────────────────────────

export interface DecisionGraphNode {
  id: string;
  label: string;
  group: 'clinician' | 'issuer' | 'employer' | 'credential' | 'decision';
  status?: string;
  trustState?: string;
  auditHash?: string | null;
  val: number;
}

export interface DecisionGraphResult {
  nodes: DecisionGraphNode[];
  edges: GraphEdge[];
}

// ── Status → visual mapping ───────────────────────────────────────────────

const CAPSULE_STATUS_MAP: Record<string, string> = {
  VALID: 'VALID',
  AT_RISK: 'AT_RISK',
  INVALID: 'INVALID',
};

// ── Extension ─────────────────────────────────────────────────────────────

/**
 * Enrich an existing trust graph with decision capsule nodes and edges.
 * Call this after generateTrustGraph() and merge the results.
 */
export async function extendGraphWithDecisions(
  npi: string,
  existingNodes: GraphNode[],
  existingEdges: GraphEdge[],
): Promise<DecisionGraphResult> {
  const capsules = await prisma.decisionCapsule.findMany({
    where: { subjectNpi: npi },
    orderBy: { decisionTimestamp: 'desc' },
    take: 50,
  });

  const nodes: DecisionGraphNode[] = existingNodes.map((n) => ({
    ...n,
    group: n.group as DecisionGraphNode['group'],
  }));
  const edges: GraphEdge[] = [...existingEdges];

  const clinicianNodeId = `clinician-${npi}`;
  const existingNodeIds = new Set(nodes.map((n) => n.id));

  for (const capsule of capsules) {
    const decisionNodeId = `decision-${capsule.id}`;

    // Add decision node
    nodes.push({
      id: decisionNodeId,
      label: `${capsule.decisionType} (${new Date(capsule.decisionTimestamp).toLocaleDateString()})`,
      group: 'decision',
      status: CAPSULE_STATUS_MAP[capsule.status] ?? capsule.status,
      val: 12,
    });

    // Edge: clinician → decision
    if (existingNodeIds.has(clinicianNodeId)) {
      edges.push({
        source: clinicianNodeId,
        target: decisionNodeId,
        label: 'DECIDED_FOR',
      });
    }

    // Edges: decision → credentials it depends on
    for (const credentialId of capsule.credentialIds) {
      const credNodeId = `cred-${credentialId}`;
      if (existingNodeIds.has(credNodeId)) {
        edges.push({
          source: decisionNodeId,
          target: credNodeId,
          label: 'DECISION_DEPENDS_ON',
        });
      }
    }
  }

  return { nodes, edges };
}

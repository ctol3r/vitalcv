import { createQaFinding, type QaFinding } from './types';

export interface GraphNodeLike {
  id: string;
  group?: string;
  type?: string;
}

export interface GraphEdgeLike {
  id?: string;
  source: string;
  target: string;
  type?: string;
  label?: string;
}

export interface GraphIntegrityCheckResult {
  findings: QaFinding[];
}

export function checkGraphIntegrity(
  nodes: readonly GraphNodeLike[],
  edges: readonly GraphEdgeLike[],
  options?: { allowOrphanedGroups?: readonly string[] },
): GraphIntegrityCheckResult {
  const findings: QaFinding[] = [];
  const allowOrphanedGroups = new Set(options?.allowOrphanedGroups ?? []);
  const nodeIds = new Set<string>();
  const duplicateNodeIds = new Set<string>();
  const incidentCounts = new Map<string, number>();
  const edgeKeys = new Set<string>();
  const duplicateEdgeKeys = new Set<string>();

  for (const node of nodes) {
    if (nodeIds.has(node.id)) {
      duplicateNodeIds.add(node.id);
    }
    nodeIds.add(node.id);
    incidentCounts.set(node.id, incidentCounts.get(node.id) ?? 0);
  }

  for (const edge of edges) {
    const edgeType = edge.type ?? edge.label ?? 'edge';
    const key = `${edge.source}|${edge.target}|${edgeType}`;
    if (edgeKeys.has(key)) {
      duplicateEdgeKeys.add(key);
    }
    edgeKeys.add(key);

    if (!nodeIds.has(edge.source) || !nodeIds.has(edge.target)) {
      findings.push(
        createQaFinding({
          code: 'graph_broken_edge_reference',
          severity: 'critical',
          component: 'graph-integrity-checker',
          summary: `Graph edge ${key} references a missing node.`,
          entityIds: [edge.source, edge.target],
          metadata: {
            edgeId: edge.id,
          },
        }),
      );
      continue;
    }

    incidentCounts.set(edge.source, (incidentCounts.get(edge.source) ?? 0) + 1);
    incidentCounts.set(edge.target, (incidentCounts.get(edge.target) ?? 0) + 1);

    if (edge.source === edge.target) {
      findings.push(
        createQaFinding({
          code: 'graph_self_loop',
          severity: 'warning',
          component: 'graph-integrity-checker',
          summary: `Graph edge ${key} forms a self-loop.`,
          entityIds: [edge.source],
          metadata: {
            edgeId: edge.id,
          },
        }),
      );
    }
  }

  for (const nodeId of duplicateNodeIds) {
    findings.push(
      createQaFinding({
        code: 'graph_duplicate_node',
        severity: 'critical',
        component: 'graph-integrity-checker',
        summary: `Graph contains duplicate node id ${nodeId}.`,
        entityIds: [nodeId],
      }),
    );
  }

  for (const edgeKey of duplicateEdgeKeys) {
    findings.push(
      createQaFinding({
        code: 'graph_duplicate_edge',
        severity: 'warning',
        component: 'graph-integrity-checker',
        summary: `Graph contains duplicate edge ${edgeKey}.`,
        repairable: true,
        suggestedFixes: ['DEDUPLICATE_RECORDS'],
      }),
    );
  }

  for (const node of nodes) {
    if ((incidentCounts.get(node.id) ?? 0) > 0) {
      continue;
    }

    const nodeGroup = node.group ?? node.type ?? 'unknown';
    if (allowOrphanedGroups.has(nodeGroup)) {
      continue;
    }

    findings.push(
      createQaFinding({
        code: 'graph_orphaned_node',
        severity: 'warning',
        component: 'graph-integrity-checker',
        summary: `Graph node ${node.id} has no relationships.`,
        entityIds: [node.id],
        repairable: true,
        suggestedFixes: ['REBUILD_GRAPH_INDEXES', 'REPAIR_BROKEN_EDGES'],
        metadata: {
          group: node.group,
          type: node.type,
        },
      }),
    );
  }

  return { findings };
}


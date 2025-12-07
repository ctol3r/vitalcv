import type { CredentialGraph, GraphEdge, GraphIssue } from '../credential/types';
import { buildAdjacency, traverseGraph } from '../credential/types';

interface ReachabilityCache {
  [stateNodeId: string]: boolean;
}

export interface InconsistencyDetectorOptions {
  clinicianNodeId?: string;
}

export function detectGraphInconsistencies(
  graph: CredentialGraph,
  options: InconsistencyDetectorOptions = {},
): GraphIssue[] {
  const issues: GraphIssue[] = [];
  const clinicianNodeId =
    options.clinicianNodeId ??
    graph.metadata?.clinicianNodeId ??
    graph.nodes.find((node) => node.type === 'clinician')?.id;

  const adjacency = buildAdjacency(graph);
  issues.push(...detectCycles(graph, adjacency));
  issues.push(...detectLicensePrivilegeConflicts(graph));

  if (clinicianNodeId) {
    const reachableStates = computeReachableStates(graph, clinicianNodeId);
    issues.push(...detectUnreachableOrgStates(graph, reachableStates));
    issues.push(...detectUnreachablePayerStates(graph, reachableStates));
  }

  return dedupeIssues(issues);
}

function detectCycles(graph: CredentialGraph, adjacency: Map<string, GraphEdge[]>): GraphIssue[] {
  const issues: GraphIssue[] = [];
  const visited = new Set<string>();
  const stack = new Set<string>();
  const stackPath: string[] = [];

  const dfs = (nodeId: string) => {
    if (stack.has(nodeId)) {
      const cycleStartIndex = stackPath.indexOf(nodeId);
      const cyclePath = cycleStartIndex >= 0 ? stackPath.slice(cycleStartIndex) : [...stackPath, nodeId];
      issues.push({
        id: `cycle:${cyclePath.join('>')}`,
        type: 'cycle',
        severity: 'warning',
        message: `Cycle detected: ${cyclePath.join(' → ')}`,
        nodes: [...cyclePath],
      });
      return;
    }

    if (visited.has(nodeId)) {
      return;
    }

    visited.add(nodeId);
    stack.add(nodeId);
    stackPath.push(nodeId);

    for (const edge of adjacency.get(nodeId) ?? []) {
      dfs(edge.target);
    }

    stack.delete(nodeId);
    stackPath.pop();
  };

  for (const node of graph.nodes) {
    if (!visited.has(node.id)) {
      dfs(node.id);
    }
  }

  return issues;
}

function detectLicensePrivilegeConflicts(graph: CredentialGraph): GraphIssue[] {
  const issues: GraphIssue[] = [];

  const stateEdges = graph.edges.filter(
    (edge) => edge.type === 'licensed_in' || edge.type === 'compact_extends_to',
  );

  for (const edge of stateEdges) {
    const licenseNode = graph.nodes.find((node) => node.id === edge.source);
    if (!licenseNode) continue;

    const status = (licenseNode.metadata?.status ?? licenseNode.status ?? '').toString().toUpperCase();
    if (status && status !== 'ACTIVE' && edge.active !== false) {
      issues.push({
        id: `conflict:${edge.id}`,
        type: 'conflict',
        severity: 'warning',
        message: `Inactive credential ${licenseNode.label} still marks state coverage`,
        nodes: [edge.source, edge.target],
        edges: [edge.id],
      });
    }
  }

  return issues;
}

function computeReachableStates(graph: CredentialGraph, clinicianNodeId: string): ReachabilityCache {
  const reachable = traverseGraph(graph, {
    startNodeId: clinicianNodeId,
    edgeFilter: (edge) =>
      ['holds_license', 'licensed_in', 'member_of_compact', 'compact_extends_to'].includes(edge.type),
  });

  const stateCache: ReachabilityCache = {};
  for (const nodeId of reachable.visited) {
    const node = graph.nodes.find((entry) => entry.id === nodeId);
    if (node?.type === 'state') {
      stateCache[nodeId] = true;
    }
  }
  return stateCache;
}

function detectUnreachableOrgStates(
  graph: CredentialGraph,
  reachableStates: ReachabilityCache,
): GraphIssue[] {
  const issues: GraphIssue[] = [];
  const stateNodes = graph.nodes.filter((node) => node.type === 'state');

  for (const orgNode of graph.nodes.filter((node) => node.type === 'org')) {
    const targetState = orgNode.metadata?.state as string | undefined;
    if (!targetState) {
      continue;
    }
    const stateNode = stateNodes.find((node) => node.metadata?.code === targetState || node.label === targetState);
    if (!stateNode) {
      issues.push({
        id: `missing_state:${orgNode.id}`,
        type: 'missing_edge',
        severity: 'warning',
        message: `Organization ${orgNode.label} references state ${targetState} without a state node`,
        nodes: [orgNode.id],
      });
      continue;
    }

    if (!reachableStates[stateNode.id]) {
      issues.push({
        id: `org_unreachable:${orgNode.id}`,
        type: 'missing_edge',
        severity: 'critical',
        message: `Privileges at ${orgNode.label} require coverage in ${targetState}, but no active path exists`,
        nodes: [orgNode.id, stateNode.id],
      });
    }
  }

  return issues;
}

function detectUnreachablePayerStates(
  graph: CredentialGraph,
  reachableStates: ReachabilityCache,
): GraphIssue[] {
  const issues: GraphIssue[] = [];
  const stateNodes = graph.nodes.filter((node) => node.type === 'state');

  for (const payerNode of graph.nodes.filter((node) => node.type === 'payer')) {
    const states = (payerNode.metadata?.states as string[] | undefined) ?? [];
    for (const state of states) {
      const stateNode =
        stateNodes.find((node) => node.metadata?.code === state) ??
        stateNodes.find((node) => node.label === state);
      if (!stateNode) {
        issues.push({
          id: `payer_missing_state:${payerNode.id}:${state}`,
          type: 'missing_edge',
          severity: 'warning',
          message: `Payer ${payerNode.label} lists ${state} but state node is missing`,
          nodes: [payerNode.id],
        });
        continue;
      }
      if (!reachableStates[stateNode.id]) {
        issues.push({
          id: `payer_unreachable:${payerNode.id}:${state}`,
          type: 'missing_edge',
          severity: 'warning',
          message: `Enrollment with ${payerNode.label} in ${state} lacks an active license or compact`,
          nodes: [payerNode.id, stateNode.id],
        });
      }
    }
  }

  return issues;
}

function dedupeIssues(issues: GraphIssue[]): GraphIssue[] {
  const seen = new Map<string, GraphIssue>();
  for (const issue of issues) {
    if (!seen.has(issue.id)) {
      seen.set(issue.id, issue);
    }
  }
  return Array.from(seen.values());
}
import type { CredentialGraph, GraphEdge, GraphIssue } from '../types';
import { buildAdjacency, traverseGraph } from '../types';

interface ReachabilityCache {
  [stateNodeId: string]: boolean;
}

export interface InconsistencyDetectorOptions {
  clinicianNodeId?: string;
}

export function detectGraphInconsistencies(
  graph: CredentialGraph,
  options: InconsistencyDetectorOptions = {},
): GraphIssue[] {
  const issues: GraphIssue[] = [];
  const clinicianNodeId =
    options.clinicianNodeId ??
    graph.metadata?.clinicianNodeId ??
    graph.nodes.find((node) => node.type === 'clinician')?.id;

  const adjacency = buildAdjacency(graph);
  issues.push(...detectCycles(graph, adjacency));
  issues.push(...detectLicensePrivilegeConflicts(graph));

  if (clinicianNodeId) {
    const reachableStates = computeReachableStates(graph, clinicianNodeId);
    issues.push(...detectUnreachableOrgStates(graph, reachableStates));
    issues.push(...detectUnreachablePayerStates(graph, reachableStates));
  }

  return dedupeIssues(issues);
}

function detectCycles(graph: CredentialGraph, adjacency: Map<string, GraphEdge[]>): GraphIssue[] {
  const issues: GraphIssue[] = [];
  const visited = new Set<string>();
  const stack = new Set<string>();
  const stackPath: string[] = [];

  const dfs = (nodeId: string) => {
    if (stack.has(nodeId)) {
      const cycleStartIndex = stackPath.indexOf(nodeId);
      const cyclePath = cycleStartIndex >= 0 ? stackPath.slice(cycleStartIndex) : [...stackPath, nodeId];
      issues.push({
        id: `cycle:${cyclePath.join('>')}`,
        type: 'cycle',
        severity: 'warning',
        message: `Cycle detected: ${cyclePath.join(' → ')}`,
        nodes: [...cyclePath],
      });
      return;
    }

    if (visited.has(nodeId)) {
      return;
    }

    visited.add(nodeId);
    stack.add(nodeId);
    stackPath.push(nodeId);

    for (const edge of adjacency.get(nodeId) ?? []) {
      dfs(edge.target);
    }

    stack.delete(nodeId);
    stackPath.pop();
  };

  for (const node of graph.nodes) {
    if (!visited.has(node.id)) {
      dfs(node.id);
    }
  }

  return issues;
}

function detectLicensePrivilegeConflicts(graph: CredentialGraph): GraphIssue[] {
  const issues: GraphIssue[] = [];

  const stateEdges = graph.edges.filter(
    (edge) => edge.type === 'licensed_in' || edge.type === 'compact_extends_to',
  );

  for (const edge of stateEdges) {
    const licenseNode = graph.nodes.find((node) => node.id === edge.source);
    if (!licenseNode) continue;

    const status = (licenseNode.metadata?.status ?? licenseNode.status ?? '').toString().toUpperCase();
    if (status && status !== 'ACTIVE' && edge.active !== false) {
      issues.push({
        id: `conflict:${edge.id}`,
        type: 'conflict',
        severity: 'warning',
        message: `Inactive credential ${licenseNode.label} still marks state coverage`,
        nodes: [edge.source, edge.target],
        edges: [edge.id],
      });
    }
  }

  return issues;
}

function computeReachableStates(graph: CredentialGraph, clinicianNodeId: string): ReachabilityCache {
  const reachable = traverseGraph(graph, {
    startNodeId: clinicianNodeId,
    edgeFilter: (edge) =>
      ['holds_license', 'licensed_in', 'member_of_compact', 'compact_extends_to'].includes(edge.type),
  });

  const stateCache: ReachabilityCache = {};
  for (const nodeId of reachable.visited) {
    const node = graph.nodes.find((entry) => entry.id === nodeId);
    if (node?.type === 'state') {
      stateCache[nodeId] = true;
    }
  }
  return stateCache;
}

function detectUnreachableOrgStates(
  graph: CredentialGraph,
  reachableStates: ReachabilityCache,
): GraphIssue[] {
  const issues: GraphIssue[] = [];
  const stateNodes = graph.nodes.filter((node) => node.type === 'state');

  for (const orgNode of graph.nodes.filter((node) => node.type === 'org')) {
    const targetState = orgNode.metadata?.state as string | undefined;
    if (!targetState) {
      continue;
    }
    const stateNode = stateNodes.find((node) => node.metadata?.code === targetState || node.label === targetState);
    if (!stateNode) {
      issues.push({
        id: `missing_state:${orgNode.id}`,
        type: 'missing_edge',
        severity: 'warning',
        message: `Organization ${orgNode.label} references state ${targetState} without a state node`,
        nodes: [orgNode.id],
      });
      continue;
    }

    if (!reachableStates[stateNode.id]) {
      issues.push({
        id: `org_unreachable:${orgNode.id}`,
        type: 'missing_edge',
        severity: 'critical',
        message: `Privileges at ${orgNode.label} require coverage in ${targetState}, but no active path exists`,
        nodes: [orgNode.id, stateNode.id],
      });
    }
  }

  return issues;
}

function detectUnreachablePayerStates(
  graph: CredentialGraph,
  reachableStates: ReachabilityCache,
): GraphIssue[] {
  const issues: GraphIssue[] = [];
  const stateNodes = graph.nodes.filter((node) => node.type === 'state');

  for (const payerNode of graph.nodes.filter((node) => node.type === 'payer')) {
    const states = (payerNode.metadata?.states as string[] | undefined) ?? [];
    for (const state of states) {
      const stateNode =
        stateNodes.find((node) => node.metadata?.code === state) ??
        stateNodes.find((node) => node.label === state);
      if (!stateNode) {
        issues.push({
          id: `payer_missing_state:${payerNode.id}:${state}`,
          type: 'missing_edge',
          severity: 'warning',
          message: `Payer ${payerNode.label} lists ${state} but state node is missing`,
          nodes: [payerNode.id],
        });
        continue;
      }
      if (!reachableStates[stateNode.id]) {
        issues.push({
          id: `payer_unreachable:${payerNode.id}:${state}`,
          type: 'missing_edge',
          severity: 'warning',
          message: `Enrollment with ${payerNode.label} in ${state} lacks an active license or compact`,
          nodes: [payerNode.id, stateNode.id],
        });
      }
    }
  }

  return issues;
}

function dedupeIssues(issues: GraphIssue[]): GraphIssue[] {
  const seen = new Map<string, GraphIssue>();
  for (const issue of issues) {
    if (!seen.has(issue.id)) {
      seen.set(issue.id, issue);
    }
  }
  return Array.from(seen.values());
}


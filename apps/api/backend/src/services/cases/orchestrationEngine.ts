// Pure functions — no I/O. Computes dependency graphs, critical paths,
// and parallel execution waves for credentialing blocker resolution.

export type BlockerSeverity = 'critical' | 'high' | 'medium' | 'low';
export type BlockerOwner = 'clinician' | 'employer' | 'system';

export interface BlockerNode {
  id: string;
  label: string;
  estimatedDays: number;
  severity: BlockerSeverity;
  owner: BlockerOwner;
  /** Action ids that must complete before this one can start. */
  dependencies: string[];
  resolutionPath: string;
}

export interface ExecutionWave {
  waveIndex: number;
  nodes: BlockerNode[];
}

export interface OrchestrationPlan {
  waves: ExecutionWave[];
  criticalPathIds: string[];
  criticalPathDays: number;
  /** Serial total minus critical path — time saved by parallelizing. */
  parallelSavingsDays: number;
  totalBlockers: number;
}

export function buildOrchestratedPlan(nodes: BlockerNode[]): OrchestrationPlan {
  if (nodes.length === 0) {
    return {
      waves: [],
      criticalPathIds: [],
      criticalPathDays: 0,
      parallelSavingsDays: 0,
      totalBlockers: 0,
    };
  }

  const nodeById = new Map(nodes.map((n) => [n.id, n]));
  const waves = groupIntoWaves(nodes, nodeById);
  const { pathIds, pathDays } = computeCriticalPath(nodes, nodeById);
  const serialDays = nodes.reduce((sum, n) => sum + n.estimatedDays, 0);

  return {
    waves,
    criticalPathIds: pathIds,
    criticalPathDays: pathDays,
    parallelSavingsDays: Math.max(0, serialDays - pathDays),
    totalBlockers: nodes.length,
  };
}

export function groupIntoWaves(
  nodes: BlockerNode[],
  nodeById: Map<string, BlockerNode>,
): ExecutionWave[] {
  // Kahn's topological sort — each wave contains all nodes whose dependencies
  // are satisfied by prior waves (or have none).
  const inDegree = new Map<string, number>();
  const dependents = new Map<string, string[]>(); // node → list of nodes that depend on it

  for (const node of nodes) {
    inDegree.set(node.id, 0);
    dependents.set(node.id, []);
  }

  for (const node of nodes) {
    for (const depId of node.dependencies) {
      if (!nodeById.has(depId)) {
        continue; // skip deps that aren't in this case's blocker set
      }
      inDegree.set(node.id, (inDegree.get(node.id) ?? 0) + 1);
      const list = dependents.get(depId) ?? [];
      list.push(node.id);
      dependents.set(depId, list);
    }
  }

  const waves: ExecutionWave[] = [];
  let ready = nodes.filter((n) => (inDegree.get(n.id) ?? 0) === 0);

  while (ready.length > 0) {
    waves.push({ waveIndex: waves.length, nodes: [...ready] });
    const nextReady: BlockerNode[] = [];

    for (const completed of ready) {
      for (const dependentId of dependents.get(completed.id) ?? []) {
        const remaining = (inDegree.get(dependentId) ?? 1) - 1;
        inDegree.set(dependentId, remaining);
        if (remaining === 0) {
          const dependentNode = nodeById.get(dependentId);
          if (dependentNode) {
            nextReady.push(dependentNode);
          }
        }
      }
    }

    ready = nextReady;
  }

  return waves;
}

export function computeCriticalPath(
  nodes: BlockerNode[],
  nodeById: Map<string, BlockerNode>,
): { pathIds: string[]; pathDays: number } {
  // Dynamic programming: longest path through the dependency DAG.
  // longestFromNode[id] = max days to complete id (including all of its deps)
  const longestFromNode = new Map<string, number>();
  const predecessor = new Map<string, string | null>();

  // Process in topological order (guaranteed by wave groups, but we compute independently)
  function resolve(id: string): number {
    const cached = longestFromNode.get(id);
    if (cached !== undefined) {
      return cached;
    }

    const node = nodeById.get(id);
    if (!node) {
      return 0;
    }

    let maxDepDays = 0;
    let maxDepId: string | null = null;
    let hasDep = false;

    for (const depId of node.dependencies) {
      if (!nodeById.has(depId)) {
        continue;
      }
      const depDays = resolve(depId);
      if (!hasDep || depDays > maxDepDays) {
        maxDepDays = depDays;
        maxDepId = depId;
        hasDep = true;
      }
    }

    const total = maxDepDays + node.estimatedDays;
    longestFromNode.set(id, total);
    predecessor.set(id, maxDepId);
    return total;
  }

  for (const node of nodes) {
    resolve(node.id);
  }

  // Find the node with the maximum total days — that's the end of the critical path
  let maxDays = 0;
  let maxId: string | null = null;

  for (const [id, days] of longestFromNode) {
    if (days > maxDays || (days === maxDays && maxId !== null && id < maxId)) {
      maxDays = days;
      maxId = id;
    }
  }

  if (!maxId) {
    return { pathIds: [], pathDays: 0 };
  }

  // Trace back to build the path
  const pathIds: string[] = [];
  let current: string | null = maxId;
  while (current !== null) {
    pathIds.unshift(current);
    current = predecessor.get(current) ?? null;
  }

  return { pathIds, pathDays: maxDays };
}

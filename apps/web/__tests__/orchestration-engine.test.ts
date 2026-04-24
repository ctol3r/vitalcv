// Pure function tests for the orchestration engine algorithm.
// Mirrors apps/api/backend/src/services/cases/__tests__/orchestrationEngine.test.ts
// but runs under Vitest without requiring a backend database.

import { describe, expect, it } from 'vitest';

// ── Inline types and algorithms (no backend import needed) ────────────────────

interface BlockerNode {
  id: string;
  estimatedDays: number;
  dependencies: string[];
}

interface ExecutionWave {
  waveIndex: number;
  nodes: BlockerNode[];
}

function groupIntoWaves(nodes: BlockerNode[]): ExecutionWave[] {
  const nodeById = new Map(nodes.map((n) => [n.id, n]));
  const inDegree = new Map<string, number>();
  const dependents = new Map<string, string[]>();

  for (const node of nodes) {
    inDegree.set(node.id, 0);
    dependents.set(node.id, []);
  }

  for (const node of nodes) {
    for (const depId of node.dependencies) {
      if (!nodeById.has(depId)) {
        continue;
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
          const dep = nodeById.get(dependentId);
          if (dep) {
            nextReady.push(dep);
          }
        }
      }
    }

    ready = nextReady;
  }

  return waves;
}

function computeCriticalPath(nodes: BlockerNode[]): { pathIds: string[]; pathDays: number } {
  const nodeById = new Map(nodes.map((n) => [n.id, n]));
  const longestFromNode = new Map<string, number>();
  const predecessor = new Map<string, string | null>();

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

  const pathIds: string[] = [];
  let current: string | null = maxId;
  while (current !== null) {
    pathIds.unshift(current);
    current = predecessor.get(current) ?? null;
  }

  return { pathIds, pathDays: maxDays };
}

function buildOrchestratedPlan(nodes: BlockerNode[]) {
  if (nodes.length === 0) {
    return { waves: [], criticalPathIds: [], criticalPathDays: 0, parallelSavingsDays: 0, totalBlockers: 0 };
  }

  const waves = groupIntoWaves(nodes);
  const { pathIds, pathDays } = computeCriticalPath(nodes);
  const serialDays = nodes.reduce((sum, n) => sum + n.estimatedDays, 0);

  return {
    waves,
    criticalPathIds: pathIds,
    criticalPathDays: pathDays,
    parallelSavingsDays: Math.max(0, serialDays - pathDays),
    totalBlockers: nodes.length,
  };
}

function n(id: string, days: number, deps: string[] = []): BlockerNode {
  return { id, estimatedDays: days, dependencies: deps };
}

// ── Wave grouping ─────────────────────────────────────────────────────────────

describe('orchestration — groupIntoWaves', () => {
  it('places independent nodes in wave 0', () => {
    const waves = groupIntoWaves([n('a', 1), n('b', 2), n('c', 3)]);
    expect(waves).toHaveLength(1);
    expect(waves[0].nodes.map((x) => x.id).sort()).toEqual(['a', 'b', 'c']);
  });

  it('chains a→b→c into three waves', () => {
    const waves = groupIntoWaves([n('a', 1), n('b', 2, ['a']), n('c', 3, ['b'])]);
    expect(waves).toHaveLength(3);
    expect(waves[0].nodes[0].id).toBe('a');
    expect(waves[1].nodes[0].id).toBe('b');
    expect(waves[2].nodes[0].id).toBe('c');
  });

  it('collapses fan-out [b,c,d] into one wave after a', () => {
    const waves = groupIntoWaves([
      n('a', 1),
      n('b', 5, ['a']),
      n('c', 3, ['a']),
      n('d', 1, ['a']),
    ]);
    expect(waves).toHaveLength(2);
    expect(waves[1].nodes.map((x) => x.id).sort()).toEqual(['b', 'c', 'd']);
  });

  it('handles diamond graph correctly', () => {
    const waves = groupIntoWaves([
      n('a', 1),
      n('b', 3, ['a']),
      n('c', 2, ['a']),
      n('d', 4, ['b', 'c']),
    ]);
    expect(waves).toHaveLength(3);
    expect(waves[2].nodes[0].id).toBe('d');
  });

  it('ignores unknown dependencies', () => {
    const waves = groupIntoWaves([n('b', 5, ['ghost']), n('c', 3)]);
    expect(waves).toHaveLength(1);
    expect(waves[0].nodes.map((x) => x.id).sort()).toEqual(['b', 'c']);
  });
});

// ── Critical path ─────────────────────────────────────────────────────────────

describe('orchestration — computeCriticalPath', () => {
  it('returns the longest single node for independent nodes', () => {
    const { pathDays, pathIds } = computeCriticalPath([n('x', 10), n('y', 3)]);
    expect(pathDays).toBe(10);
    expect(pathIds).toEqual(['x']);
  });

  it('sums the chain a(5)→b(10)→c(3) = 18', () => {
    const { pathDays, pathIds } = computeCriticalPath([
      n('a', 5), n('b', 10, ['a']), n('c', 3, ['b']),
    ]);
    expect(pathDays).toBe(18);
    expect(pathIds).toEqual(['a', 'b', 'c']);
  });

  it('picks the longer branch in a diamond', () => {
    const { pathDays, pathIds } = computeCriticalPath([
      n('a', 1),
      n('b', 10, ['a']),
      n('c', 2, ['a']),
      n('d', 2, ['b', 'c']),
    ]);
    expect(pathDays).toBe(13); // a(1)+b(10)+d(2)
    expect(pathIds).toEqual(['a', 'b', 'd']);
  });

  it('returns zero for empty input', () => {
    const { pathDays, pathIds } = computeCriticalPath([]);
    expect(pathDays).toBe(0);
    expect(pathIds).toHaveLength(0);
  });
});

// ── Full orchestration plan ───────────────────────────────────────────────────

describe('orchestration — buildOrchestratedPlan', () => {
  it('computes correct plan for VitalCV blocker scenario', () => {
    // verify-identity(0) → submit-pecos(60)
    //                    → run-exclusion(3) → leie-review(10)
    // refresh-licensure(21) independent
    const plan = buildOrchestratedPlan([
      n('verify-identity', 0),
      n('submit-pecos-enrollment', 60, ['verify-identity']),
      n('run-exclusion-check', 3, ['verify-identity']),
      n('resolve-leie-review', 10, ['run-exclusion-check']),
      n('refresh-licensure', 21),
    ]);

    expect(plan.totalBlockers).toBe(5);
    expect(plan.criticalPathDays).toBe(60);
    expect(plan.criticalPathIds).toEqual(['verify-identity', 'submit-pecos-enrollment']);
    // serial=94, critical=60 → savings=34
    expect(plan.parallelSavingsDays).toBe(34);
  });

  it('parallel savings is zero when all nodes are sequential', () => {
    const plan = buildOrchestratedPlan([n('a', 5), n('b', 3, ['a']), n('c', 2, ['b'])]);
    expect(plan.parallelSavingsDays).toBe(0);
    expect(plan.criticalPathDays).toBe(10);
  });

  it('parallel savings equals serial minus longest for fully independent nodes', () => {
    const plan = buildOrchestratedPlan([n('a', 30), n('b', 20), n('c', 10)]);
    expect(plan.criticalPathDays).toBe(30);
    expect(plan.parallelSavingsDays).toBe(30); // 60 - 30
    expect(plan.waves).toHaveLength(1);
  });

  it('returns empty plan for no blockers', () => {
    const plan = buildOrchestratedPlan([]);
    expect(plan.totalBlockers).toBe(0);
    expect(plan.criticalPathDays).toBe(0);
    expect(plan.waves).toHaveLength(0);
  });
});

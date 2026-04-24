import {
  buildOrchestratedPlan,
  groupIntoWaves,
  computeCriticalPath,
  type BlockerNode,
} from '../orchestrationEngine';

function node(
  id: string,
  estimatedDays: number,
  dependencies: string[] = [],
): BlockerNode {
  return {
    id,
    label: id,
    estimatedDays,
    severity: 'medium',
    owner: 'system',
    dependencies,
    resolutionPath: `Resolve ${id}`,
  };
}

describe('orchestrationEngine — groupIntoWaves', () => {
  it('puts independent nodes in wave 0', () => {
    const nodes = [node('a', 3), node('b', 5), node('c', 2)];
    const nodeById = new Map(nodes.map((n) => [n.id, n]));
    const waves = groupIntoWaves(nodes, nodeById);
    expect(waves).toHaveLength(1);
    expect(waves[0].waveIndex).toBe(0);
    expect(waves[0].nodes.map((n) => n.id).sort()).toEqual(['a', 'b', 'c']);
  });

  it('separates dependent nodes into later waves', () => {
    // a → b → c chain
    const nodes = [node('a', 1), node('b', 2, ['a']), node('c', 3, ['b'])];
    const nodeById = new Map(nodes.map((n) => [n.id, n]));
    const waves = groupIntoWaves(nodes, nodeById);
    expect(waves).toHaveLength(3);
    expect(waves[0].nodes.map((n) => n.id)).toEqual(['a']);
    expect(waves[1].nodes.map((n) => n.id)).toEqual(['b']);
    expect(waves[2].nodes.map((n) => n.id)).toEqual(['c']);
  });

  it('places fan-out nodes in the same wave when their single dep is complete', () => {
    // a → [b, c, d] in parallel
    const nodes = [node('a', 2), node('b', 5, ['a']), node('c', 3, ['a']), node('d', 1, ['a'])];
    const nodeById = new Map(nodes.map((n) => [n.id, n]));
    const waves = groupIntoWaves(nodes, nodeById);
    expect(waves).toHaveLength(2);
    expect(waves[0].nodes.map((n) => n.id)).toEqual(['a']);
    expect(waves[1].nodes.map((n) => n.id).sort()).toEqual(['b', 'c', 'd']);
  });

  it('handles a diamond dependency graph', () => {
    //    a
    //   / \
    //  b   c
    //   \ /
    //    d
    const nodes = [
      node('a', 1),
      node('b', 3, ['a']),
      node('c', 2, ['a']),
      node('d', 4, ['b', 'c']),
    ];
    const nodeById = new Map(nodes.map((n) => [n.id, n]));
    const waves = groupIntoWaves(nodes, nodeById);
    expect(waves).toHaveLength(3);
    expect(waves[0].nodes.map((n) => n.id)).toEqual(['a']);
    expect(waves[1].nodes.map((n) => n.id).sort()).toEqual(['b', 'c']);
    expect(waves[2].nodes.map((n) => n.id)).toEqual(['d']);
  });

  it('skips deps not present in the current node set', () => {
    // 'b' depends on 'a', but 'a' is not in the set
    const nodes = [node('b', 2, ['a']), node('c', 3)];
    const nodeById = new Map(nodes.map((n) => [n.id, n]));
    const waves = groupIntoWaves(nodes, nodeById);
    // 'a' is missing from nodeById, so 'b' has no satisfied deps → wave 0
    expect(waves).toHaveLength(1);
    expect(waves[0].nodes.map((n) => n.id).sort()).toEqual(['b', 'c']);
  });

  it('returns empty array for empty input', () => {
    const waves = groupIntoWaves([], new Map());
    expect(waves).toHaveLength(0);
  });
});

describe('orchestrationEngine — computeCriticalPath', () => {
  it('returns a single node when there are no dependencies', () => {
    const nodes = [node('x', 10), node('y', 3), node('z', 7)];
    const nodeById = new Map(nodes.map((n) => [n.id, n]));
    const { pathDays, pathIds } = computeCriticalPath(nodes, nodeById);
    expect(pathDays).toBe(10);
    expect(pathIds).toEqual(['x']);
  });

  it('computes the longest chain through a linear dependency', () => {
    // a(5) → b(10) → c(3) — total 18
    const nodes = [node('a', 5), node('b', 10, ['a']), node('c', 3, ['b'])];
    const nodeById = new Map(nodes.map((n) => [n.id, n]));
    const { pathDays, pathIds } = computeCriticalPath(nodes, nodeById);
    expect(pathDays).toBe(18);
    expect(pathIds).toEqual(['a', 'b', 'c']);
  });

  it('picks the longer branch in a diamond', () => {
    //   a(1) → b(10) → d(2)   total 13
    //         → c(2)  → d(2)  total  5
    const nodes = [
      node('a', 1),
      node('b', 10, ['a']),
      node('c', 2, ['a']),
      node('d', 2, ['b', 'c']),
    ];
    const nodeById = new Map(nodes.map((n) => [n.id, n]));
    const { pathDays, pathIds } = computeCriticalPath(nodes, nodeById);
    expect(pathDays).toBe(13); // a(1) + b(10) + d(2)
    expect(pathIds).toEqual(['a', 'b', 'd']);
  });

  it('returns zero for empty input', () => {
    const { pathDays, pathIds } = computeCriticalPath([], new Map());
    expect(pathDays).toBe(0);
    expect(pathIds).toHaveLength(0);
  });
});

describe('orchestrationEngine — buildOrchestratedPlan', () => {
  it('returns a correct full plan', () => {
    // identity(0) → exclusion(3) → leie(10)
    // licensure(21) independent
    // total serial = 0 + 3 + 10 + 21 = 34
    // critical path = 0 + 3 + 10 = 13 (identity → exclusion → leie)
    // parallel savings = 34 - 13 = 21
    const nodes = [
      node('identity', 0),
      node('exclusion', 3, ['identity']),
      node('leie', 10, ['exclusion']),
      node('licensure', 21),
    ];
    const plan = buildOrchestratedPlan(nodes);

    expect(plan.totalBlockers).toBe(4);
    expect(plan.criticalPathDays).toBe(13);
    expect(plan.criticalPathIds).toEqual(['identity', 'exclusion', 'leie']);
    expect(plan.parallelSavingsDays).toBe(21);
    expect(plan.waves).toHaveLength(3);
    expect(plan.waves[0].nodes.map((n) => n.id).sort()).toEqual(['identity', 'licensure']);
    expect(plan.waves[1].nodes.map((n) => n.id)).toEqual(['exclusion']);
    expect(plan.waves[2].nodes.map((n) => n.id)).toEqual(['leie']);
  });

  it('handles a single blocker with no dependencies', () => {
    const plan = buildOrchestratedPlan([node('only', 5)]);
    expect(plan.totalBlockers).toBe(1);
    expect(plan.criticalPathDays).toBe(5);
    expect(plan.criticalPathIds).toEqual(['only']);
    expect(plan.parallelSavingsDays).toBe(0);
    expect(plan.waves).toHaveLength(1);
  });

  it('returns empty plan for no blockers', () => {
    const plan = buildOrchestratedPlan([]);
    expect(plan.totalBlockers).toBe(0);
    expect(plan.criticalPathDays).toBe(0);
    expect(plan.criticalPathIds).toHaveLength(0);
    expect(plan.waves).toHaveLength(0);
  });

  it('handles parallel savings correctly for fully independent nodes', () => {
    // All independent: serial=60, critical path=30, savings=30
    const nodes = [node('a', 30), node('b', 20), node('c', 10)];
    const plan = buildOrchestratedPlan(nodes);
    expect(plan.criticalPathDays).toBe(30);
    expect(plan.parallelSavingsDays).toBe(30);
    expect(plan.waves).toHaveLength(1);
  });
});

describe('orchestrationEngine — real VitalCV blocker scenario', () => {
  it('computes the correct plan for verify-identity → submit-pecos-enrollment + run-exclusion-check', () => {
    // verify-identity(0) → submit-pecos(60)
    //                    → run-exclusion(3) → resolve-leie(10)
    // licensure(21) independent
    const nodes = [
      node('verify-identity', 0),
      node('submit-pecos-enrollment', 60, ['verify-identity']),
      node('run-exclusion-check', 3, ['verify-identity']),
      node('resolve-leie-review', 10, ['run-exclusion-check']),
      node('refresh-licensure', 21),
    ];
    const plan = buildOrchestratedPlan(nodes);

    // Critical path: verify-identity(0) → submit-pecos(60) = 60 days
    // verify-identity is a real predecessor even though its estimatedDays is 0
    expect(plan.criticalPathDays).toBe(60);
    expect(plan.criticalPathIds).toEqual(['verify-identity', 'submit-pecos-enrollment']);

    // Serial: 0+60+3+10+21 = 94, critical path 60 → savings 34
    expect(plan.parallelSavingsDays).toBe(34);
    expect(plan.totalBlockers).toBe(5);
  });
});

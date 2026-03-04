import { computeReachableNodesMemoized } from '../src/services/revocation/cascadeEngine';

function addEdge(graph: Map<string, Set<string>>, source: string, target: string): void {
  if (!graph.has(source)) {
    graph.set(source, new Set<string>());
  }
  if (!graph.has(target)) {
    graph.set(target, new Set<string>());
  }
  graph.get(source)?.add(target);
}

describe('revocation cascade graph memoization', () => {
  it('reuses memoized traversal for shared subgraphs', () => {
    const graph = new Map<string, Set<string>>();
    addEdge(graph, 'credential:root', 'decision:left');
    addEdge(graph, 'credential:root', 'decision:right');
    addEdge(graph, 'decision:left', 'decision:shared');
    addEdge(graph, 'decision:right', 'decision:shared');
    addEdge(graph, 'decision:shared', 'employer:alpha');

    const memo = new Map<string, Set<string>>();
    const computeCount = new Map<string, number>();
    const onComputed = (nodeId: string): void => {
      computeCount.set(nodeId, (computeCount.get(nodeId) ?? 0) + 1);
    };

    const reachableFromRoot = computeReachableNodesMemoized(
      'credential:root',
      graph,
      memo,
      onComputed,
    );
    expect([...reachableFromRoot].sort()).toEqual(
      [
        'credential:root',
        'decision:left',
        'decision:right',
        'decision:shared',
        'employer:alpha',
      ].sort(),
    );

    const countSnapshot = new Map(computeCount);
    const reachableFromLeft = computeReachableNodesMemoized(
      'decision:left',
      graph,
      memo,
      onComputed,
    );
    expect([...reachableFromLeft].sort()).toEqual(
      ['decision:left', 'decision:shared', 'employer:alpha'].sort(),
    );
    expect(computeCount).toEqual(countSnapshot);
    expect(computeCount.get('decision:shared')).toBe(1);
    expect(computeCount.get('employer:alpha')).toBe(1);
  });

  it('terminates on cycles and returns stable reachability', () => {
    const graph = new Map<string, Set<string>>();
    addEdge(graph, 'credential:root', 'decision:a');
    addEdge(graph, 'decision:a', 'decision:b');
    addEdge(graph, 'decision:b', 'decision:c');
    addEdge(graph, 'decision:c', 'decision:a');
    addEdge(graph, 'decision:c', 'employer:omega');

    const computeCount = new Map<string, number>();
    const reachable = computeReachableNodesMemoized(
      'credential:root',
      graph,
      new Map(),
      (nodeId: string) => {
        computeCount.set(nodeId, (computeCount.get(nodeId) ?? 0) + 1);
      },
    );

    expect([...reachable].sort()).toEqual(
      [
        'credential:root',
        'decision:a',
        'decision:b',
        'decision:c',
        'employer:omega',
      ].sort(),
    );
    expect([...(computeCount.values())].every((count) => count === 1)).toBe(true);
  });
});

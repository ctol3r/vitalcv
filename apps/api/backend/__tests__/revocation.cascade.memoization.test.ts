/**
 * revocation.cascade.memoization.test.ts — Wave B
 *
 * Unit tests for computeReachableNodesMemoized() in cascadeEngine.ts.
 * Pure function — no Prisma / network calls.
 *
 * Covers:
 *   - Basic reachability in a DAG
 *   - Cycle tolerance (no infinite loop)
 *   - Memoization: nodes computed once, cache hits returned for subsequent calls
 *   - Shared memo across multiple calls avoids re-traversal
 */

import { computeReachableNodesMemoized } from '../src/services/revocation/cascadeEngine';

// ── Helpers ────────────────────────────────────────────────────────────────

function makeGraph(edges: [string, string][]): Map<string, Set<string>> {
  const g = new Map<string, Set<string>>();
  for (const [src, dst] of edges) {
    if (!g.has(src)) g.set(src, new Set());
    if (!g.has(dst)) g.set(dst, new Set());
    g.get(src)!.add(dst);
  }
  return g;
}

// ── Tests ──────────────────────────────────────────────────────────────────

describe('computeReachableNodesMemoized', () => {
  it('single node with no edges is reachable only to itself', () => {
    const graph = makeGraph([]);
    graph.set('A', new Set());
    const result = computeReachableNodesMemoized('A', graph);
    expect(result).toEqual(new Set(['A']));
  });

  it('traverses a simple linear chain A→B→C', () => {
    const graph = makeGraph([['A', 'B'], ['B', 'C']]);
    const result = computeReachableNodesMemoized('A', graph);
    expect(result).toEqual(new Set(['A', 'B', 'C']));
  });

  it('traverses a diamond DAG: A→B, A→C, B→D, C→D', () => {
    const graph = makeGraph([['A', 'B'], ['A', 'C'], ['B', 'D'], ['C', 'D']]);
    const result = computeReachableNodesMemoized('A', graph);
    expect(result).toEqual(new Set(['A', 'B', 'C', 'D']));
  });

  it('does not include nodes not reachable from start', () => {
    const graph = makeGraph([['A', 'B'], ['C', 'D']]);
    const result = computeReachableNodesMemoized('A', graph);
    expect(result).toContain('A');
    expect(result).toContain('B');
    expect(result).not.toContain('C');
    expect(result).not.toContain('D');
  });

  it('handles a cycle without infinite recursion (A→B→C→A)', () => {
    const graph = makeGraph([['A', 'B'], ['B', 'C'], ['C', 'A']]);
    // Should terminate and contain all three nodes
    const result = computeReachableNodesMemoized('A', graph);
    expect(result.has('A')).toBe(true);
    expect(result.has('B')).toBe(true);
    expect(result.has('C')).toBe(true);
  });

  it('handles self-loop (A→A) without infinite recursion', () => {
    const graph = makeGraph([['A', 'A']]);
    const result = computeReachableNodesMemoized('A', graph);
    expect(result).toContain('A');
  });

  it('stores reachable sets for traversed nodes in the shared memo', () => {
    const graph = makeGraph([['A', 'B'], ['A', 'C'], ['B', 'D']]);
    const memo = new Map<string, Set<string>>();

    computeReachableNodesMemoized('A', graph, memo);

    expect(memo.get('A')).toEqual(new Set(['A', 'B', 'C', 'D']));
    expect(memo.get('B')).toEqual(new Set(['B', 'D']));
    expect(memo.get('C')).toEqual(new Set(['C']));
    expect(memo.get('D')).toEqual(new Set(['D']));
  });

  it('does not mutate the shared memo on cache hits', () => {
    const graph = makeGraph([['A', 'B'], ['B', 'C']]);
    const memo = new Map<string, Set<string>>();

    computeReachableNodesMemoized('A', graph, memo);
    const memoSnapshot = JSON.stringify(
      [...memo.entries()]
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([nodeId, reachable]) => [nodeId, [...reachable].sort()]),
    );

    const result = computeReachableNodesMemoized('A', graph, memo);

    expect(result).toEqual(new Set(['A', 'B', 'C']));
    expect(result).not.toBe(memo.get('A'));
    expect(
      JSON.stringify(
        [...memo.entries()]
          .sort(([left], [right]) => left.localeCompare(right))
          .map(([nodeId, reachable]) => [nodeId, [...reachable].sort()]),
      ),
    ).toBe(memoSnapshot);
  });

  it('partial memo reuse only adds uncached starting nodes', () => {
    const graph = makeGraph([['A', 'B'], ['B', 'C']]);
    const memo = new Map<string, Set<string>>();

    // Prime the memo with B and C by starting at B
    computeReachableNodesMemoized('B', graph, memo);
    expect(memo.has('A')).toBe(false);
    expect(memo.get('B')).toEqual(new Set(['B', 'C']));
    expect(memo.get('C')).toEqual(new Set(['C']));

    // Now traverse from A — B and C are reused from the shared memo
    computeReachableNodesMemoized('A', graph, memo);
    expect(memo.get('A')).toEqual(new Set(['A', 'B', 'C']));
    expect(memo.get('B')).toEqual(new Set(['B', 'C']));
    expect(memo.get('C')).toEqual(new Set(['C']));
  });

  it('returns a new Set instance each call (no aliasing)', () => {
    const graph = makeGraph([['A', 'B']]);
    const memo = new Map<string, Set<string>>();
    const r1 = computeReachableNodesMemoized('A', graph, memo);
    const r2 = computeReachableNodesMemoized('A', graph, memo);
    expect(r1).not.toBe(r2); // different instances
    expect(r1).toEqual(r2);  // same contents
  });

  it('models a credential → decision → employer cascade pattern', () => {
    const graph = makeGraph([
      ['credential:cred-1', 'decision:dec-1'],
      ['credential:cred-1', 'decision:dec-2'],
      ['decision:dec-1', 'employer:org-a'],
      ['decision:dec-2', 'employer:org-b'],
      ['decision:dec-1', 'deployment:dep-1'],
    ]);
    const result = computeReachableNodesMemoized('credential:cred-1', graph);
    expect(result).toContain('credential:cred-1');
    expect(result).toContain('decision:dec-1');
    expect(result).toContain('decision:dec-2');
    expect(result).toContain('employer:org-a');
    expect(result).toContain('employer:org-b');
    expect(result).toContain('deployment:dep-1');
  });
});

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
 *   - onComputed callback fires exactly once per unique node
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

  it('fires onComputed callback exactly once per computed node', () => {
    const graph = makeGraph([['A', 'B'], ['A', 'C'], ['B', 'D']]);
    const computed: string[] = [];
    computeReachableNodesMemoized('A', graph, new Map(), (nodeId) => {
      computed.push(nodeId);
    });
    // Each unique node should be computed exactly once
    expect(computed.sort()).toEqual(['A', 'B', 'C', 'D'].sort());
    expect(new Set(computed).size).toBe(computed.length);
  });

  it('does NOT fire onComputed for cache hits when memo is shared', () => {
    const graph = makeGraph([['A', 'B'], ['B', 'C']]);
    const memo = new Map<string, Set<string>>();
    const computedFirst: string[] = [];
    const computedSecond: string[] = [];

    // First traversal — all nodes computed
    computeReachableNodesMemoized('A', graph, memo, (n) => computedFirst.push(n));
    expect(computedFirst.length).toBeGreaterThan(0);

    // Second traversal with same memo — 'A' already cached, onComputed NOT fired
    computeReachableNodesMemoized('A', graph, memo, (n) => computedSecond.push(n));
    expect(computedSecond).toHaveLength(0);
  });

  it('partial memo reuse: only uncached nodes fire onComputed', () => {
    const graph = makeGraph([['A', 'B'], ['B', 'C']]);
    const memo = new Map<string, Set<string>>();
    const firstRound: string[] = [];

    // Prime the memo with B and C by starting at B
    computeReachableNodesMemoized('B', graph, memo, (n) => firstRound.push(n));
    expect(firstRound.sort()).toEqual(['B', 'C'].sort());

    // Now traverse from A — B and C already cached, only A should fire
    const secondRound: string[] = [];
    computeReachableNodesMemoized('A', graph, memo, (n) => secondRound.push(n));
    expect(secondRound).toEqual(['A']);
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

import { describe, expect, it } from 'vitest';
import {
  CAREER_NODES,
  CAREER_EDGES,
  GROUP_META,
} from '@/components/career-graph/data';

/**
 * Career-evidence graph data contract.
 *
 * The graph is modeled the Roam/Obsidian way: EVERY NODE IS A UNIQUE ENTITY.
 * There must be no repeated label (the old dataset generated a separate "NPI"
 * node per clinician — this test exists so that regression can't return).
 * Shared concepts (sources, specialties, issuers, employers) are single hub
 * nodes; per-clinician credentials are edges to those hubs.
 */

describe('career-graph data — unique nodes', () => {
  it('every node id is unique', () => {
    const ids = CAREER_NODES.map((n) => n.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('every node LABEL is unique (no duplicate "NPI"/"Board Cert" nodes)', () => {
    const labels = CAREER_NODES.map((n) => n.label);
    const dupes = [...new Set(labels.filter((l, i) => labels.indexOf(l) !== i))];
    expect(dupes).toEqual([]);
  });

  it('only the three doctrine groups (+ neutral evidence) appear', () => {
    const groups = new Set(CAREER_NODES.map((n) => n.group));
    for (const g of groups) expect(GROUP_META[g]).toBeDefined();
    expect(groups.has('holder')).toBe(true);
    expect(groups.has('verifier')).toBe(true); // verifier ≡ employer
    expect(groups.has('issuer')).toBe(true);
  });
});

describe('career-graph data — bidirectional edges', () => {
  const ids = new Set(CAREER_NODES.map((n) => n.id));

  it('every edge references existing nodes', () => {
    for (const e of CAREER_EDGES) {
      expect(ids.has(e.source)).toBe(true);
      expect(ids.has(e.target)).toBe(true);
    }
  });

  it('every forward link has a matching backlink (bidirectional)', () => {
    const has = (s: string, t: string, kind: string) =>
      CAREER_EDGES.some((e) => e.source === s && e.target === t && e.kind === kind);
    const forward = CAREER_EDGES.filter((e) => e.kind !== 'backlink');
    for (const e of forward) {
      expect(has(e.target, e.source, 'backlink')).toBe(true);
    }
  });

  it('no self-loops', () => {
    for (const e of CAREER_EDGES) expect(e.source).not.toBe(e.target);
  });
});

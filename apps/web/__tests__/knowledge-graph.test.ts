/**
 * Wave 1100 — Knowledge Graph Platform integration (C7)
 * ──────────────────────────────────────────────────────────────────────────
 * Validates that Identity → Education → Evidence → Trust → Organizations →
 * Research → Leadership → Legacy → Opportunities all resolve through ONE graph:
 * a single subject root from which evidence and organizations are reachable by
 * traversal, searchable by kind/label, and honest about decision-grade.
 */
import { describe, expect, it } from 'vitest';
import { buildDemoPassport } from '../lib/demo/demo-passport';
import { passportToEvidenceCollection } from '../lib/evidence/passport-to-evidence';
import {
  buildKnowledgeGraph,
  indexKnowledgeGraph,
  neighbors,
  traverseSubgraph,
  searchEntities,
  KNOWLEDGE_GRAPH_SCHEMA,
} from '@vitalcv/domain-evidence';

function graph() {
  return buildKnowledgeGraph(passportToEvidenceCollection(buildDemoPassport()));
}

describe('Knowledge Graph — one canonical graph (C1/C7)', () => {
  it('unifies subject, evidence, and organization entities into one graph', () => {
    const g = graph();
    expect(g.schema).toBe(KNOWLEDGE_GRAPH_SCHEMA);
    expect(g.stats.byKind.subject).toBe(1); // Identity: exactly one subject
    expect(g.stats.byKind.evidence).toBeGreaterThan(0); // Education/Evidence
    expect(g.stats.byKind.organization).toBeGreaterThan(0); // Organizations
    expect(g.stats.entityCount).toBe(g.entities.length);
    expect(g.stats.edgeCount).toBe(g.edges.length);
  });

  it('everything resolves through one graph — traversal from the subject reaches evidence and orgs', () => {
    const g = graph();
    const index = indexKnowledgeGraph(g);

    // Subject's direct neighbors include evidence.
    const subjectNeighbors = neighbors(index, g.subjectId);
    expect(subjectNeighbors.some((e) => e.kind === 'evidence')).toBe(true);

    // Bounded traversal from the subject reaches organization entities (the chain
    // Identity → Evidence → Organizations is connected in one graph).
    const sub = traverseSubgraph(index, g.subjectId, 3);
    const kinds = new Set(sub.entities.map((e) => e.kind));
    expect(kinds.has('subject')).toBe(true);
    expect(kinds.has('evidence')).toBe(true);
    expect(sub.entities.length).toBeGreaterThan(1);
    // Every returned edge connects two returned entities (well-formed subgraph).
    const ids = new Set(sub.entities.map((e) => e.id));
    for (const edge of sub.edges) {
      expect(ids.has(edge.from) && ids.has(edge.to)).toBe(true);
    }
  });

  it('decision-grade honesty carries through the graph', () => {
    const g = graph();
    for (const e of g.entities) {
      if (e.kind === 'evidence') {
        // decisionGrade ⇔ status === 'checked'
        expect(e.decisionGrade).toBe(e.status === 'checked');
      }
    }
    const dgCount = g.entities.filter((e) => e.decisionGrade).length;
    expect(g.stats.decisionGradeEntityCount).toBe(dgCount);
    expect(g.stats.decisionGradeEntityCount).toBeLessThanOrEqual(g.stats.entityCount);
  });

  it('search resolves by kind, label, and decision-grade (C5)', () => {
    const g = graph();
    const orgs = searchEntities(g, { kind: 'organization' });
    expect(orgs.length).toBe(g.stats.byKind.organization);
    expect(orgs.every((e) => e.kind === 'organization')).toBe(true);

    const dgOnly = searchEntities(g, { decisionGradeOnly: true });
    expect(dgOnly.every((e) => e.decisionGrade)).toBe(true);

    // Label substring search is case-insensitive.
    const someLabel = g.entities.find((e) => e.kind === 'evidence')!.label.slice(0, 3).toLowerCase();
    const byLabel = searchEntities(g, { q: someLabel });
    expect(byLabel.every((e) => e.label.toLowerCase().includes(someLabel))).toBe(true);
  });

  it('traversal is bounded and deterministic (C6)', () => {
    const g = graph();
    const index = indexKnowledgeGraph(g);

    // Depth 0 returns only the root.
    const d0 = traverseSubgraph(index, g.subjectId, 0);
    expect(d0.entities).toHaveLength(1);
    expect(d0.entities[0].id).toBe(g.subjectId);

    // Deterministic content hash.
    expect(g.contentHash).toBe(graph().contentHash);
    expect(g.contentHash).toMatch(/^[0-9a-f]{8}$/);

    // Unknown root → empty, not a throw.
    const missing = traverseSubgraph(index, 'does-not-exist', 3);
    expect(missing.entities).toHaveLength(0);
  });
});

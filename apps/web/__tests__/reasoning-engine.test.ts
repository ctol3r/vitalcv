/**
 * Wave 1200 — Professional Reasoning Engine integration (C7)
 * ──────────────────────────────────────────────────────────────────────────
 * One reasoning engine over the canonical Knowledge Graph, consumed by every
 * product (Career, Recruiter, Organization, Growth, Trust Exchange). Validates:
 *  - every answer is explained (evidence, relationships, path, confidence) — C4
 *  - confidence is honest: decision-grade coverage only, never inflated
 *  - scenario simulation never mutates source data and never confers
 *    decision-grade — a hypothetical is never real verification — C5
 *  - traversal is bounded/cached — C6
 */
import { describe, expect, it } from 'vitest';
import { buildDemoPassport } from '../lib/demo/demo-passport';
import { passportToEvidenceCollection } from '../lib/evidence/passport-to-evidence';
import {
  buildKnowledgeGraph,
  reason,
  createReasoner,
  simulateScenario,
  REASONING_SCHEMA,
} from '@vitalcv/domain-evidence';

function graph() {
  return buildKnowledgeGraph(passportToEvidenceCollection(buildDemoPassport()));
}

describe('Reasoning Engine — one semantic layer (C1/C4/C7)', () => {
  it('every answer carries evidence, relationships, traversal path, and confidence', () => {
    const result = reason(graph(), { maxDepth: 3 });
    expect(result.schema).toBe(REASONING_SCHEMA);
    expect(result.explanation).toBeDefined();
    expect(Array.isArray(result.explanation.evidence)).toBe(true);
    expect(Array.isArray(result.explanation.relationships)).toBe(true);
    expect(Array.isArray(result.explanation.traversalPath)).toBe(true);
    expect(result.explanation.traversalPath[0]).toBe(result.plan.root); // path starts at root
    expect(result.explanation.confidence).toHaveProperty('score');
    expect(result.explanation.confidence).toHaveProperty('basis');
    expect(result.hypothetical).toBe(false);
  });

  it('confidence is honest — decision-grade coverage only, bounded [0,1]', () => {
    const result = reason(graph(), { maxDepth: 4 });
    const c = result.explanation.confidence;
    expect(c.score).toBeGreaterThanOrEqual(0);
    expect(c.score).toBeLessThanOrEqual(1);
    expect(c.decisionGradeEvidence).toBeLessThanOrEqual(c.totalEvidence);
    // The score equals the decision-grade fraction (no inflation).
    const expected = c.totalEvidence === 0 ? 0 : Math.round((c.decisionGradeEvidence / c.totalEvidence) * 10000) / 10000;
    expect(c.score).toBe(expected);
  });

  it('createReasoner caches the index and answers consistently (C6)', () => {
    const g = graph();
    const reasoner = createReasoner(g);
    const a = reasoner.ask({ maxDepth: 2 });
    const b = reasoner.ask({ maxDepth: 2 });
    expect(a.answer.map((e) => e.id)).toEqual(b.answer.map((e) => e.id));
    expect(a.explanation.confidence.score).toBe(b.explanation.confidence.score);
  });
});

describe('Reasoning Engine — scenario simulation (C5)', () => {
  it('never mutates the source graph', () => {
    const g = graph();
    const beforeEntities = g.entities.length;
    const beforeEdges = g.edges.length;
    const beforeHash = g.contentHash;

    simulateScenario(g, [
      { type: 'add_entity', entity: { id: 'maybe-board-cert', kind: 'evidence', label: 'Hypothetical board cert', status: 'checked' } },
      { type: 'add_edge', edge: { from: g.subjectId, to: 'hypothetical:maybe-board-cert', predicate: g.edges[0]?.predicate ?? 'HAS_EVIDENCE' } },
    ]);

    // Source graph unchanged.
    expect(g.entities.length).toBe(beforeEntities);
    expect(g.edges.length).toBe(beforeEdges);
    expect(g.contentHash).toBe(beforeHash);
  });

  it('a hypothetical checked credential is NEVER decision-grade and never inflates confidence', () => {
    const g = graph();
    const real = reason(g, { maxDepth: 4 });

    const scenario = simulateScenario(
      g,
      [
        // Add a hypothetical credential and mark it "checked" — must stay non-decision-grade.
        { type: 'add_entity', entity: { id: 'fake-checked', kind: 'evidence', label: 'Pretend checked', status: 'checked' } },
        { type: 'add_edge', edge: { from: g.subjectId, to: 'hypothetical:fake-checked', predicate: g.edges[0]?.predicate ?? 'HAS_EVIDENCE' } },
      ],
      { maxDepth: 4 },
    );

    expect(scenario.hypothetical).toBe(true);
    expect(scenario.result.hypothetical).toBe(true);

    // The hypothetical entity exists in the simulated answer but is not decision-grade.
    const fake = scenario.result.explanation.evidence.find((e) => e.id === 'hypothetical:fake-checked');
    if (fake) expect(fake.decisionGrade).toBe(false);

    // Confidence is NOT inflated above the real decision-grade fraction.
    expect(scenario.result.explanation.confidence.decisionGradeEvidence).toBe(
      real.explanation.confidence.decisionGradeEvidence,
    );
  });

  it('set_status on a hypothetical entity does not confer decision-grade', () => {
    const g = graph();
    const scenario = simulateScenario(g, [
      { type: 'add_entity', entity: { id: 'h1', kind: 'evidence', label: 'Hypo', status: 'self_reported' } },
      { type: 'set_status', target: 'hypothetical:h1', status: 'checked' },
    ]);
    const h = scenario.result.explanation.evidence.find((e) => e.id === 'hypothetical:h1');
    if (h) expect(h.decisionGrade).toBe(false);
  });

  it('set_status UPGRADE on a REAL non-decision-grade entity cannot raise confidence', () => {
    const g = graph();
    const baseline = reason(g, { maxDepth: 5 });

    // A real (non-hypothetical) evidence entity that is currently NOT decision-grade
    // (the demo has self-reported credentials/training).
    const target = g.entities.find((e) => e.kind === 'evidence' && !e.decisionGrade && !e.id.startsWith('hypothetical:'));
    expect(target).toBeDefined();

    const scenario = simulateScenario(
      g,
      [{ type: 'set_status', target: target!.id, status: 'checked' }],
      { maxDepth: 5 },
    );

    // The hypothetically-upgraded real entity must stay non-decision-grade.
    const inSim = scenario.result.explanation.evidence.find((e) => e.id === target!.id);
    if (inSim) expect(inSim.decisionGrade).toBe(false);

    // Confidence must not be inflated above the real baseline.
    expect(scenario.result.explanation.confidence.decisionGradeEvidence).toBeLessThanOrEqual(
      baseline.explanation.confidence.decisionGradeEvidence,
    );
  });
});

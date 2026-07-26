import { describe, expect, it } from 'vitest';

import {
  DENIALS,
  PERSPECTIVE_RULES,
  type GraphPerspective,
} from './authorization';
import { EDGE_GAPS, NODE_GAPS } from './gaps';
import { EDGE_PROJECTIONS, NODE_PROJECTIONS } from './projection';
import type { CareerGraphEdgeType, CareerGraphNodeType } from './types';

/**
 * The ontology, restated here as values.
 *
 * This duplication is deliberate: the type union cannot be enumerated at
 * runtime, so without it "every node type is decided" is unprovable. The
 * `satisfies` below makes the compiler reject any drift between this list and
 * the union — add a node type without listing it and this file fails to build.
 */
const ALL_NODE_TYPES = [
  'clinician',
  'wallet',
  'identity',
  'npi',
  'evidence_claim',
  'source_receipt',
  'credential',
  'license',
  'specialty',
  'preference',
  'organization',
  'facility',
  'opportunity',
  'requirement',
  'recommendation',
  'application',
  'application_packet',
  'consent_receipt',
  'clarification',
  'decision',
  'decision_capsule',
  'recognition',
  'start_attestation',
  'source',
  'methodology',
] as const satisfies readonly CareerGraphNodeType[];

const ALL_EDGE_TYPES = [
  'owns',
  'has_identity',
  'holds',
  'backed_by',
  'observed_by',
  'supersedes',
  'revokes',
  'states_preference',
  'offered_by',
  'located_at',
  'requires',
  'satisfies',
  'partially_satisfies',
  'matched_to',
  'explained_by',
  'interested_in',
  'passed_on',
  'applied_to',
  'targets_version',
  'presented_in',
  'consented_to',
  'reviewed_by',
  'requested_clarification',
  'decided_by',
  'accepted_as_head_start',
  'produced_recognition',
  'recognized_by',
  'started_at',
] as const satisfies readonly CareerGraphEdgeType[];

describe('ontology coverage — nothing is silently forgotten', () => {
  it('decides every node type: projected or registered as a gap, never both, never neither', () => {
    const projected = new Set(NODE_PROJECTIONS.map((p) => p.type));
    const gapped = new Set(NODE_GAPS.map((g) => g.type));

    for (const type of ALL_NODE_TYPES) {
      const decided = projected.has(type) !== gapped.has(type);
      expect(decided, `node type "${type}" must be exactly one of projected or gapped`).toBe(true);
    }
    expect(projected.size + gapped.size).toBe(ALL_NODE_TYPES.length);
  });

  it('decides every edge type: projected or registered as a gap, never both, never neither', () => {
    const projected = new Set(EDGE_PROJECTIONS.map((p) => p.type));
    const gapped = new Set(EDGE_GAPS.map((g) => g.type));

    for (const type of ALL_EDGE_TYPES) {
      const decided = projected.has(type) !== gapped.has(type);
      expect(decided, `edge type "${type}" must be exactly one of projected or gapped`).toBe(true);
    }
    expect(projected.size + gapped.size).toBe(ALL_EDGE_TYPES.length);
  });

  it('registers no duplicate projections', () => {
    expect(new Set(NODE_PROJECTIONS.map((p) => p.type)).size).toBe(NODE_PROJECTIONS.length);
    expect(new Set(EDGE_PROJECTIONS.map((p) => p.type)).size).toBe(EDGE_PROJECTIONS.length);
  });
});

describe('projection integrity — the graph describes truth already held', () => {
  it('never projects an edge whose endpoints are not themselves projectable', () => {
    const projectableNodes = new Set(NODE_PROJECTIONS.map((p) => p.type));

    for (const edge of EDGE_PROJECTIONS) {
      expect(projectableNodes.has(edge.from), `edge "${edge.type}" projects from unprojectable "${edge.from}"`).toBe(true);
      expect(projectableNodes.has(edge.to), `edge "${edge.type}" projects to unprojectable "${edge.to}"`).toBe(true);
    }
  });

  it('names a canonical model and locator for every projection', () => {
    for (const node of NODE_PROJECTIONS) {
      expect(node.model.length, `node "${node.type}" needs a model`).toBeGreaterThan(0);
      expect(node.idField.length, `node "${node.type}" needs an idField`).toBeGreaterThan(0);
      expect(node.labelFields.length, `node "${node.type}" needs labelFields`).toBeGreaterThan(0);
    }
    for (const edge of EDGE_PROJECTIONS) {
      expect(edge.model.length, `edge "${edge.type}" needs a model`).toBeGreaterThan(0);
      expect(edge.via.length, `edge "${edge.type}" needs a via`).toBeGreaterThan(0);
    }
  });

  it('explains every non-FK edge, so a dangling join is never mistaken for an enforced one', () => {
    for (const edge of EDGE_PROJECTIONS.filter((e) => !e.foreignKeyBacked)) {
      expect(edge.note, `edge "${edge.type}" is not FK-backed and must say why`).toBeTruthy();
    }
  });

  it('states what exists today and what is required, for every gap', () => {
    for (const gap of [...NODE_GAPS, ...EDGE_GAPS]) {
      expect(gap.today.length, `gap "${gap.type}" must state today`).toBeGreaterThan(0);
      expect(gap.wouldRequire.length, `gap "${gap.type}" must state wouldRequire`).toBeGreaterThan(0);
    }
  });
});

describe('authorization matrix', () => {
  const rule = (p: GraphPerspective) => PERSPECTIVE_RULES.find((r) => r.perspective === p)!;

  it('covers every perspective exactly once', () => {
    const perspectives = PERSPECTIVE_RULES.map((r) => r.perspective);
    expect(new Set(perspectives).size).toBe(PERSPECTIVE_RULES.length);
    expect(new Set(perspectives)).toEqual(
      new Set<GraphPerspective>(['clinician_self', 'employer_reviewer', 'admin', 'public']),
    );
  });

  it('exposes no public clinician career graph by default', () => {
    expect(rule('public').visibleNodes).toEqual([]);
    expect(rule('public').visibleEdges).toEqual([]);
  });

  it('grants admin nothing implicitly, and audits it', () => {
    expect(rule('admin').visibleNodes).toEqual([]);
    expect(rule('admin').audited).toBe(true);
  });

  it('never lets an employer see a clinician’s private discovery signals', () => {
    const employer = rule('employer_reviewer');
    expect(employer.visibleEdges).not.toContain('passed_on');
    expect(employer.visibleEdges).not.toContain('interested_in');
    expect(employer.visibleNodes).not.toContain('preference');
    expect(employer.visibleNodes).not.toContain('wallet');
  });

  it('gives every denial a reason and a target', () => {
    for (const denial of DENIALS) {
      expect(denial.reason.length).toBeGreaterThan(0);
      expect(
        Boolean(denial.nodeType) !== Boolean(denial.edgeType),
        'a denial targets exactly one of nodeType or edgeType',
      ).toBe(true);
    }
  });

  it('keeps every denial consistent with the matrix it constrains', () => {
    for (const denial of DENIALS) {
      const r = rule(denial.perspective);
      if (denial.nodeType) expect(r.visibleNodes).not.toContain(denial.nodeType);
      if (denial.edgeType) expect(r.visibleEdges).not.toContain(denial.edgeType);
    }
  });

  it('binds every visible type to a scope predicate — a type filter alone is not authorization', () => {
    for (const r of PERSPECTIVE_RULES) {
      if (r.visibleNodes.length > 0) expect(r.scope.length).toBeGreaterThan(0);
    }
  });

  it('only exposes a perspective to node types that can actually project', () => {
    const projectable = new Set(NODE_PROJECTIONS.map((p) => p.type));
    for (const r of PERSPECTIVE_RULES) {
      for (const node of r.visibleNodes) {
        expect(projectable.has(node), `"${r.perspective}" exposes "${node}", which projects from nothing`).toBe(true);
      }
    }
  });
});

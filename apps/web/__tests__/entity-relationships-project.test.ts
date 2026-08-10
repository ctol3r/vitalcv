import { describe, expect, it } from 'vitest';

import type { GraphNode, GraphProjection, GraphRelationship } from '@vitalcv/domain-evidence';

import { projectEntityRelationships } from '@/lib/entity-relationships/project';

function node(id: string, type: GraphNode['type'], label: string, status: GraphNode['status'] = null): GraphNode {
  return {
    id,
    type,
    label,
    trustScore: null,
    evidenceSource: null,
    status,
    evidenceClass: null,
    decisionGrade: false,
    checkedAt: null,
    expiresAt: null,
    lifecycle: null,
  };
}

function rel(id: string, from: string, to: string, type: GraphRelationship['type'], evidenceId: string | null = null): GraphRelationship {
  return { id, from, to, type, evidenceId };
}

function graphOf(nodes: GraphNode[], relationships: GraphRelationship[]): GraphProjection {
  return {
    subjectKey: 'subject:me',
    nodes,
    relationships,
    stats: { nodeCount: nodes.length, relationshipCount: relationships.length, decisionGradeNodeCount: 0 },
  };
}

const SUBJECT = node('subject:me', 'subject', 'Dr. Chris Toler');
const LICENSE = node('evidence:lic_ca', 'evidence', 'California Medical License', 'gated');
const SOURCE = node('source:nppes', 'source', 'NPPES');

describe('projectEntityRelationships', () => {
  it('splits a relationship into outgoing (from focus) and backlink (to focus)', () => {
    const graph = graphOf([SUBJECT, LICENSE], [rel('r1', 'subject:me', 'evidence:lic_ca', 'HOLDS_LICENSE', 'ev1')]);

    const subjectRels = projectEntityRelationships(graph, 'subject:me');
    expect(subjectRels.outgoing).toHaveLength(1);
    expect(subjectRels.backlinks).toHaveLength(0);
    expect(subjectRels.outgoing[0]).toMatchObject({
      type: 'HOLDS_LICENSE',
      label: 'Holds license',
      direction: 'outgoing',
      evidenceId: 'ev1',
      node: { id: 'evidence:lic_ca', type: 'evidence', label: 'California Medical License', state: 'gated' },
    });

    // The SAME edge, viewed from the license, is a backlink with inverse phrasing.
    const licenseRels = projectEntityRelationships(graph, 'evidence:lic_ca');
    expect(licenseRels.outgoing).toHaveLength(0);
    expect(licenseRels.backlinks).toHaveLength(1);
    expect(licenseRels.backlinks[0]).toMatchObject({
      label: 'Licensed to',
      direction: 'backlink',
      node: { id: 'subject:me', label: 'Dr. Chris Toler' },
    });
  });

  it('defaults the focus to the subject node when none is given', () => {
    const graph = graphOf([SUBJECT, LICENSE], [rel('r1', 'subject:me', 'evidence:lic_ca', 'HOLDS_LICENSE')]);
    const rels = projectEntityRelationships(graph);
    expect(rels.focusId).toBe('subject:me');
    expect(rels.outgoing).toHaveLength(1);
  });

  it('carries the evidence coverage state onto the related node (never invents one)', () => {
    const graph = graphOf(
      [SUBJECT, LICENSE, SOURCE],
      [
        rel('r1', 'subject:me', 'evidence:lic_ca', 'HOLDS_LICENSE'),
        rel('r2', 'evidence:lic_ca', 'source:nppes', 'VERIFIED_BY'),
      ],
    );
    const licenseRels = projectEntityRelationships(graph, 'evidence:lic_ca');
    // outgoing: license → source (VERIFIED_BY); backlink: subject → license (HOLDS_LICENSE)
    expect(licenseRels.outgoing.map((r) => r.node.id)).toEqual(['source:nppes']);
    expect(licenseRels.outgoing[0].label).toBe('Verified by');
    expect(licenseRels.backlinks.map((r) => r.node.id)).toEqual(['subject:me']);
    // The source node has no coverage state — it must stay undefined, not fabricated.
    expect(licenseRels.outgoing[0].node.state).toBeUndefined();
  });

  it('returns empty lists for a node with no relationships', () => {
    const orphan = node('evidence:orphan', 'evidence', 'Unconnected claim');
    const graph = graphOf([SUBJECT, orphan], []);
    const rels = projectEntityRelationships(graph, 'evidence:orphan');
    expect(rels.outgoing).toEqual([]);
    expect(rels.backlinks).toEqual([]);
  });
});

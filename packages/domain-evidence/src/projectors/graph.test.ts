import { describe, expect, it } from 'vitest';
import { buildEvidenceCollection, isDecisionGradeStatus } from '../collection';
import type { EvidenceObject, EvidenceClass, EvidenceStatus } from '../types';
import {
  GRAPH_RELATIONSHIP_TYPES,
  projectEvidenceToGraph,
  statusTrustScore,
} from './graph';

function makeObject(
  id: string,
  evidenceClass: EvidenceClass,
  status: EvidenceStatus,
  sourceId: string,
): EvidenceObject {
  return {
    evidenceId: id,
    subjectKey: 'subject-1',
    evidenceClass,
    label: `${evidenceClass} ${id}`,
    value: null,
    status,
    source: { sourceId, sourceLabel: sourceId, laneType: null, governance: null },
    trustTier: null,
    decisionGrade: isDecisionGradeStatus(status),
    observedAt: null,
    checkedAt: null,
    expiresAt: null,
    freshnessWindowHours: null,
    integrityHash: null,
    provenance: { artifactIds: [], receiptIds: [], sourceUrl: null, checksum: null, parserVersion: null },
    lifecycle: 'active',
    supersedes: null,
    supersededBy: null,
  };
}

function fixtureCollection() {
  return buildEvidenceCollection({
    subjectKey: 'subject-1',
    generatedFor: { displayName: 'Ada Lovelace', npi: '1234567890' },
    objects: [
      makeObject('coverage:NPPES_API', 'identity', 'checked', 'NPPES_API'),
      makeObject('cred:lic-ca', 'licensure', 'checked', 'STATE_BOARD'),
      makeObject('cred:abms', 'board_cert', 'checked', 'ABMS'),
      makeObject('coverage:STATE_BOARD', 'licensure', 'gated', 'STATE_BOARD'),
    ],
  });
}

describe('projectEvidenceToGraph', () => {
  it('projects licenses with HOLDS_LICENSE', () => {
    const graph = projectEvidenceToGraph(fixtureCollection());
    const rel = graph.relationships.find((r) => r.to === 'cred:lic-ca' && r.from.startsWith('subject:'));
    expect(rel?.type).toBe('HOLDS_LICENSE');
  });

  it('projects certifications with HOLDS_CERTIFICATION and CERTIFIED_BY source', () => {
    const graph = projectEvidenceToGraph(fixtureCollection());
    const holds = graph.relationships.find((r) => r.to === 'cred:abms' && r.from.startsWith('subject:'));
    const certifiedBy = graph.relationships.find((r) => r.from === 'cred:abms' && r.to.startsWith('source:'));
    expect(holds?.type).toBe('HOLDS_CERTIFICATION');
    expect(certifiedBy?.type).toBe('CERTIFIED_BY');
  });

  it('generates no duplicate nodes (subject once, source deduped)', () => {
    const graph = projectEvidenceToGraph(fixtureCollection());
    const ids = graph.nodes.map((n) => n.id);
    expect(new Set(ids).size).toBe(ids.length);
    // STATE_BOARD is shared by two evidence objects but yields one source node
    expect(graph.nodes.filter((n) => n.id === 'source:STATE_BOARD')).toHaveLength(1);
    expect(graph.nodes.filter((n) => n.type === 'subject')).toHaveLength(1);
  });

  it('has no orphan relationships (every endpoint is a real node)', () => {
    const graph = projectEvidenceToGraph(fixtureCollection());
    const nodeIds = new Set(graph.nodes.map((n) => n.id));
    for (const rel of graph.relationships) {
      expect(nodeIds.has(rel.from)).toBe(true);
      expect(nodeIds.has(rel.to)).toBe(true);
    }
  });

  it('does not inflate trust — gated evidence scores 0, checked scores 1', () => {
    const graph = projectEvidenceToGraph(fixtureCollection());
    const gated = graph.nodes.find((n) => n.id === 'coverage:STATE_BOARD');
    const checked = graph.nodes.find((n) => n.id === 'coverage:NPPES_API');
    expect(gated?.trustScore).toBe(0);
    expect(checked?.trustScore).toBe(1);
    // no evidence node exceeds its status-implied score
    for (const node of graph.nodes) {
      if (node.type === 'evidence' && node.status) {
        expect(node.trustScore).toBeLessThanOrEqual(statusTrustScore(node.status));
      }
    }
  });

  it('produces no false decision-grade states', () => {
    const graph = projectEvidenceToGraph(fixtureCollection());
    for (const node of graph.nodes) {
      if (node.type === 'evidence' && node.status) {
        expect(node.decisionGrade).toBe(node.status === 'checked');
      } else {
        expect(node.decisionGrade).toBe(false); // subject/source are never decision-grade
      }
    }
  });

  it('only emits enumerated relationship types', () => {
    const graph = projectEvidenceToGraph(fixtureCollection());
    for (const rel of graph.relationships) {
      expect(GRAPH_RELATIONSHIP_TYPES).toContain(rel.type);
    }
  });

  it('reports honest stats', () => {
    const graph = projectEvidenceToGraph(fixtureCollection());
    expect(graph.stats.nodeCount).toBe(graph.nodes.length);
    expect(graph.stats.relationshipCount).toBe(graph.relationships.length);
    expect(graph.stats.decisionGradeNodeCount).toBe(graph.nodes.filter((n) => n.decisionGrade).length);
  });
});

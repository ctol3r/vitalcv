import { describe, expect, it } from 'vitest';
import { buildEvidenceCollection, isDecisionGradeStatus } from '../collection';
import { projectEvidenceToGraph } from '../projectors/graph';
import type { EvidenceClass, EvidenceObject, EvidenceStatus } from '../types';
import { projectOrganizations } from './organizations';

function makeObject(id: string, evidenceClass: EvidenceClass, status: EvidenceStatus, sourceId: string, sourceLabel: string): EvidenceObject {
  return {
    evidenceId: id, subjectKey: 'subject-1', evidenceClass, label: `${evidenceClass} ${id}`, value: null, status,
    source: { sourceId, sourceLabel, laneType: null, governance: null },
    trustTier: null, decisionGrade: isDecisionGradeStatus(status),
    observedAt: null, checkedAt: '2026-03-01T00:00:00.000Z', expiresAt: null, freshnessWindowHours: null,
    integrityHash: null, provenance: { artifactIds: [], receiptIds: [], sourceUrl: null, checksum: null, parserVersion: null },
    lifecycle: 'active', supersedes: null, supersededBy: null,
  };
}

function orgGraph(objects: EvidenceObject[]) {
  const collection = buildEvidenceCollection({ subjectKey: 'subject-1', generatedFor: { displayName: 'Ada', npi: '1' }, objects });
  return projectOrganizations(collection, projectEvidenceToGraph(collection));
}

const FIXTURE = [
  makeObject('coverage:NPPES_API', 'identity', 'checked', 'nppes', 'NPPES'),
  makeObject('cred:lic', 'licensure', 'checked', 'stateboard', 'California Medical Board'),
  makeObject('cred:abms', 'board_cert', 'checked', 'abms', 'ABMS'),
  makeObject('training:res', 'training', 'checked', 'johnshopkins', 'Johns Hopkins'),
];

function find(g: ReturnType<typeof orgGraph>, sourceId: string) {
  return g.organizations.find((o) => o.sourceId === sourceId)!;
}
function rel(g: ReturnType<typeof orgGraph>, sourceId: string) {
  return g.relationships.find((r) => r.to === `org:${sourceId}`)!;
}

describe('projectOrganizations (W265)', () => {
  it('types organizations by the evidence class they back', () => {
    const g = orgGraph(FIXTURE);
    expect(find(g, 'johnshopkins').kind).toBe('training_institution');
    expect(find(g, 'abms').kind).toBe('credential_issuer');
    expect(find(g, 'stateboard').kind).toBe('licensing_board');
    expect(find(g, 'nppes').kind).toBe('verification_authority');
  });

  it('types the clinician↔organization relationships', () => {
    const g = orgGraph(FIXTURE);
    expect(rel(g, 'johnshopkins').type).toBe('TRAINED_AT');
    expect(rel(g, 'abms').type).toBe('CERTIFIED_BY');
    expect(rel(g, 'stateboard').type).toBe('VERIFIED_BY');
    // every relationship originates from the clinician subject node
    expect(g.relationships.every((r) => r.from === 'subject:subject-1')).toBe(true);
  });

  it('does not inflate trust — contribution is bounded and gated orgs contribute 0', () => {
    const g = orgGraph([
      ...FIXTURE,
      makeObject('cred:lic-gated', 'licensure', 'gated', 'gatedboard', 'Gated Board'),
    ]);
    for (const o of g.organizations) {
      if (o.trustContribution !== null) expect(o.trustContribution).toBeLessThanOrEqual(1);
    }
    expect(find(g, 'gatedboard').trustContribution).toBe(0);
    expect(rel(g, 'gatedboard').decisionGrade).toBe(false);
  });

  it('reports honest stats and dedupes a shared source into one org', () => {
    const g = orgGraph([
      ...FIXTURE,
      makeObject('cred:lic2', 'registration', 'checked', 'stateboard', 'California Medical Board'), // same source
    ]);
    expect(g.organizations.filter((o) => o.sourceId === 'stateboard')).toHaveLength(1);
    expect(find(g, 'stateboard').evidenceCount).toBe(2);
    expect(g.stats.organizationCount).toBe(g.organizations.length);
  });

  it('is deterministic', () => {
    expect(orgGraph(FIXTURE)).toEqual(orgGraph(FIXTURE));
  });
});

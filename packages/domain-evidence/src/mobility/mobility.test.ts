import { describe, expect, it } from 'vitest';
import { buildEvidenceCollection, isDecisionGradeStatus } from '../collection';
import { projectEvidenceToGraph } from '../projectors/graph';
import { propagateTrust, type TrustProjection } from '../trust/propagate';
import type { EvidenceClass, EvidenceObject, EvidenceStatus } from '../types';
import {
  defaultReadinessTemplate,
  deriveMobilityOverview,
  detectGaps,
  projectReadiness,
  type GapReport,
  type OpportunityObject,
} from './mobility';

function makeObject(
  id: string,
  evidenceClass: EvidenceClass,
  status: EvidenceStatus,
  sourceId: string,
  jurisdiction?: string,
): EvidenceObject {
  return {
    evidenceId: id, subjectKey: 'subject-1', evidenceClass, label: `${evidenceClass} ${id}`,
    value: jurisdiction ? { jurisdiction } : null, status,
    source: { sourceId, sourceLabel: sourceId, laneType: null, governance: null },
    trustTier: null, decisionGrade: isDecisionGradeStatus(status),
    observedAt: null, checkedAt: '2026-03-01T00:00:00.000Z', expiresAt: null, freshnessWindowHours: null,
    integrityHash: null, provenance: { artifactIds: [], receiptIds: [], sourceUrl: null, checksum: null, parserVersion: null },
    lifecycle: 'active', supersedes: null, supersededBy: null,
  };
}

function pipeline(objects: EvidenceObject[]) {
  const collection = buildEvidenceCollection({ subjectKey: 'subject-1', generatedFor: { displayName: 'Ada', npi: '1' }, objects });
  const trust = propagateTrust(projectEvidenceToGraph(collection));
  return { collection, trust };
}

const READY_OBJECTS = [
  makeObject('coverage:NPPES_API', 'identity', 'checked', 'NPPES_API'),
  makeObject('coverage:OIG_LEIE', 'exclusion', 'checked', 'OIG_LEIE'),
  makeObject('cred:lic-ca', 'licensure', 'checked', 'STATE_BOARD', 'CA'),
];

describe('detectGaps (W270/W230-C3)', () => {
  it('marks satisfied mandatory requirements as satisfied', () => {
    const { collection, trust } = pipeline(READY_OBJECTS);
    const report = detectGaps(defaultReadinessTemplate('CA'), collection, trust);
    const lic = report.gaps.find((g) => g.requirementId === 'licensure')!;
    expect(lic.kind).toBe('satisfied');
    expect(report.mandatoryUnmet).toBe(0);
  });

  it('marks a missing jurisdiction license as missing with an endorsement remediation', () => {
    const { collection, trust } = pipeline(READY_OBJECTS); // licensed CA, not NV
    const report = detectGaps(defaultReadinessTemplate('NV'), collection, trust);
    const lic = report.gaps.find((g) => g.requirementId === 'licensure')!;
    expect(lic.kind).toBe('missing');
    expect(lic.remediation?.type).toBe('apply_endorsement');
  });

  it('marks gated evidence as insufficient, never satisfied', () => {
    const { collection, trust } = pipeline([
      makeObject('coverage:NPPES_API', 'identity', 'checked', 'NPPES_API'),
      makeObject('coverage:OIG_LEIE', 'exclusion', 'checked', 'OIG_LEIE'),
      makeObject('cred:lic-ca', 'licensure', 'gated', 'STATE_BOARD', 'CA'),
    ]);
    const lic = detectGaps(defaultReadinessTemplate('CA'), collection, trust).gaps.find((g) => g.requirementId === 'licensure')!;
    expect(lic.kind).toBe('insufficient'); // gated never satisfies a decision-grade requirement
  });

  it('a MANDATORY requirement is never satisfied by non-checked evidence, even if minStatus is lowered', () => {
    const { collection, trust } = pipeline([
      makeObject('cred:lic-ca', 'licensure', 'gated', 'STATE_BOARD', 'CA'),
    ]);
    // A hostile/loose opportunity tries to accept gated evidence for a mandatory lane.
    const opp: OpportunityObject = {
      opportunityId: 'loose', title: 'Loose', organizationKey: null, specialty: null, states: ['CA'],
      schema: 'vitalcv.opportunity.v1',
      requirements: [{ kind: 'evidence', requirementId: 'lic', label: 'License', necessity: 'mandatory', minStatus: 'gated', evidenceClass: 'licensure', jurisdiction: 'CA' }],
    };
    const gap = detectGaps(opp, collection, trust).gaps.find((g) => g.requirementId === 'lic')!;
    expect(gap.kind).not.toBe('satisfied'); // mandatory needs decision-grade regardless of minStatus
  });
});

describe('projectReadiness state machine (W230-C5)', () => {
  const opp: OpportunityObject = defaultReadinessTemplate('CA');
  const trustWith = (dg: number) => ({ overall: { score: 0.5, decisionGradeEvidence: dg, totalEvidence: dg }, dimensions: [], history: {} } as unknown as TrustProjection);
  const report = (gaps: GapReport['gaps']): GapReport => ({ opportunityId: opp.opportunityId, subjectKey: 'subject-1', gaps, mandatoryUnmet: gaps.filter((g) => g.necessity === 'mandatory' && g.kind !== 'satisfied').length, preferredUnmet: 0 });

  it('READY when all mandatory satisfied and evidence is decision-grade', () => {
    const r = projectReadiness(opp, report([{ requirementId: 'licensure', label: 'L', necessity: 'mandatory', kind: 'satisfied', reason: '', blockingEvidenceIds: [], remediation: null }]), trustWith(3));
    expect(r.readiness).toBe('ready');
  });

  it('NEAR_READY when mandatory gaps all have remediation', () => {
    const r = projectReadiness(opp, report([{ requirementId: 'licensure', label: 'L', necessity: 'mandatory', kind: 'missing', reason: '', blockingEvidenceIds: [], remediation: { type: 'apply_endorsement', detail: '', estimatedDays: null } }]), trustWith(3));
    expect(r.readiness).toBe('near_ready');
    expect(r.fixableGaps).toContain('licensure');
  });

  it('BLOCKED when a mandatory gap is missing with no remediation', () => {
    const r = projectReadiness(opp, report([{ requirementId: 'x', label: 'X', necessity: 'mandatory', kind: 'missing', reason: 'hard block', blockingEvidenceIds: [], remediation: null }]), trustWith(3));
    expect(r.readiness).toBe('blocked');
    expect(r.blockers).toContain('hard block');
  });

  it('UNKNOWN (not blocked) when there is no decision-grade evidence', () => {
    const r = projectReadiness(opp, report([{ requirementId: 'licensure', label: 'L', necessity: 'mandatory', kind: 'insufficient', reason: '', blockingEvidenceIds: [], remediation: { type: 'await_review', detail: '', estimatedDays: null } }]), trustWith(0));
    expect(r.readiness).toBe('unknown'); // absence of evidence is honest uncertainty, not failure
  });
});

describe('deriveMobilityOverview (W230-C4)', () => {
  it('reports decision-grade licensed states and reusable evidence count', () => {
    const { collection, trust } = pipeline([
      ...READY_OBJECTS,
      makeObject('cred:lic-nv', 'licensure', 'checked', 'STATE_BOARD', 'NV'),
      makeObject('cred:lic-tx', 'licensure', 'gated', 'STATE_BOARD', 'TX'), // gated → not counted
    ]);
    const overview = deriveMobilityOverview(collection, trust);
    expect(overview.licensedStates).toEqual(['CA', 'NV']); // TX gated, excluded
    expect(overview.reusableEvidenceCount).toBe(4); // 4 checked
    expect(overview.mobilityTrust).not.toBeNull();
  });
});

describe('end-to-end readiness', () => {
  it('a fully-checked clinician is READY for the standard template', () => {
    const { collection, trust } = pipeline(READY_OBJECTS);
    const opp = defaultReadinessTemplate('CA');
    const r = projectReadiness(opp, detectGaps(opp, collection, trust), trust);
    expect(r.readiness).toBe('ready');
  });

  it('is deterministic', () => {
    const { collection, trust } = pipeline(READY_OBJECTS);
    const opp = defaultReadinessTemplate('CA');
    expect(detectGaps(opp, collection, trust)).toEqual(detectGaps(opp, collection, trust));
  });
});

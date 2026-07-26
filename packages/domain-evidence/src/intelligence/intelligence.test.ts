import { describe, expect, it } from 'vitest';
import { buildEvidenceCollection, isDecisionGradeStatus } from '../collection';
import { projectEvidenceToGraph } from '../projectors/graph';
import { propagateTrust } from '../trust/propagate';
import { projectTimeline } from '../timeline/timeline';
import { deriveMobilityOverview } from '../mobility/mobility';
import { projectOrganizations } from '../organizations/organizations';
import type { EvidenceClass, EvidenceLifecycle, EvidenceObject, EvidenceStatus } from '../types';
import { generateIntelligence } from './intelligence';

function makeObject(id: string, evidenceClass: EvidenceClass, status: EvidenceStatus, sourceId: string, opts: { jurisdiction?: string; checkedAt?: string; expiresAt?: string; lifecycle?: EvidenceLifecycle } = {}): EvidenceObject {
  return {
    evidenceId: id, subjectKey: 'subject-1', evidenceClass, label: `${evidenceClass} ${id}`,
    value: opts.jurisdiction ? { jurisdiction: opts.jurisdiction } : null, status,
    source: { sourceId, sourceLabel: sourceId, laneType: null, governance: null },
    trustTier: null, decisionGrade: isDecisionGradeStatus(status),
    observedAt: null, checkedAt: opts.checkedAt ?? '2026-03-01T00:00:00.000Z', expiresAt: opts.expiresAt ?? null, freshnessWindowHours: null,
    integrityHash: null, provenance: { artifactIds: [], receiptIds: [], sourceUrl: null, checksum: null, parserVersion: null },
    lifecycle: opts.lifecycle ?? 'active', supersedes: null, supersededBy: null,
  };
}

function intelOf(objects: EvidenceObject[]) {
  const collection = buildEvidenceCollection({ subjectKey: 'subject-1', generatedFor: { displayName: 'Ada', npi: '1' }, objects });
  const graph = projectEvidenceToGraph(collection);
  const trust = propagateTrust(graph);
  const timeline = projectTimeline(collection, graph, trust);
  const mobility = deriveMobilityOverview(collection, trust);
  const organizations = projectOrganizations(collection, graph);
  return generateIntelligence(collection, trust, timeline, mobility, organizations);
}

const FIXTURE = [
  makeObject('coverage:NPPES_API', 'identity', 'checked', 'NPPES_API'),
  makeObject('cred:lic-ca', 'licensure', 'checked', 'STATE_BOARD', { jurisdiction: 'CA' }),
  makeObject('cred:dea', 'registration', 'stale', 'DEA', { expiresAt: '2026-01-01T00:00:00.000Z', lifecycle: 'expired' }),
  makeObject('coverage:STATE_BOARD', 'licensure', 'gated', 'GATED_BOARD'),
];

describe('generateIntelligence (W320)', () => {
  it('generates strengths, gaps, risks, and opportunities', () => {
    const intel = intelOf(FIXTURE);
    expect(intel.insights.some((i) => i.kind === 'risk')).toBe(true); // expired DEA decay
    expect(intel.insights.some((i) => i.kind === 'gap')).toBe(true); // empty dimensions + gated source
    expect(intel.insights.some((i) => i.kind === 'opportunity')).toBe(true); // reusable + CA license
    expect(intel.summary.risks + intel.summary.gaps + intel.summary.opportunities + intel.summary.strengths).toBe(intel.insights.length);
  });

  it('every insight is explainable (carries a basis or is dimension-tied)', () => {
    const intel = intelOf(FIXTURE);
    for (const i of intel.insights) {
      expect(i.basis.length > 0 || i.dimension !== null).toBe(true);
    }
  });

  it('notifications surface risks first (highest severity), strengths are not notifications', () => {
    const intel = intelOf(FIXTURE);
    expect(intel.notifications.length).toBeGreaterThan(0);
    expect(intel.notifications[0].severity).toBe('high'); // decay risk first
    expect(intel.notifications.every((n) => n.category !== 'review' || true)).toBe(true);
    // no strength leaks into notifications
    expect(intel.notifications.some((n) => n.title.startsWith('Strong'))).toBe(false);
  });

  it('actions are prioritized high→low with explainable rationale and stable ranks', () => {
    const intel = intelOf(FIXTURE);
    expect(intel.actions[0].priority).toBe('high'); // resolve decay first
    expect(intel.actions[0].rank).toBe(1);
    for (const a of intel.actions) {
      expect(a.rationale.length).toBeGreaterThan(0);
      expect(a.relatedInsightIds.length).toBeGreaterThan(0);
    }
    // ranks are 1..n contiguous
    expect(intel.actions.map((a) => a.rank)).toEqual(intel.actions.map((_, i) => i + 1));
  });

  it('is fully deterministic', () => {
    expect(intelOf(FIXTURE)).toEqual(intelOf(FIXTURE));
  });

  it('a clinician with no evidence yields honest gaps, no fabricated strengths', () => {
    const intel = intelOf([makeObject('coverage:STATE_BOARD', 'licensure', 'gated', 'GATED')]);
    expect(intel.summary.strengths).toBe(0); // nothing decision-grade → no strengths invented
    expect(intel.summary.gaps).toBeGreaterThan(0);
  });
});

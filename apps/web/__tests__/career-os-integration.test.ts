import { describe, expect, it } from 'vitest';
import {
  projectEvidenceToGraph,
  projectTimeline,
  propagateTrust,
} from '@vitalcv/domain-evidence';
import { passportToEvidenceCollection } from '../lib/evidence/passport-to-evidence';
import { assertPassportData } from '../lib/trust/passport-contract';

/**
 * W245-C4 — Career OS integration: passport → Evidence → Graph → Trust → Timeline.
 *
 * Proves the four layers compose coherently AND that the honesty contract holds
 * end-to-end: a gated source is non-decision-grade at EVERY layer, and a checked
 * source is decision-grade at every layer. This is the load-bearing "Career OS is
 * coherent" assertion — one source's truth never drifts across the pipeline.
 */

function buildRichPassport(overrides: Record<string, unknown> = {}) {
  return {
    entityId: 'entity-os-1',
    npi: '1234567890',
    identity: { displayName: 'Ada Lovelace', specialty: 'Cardiology', entityType: 'PERSON', status: 'ACTIVE', npi: '1234567890' },
    authority: {
      credentials: [
        { id: 'lic-ca', domain: 'California Medical Board', type: 'STATE_LICENSE', status: 'ACTIVE',
          verificationLevel: 'PRIMARY_SOURCE', stale: false, confidenceLabel: 'HIGH', claimConfidenceLabel: 'HIGH',
          dataFreshness: 'fresh', dataFreshnessLabel: 'Fresh', reviewRequired: false, jurisdiction: 'CA',
          verifiedAt: '2026-03-02T00:00:00.000Z', sourceId: 'STATE_BOARD' },
        { id: 'dea-1', domain: 'DEA', type: 'DEA_REGISTRATION', status: 'EXPIRED',
          verificationLevel: 'PRIMARY_SOURCE', stale: true, confidenceLabel: 'MEDIUM', claimConfidenceLabel: 'MEDIUM',
          dataFreshness: 'stale', dataFreshnessLabel: 'Stale', reviewRequired: false, expiresAt: '2026-01-01T00:00:00.000Z' },
      ],
      summary: { active: 1, expired: 1, stale: 1, missing: [] },
    },
    training: { records: [], hasDegree: true, degreeVerified: true, hasResidency: true, fellowshipCount: 0 },
    standing: {
      exclusionClear: true, exclusionStatus: 'CLEAR', exclusionCheckedAt: '2026-03-01T00:00:00.000Z',
      licensureStatus: 'verified', deaStatus: 'unknown', pecosStatus: 'enrolled', pecosEnrollmentStatus: 'ENROLLED',
      enrollmentSourceLabel: 'CMS PECOS', enrollmentDataFreshness: 'Quarterly',
      enrollmentNote: 'Current PECOS enrollment found.', enrollmentObservedAt: '2026-03-01T00:00:00.000Z',
      negativeFindings: [],
    },
    readiness: { status: 'PARTIAL', score: 68, level: 'L2', blockers: [], gaps: [], estimatedStartDays: 12, nextActions: [] },
    sources: { checked: ['NPPES_API', 'OIG_LEIE'], lastFetch: { NPPES_API: '2026-03-01T00:00:00.000Z', OIG_LEIE: '2026-03-01T00:00:00.000Z' } },
    sourceCoverage: {
      checks: [
        { sourceId: 'NPPES_API', state: 'checked', reason: 'NPPES identity checked', checkedAt: '2026-03-01T00:00:00.000Z' },
        { sourceId: 'OIG_LEIE', state: 'checked', reason: 'OIG LEIE clear', checkedAt: '2026-03-01T00:00:00.000Z' },
        { sourceId: 'STATE_BOARD', state: 'gated', reason: 'institutional access required', checkedAt: null },
      ],
    },
    trustPosture: {
      band: 'L2', bandLabel: 'Moderate trust', score: 68, dimensions: [],
      freshness: { state: 'partial', label: 'Partial', items: [] },
      safeToRelyOnNow: [], missingItems: [], gatedItems: [], reviewRequiredItems: [], staleItems: [], blockers: [],
    },
    lastCheckedAt: '2026-03-02T00:00:00.000Z',
    ...overrides,
  };
}

function runPipeline(overrides: Record<string, unknown> = {}) {
  const passport = assertPassportData(buildRichPassport(overrides));
  const collection = passportToEvidenceCollection(passport);
  const graph = projectEvidenceToGraph(collection);
  const trust = propagateTrust(graph);
  const timeline = projectTimeline(collection, graph, trust);
  return { collection, graph, trust, timeline };
}

describe('Career OS integration (W245-C4)', () => {
  it('composes all four layers from one passport', () => {
    const { collection, graph, trust, timeline } = runPipeline();
    expect(collection.objects.length).toBeGreaterThan(0);
    expect(graph.nodes.length).toBeGreaterThan(collection.objects.length); // + subject + sources
    expect(trust.dimensions).toHaveLength(7);
    expect(timeline.events.length).toBeGreaterThan(0);
    expect(collection.subjectKey).toBe('entity-os-1');
    expect(graph.subjectKey).toBe('entity-os-1');
    expect(trust.subjectKey).toBe('entity-os-1');
    expect(timeline.subjectKey).toBe('entity-os-1');
  });

  it('keeps a CHECKED source decision-grade at every layer', () => {
    const { collection, graph, trust } = runPipeline();
    // collection
    expect(collection.coverageSummary.checked).toContain('NPPES_API');
    // graph
    const node = graph.nodes.find((n) => n.id === 'coverage:NPPES_API')!;
    expect(node.decisionGrade).toBe(true);
    expect(node.trustScore).toBe(1);
    // trust
    const identity = trust.dimensions.find((d) => d.dimension === 'identity')!;
    expect(identity.supporting).toContain('coverage:NPPES_API');
  });

  it('keeps a GATED source non-decision-grade at every layer (no drift)', () => {
    const { collection, graph, trust, timeline } = runPipeline();
    // collection
    expect(collection.coverageSummary.gated).toContain('STATE_BOARD');
    // graph
    const node = graph.nodes.find((n) => n.id === 'coverage:STATE_BOARD')!;
    expect(node.decisionGrade).toBe(false);
    expect(node.trustScore).toBe(0);
    // trust — appears in weakening, never supporting
    const authority = trust.dimensions.find((d) => d.dimension === 'authority')!;
    expect(authority.weakening).toContain('coverage:STATE_BOARD');
    expect(authority.supporting).not.toContain('coverage:STATE_BOARD');
    // timeline — its event never carries positive trust impact
    const ev = timeline.events.find((e) => e.evidenceId === 'coverage:STATE_BOARD');
    if (ev) expect(ev.trustImpact).toBeLessThanOrEqual(0);
  });

  it('propagates decay coherently: the expired DEA registration weakens, never inflates', () => {
    const { graph, trust, timeline } = runPipeline();
    const dea = graph.nodes.find((n) => n.id === 'cred:dea-1')!;
    expect(dea.decisionGrade).toBe(false); // EXPIRED → stale → not decision-grade
    expect(dea.trustScore).toBeLessThan(1);
    // overall trust stays bounded and reputation is honest
    expect(trust.overall.score).toBeLessThanOrEqual(1);
    expect(['established', 'emerging', 'provisional', 'unknown']).toContain(timeline.reputation.standing);
    expect(timeline.trustHistory.decayCount).toBeGreaterThanOrEqual(1);
  });

  it('overall decision-grade evidence count agrees across layers', () => {
    const { graph, trust, timeline } = runPipeline();
    const graphDG = graph.nodes.filter((n) => n.type === 'evidence' && n.decisionGrade).length;
    expect(trust.overall.decisionGradeEvidence).toBe(graphDG);
    expect(timeline.reputation.decisionGradeEvidence).toBe(graphDG);
  });

  it('is end-to-end deterministic', () => {
    expect(runPipeline().timeline).toEqual(runPipeline().timeline);
  });
});

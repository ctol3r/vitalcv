import { describe, expect, it } from 'vitest';
import { projectEvidenceToGraph, statusTrustScore } from '@vitalcv/domain-evidence';
import { passportToEvidenceCollection } from '../lib/evidence/passport-to-evidence';
import { assertPassportData } from '../lib/trust/passport-contract';

function buildPassportPayload(overrides: Record<string, unknown> = {}) {
  return {
    entityId: 'entity-1',
    npi: '1234567890',
    identity: { displayName: 'Ada Lovelace', specialty: 'Cardiology', entityType: 'PERSON', status: 'ACTIVE', npi: '1234567890' },
    authority: {
      credentials: [
        {
          id: 'lic-ca', domain: 'California Medical Board', type: 'STATE_LICENSE', status: 'ACTIVE',
          verificationLevel: 'PRIMARY_SOURCE', stale: false, confidenceLabel: 'HIGH', claimConfidenceLabel: 'HIGH',
          dataFreshness: 'fresh', dataFreshnessLabel: 'Fresh', reviewRequired: false, jurisdiction: 'CA',
          verifiedAt: '2026-03-23T12:00:00.000Z', sourceId: 'STATE_BOARD',
        },
      ],
      summary: { active: 1, expired: 0, stale: 0, missing: [] },
    },
    training: { records: [], hasDegree: true, degreeVerified: true, hasResidency: true, fellowshipCount: 0 },
    standing: {
      exclusionClear: true, exclusionStatus: 'CLEAR', exclusionCheckedAt: '2026-03-23T12:00:00.000Z',
      licensureStatus: 'verified', deaStatus: 'unknown', pecosStatus: 'enrolled', pecosEnrollmentStatus: 'ENROLLED',
      enrollmentSourceLabel: 'CMS PECOS', enrollmentDataFreshness: 'Quarterly',
      enrollmentNote: 'Current PECOS enrollment found.', enrollmentObservedAt: '2026-03-20T00:00:00.000Z',
      negativeFindings: [],
    },
    readiness: { status: 'PARTIAL', score: 70, level: 'L2', blockers: [], gaps: [], estimatedStartDays: 14, nextActions: [] },
    sources: { checked: ['NPPES_API'], lastFetch: { NPPES_API: '2026-03-23T12:00:00.000Z' } },
    sourceCoverage: {
      checks: [
        { sourceId: 'NPPES_API', state: 'checked', reason: 'NPPES identity checked', checkedAt: '2026-03-23T12:00:00.000Z' },
        { sourceId: 'STATE_BOARD', state: 'gated', reason: 'institutional access required', checkedAt: null },
      ],
    },
    trustPosture: {
      band: 'L2', bandLabel: 'Moderate trust', score: 70, dimensions: [],
      freshness: { state: 'partial', label: 'Partial source coverage', items: [] },
      safeToRelyOnNow: [], missingItems: [], gatedItems: [], reviewRequiredItems: [], staleItems: [], blockers: [],
    },
    lastCheckedAt: '2026-03-23T12:00:00.000Z',
    ...overrides,
  };
}

function projectPassport(overrides: Record<string, unknown> = {}) {
  return projectEvidenceToGraph(passportToEvidenceCollection(assertPassportData(buildPassportPayload(overrides))));
}

describe('passport -> evidence -> graph (W221 C5)', () => {
  it('projects a license credential as HOLDS_LICENSE', () => {
    const graph = projectPassport();
    const rel = graph.relationships.find((r) => r.to === 'cred:lic-ca' && r.from.startsWith('subject:'));
    expect(rel?.type).toBe('HOLDS_LICENSE');
  });

  it('has no orphan relationships', () => {
    const graph = projectPassport();
    const nodeIds = new Set(graph.nodes.map((n) => n.id));
    for (const rel of graph.relationships) {
      expect(nodeIds.has(rel.from)).toBe(true);
      expect(nodeIds.has(rel.to)).toBe(true);
    }
  });

  it('does not inflate trust — gated coverage scores 0 and is not decision-grade', () => {
    const graph = projectPassport();
    const gated = graph.nodes.find((n) => n.id === 'coverage:STATE_BOARD');
    expect(gated?.trustScore).toBe(0);
    expect(gated?.decisionGrade).toBe(false);
    for (const node of graph.nodes) {
      if (node.type === 'evidence' && node.status) {
        expect(node.trustScore).toBeLessThanOrEqual(statusTrustScore(node.status));
      }
    }
  });

  it('produces no false decision-grade nodes', () => {
    const graph = projectPassport();
    for (const node of graph.nodes) {
      if (node.type === 'evidence' && node.status) {
        expect(node.decisionGrade).toBe(node.status === 'checked');
      } else {
        expect(node.decisionGrade).toBe(false);
      }
    }
  });

  it('dedupes the shared STATE_BOARD source into one node', () => {
    const graph = projectPassport();
    expect(graph.nodes.filter((n) => n.id === 'source:STATE_BOARD')).toHaveLength(1);
  });
});

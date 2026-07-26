import { describe, expect, it } from 'vitest';
import { buildEmployerProofPacketPdfModel } from '../lib/export/employer-proof-packet-pdf';
import { buildCareerPacket } from '../lib/packet/career-packet';
import { resolveEmployerPacketExportGate } from '../lib/export/export-gating';
import { assertPassportData } from '../lib/trust/passport-contract';

function buildPassportPayload(overrides: Record<string, unknown> = {}) {
  return {
    entityId: 'entity-1',
    npi: '1234567890',
    identity: { displayName: 'Ada Lovelace', specialty: 'Cardiology', entityType: 'PERSON', status: 'ACTIVE', npi: '1234567890' },
    authority: { credentials: [], summary: { active: 0, expired: 0, stale: 0, missing: [] } },
    training: { records: [], hasDegree: true, degreeVerified: true, hasResidency: true, fellowshipCount: 0 },
    standing: {
      exclusionClear: true,
      exclusionStatus: 'CLEAR',
      exclusionCheckedAt: '2026-03-23T12:00:00.000Z',
      licensureStatus: 'verified',
      deaStatus: 'unknown',
      pecosStatus: 'enrolled',
      pecosEnrollmentStatus: 'ENROLLED',
      enrollmentSourceLabel: 'CMS PECOS',
      enrollmentDataFreshness: 'Quarterly',
      enrollmentNote: 'Current PECOS enrollment found.',
      enrollmentObservedAt: '2026-03-20T00:00:00.000Z',
      negativeFindings: [],
    },
    readiness: { status: 'PARTIAL', score: 70, level: 'L2', blockers: [], gaps: ['DEA registration not on file'], estimatedStartDays: 14, nextActions: [] },
    sources: { checked: ['NPPES_API'], lastFetch: { NPPES_API: '2026-03-23T12:00:00.000Z' } },
    sourceCoverage: {
      checks: [
        { sourceId: 'NPPES_API', state: 'checked', reason: 'NPPES identity checked', checkedAt: '2026-03-23T12:00:00.000Z' },
        { sourceId: 'OIG_LEIE', state: 'checked', reason: 'OIG LEIE check clear', checkedAt: '2026-03-23T12:00:00.000Z' },
        { sourceId: 'PECOS_PUBLIC', state: 'gated', reason: 'institutional access required', checkedAt: null },
      ],
    },
    trustPosture: {
      band: 'L2',
      bandLabel: 'Moderate trust',
      score: 70,
      dimensions: [],
      freshness: { state: 'partial', label: 'Partial source coverage', items: [] },
      safeToRelyOnNow: [],
      missingItems: [],
      gatedItems: [],
      reviewRequiredItems: [],
      staleItems: [],
      blockers: [],
    },
    lastCheckedAt: '2026-03-23T12:00:00.000Z',
    ...overrides,
  };
}

describe('career packet PDF integration (W205-4)', () => {
  it('renders PDF sections from the shared career-packet derivation (no duplicate logic)', () => {
    const passport = assertPassportData(buildPassportPayload());
    const model = buildEmployerProofPacketPdfModel(passport, '2026-04-09T19:45:00.000Z');
    // Same data as the UI: model.careerPacket is exactly buildCareerPacket(passport).
    expect(model.careerPacket).toEqual(buildCareerPacket(passport));
    expect(model.careerPacket.recruiter.label).toBeDefined();
    expect(model.careerPacket.readiness.status).toBe('PARTIAL');
    expect(model.careerPacket.missingEvidence.length).toBeGreaterThan(0);
  });

  it('preserves the existing export gate — a partial/gated passport is blocked', () => {
    const passport = assertPassportData(buildPassportPayload());
    const gate = resolveEmployerPacketExportGate(passport);
    expect(gate.allowed).toBe(false);
    expect(gate.status).toBe('blocked');
  });
});

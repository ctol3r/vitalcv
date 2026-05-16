import { describe, expect, it } from 'vitest';
import { resolveEmployerPacketExportGate } from '../lib/export/export-gating';
import { assertPassportData } from '../lib/trust/passport-contract';

function buildPassportPayload(overrides: Record<string, unknown> = {}) {
  return {
    entityId: 'entity-1',
    npi: '1234567890',
    identity: {
      displayName: 'Ada Lovelace',
      specialty: 'Cardiology',
      entityType: 'PERSON',
      status: 'ACTIVE',
      npi: '1234567890',
    },
    authority: {
      credentials: [],
      summary: {
        active: 0,
        expired: 0,
        stale: 0,
        missing: [],
      },
    },
    training: {
      records: [],
      hasDegree: true,
      degreeVerified: true,
      hasResidency: true,
      fellowshipCount: 0,
    },
    standing: {
      exclusionClear: true,
      exclusionStatus: 'CLEAR',
      exclusionCheckedAt: '2026-03-23T12:00:00.000Z',
      exclusionConfidenceLabel: 'HIGH',
      licensureStatus: 'verified',
      deaStatus: 'unknown',
      pecosStatus: 'enrolled',
      pecosEnrollmentStatus: 'ENROLLED',
      enrollmentSourceLabel: 'CMS PECOS',
      enrollmentDataFreshness: 'Quarterly',
      enrollmentSourceLatency: 'Quarterly snapshot',
      enrollmentNote: 'Current PECOS enrollment found.',
      enrollmentObservedAt: '2026-03-20T00:00:00.000Z',
      enrollmentDataVersion: '2026-Q1',
      enrollmentStatusLabel: 'Enrolled',
      enrollmentFreshnessLabel: 'Quarterly',
      enrollmentConfidenceLabel: 'Quarterly release',
      negativeFindings: [],
    },
    readiness: {
      status: 'DECISION_GRADE',
      score: 92,
      level: 'L3',
      blockers: [],
      gaps: [],
      estimatedStartDays: 10,
      nextActions: [],
    },
    sources: {
      checked: ['NPPES_API', 'OIG_LEIE', 'PECOS_PUBLIC', 'STATE_BOARD'],
      lastFetch: {
        NPPES_API: '2026-03-23T12:00:00.000Z',
        OIG_LEIE: '2026-03-23T12:00:00.000Z',
        PECOS_PUBLIC: '2026-03-20T00:00:00.000Z',
        STATE_BOARD: '2026-03-22T00:00:00.000Z',
      },
    },
    sourceCoverage: {
      checks: [
        {
          sourceId: 'NPPES_API',
          state: 'checked',
          reason: 'NPPES identity checked',
          checkedAt: '2026-03-23T12:00:00.000Z',
        },
        {
          sourceId: 'OIG_LEIE',
          state: 'checked',
          reason: 'OIG LEIE check clear',
          checkedAt: '2026-03-23T12:00:00.000Z',
        },
        {
          sourceId: 'PECOS_PUBLIC',
          state: 'checked',
          reason: 'PECOS quarterly enrollment checked',
          checkedAt: '2026-03-20T00:00:00.000Z',
        },
        {
          sourceId: 'STATE_BOARD',
          state: 'checked',
          reason: 'State board authority checked',
          checkedAt: '2026-03-22T00:00:00.000Z',
        },
      ],
    },
    trustPosture: {
      band: 'L3',
      bandLabel: 'Source-backed',
      score: 92,
      dimensions: [],
      freshness: {
        state: 'current',
        label: 'Current source coverage',
        items: [],
      },
      safeToRelyOnNow: ['Identity confirmed'],
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

describe('export gating runtime contract', () => {
  it('allows export only when launch-spine evidence is decision-grade', () => {
    const passport = assertPassportData(buildPassportPayload());
    const gate = resolveEmployerPacketExportGate(passport);

    expect(gate.allowed).toBe(true);
    expect(gate.status).toBe('allowed');
    expect(gate.survivabilityScore).toBe(100);
    expect(gate.replayAttribution.lineageKey).toContain('vitalcv.export-gating.v1');
  });

  it('fails closed when a launch-spine source is missing', () => {
    const passport = assertPassportData(buildPassportPayload({
      sourceCoverage: {
        checks: [
          {
            sourceId: 'NPPES_API',
            state: 'checked',
            reason: 'NPPES identity checked',
            checkedAt: '2026-03-23T12:00:00.000Z',
          },
        ],
      },
    }));
    const gate = resolveEmployerPacketExportGate(passport);

    expect(gate.allowed).toBe(false);
    expect(gate.ambiguityLevel).toBe('partial');
    expect(gate.blockers).toEqual(expect.arrayContaining([
      expect.objectContaining({ code: 'SOURCE_MISSING', sourceId: 'OIG_LEIE' }),
      expect.objectContaining({ code: 'SOURCE_MISSING', sourceId: 'PECOS_PUBLIC' }),
      expect.objectContaining({ code: 'SOURCE_MISSING', sourceId: 'STATE_BOARD' }),
      expect.objectContaining({ code: 'READINESS_COVERAGE_MISMATCH' }),
    ]));
  });

  it('preserves preview-only ambiguity instead of flattening it to readiness', () => {
    const passport = assertPassportData(buildPassportPayload({
      sourceCoverage: {
        checks: [
          {
            sourceId: 'NPPES_API',
            state: 'previewOnly',
            reason: 'Preview source',
            checkedAt: null,
          },
          {
            sourceId: 'OIG_LEIE',
            state: 'checked',
            reason: 'OIG LEIE check clear',
            checkedAt: '2026-03-23T12:00:00.000Z',
          },
          {
            sourceId: 'PECOS_PUBLIC',
            state: 'checked',
            reason: 'PECOS quarterly enrollment checked',
            checkedAt: '2026-03-20T00:00:00.000Z',
          },
          {
            sourceId: 'STATE_BOARD',
            state: 'checked',
            reason: 'State board authority checked',
            checkedAt: '2026-03-22T00:00:00.000Z',
          },
        ],
      },
    }));
    const gate = resolveEmployerPacketExportGate(passport);

    expect(gate.allowed).toBe(false);
    expect(gate.blockers).toEqual(expect.arrayContaining([
      expect.objectContaining({ code: 'SOURCE_PREVIEW_ONLY', sourceId: 'NPPES_API' }),
    ]));
    expect(gate.replayAttribution.lineageKey).toContain('NPPES_API:previewOnly');
  });
});

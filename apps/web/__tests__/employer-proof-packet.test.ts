import { describe, expect, it } from 'vitest';
import {
  buildEmployerProofPacketDownloadUrl,
  employerProofPacketFilename,
} from '../lib/export/employer-proof-packet';
import { buildEmployerProofPacketPdfModel } from '../lib/export/employer-proof-packet-pdf';
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
      status: 'PARTIAL',
      score: 82,
      level: 'L2',
      blockers: [],
      gaps: [],
      estimatedStartDays: 10,
      nextActions: [],
    },
    sources: {
      checked: ['NPPES_API', 'OIG_LEIE', 'PECOS_PUBLIC'],
      lastFetch: {
        NPPES_API: '2026-03-23T12:00:00.000Z',
        OIG_LEIE: '2026-03-23T12:00:00.000Z',
        PECOS_PUBLIC: '2026-03-20T00:00:00.000Z',
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
      ],
    },
    trustPosture: {
      band: 'L2',
      bandLabel: 'Moderate trust',
      score: 82,
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

describe('employer proof packet helpers', () => {
  it('builds the packet model from canonical passport data', () => {
    const passport = assertPassportData(buildPassportPayload());
    const model = buildEmployerProofPacketPdfModel(passport, '2026-04-09T19:45:00.000Z');

    expect(model.clinicianName).toBe('Ada Lovelace');
    expect(model.npi).toBe('1234567890');
    expect(model.specialty).toBe('Cardiology');
    expect(model.sourceRows).toEqual([
      {
        source: 'NPPES',
        status: 'CHECKED',
        checkedAt: '2026-03-23T12:00:00.000Z',
        detail: 'NPPES identity checked',
      },
      {
        source: 'OIG/LEIE',
        status: 'CLEARED',
        checkedAt: '2026-03-23T12:00:00.000Z',
        detail: 'OIG LEIE check clear',
      },
      {
        source: 'CMS PECOS',
        status: 'ENROLLED',
        checkedAt: '2026-03-20T00:00:00.000Z',
        detail: 'PECOS quarterly enrollment checked',
      },
    ]);
    expect(model.generatedAtLabel).toContain('UTC');
    expect(model.packetHash).toMatch(/^[0-9a-f]{64}$/);
  });

  it('builds stable download URLs and filenames for the review surface', () => {
    expect(buildEmployerProofPacketDownloadUrl('1234567890')).toBe('/api/export/packet?npi=1234567890');
    expect(employerProofPacketFilename('1234567890')).toBe('vitalcv-employer-packet-1234567890.pdf');
  });
});

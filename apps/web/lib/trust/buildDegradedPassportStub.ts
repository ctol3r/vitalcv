import type { PassportData } from './passport-contract';
import { buildPassportRuntimeMetadata } from './passport-runtime-metadata';
import { resolvePassportTruthSet } from './passport-truth-set';

/**
 * Builds a minimal PassportData stub for degraded rendering.
 * Used when NPPES is reachable but the passport is still incomplete.
 * The shape stays stable so degraded and hydrated payloads render identically.
 */
export function buildDegradedPassportStub(
  npi: string,
  nppesData: Record<string, unknown> | null,
): PassportData & { _degraded: boolean } {
  const basic = (nppesData?.basic as Record<string, unknown>) ?? {};
  const taxonomies = (nppesData?.taxonomies as Array<Record<string, unknown>>) ?? [];
  const displayName = [
    basic.first_name,
    basic.middle_name,
    basic.last_name,
  ].filter(Boolean).join(' ') || `NPI ${npi}`;

  const now = new Date().toISOString();

  const passport = {
    entityId: npi,
    npi,
    identity: {
      npi,
      displayName,
      entityType: 'individual',
      status: basic.status === 'A' ? 'active' : 'unknown',
      specialty: (taxonomies[0]?.desc as string | undefined) ?? undefined,
    },
    authority: {
      credentials: [],
      summary: { active: 0, expired: 0, stale: 0, missing: [] },
    },
    training: {
      records: [],
      hasDegree: false,
      degreeVerified: false,
      hasResidency: false,
      fellowshipCount: 0,
    },
    standing: {
      exclusionClear: false,
      exclusionStatus: 'UNCHECKED' as const,
      licensureStatus: 'unknown' as const,
      deaStatus: 'unknown' as const,
      pecosStatus: 'unknown' as const,
      pecosEnrollmentStatus: 'UNKNOWN' as const,
      enrollmentSourceLabel: 'Eligibility source pending',
      enrollmentDataFreshness: 'unknown',
      enrollmentNote: null,
      negativeFindings: [],
    },
    readiness: {
      status: 'CHECKING' as const,
      score: 0,
      level: 'unknown',
      blockers: ['Safety, authority, and eligibility sources are pending'],
      gaps: [],
      estimatedStartDays: null,
      nextActions: [],
    },
    sources: {
      checked: [],
      lastFetch: {},
    },
    sourceCoverage: {
      checks: [
        {
          sourceId: 'nppes_identity',
          state: 'checked' as const,
          reason: 'Identity is checked against CMS NPPES. Safety, authority, and eligibility are pending.',
          checkedAt: now,
        },
        {
          sourceId: 'oig_leie',
          state: 'pending' as const,
          reason: 'Safety source is pending.',
          checkedAt: null,
        },
        {
          sourceId: 'state_board',
          state: 'pending' as const,
          reason: 'Authority source is pending.',
          checkedAt: null,
        },
        {
          sourceId: 'pecos_public',
          state: 'pending' as const,
          reason: 'Eligibility source is pending.',
          checkedAt: null,
        },
      ],
      summary: {
        checked: ['nppes_identity'],
        stale: [],
        pending: ['oig_leie', 'state_board', 'pecos_public'],
        gated: [],
        unavailable: [],
        accessRequired: [],
        reviewRequired: [],
        notDecisionGrade: [],
        previewOnly: [],
      },
    },
    trustPosture: {
      band: 'degraded',
      bandLabel: 'Source incomplete',
      score: 0,
      dimensions: [
        {
          id: 'identity',
          label: 'Identity',
          state: 'current',
          detail: 'Identity is checked against CMS NPPES. Other readiness sources are pending.',
          checkedAt: now,
        },
        {
          id: 'safety',
          label: 'Safety',
          state: 'pending',
          detail: 'Safety source is pending.',
        },
        {
          id: 'authority',
          label: 'Authority',
          state: 'pending',
          detail: 'Authority source is pending.',
        },
        {
          id: 'eligibility',
          label: 'Eligibility',
          state: 'pending',
          detail: 'Eligibility source is pending.',
        },
      ],
      freshness: {
        state: 'partial',
        label: 'Source coverage incomplete',
        items: [],
      },
      safeToRelyOnNow: ['Identity confirmed via NPPES'],
      missingItems: [],
      gatedItems: [],
      reviewRequiredItems: [],
      staleItems: [],
      blockers: ['Safety, authority, and eligibility sources are pending'],
    },
    lastCheckedAt: now,
    ...buildPassportRuntimeMetadata(npi, {
      checkedAt: now,
      replayPosture: {
        status: 'degraded',
        label: 'Replay Partially Available',
        detail: 'The NPPES identity check is replayable. Safety, authority, and eligibility are pending.',
      },
      continuityPosture: {
        status: 'degraded',
        label: 'Continuity Partially Available',
        detail: 'NPPES identity is source-backed. Safety, authority, and eligibility are pending.',
      },
      issuerPosture: {
        status: 'verified',
        label: 'Source Issuer Available',
        detail: 'CMS NPPES returned the identity source record.',
      },
    }),
    _degraded: true,
  };

  return {
    ...passport,
    truth: resolvePassportTruthSet(passport as PassportData),
  } as PassportData & { _degraded: boolean };
}

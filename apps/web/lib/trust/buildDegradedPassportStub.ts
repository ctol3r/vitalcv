import type { PassportData } from './passport-contract';

/**
 * Builds a minimal PassportData stub for degraded rendering.
 * Used when the backend is unreachable but NPPES is reachable.
 * All lanes except nppes_identity are marked `pending`.
 * No lane is ever `checked` by this stub — degraded mode cannot
 * substitute for a real source verification run.
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

  const summaryEmpty = {
    checked: [] as readonly string[],
    stale: [] as readonly string[],
    pending: [npi] as readonly string[],
    gated: [] as readonly string[],
    unavailable: [] as readonly string[],
    accessRequired: [] as readonly string[],
    reviewRequired: [] as readonly string[],
    notDecisionGrade: [] as readonly string[],
    previewOnly: [] as readonly string[],
  } as const;

  return {
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
      exclusionStatus: 'UNCHECKED',
      licensureStatus: 'unknown',
      deaStatus: 'unknown',
      pecosStatus: 'unknown',
      pecosEnrollmentStatus: 'UNKNOWN',
      enrollmentSourceLabel: 'Degraded mode — backend unavailable',
      enrollmentDataFreshness: 'unknown',
      enrollmentNote: null,
      negativeFindings: [],
    },
    readiness: {
      status: 'CHECKING',
      score: 0,
      level: 'unknown',
      blockers: ['Backend unavailable — source checks pending'],
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
          state: 'checked',
          reason: 'Identity confirmed via NPPES (degraded mode — backend unavailable)',
          checkedAt: now,
        },
      ],
      summary: {
        ...summaryEmpty,
        checked: ['nppes_identity'] as readonly string[],
        pending: [] as readonly string[],
      },
    },
    trustPosture: {
      band: 'degraded',
      bandLabel: 'Degraded',
      score: 0,
      dimensions: [
        {
          id: 'identity',
          label: 'Identity',
          state: 'missing',
          detail: 'NPPES identity confirmed; full verification pending backend recovery.',
        },
        {
          id: 'safety',
          label: 'Safety',
          state: 'missing',
          detail: 'Backend unavailable — safety checks pending.',
        },
        {
          id: 'authority',
          label: 'Authority',
          state: 'missing',
          detail: 'Backend unavailable — authority checks pending.',
        },
        {
          id: 'eligibility',
          label: 'Eligibility',
          state: 'missing',
          detail: 'Backend unavailable — eligibility checks pending.',
        },
      ],
      freshness: {
        state: 'stale',
        label: 'Degraded mode',
        items: [],
      },
      safeToRelyOnNow: [],
      missingItems: ['identity', 'safety', 'authority', 'eligibility'],
      gatedItems: [],
      reviewRequiredItems: [],
      staleItems: [],
      blockers: ['Backend unavailable — operating in degraded mode'],
    },
    lastCheckedAt: now,
    _degraded: true,
  };
}

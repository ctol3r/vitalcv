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

  // NPPES enumerates organizations as NPI-2. The stub used to hardcode
  // `entityType: 'individual'`, which called real organizations people, and
  // only ever read the person name fields, so an organization fell through to
  // the `NPI …` placeholder even though NPPES had its name.
  const enumerationType = typeof nppesData?.enumeration_type === 'string'
    ? nppesData.enumeration_type
    : null;
  const isOrganization = enumerationType === 'NPI-2';
  const entityType = isOrganization
    ? 'organization'
    : enumerationType === 'NPI-1'
      ? 'individual'
      : 'unknown';

  const organizationName = typeof basic.organization_name === 'string'
    ? basic.organization_name.trim()
    : '';
  const personName = [
    basic.first_name,
    basic.middle_name,
    basic.last_name,
  ].filter(Boolean).join(' ');
  const displayName = (isOrganization ? organizationName : personName) || `NPI ${npi}`;

  // NPPES returns taxonomies in no meaningful order and routinely lists several
  // non-primary rows first — 1003000126 carries three non-primary "Internal
  // Medicine" entries ahead of its primary "Hospitalist". Reading `[0]` reported
  // a specialty the provider does not hold as their primary. Only the row NPPES
  // marks primary is authoritative; if none is marked, the specialty is withheld
  // rather than guessed, because guessing is the defect being fixed.
  const primaryTaxonomy = taxonomies.find((taxonomy) => taxonomy.primary === true);
  const specialty = typeof primaryTaxonomy?.desc === 'string'
    ? primaryTaxonomy.desc
    : undefined;

  const now = new Date().toISOString();

  const passport = {
    entityId: npi,
    npi,
    identity: {
      npi,
      displayName,
      entityType,
      status: basic.status === 'A' ? 'active' : 'unknown',
      specialty,
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
      bandLabel: 'Waiting on sources',
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
        label: 'Waiting on sources',
        items: [],
      },
      safeToRelyOnNow: ['Identity recognized via NPPES'],
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

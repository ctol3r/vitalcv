import { fetchNppesIdentityProbe } from '@/lib/api';
import { buildDegradedPassportStub } from '@/lib/trust/buildDegradedPassportStub';
import { buildPassportRuntimeMetadata } from '@/lib/trust/passport-runtime-metadata';
import type { PassportData } from '@/lib/trust/passport-contract';
import { resolvePassportTruthSet } from '@/lib/trust/passport-truth-set';

type PassportRuntimePayload = PassportData & {
  _degraded: boolean;
  checkedAt: string;
  lineageKey: string;
  replayPosture: {
    status: 'verified' | 'degraded' | 'pending' | 'unavailable' | 'unverifiable';
    label: string;
    detail: string;
  };
  continuityPosture: {
    status: 'verified' | 'degraded' | 'pending' | 'unavailable' | 'unverifiable';
    label: string;
    detail: string;
  };
  issuerPosture: {
    status: 'verified' | 'degraded' | 'pending' | 'unavailable' | 'unverifiable';
    label: string;
    detail: string;
  };
};

function isNpi(value: string): boolean {
  return /^\d{10}$/.test(value);
}

function buildGenericDegradedPassport(entityId: string): PassportRuntimePayload {
  const now = new Date().toISOString();
  const hasNpi = isNpi(entityId);
  const identityUnavailableReason = hasNpi
    ? 'NPPES identity source is unavailable for this check.'
    : 'NPPES identity source is unavailable until an NPI is provided.';

  const passport = {
    entityId,
    npi: null,
    identity: {
      npi: null,
      displayName: `Passport ${entityId}`,
      entityType: 'unknown',
      status: 'unknown',
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
      blockers: ['Identity source unavailable', 'Safety, authority, and eligibility sources are pending'],
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
          state: 'unavailable' as const,
          reason: identityUnavailableReason,
          checkedAt: null,
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
        checked: [],
        stale: [],
        pending: ['oig_leie', 'state_board', 'pecos_public'],
        gated: [],
        unavailable: ['nppes_identity'],
        accessRequired: [],
        reviewRequired: [],
        notDecisionGrade: [],
        previewOnly: [],
      },
    },
    trustPosture: {
      band: 'degraded',
      bandLabel: 'Source unavailable',
      score: 0,
      dimensions: [
        {
          id: 'identity',
          label: 'Identity',
          state: 'unavailable',
          detail: identityUnavailableReason,
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
        label: 'Source coverage unavailable',
        items: [],
      },
      safeToRelyOnNow: [],
      missingItems: ['identity'],
      gatedItems: [],
      reviewRequiredItems: [],
      staleItems: [],
      blockers: ['Identity source unavailable', 'Safety, authority, and eligibility sources are pending'],
    },
    lastCheckedAt: now,
    ...buildPassportRuntimeMetadata(entityId, {
      checkedAt: now,
      replayPosture: {
        status: 'unavailable',
        label: 'Replay Unavailable',
        detail: 'No source check was completed for this passport response.',
      },
      continuityPosture: {
        status: 'unavailable',
        label: 'Continuity Unavailable',
        detail: 'Continuity is unavailable because no source check was completed.',
      },
      issuerPosture: {
        status: 'unavailable',
        label: 'Issuer Unavailable',
        detail: 'No issuer source record is available for this passport response.',
      },
    }),
    _degraded: true,
  };

  const payload = {
    ...passport,
    truth: resolvePassportTruthSet(passport as PassportData),
  } as PassportRuntimePayload;

  return payload;
}

async function buildNpiPassport(npi: string): Promise<PassportRuntimePayload> {
  const probe = await fetchNppesIdentityProbe(npi);
  if (probe.ok && probe.nppesData) {
    const payload = buildDegradedPassportStub(npi, probe.nppesData) as PassportRuntimePayload;
    return payload;
  }

  return buildGenericDegradedPassport(npi);
}

/**
 * Resolves passport runtime data without crossing into the legacy backend.
 * The result is always structured JSON and always truthfully indicates
 * degraded mode when source verification is incomplete.
 */
export async function resolvePassportRuntimePassport(entityId: string): Promise<PassportRuntimePayload> {
  if (isNpi(entityId)) {
    return buildNpiPassport(entityId);
  }

  return buildGenericDegradedPassport(entityId);
}

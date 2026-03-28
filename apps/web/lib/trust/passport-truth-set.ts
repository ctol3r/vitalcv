import type { PassportData } from '@/lib/trust/passport-contract';
import {
  createCanonicalSourceCoverage,
  createCanonicalTruth,
  findPriorityCanonicalSourceCoverage,
  type CanonicalSourceCoverageState,
  type CanonicalTruthSet,
} from '../../../../packages/trust-state';
import {
  findPassportSourceCoverageChecks,
} from '@/lib/trust/source-coverage';

const TRUTH_COVERAGE_PRIORITY: readonly CanonicalSourceCoverageState[] = [
  'reviewRequired',
  'stale',
  'accessRequired',
  'gated',
  'notDecisionGrade',
  'unavailable',
  'previewOnly',
  'pending',
  'checked',
] as const;

function fallbackCoverage(sourceId: string, reason: string) {
  return createCanonicalSourceCoverage({
    sourceId,
    state: 'pending',
    reason,
  });
}

function selectCoverage(
  passport: PassportData,
  aliases: string[],
  fallback: { sourceId: string; reason: string },
) {
  return findPriorityCanonicalSourceCoverage(
    findPassportSourceCoverageChecks(passport.sourceCoverage, aliases),
    TRUTH_COVERAGE_PRIORITY,
  ) ?? fallbackCoverage(fallback.sourceId, fallback.reason);
}

export function resolvePassportTruthSet(
  passport: PassportData,
): CanonicalTruthSet {
  if (passport.truth) {
    return passport.truth;
  }

  const licensureCredentials = passport.authority.credentials.filter(
    (credential) => credential.domain === 'LICENSURE',
  );

  return {
    identity: createCanonicalTruth({
      kind: 'verification',
      satisfied: Boolean(passport.identity.displayName && (passport.identity.npi ?? passport.npi)),
      coverage: selectCoverage(passport, ['NPPES_API', 'NPPES', 'NPI Registry'], {
        sourceId: 'NPPES_API',
        reason: 'NPPES identity source not yet checked',
      }),
    }),
    safety: createCanonicalTruth({
      kind: 'clearance',
      satisfied: passport.standing.exclusionStatus === 'CLEAR',
      coverage: selectCoverage(passport, ['OIG_LEIE', 'OIG', 'LEIE'], {
        sourceId: 'OIG_LEIE',
        reason: 'OIG LEIE source not yet checked',
      }),
    }),
    authority: createCanonicalTruth({
      kind: 'verification',
      satisfied: passport.standing.licensureStatus === 'verified'
        && licensureCredentials.some((credential) => (
          credential.status === 'ACTIVE'
          && !credential.stale
          && !credential.reviewRequired
        )),
      coverage: selectCoverage(
        passport,
        [
          'STATE_BOARD',
          'FSMB',
          'FSMB_MED_API',
          'FSMB_PDC',
          'NURSYS',
          ...licensureCredentials
            .map((credential) => credential.sourceId)
            .filter((value): value is string => typeof value === 'string' && value.trim().length > 0),
        ],
        {
          sourceId: licensureCredentials[0]?.sourceId ?? 'STATE_BOARD',
          reason: 'Licensure source not yet checked',
        },
      ),
    }),
    eligibility: createCanonicalTruth({
      kind: 'enrollment',
      satisfied: passport.standing.pecosEnrollmentStatus === 'ENROLLED',
      coverage: selectCoverage(passport, ['PECOS_PUBLIC', 'PECOS'], {
        sourceId: 'PECOS_PUBLIC',
        reason: 'PECOS enrollment source not yet checked',
      }),
    }),
  };
}

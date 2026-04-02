import type { PassportData } from '@/lib/trust/passport-contract';
import {
  type CanonicalTruth,
} from '../../../../packages/trust-state';
import {
  buildPassportProofSections,
  summarizePassportProofSections,
} from '@/components/trust/passportProofSections';
import type { AccordionItem } from '@/components/ui/accordion';
import {
  buildPassportFreshnessEntries,
  formatAsOfDate,
  formatAsOfQuarter,
  joinNoteParts,
  summarizePassportFreshnessEntries,
  type PassportFreshnessEntry,
  type PassportFreshnessState,
} from '@/lib/trust/proof-language';
import {
  normalizePassportSourceCoverageChecks,
  type PassportSourceCoverageCheck,
} from '@/lib/trust/source-coverage';
import { resolvePassportTruthSet } from '@/lib/trust/passport-truth-set';
import {
  resolveAuthorityDecisionBasisBucket,
  resolveAuthorityMethodLabel,
  resolveAuthorityStatusLead,
  resolveAuthorityTitle,
} from '@/lib/trust/passport-truth';

export type PassportTrustDimensionState =
  | 'checked'
  | 'stale'
  | 'pending'
  | 'gated'
  | 'unavailable'
  | 'review_required';

export interface PassportTrustDimension {
  label: string;
  state: PassportTrustDimensionState;
  note?: string;
}

export interface PassportTrustPostureModel {
  level: string;
  bandLabel: string;
  score: number;
  reliableCount: number;
  reliableLabel: string;
  dimensions: PassportTrustDimension[];
  blockers: string[];
  gaps: string[];
  disclaimer: string;
}

export interface PassportTruthListItem {
  id: string;
  label: string;
  detail?: string;
}

export interface PassportReviewTruthModel {
  posture: PassportTrustPostureModel;
  proofSummary: ReturnType<typeof summarizePassportProofSections>;
  freshness: {
    entries: PassportFreshnessEntry[];
    state: PassportFreshnessState;
    label: string;
  };
  sourceCoverageChecks: PassportSourceCoverageCheck[];
  buckets: {
    sourceBackedNow: PassportTruthListItem[];
    contextualOnly: PassportTruthListItem[];
    stale: PassportTruthListItem[];
    needsReview: PassportTruthListItem[];
    missingOrAccessRequired: PassportTruthListItem[];
    nextActions: PassportTruthListItem[];
  };
}

const TRUST_POSTURE_BAND_LABELS: Record<string, string> = {
  L3: 'High trust',
  L2: 'Moderate trust',
  L1: 'Partial trust',
  L0: 'Insufficient',
};

function dimensionStateFromTruthStatus(
  truth: CanonicalTruth,
): PassportTrustDimensionState {
  switch (truth.coverage.state) {
    case 'stale':
      return 'stale';
    case 'gated':
    case 'accessRequired':
      return 'gated';
    case 'previewOnly':
    case 'notDecisionGrade':
    case 'unavailable':
      return 'unavailable';
    default:
      break;
  }

  switch (truth.status) {
    case 'VERIFIED':
    case 'CLEAR':
    case 'ENROLLED':
      return 'checked';
    case 'ACCESS REQUIRED':
      return 'gated';
    case 'REVIEW REQUIRED':
      return 'review_required';
    case 'UNAVAILABLE':
    case 'NOT DECISION-GRADE':
      return 'unavailable';
    case 'PENDING':
    default:
      return 'pending';
  }
}

function bucketForTruth(
  truth: CanonicalTruth,
): keyof PassportReviewTruthModel['buckets'] {
  switch (truth.coverage.state) {
    case 'stale':
      return 'stale';
    case 'notDecisionGrade':
    case 'previewOnly':
      return 'contextualOnly';
    case 'gated':
    case 'accessRequired':
      return 'missingOrAccessRequired';
    default:
      break;
  }

  switch (truth.status) {
    case 'VERIFIED':
    case 'CLEAR':
    case 'ENROLLED':
      return 'sourceBackedNow';
    case 'NOT DECISION-GRADE':
      return 'contextualOnly';
    case 'REVIEW REQUIRED':
      return 'needsReview';
    case 'PENDING':
    case 'UNAVAILABLE':
    case 'ACCESS REQUIRED':
    default:
      return 'missingOrAccessRequired';
  }
}

export const PASSPORT_TRUST_POSTURE_DISCLAIMER =
  'Trust posture reflects available source data only. Does not constitute privileging, credentialing, or employment approval.';

const PROOF_SECTION_LABELS: Record<string, string> = {
  identity: 'Identity verification',
  licensure: 'State licensure / authority',
  board: 'Board certification',
  dea: 'DEA / controlled substance',
  sanctions: 'Sanctions & exclusions',
  eligibility: 'Enrollment / eligibility',
};

const AUTHORITY_SECTION_DOMAINS = {
  licensure: 'LICENSURE',
  board: 'BOARD_CERTIFICATION',
  dea: 'DEA_REGISTRATION',
} as const;

function latestCredentialDate(
  credentials: PassportData['authority']['credentials'],
): string | null {
  const values = credentials
    .map((credential) => credential.observedAt ?? credential.verifiedAt ?? null)
    .filter((value): value is string => Boolean(value));

  if (values.length === 0) {
    return null;
  }

  return values.sort((left, right) => Date.parse(right) - Date.parse(left))[0] ?? null;
}

function uniqueCredentialSources(
  credentials: PassportData['authority']['credentials'],
  fallback: string,
): string {
  const sources = Array.from(new Set(
    credentials
      .map((credential) => credential.issuerName ?? credential.sourceId ?? null)
      .filter((value): value is string => Boolean(value && value.trim())),
  ));

  return sources.length > 0 ? sources.join(' · ') : fallback;
}

function proofSectionLabel(item: AccordionItem): string {
  return typeof item.trigger === 'string'
    ? item.trigger
    : PROOF_SECTION_LABELS[item.id] ?? item.id;
}

function proofSectionDetail(
  passport: PassportData,
  sectionId: string,
): string | undefined {
  switch (sectionId) {
    case 'identity':
      return joinNoteParts([
        'CMS NPPES',
        formatAsOfDate(passport.lastCheckedAt),
      ]);
    case 'licensure': {
      const credentials = passport.authority.credentials.filter(
        (credential) => credential.domain === 'LICENSURE',
      );

      return joinNoteParts([
        uniqueCredentialSources(credentials, 'State Boards / FSMB'),
        formatAsOfDate(latestCredentialDate(credentials)),
      ]);
    }
    case 'board': {
      const credentials = passport.authority.credentials.filter(
        (credential) => credential.domain === 'BOARD_CERTIFICATION',
      );

      return joinNoteParts([
        uniqueCredentialSources(credentials, 'ABMS / specialty board'),
        formatAsOfDate(latestCredentialDate(credentials)),
      ]);
    }
    case 'dea': {
      const credentials = passport.authority.credentials.filter(
        (credential) => credential.domain === 'DEA_REGISTRATION',
      );

      return joinNoteParts([
        uniqueCredentialSources(credentials, 'DEA'),
        formatAsOfDate(latestCredentialDate(credentials)),
      ]);
    }
    case 'sanctions':
      return joinNoteParts([
        'OIG LEIE',
        formatAsOfDate(passport.standing.exclusionCheckedAt ?? passport.lastCheckedAt),
      ]);
    case 'eligibility':
      return joinNoteParts([
        passport.standing.enrollmentSourceLabel ?? 'CMS PECOS',
        passport.standing.enrollmentFreshnessLabel
          ?? passport.standing.enrollmentDataFreshness
          ?? null,
        formatAsOfQuarter(
          passport.standing.enrollmentObservedAt,
          passport.standing.enrollmentDataVersion,
        ),
      ]);
    default:
      return undefined;
  }
}

export { resolvePassportTruthSet } from '@/lib/trust/passport-truth-set';

function truthItemFromProofSection(
  passport: PassportData,
  item: AccordionItem,
): PassportTruthListItem {
  return {
    id: item.id,
    label: proofSectionLabel(item),
    detail: proofSectionDetail(passport, item.id),
  };
}

function postureReliableLabel(reliableCount: number): string {
  if (reliableCount === 0) {
    return 'No source-backed claims yet';
  }

  return reliableCount === 1
    ? '1 source-backed claim'
    : `${reliableCount} source-backed claims`;
}

function authorityCredentialDetail(
  credential: PassportData['authority']['credentials'][number],
  bucket: Exclude<keyof PassportReviewTruthModel['buckets'], 'contextualOnly' | 'nextActions'>,
): string | undefined {
  return joinNoteParts([
    resolveAuthorityMethodLabel(credential),
    formatAsOfDate(credential.observedAt ?? credential.verifiedAt),
    bucket === 'stale' ? 'Stale' : credential.dataFreshnessLabel ?? null,
    bucket === 'sourceBackedNow' ? null : resolveAuthorityStatusLead(credential),
  ]);
}

function truthItemFromAuthorityCredential(
  credential: PassportData['authority']['credentials'][number],
): {
  bucket: Exclude<keyof PassportReviewTruthModel['buckets'], 'contextualOnly' | 'nextActions'>;
  item: PassportTruthListItem;
} {
  const bucket = resolveAuthorityDecisionBasisBucket(credential);

  return {
    bucket,
    item: {
      id: `authority:${credential.id}`,
      label: resolveAuthorityTitle(credential),
      detail: authorityCredentialDetail(credential, bucket),
    },
  };
}

export function resolvePassportTrustBandLabel(
  level: string | null | undefined,
): string {
  if (!level) {
    return TRUST_POSTURE_BAND_LABELS.L1;
  }

  return TRUST_POSTURE_BAND_LABELS[level] ?? level;
}

export function buildPassportTrustPosture(
  passport: PassportData,
): PassportTrustPostureModel {
  const { readiness, training } = passport;
  const truth = resolvePassportTruthSet(passport);
  const level = readiness.level ?? 'L1';
  const dimensions: PassportTrustDimension[] = [
    {
      label: 'Identity (NPI / CMS)',
      state: dimensionStateFromTruthStatus(truth.identity),
      note: truth.identity.coverage.state === 'checked' ? undefined : truth.identity.coverage.reason,
    },
    {
      label: 'Exclusion check (OIG/LEIE)',
      state: dimensionStateFromTruthStatus(truth.safety),
      note: truth.safety.status === 'REVIEW REQUIRED'
        ? 'Review required'
        : truth.safety.coverage.state !== 'checked'
          ? truth.safety.coverage.reason
          : undefined,
    },
    {
      label: 'State licensure',
      state: dimensionStateFromTruthStatus(truth.authority),
      note: truth.authority.coverage.state === 'checked' ? undefined : truth.authority.coverage.reason,
    },
  ];

  dimensions.push({
    label: 'Medicare enrollment (PECOS)',
    state: dimensionStateFromTruthStatus(truth.eligibility),
    note: truth.eligibility.coverage.state === 'checked' ? undefined : truth.eligibility.coverage.reason,
  });

  if (training.hasDegree || training.hasResidency) {
    dimensions.push({
      label: 'Training record',
      state: training.degreeVerified ? 'checked' : 'pending',
      note: training.degreeVerified ? undefined : 'Self-reported',
    });
  }

  const reliableCount = dimensions.filter((dimension) => dimension.state === 'checked').length;

  return {
    level,
    bandLabel: resolvePassportTrustBandLabel(level),
    score: readiness.score,
    reliableCount,
    reliableLabel: postureReliableLabel(reliableCount),
    dimensions,
    blockers: readiness.blockers,
    gaps: readiness.gaps,
    disclaimer: PASSPORT_TRUST_POSTURE_DISCLAIMER,
  };
}

function bucketForProofStatus(
  status: AccordionItem['status'],
): keyof PassportReviewTruthModel['buckets'] | null {
  switch (status) {
    case 'checked':
      return 'sourceBackedNow';
    case 'stale':
      return 'stale';
    case 'review_required':
      return 'needsReview';
    case 'pending':
    case 'unavailable':
    case 'access_required':
      return 'missingOrAccessRequired';
    default:
      return null;
  }
}

export function buildPassportReviewTruthModel(
  passport: PassportData,
): PassportReviewTruthModel {
  const truth = resolvePassportTruthSet(passport);
  const proofItems = buildPassportProofSections(passport);
  const freshnessEntries = buildPassportFreshnessEntries(passport);
  const freshnessSummary = summarizePassportFreshnessEntries(freshnessEntries);
  const sourceCoverageChecks = normalizePassportSourceCoverageChecks(passport.sourceCoverage);

  const buckets: PassportReviewTruthModel['buckets'] = {
    sourceBackedNow: [],
    contextualOnly: [],
    stale: [],
    needsReview: [],
    missingOrAccessRequired: [],
    nextActions: passport.readiness.nextActions.map((action) => ({
      id: action.id,
      label: action.title,
      detail: action.detail,
    })),
  };
  const topLevelTruthBuckets = new Map<string, keyof PassportReviewTruthModel['buckets']>([
    ['identity', bucketForTruth(truth.identity)],
    ['sanctions', bucketForTruth(truth.safety)],
    ['eligibility', bucketForTruth(truth.eligibility)],
  ]);

  for (const item of proofItems) {
    if (item.id in AUTHORITY_SECTION_DOMAINS) {
      const domain = AUTHORITY_SECTION_DOMAINS[item.id as keyof typeof AUTHORITY_SECTION_DOMAINS];
      const hasCredentialForDomain = passport.authority.credentials.some((credential) => (
        credential.domain === domain
      ));

      if (hasCredentialForDomain) {
        continue;
      }
    }

    const bucket = topLevelTruthBuckets.get(item.id) ?? bucketForProofStatus(item.status);
    if (!bucket) {
      continue;
    }

    buckets[bucket].push(truthItemFromProofSection(passport, item));
  }

  for (const credential of passport.authority.credentials) {
    if (!Object.values(AUTHORITY_SECTION_DOMAINS).includes(
      credential.domain as (typeof AUTHORITY_SECTION_DOMAINS)[keyof typeof AUTHORITY_SECTION_DOMAINS],
    )) {
      continue;
    }

    const { bucket, item } = truthItemFromAuthorityCredential(credential);
    buckets[bucket].push(item);
  }

  return {
    posture: buildPassportTrustPosture(passport),
    proofSummary: summarizePassportProofSections(proofItems),
    freshness: {
      entries: freshnessEntries,
      state: freshnessSummary.state,
      label: freshnessSummary.label,
    },
    sourceCoverageChecks,
    buckets,
  };
}

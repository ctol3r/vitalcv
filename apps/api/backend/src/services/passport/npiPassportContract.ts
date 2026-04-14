import {
  createCanonicalSourceCoverage,
  summarizeCanonicalSourceCoverage,
  deriveReadinessState,
  type CanonicalSourceCoverageReport,
} from '@vitalcv/trust-state';
import {
  buildPecosEnrollmentNote,
  buildPecosFreshnessLabel,
  buildPecosStatusLabel,
  normalizePecosEnrollmentStatus,
  pecosCoverageReason,
  PECOS_SOURCE_LABEL,
  type PecosEnrollmentStatus,
} from '../identity/pecosContract';
import { getSourceFreshnessWindowHours } from '../identity/sourceCatalog';
import {
  buildDecisionPosture,
  buildPassportTrustPosture,
  buildPassportTruth,
  type PassportAuthority,
  type PassportCredential,
  type PassportIdentity,
  type PassportReadiness,
  type PassportStanding,
  type PassportTraining,
  type ReadinessNextAction,
  type TrustPassport,
} from '../entity/passportService';
import {
  loadPassportData,
  type LoadedPassportData,
  type PassportCredential as LegacyPassportCredential,
} from '../../routes/passport';
import prisma from '../../graphql/prisma_client';
import { unacknowledgedCount } from '../alerts/trustAlerts';

type PassportCredentialSummary = {
  id: string;
  type: string;
  label: string;
  source: string;
  status: string;
  timestamp: string;
};

export type PassportDataContract = TrustPassport & {
  credentials: PassportCredentialSummary[];
};

function dedupeStrings(values: readonly string[]): string[] {
  return Array.from(new Set(values.map((value) => value.trim()).filter(Boolean)));
}

function latestIso(left?: string, right?: string): string | undefined {
  if (!left) return right;
  if (!right) return left;

  const leftMs = Date.parse(left);
  const rightMs = Date.parse(right);
  if (!Number.isFinite(leftMs)) return right;
  if (!Number.isFinite(rightMs)) return left;
  return leftMs >= rightMs ? left : right;
}

function isPastIso(value: string | null | undefined): boolean {
  if (!value) return false;
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) && parsed <= Date.now();
}

function normalizedCredentialSource(credential: LegacyPassportCredential): string {
  switch (credential.type) {
    case 'NPI_IDENTITY':
    case 'NPI_ENROLLMENT':
    case 'IDENTITY':
      return 'NPPES_API';
    case 'STATE_LICENSE':
      return 'STATE_BOARD';
    case 'BOARD_CERTIFICATION':
      return 'BOARD_CERTIFICATION';
    case 'DEA_REGISTRATION':
      return 'DEA';
    case 'ENROLLMENT':
      return 'PECOS_PUBLIC';
    case 'SANCTIONS_CHECK':
    case 'OIG_EXCLUSION':
      return 'OIG_LEIE';
    default:
      return credential.issuer.trim().toUpperCase().replace(/[^A-Z0-9]+/g, '_') || 'UNKNOWN';
  }
}

function authorityDomainForLegacyCredential(
  credential: LegacyPassportCredential,
): PassportCredential['domain'] | null {
  switch (credential.type) {
    case 'STATE_LICENSE':
      return 'LICENSURE';
    case 'BOARD_CERTIFICATION':
      return 'BOARD_CERTIFICATION';
    case 'DEA_REGISTRATION':
      return 'DEA_REGISTRATION';
    default:
      return null;
  }
}

function timestampForLegacyCredential(
  credential: LegacyPassportCredential,
  computedAt: string,
): string {
  return credential.verifiedAt ?? credential.expiresAt ?? computedAt;
}

function jurisdictionForLegacyCredential(
  credential: LegacyPassportCredential,
): string {
  const match = credential.name.match(/^([A-Z]{2})\b/);
  return match?.[1] ?? '';
}

function statusLabel(status: string): string {
  const normalized = status.trim().toUpperCase();
  if (normalized === 'ACTIVE') return 'Active';
  if (normalized === 'PENDING') return 'Pending';
  if (normalized === 'EXPIRED') return 'Expired';
  if (normalized === 'REVOKED') return 'Revoked';
  if (normalized === 'SUSPENDED') return 'Suspended';
  return 'Unknown';
}

function freshnessLabelForCredential(credential: LegacyPassportCredential): string {
  if (isPastIso(credential.expiresAt)) {
    return 'Stale — refresh required';
  }
  return 'Current attached record';
}

function buildCredentialSummaries(
  credentials: readonly LegacyPassportCredential[],
  computedAt: string,
): PassportCredentialSummary[] {
  return credentials.map((credential) => ({
    id: credential.id,
    type: credential.type,
    label: credential.name || credential.type,
    source: credential.issuer || normalizedCredentialSource(credential),
    status: credential.status,
    timestamp: timestampForLegacyCredential(credential, computedAt),
  }));
}

function buildAuthority(
  credentials: readonly LegacyPassportCredential[],
  computedAt: string,
): PassportAuthority {
  const mapped = credentials.flatMap((credential) => {
    const domain = authorityDomainForLegacyCredential(credential);
    if (!domain) {
      return [];
    }

    const sourceId = normalizedCredentialSource(credential);
    const jurisdiction = jurisdictionForLegacyCredential(credential);
    const stale = isPastIso(credential.expiresAt);
    const authorityClaimCode =
      domain === 'LICENSURE' && credential.status === 'ACTIVE'
        ? 'PHYSICIAN_LICENSE_ACTIVE'
        : domain === 'BOARD_CERTIFICATION' && credential.status === 'ACTIVE'
          ? 'BOARD_CERTIFIED'
          : '';

    return [{
      id: credential.id,
      domain,
      type: credential.type,
      status: credential.status,
      label: credential.name || credential.type,
      verificationLevel: credential.status === 'ACTIVE' ? 'PRIMARY_SOURCE' : 'SOURCE_ATTACHED',
      issuerEntityId: '',
      issuerName: credential.issuer || sourceId,
      sourceId,
      jurisdiction,
      issuedAt: '',
      expiresAt: credential.expiresAt ?? '',
      verifiedAt: credential.verifiedAt ?? '',
      observedAt: credential.verifiedAt ?? timestampForLegacyCredential(credential, computedAt),
      stale,
      confidenceLabel: credential.status === 'ACTIVE' ? 'HIGH' : 'MEDIUM',
      claimConfidenceLabel: credential.status === 'ACTIVE' ? 'HIGH' : 'MEDIUM',
      matchConfidence: '',
      sourceLatency: '',
      dataFreshness: stale ? 'STALE' : 'CURRENT',
      dataFreshnessLabel: freshnessLabelForCredential(credential),
      dataFreshnessCadence: '',
      claimState: credential.status,
      statusLabel: statusLabel(credential.status),
      dataVersion: '',
      revalidationDue: credential.expiresAt ?? '',
      identityOnly: false,
      sourceDisclaimer: '',
      nextReverifyAt: credential.expiresAt ?? '',
      reviewRequired: credential.status === 'PENDING',
      authorityClaimCode,
      boardOrderSeverity: '',
      connectorState: sourceId === 'UNKNOWN' ? 'unresolved' : 'connected',
      participationStatus: credential.status === 'ACTIVE' ? 'verified_result' : 'manual_verification_required',
      sourceScope: domain === 'LICENSURE' ? 'STATE_BOARD_MANUAL' : sourceId,
      source: credential.issuer || sourceId,
      timestamp: timestampForLegacyCredential(credential, computedAt),
    }];
  });

  const active = mapped.filter((credential) => credential.status === 'ACTIVE').length;
  const expired = mapped.filter((credential) => credential.status === 'EXPIRED').length;
  const stale = mapped.filter((credential) => credential.stale).length;

  return {
    credentials: mapped,
    summary: {
      active,
      expired,
      stale,
      missing: mapped.some((credential) => credential.domain === 'LICENSURE') ? [] : ['LICENSURE'],
    },
  };
}

function deriveLicensureStatus(
  authority: PassportAuthority,
  trustState: LoadedPassportData['trustState'],
): PassportStanding['licensureStatus'] {
  if (trustState.licensureStatus) {
    return trustState.licensureStatus;
  }

  const license = authority.credentials.find((credential) => credential.domain === 'LICENSURE');
  if (!license) return 'unknown';
  if (license.status === 'ACTIVE') return 'verified';
  if (license.status === 'EXPIRED') return 'expired';
  return 'pending';
}

function deriveDeaStatus(
  credentials: readonly LegacyPassportCredential[],
): PassportStanding['deaStatus'] {
  const dea = credentials.find((credential) => credential.type === 'DEA_REGISTRATION');
  if (!dea) return 'unknown';
  return dea.status === 'ACTIVE' ? 'registered' : 'none';
}

function derivePecosEnrollmentStatus(
  credentials: readonly LegacyPassportCredential[],
  trustState: LoadedPassportData['trustState'],
): PecosEnrollmentStatus {
  if (trustState.pecosStatus) {
    return trustState.pecosStatus;
  }

  const enrollment = credentials.find((credential) => credential.type === 'ENROLLMENT');
  if (!enrollment) {
    return 'UNCHECKED';
  }

  return normalizePecosEnrollmentStatus({
    claimState: enrollment.status === 'ACTIVE' ? 'ENROLLED' : 'NOT_FOUND',
  });
}

function normalizeExclusionStatus(
  legacy: LoadedPassportData,
): PassportStanding['exclusionStatus'] {
  const trustStatus = legacy.trustState.exclusionStatus;
  if (trustStatus) {
    return trustStatus;
  }

  if (legacy.passport.sanctions.status === 'CLEAR') {
    return 'CLEAR';
  }
  if (legacy.passport.sanctions.status === 'FLAGGED') {
    return 'POSSIBLE_MATCH';
  }

  return 'UNCHECKED';
}

function buildStanding(
  authority: PassportAuthority,
  legacy: LoadedPassportData,
): PassportStanding {
  const exclusionStatus = normalizeExclusionStatus(legacy);
  const exclusionCheckedAt = legacy.passport.sanctions.checkedAt ?? '';
  const licensureStatus = deriveLicensureStatus(authority, legacy.trustState);
  const pecosEnrollmentStatus = derivePecosEnrollmentStatus(
    legacy.passport.credentials,
    legacy.trustState,
  );
  const enrollmentCredential = legacy.passport.credentials.find(
    (credential) => credential.type === 'ENROLLMENT',
  );
  const enrollmentObservedAt = enrollmentCredential?.verifiedAt ?? legacy.trustState.computed_at;
  const enrollmentDataVersion = '';
  const enrollmentFreshnessLabel = buildPecosFreshnessLabel({
    status: pecosEnrollmentStatus,
    observedAt: enrollmentObservedAt,
  });
  const negativeFindings = dedupeStrings([
    ...(exclusionStatus === 'EXCLUDED' || exclusionStatus === 'POSSIBLE_MATCH'
      ? ['Exclusion screening requires review']
      : []),
    ...(licensureStatus === 'expired'
      ? ['License expired']
      : []),
  ]);

  return {
    exclusionClear: exclusionStatus === 'CLEAR',
    exclusionStatus,
    exclusionCheckedAt,
    exclusionConfidenceLabel: exclusionStatus === 'UNCHECKED' ? 'UNCERTAIN' : 'HIGH',
    licensureStatus,
    deaStatus: deriveDeaStatus(legacy.passport.credentials),
    pecosStatus:
      pecosEnrollmentStatus === 'ENROLLED'
        ? 'enrolled'
        : pecosEnrollmentStatus === 'NOT_FOUND'
          ? 'not_enrolled'
          : 'unknown',
    pecosEnrollmentStatus,
    enrollmentSourceLabel: PECOS_SOURCE_LABEL,
    enrollmentDataFreshness: 'Quarterly',
    enrollmentSourceLatency: 'Quarterly snapshot',
    enrollmentNote: buildPecosEnrollmentNote(pecosEnrollmentStatus, enrollmentDataVersion),
    enrollmentObservedAt,
    enrollmentDataVersion,
    enrollmentStatusLabel: buildPecosStatusLabel(pecosEnrollmentStatus, enrollmentDataVersion),
    enrollmentFreshnessLabel,
    enrollmentConfidenceLabel: pecosEnrollmentStatus === 'UNCHECKED' ? 'UNCERTAIN' : 'HIGH',
    negativeFindings,
  };
}

function buildNextActions(
  trustState: LoadedPassportData['trustState'],
  gaps: readonly string[],
  blockers: readonly string[],
): ReadinessNextAction[] {
  const seeded = trustState.nextActions ?? [];
  if (seeded.length > 0) {
    return seeded.map((action, index) => ({
      id: `action-${index + 1}`,
      title: action,
      detail: action,
      priority: blockers.length > 0 ? 'HIGH' : 'MEDIUM',
    }));
  }

  return dedupeStrings([...blockers, ...gaps]).slice(0, 4).map((item, index) => ({
    id: `action-${index + 1}`,
    title: item,
    detail: item,
    priority: blockers.includes(item) ? 'HIGH' : 'MEDIUM',
  }));
}

function buildReadiness(
  legacy: LoadedPassportData,
  standing: PassportStanding,
  sourceCoverage: CanonicalSourceCoverageReport,
): PassportReadiness {
  const blockers = dedupeStrings([
    ...(standing.exclusionStatus === 'EXCLUDED' ? ['OIG LEIE exclusion confirmed'] : []),
    ...(standing.licensureStatus === 'expired' ? ['Licensure expired'] : [])
  ]);
  const gaps = dedupeStrings([
    ...(legacy.trustState.gaps ?? []),
    ...(legacy.trustState.gap_summary ?? []),
  ]);
  
  const status = deriveReadinessState(sourceCoverage.checks);

  return {
    status,
    score: 0,
    readiness_score: 0,
    level: 'L0',
    blockers,
    gaps,
    nextActions: buildNextActions(legacy.trustState, gaps, blockers),
    estimatedStartDays: status === 'DECISION_GRADE' ? 3 : status === 'PARTIAL' ? 14 : null,
  };
}

function buildSourceCoverage(
  legacy: LoadedPassportData,
  identity: PassportIdentity,
  authority: PassportAuthority,
  standing: PassportStanding,
): CanonicalSourceCoverageReport {
  const existingChecks = legacy.trustState.sourceCoverage ?? [];
  if (existingChecks.length > 0) {
    const checks = existingChecks.map((check) => createCanonicalSourceCoverage({
      sourceId: check.sourceId,
      state: check.state,
      reason: check.reason,
      checkedAt: check.checkedAt ?? null,
      observedAt: check.observedAt ?? null,
      expiresAt: check.expiresAt ?? null,
      artifactId: check.artifactId ?? null,
      sourceUrl: check.sourceUrl ?? null,
      rawArtifactRef: check.rawArtifactRef ?? null,
      checksum: check.checksum ?? null,
      parserVersion: check.parserVersion ?? null,
      freshnessWindowHours: check.freshnessWindowHours ?? null,
      proof: check.proof ?? null,
    }));

    return {
      checks,
      summary: summarizeCanonicalSourceCoverage(checks),
    };
  }

  const license = authority.credentials.find((credential) => credential.domain === 'LICENSURE');
  const enrollmentStatus = standing.pecosEnrollmentStatus;
  const nppesCheckedAt = legacy.passport.credentials.find((credential) => (
    credential.type === 'NPI_IDENTITY' || credential.type === 'IDENTITY'
  ))?.verifiedAt ?? legacy.trustState.computed_at;
  const exclusionCheckedAt = standing.exclusionCheckedAt || legacy.trustState.computed_at;
  const licensureCheckedAt = license?.observedAt ?? legacy.trustState.computed_at;
  const enrollmentObservedAt = standing.enrollmentObservedAt || legacy.trustState.computed_at;
  const enrollmentFresh = enrollmentStatus === 'ENROLLED' || enrollmentStatus === 'NOT_FOUND';

  const checks = [
    createCanonicalSourceCoverage({
      sourceId: 'NPPES_API',
      state: identity.npi ? 'checked' : 'pending',
      reason: identity.npi ? 'NPPES identity checked' : 'NPPES identity source not yet checked',
      checkedAt: nppesCheckedAt,
      freshnessWindowHours: getSourceFreshnessWindowHours('NPPES_API'),
    }),
    createCanonicalSourceCoverage({
      sourceId: 'OIG_LEIE',
      state:
        standing.exclusionStatus === 'CLEAR'
        || standing.exclusionStatus === 'EXCLUDED'
          ? 'checked'
          : standing.exclusionStatus === 'POSSIBLE_MATCH'
            ? 'reviewRequired'
            : 'pending',
      reason:
        standing.exclusionStatus === 'CLEAR'
          ? 'OIG LEIE check clear'
          : standing.exclusionStatus === 'EXCLUDED'
            ? 'OIG LEIE exclusion confirmed'
            : standing.exclusionStatus === 'POSSIBLE_MATCH'
              ? 'OIG LEIE returned a possible match and requires human adjudication'
              : 'OIG LEIE source not yet checked',
      checkedAt: exclusionCheckedAt,
      freshnessWindowHours: getSourceFreshnessWindowHours('OIG_LEIE'),
    }),
    createCanonicalSourceCoverage({
      sourceId: 'STATE_BOARD',
      state: license ? 'checked' : 'pending',
      reason: license
        ? 'Licensure checked'
        : 'Licensure source not yet checked',
      checkedAt: licensureCheckedAt,
      freshnessWindowHours: getSourceFreshnessWindowHours('STATE_BOARD'),
    }),
    createCanonicalSourceCoverage({
      sourceId: 'PECOS_PUBLIC',
      state:
        enrollmentStatus === 'UNCHECKED'
          ? 'pending'
          : enrollmentFresh
            ? 'checked'
            : 'pending',
      reason: pecosCoverageReason({
        status: enrollmentStatus,
        checked: enrollmentStatus !== 'UNCHECKED',
        fresh: enrollmentFresh,
      }),
      checkedAt: enrollmentObservedAt,
      freshnessWindowHours: getSourceFreshnessWindowHours('PECOS_PUBLIC'),
    }),
  ];

  return {
    checks,
    summary: summarizeCanonicalSourceCoverage(checks),
  };
}

function buildSources(report: CanonicalSourceCoverageReport): TrustPassport['sources'] {
  const checked = report.checks.map((check) => check.sourceId);
  const lastFetch = Object.fromEntries(
    report.checks
      .filter((check) => Boolean(check.checkedAt))
      .map((check) => [check.sourceId, check.checkedAt ?? '']),
  );

  return {
    checked,
    lastFetch,
  };
}

function lastCheckedAt(report: CanonicalSourceCoverageReport, computedAt: string): string {
  return report.checks.reduce<string>(
    (latest, check) => latestIso(latest, check.checkedAt ?? undefined) ?? latest,
    computedAt,
  );
}

// ── Wave 245: Monitoring status builder ──────────────────────────────────────

type MonitoringStatus = {
  active: boolean;
  lastCheckAt: string | null;
  monitoredSources: Array<{
    sourceId: string;
    sourceLabel: string;
    lastCheckAt: string | null;
    status: 'active' | 'paused' | 'error';
  }>;
  activeAlertCount: number;
};

async function buildMonitoringStatus(npi: string): Promise<MonitoringStatus> {
  const monitoredArtifacts = await prisma.verificationArtifact.findMany({
    where: { npi, monitoring: true },
    select: {
      source: true,
      statusLastChecked: true,
      lifecycleState: true,
    },
    orderBy: { statusLastChecked: 'desc' },
  });

  if (monitoredArtifacts.length === 0) {
    return { active: false, lastCheckAt: null, monitoredSources: [], activeAlertCount: 0 };
  }

  const sourceMap = new Map<string, { lastCheck: Date | null; state: string }>();
  let latestCheck: Date | null = null;

  for (const artifact of monitoredArtifacts) {
    if (!sourceMap.has(artifact.source)) {
      sourceMap.set(artifact.source, {
        lastCheck: artifact.statusLastChecked,
        state: artifact.lifecycleState ?? 'active',
      });
    }
    if (artifact.statusLastChecked) {
      if (!latestCheck || artifact.statusLastChecked > latestCheck) {
        latestCheck = artifact.statusLastChecked;
      }
    }
  }

  const SOURCE_LABELS: Record<string, string> = {
    'nursys-enotify': 'Nursys e-Notify',
    NURSYS: 'Nursys',
    STATE_BOARD: 'State Board',
    OIG_LEIE: 'OIG/LEIE',
    NPPES: 'CMS NPPES',
  };

  const monitoredSources = Array.from(sourceMap.entries()).map(([sourceId, data]) => ({
    sourceId,
    sourceLabel: SOURCE_LABELS[sourceId] ?? sourceId,
    lastCheckAt: data.lastCheck?.toISOString() ?? null,
    status: (data.state === 'error' ? 'error' : 'active') as 'active' | 'paused' | 'error',
  }));

  return {
    active: true,
    lastCheckAt: latestCheck?.toISOString() ?? null,
    monitoredSources,
    activeAlertCount: unacknowledgedCount(),
  };
}

export async function buildPassportDataByNpi(
  npi: string,
): Promise<PassportDataContract | null> {
  const legacy = await loadPassportData(npi);
  if (!legacy) {
    return null;
  }

  const entityId = npi;
  const identity: PassportIdentity = {
    entityId,
    displayName: legacy.passport.public.name || `Clinician ${npi}`,
    npi,
    specialty: legacy.passport.public.specialty || 'Healthcare Provider',
    entityType: legacy.passport.public.providerType === 'INDIVIDUAL' ? 'PERSON' : 'ORGANIZATION',
    status: legacy.trustState.identityVerified ? 'ACTIVE' : 'UNKNOWN',
  };
  const training: PassportTraining = {
    records: [],
    hasDegree: false,
    degreeVerified: false,
    hasResidency: false,
    fellowshipCount: 0,
  };
  const credentials = buildCredentialSummaries(
    legacy.passport.credentials,
    legacy.trustState.computed_at,
  );
  const authority = buildAuthority(
    legacy.passport.credentials,
    legacy.trustState.computed_at,
  );
  const standing = buildStanding(authority, legacy);
  const sourceCoverage = buildSourceCoverage(legacy, identity, authority, standing);
  const readiness = buildReadiness(legacy, standing, sourceCoverage);
  const truth = buildPassportTruth({
    identity,
    authority,
    standing,
    sourceCoverage,
  });
  const computedLastCheckedAt = lastCheckedAt(sourceCoverage, legacy.trustState.computed_at);
  const trustPosture = buildPassportTrustPosture({
    identity,
    authority,
    training,
    standing,
    readiness,
    sourceCoverage,
    truth,
    lastCheckedAt: computedLastCheckedAt,
  });

  const decisionPosture = buildDecisionPosture({
    readiness,
    sourceCoverage,
    truth,
    trustPosture,
  });

  // Wave 245: Build monitoring status
  const monitoring = await buildMonitoringStatus(npi);

  return {
    entityId,
    npi,
    credentials,
    identity,
    authority,
    training,
    standing,
    readiness,
    sources: buildSources(sourceCoverage),
    sourceCoverage,
    truth,
    trustPosture,
    decisionPosture,
    lastCheckedAt: computedLastCheckedAt,
    monitoring,
  };
}

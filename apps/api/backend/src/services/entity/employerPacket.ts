import {
  createCanonicalSourceCoverage,
  LAUNCH_SPINE_SOURCE_IDS,
  summarizeCanonicalSourceCoverage,
  type CanonicalSourceCoverage,
  type CanonicalSourceCoverageSummary,
  type CanonicalTruthStatus,
} from '../../../../../../packages/trust-state';
import type { TrustPassport } from './passportService';

type PassportCredential = TrustPassport['authority']['credentials'][number];

export const EMPLOYER_EVIDENCE_PACKET_BUNDLE_FILES = Object.freeze([
  'packet.json',
  'manifest.json',
  'source-coverage.json',
  'status.json',
  'README.txt',
]);

export interface EmployerPacketReceiptReference {
  sourceId: string;
  receiptId: string;
}

export interface EmployerPacketArtifactReference {
  sourceId: string;
  artifactId: string;
  checksum: string | null;
  parserVersion: string | null;
  sourceUrl: string | null;
  rawArtifactRef: string | null;
}

export interface EmployerPacketSourceManifestEntry {
  sourceId: string;
  truthStatus: CanonicalTruthStatus;
  state: CanonicalSourceCoverage['state'];
  reason: string;
  checkedAt: string | null;
  observedAt: string | null;
  expiresAt: string | null;
  credentialExpiresAt?: string | null;
  freshness: NonNullable<CanonicalSourceCoverage['freshness']>;
  provenance: NonNullable<CanonicalSourceCoverage['provenance']>;
  parserVersion: string | null;
  checksum: string | null;
  sourceUrl: string | null;
  rawArtifactRef: string | null;
  freshnessWindowHours: number | null;
  confidenceLabel: string | null;
  reviewRequired: boolean;
  artifactId: string | null;
  artifactIds: string[];
  receiptIds: string[];
}

export interface EmployerEvidencePacketManifestStatusV1 {
  truth: TrustPassport['truth'];
  freshness: TrustPassport['trustPosture']['freshness'];
  readiness: Pick<
    EmployerEvidencePacketV1['readiness'],
    'status' | 'score' | 'readiness_score' | 'level' | 'blockers'
  >;
  sourceCoverageSummary: CanonicalSourceCoverageSummary;
}

export interface EmployerEvidencePacketManifestV1 {
  schema: 'vitalcv.employer.packet-manifest.v1';
  packetSchema: EmployerEvidencePacketV1['schema'];
  exportedAt: string;
  exportedBy: string;
  entityId: string;
  clinicianNpi: string;
  bundleFiles: readonly string[];
  receiptReferences: EmployerPacketReceiptReference[];
  artifactReferences: EmployerPacketArtifactReference[];
  sourceCoverage: TrustPassport['sourceCoverage'];
  sourceCoverageSummary: CanonicalSourceCoverageSummary;
  freshness: TrustPassport['trustPosture']['freshness'];
  status: EmployerEvidencePacketManifestStatusV1;
  sources: EmployerPacketSourceManifestEntry[];
}

export interface EmployerEvidencePacketV1 {
  schema: 'vitalcv.employer.packet.v1';
  exportedAt: string;
  exportedBy: string;
  entityId: string;
  clinicianNpi: string;
  displayName: string;
  truth: TrustPassport['truth'];
  manifest: EmployerEvidencePacketManifestV1;
  receiptReferences: EmployerPacketReceiptReference[];
  artifactReferences: EmployerPacketArtifactReference[];
  sourceCoverageSummary: CanonicalSourceCoverageSummary;
  freshness: TrustPassport['trustPosture']['freshness'];
  identity: {
    npi: string | null;
    displayName: string;
    specialty: string | null;
    source: string;
    checkedAt: string | null;
    status: 'confirmed' | 'missing';
    truthStatus: CanonicalTruthStatus;
  };
  safety: {
    exclusionStatus: string;
    exclusionCheckedAt: string | null;
    exclusionConfidence: string | null;
    source: string;
    isClear: boolean;
    negativeFindings: string[];
    truthStatus: CanonicalTruthStatus;
  };
  authority: {
    truthStatus: CanonicalTruthStatus;
    credentials: Array<{
      domain: string;
      status: string;
      jurisdiction: string | null;
      issuerName: string | null;
      sourceId: string | null;
      observedAt: string | null;
      verifiedAt: string | null;
      expiresAt: string | null;
      freshnessDays: string | null;
      confidence: string | null;
      claimCode: string | null;
      reviewRequired: boolean;
    }>;
    summary: {
      active: number;
      missing: string[];
    };
  };
  eligibility: {
    pecosEnrollmentStatus: string;
    enrollmentNote: string | null;
    enrollmentDataVersion: string | null;
    enrollmentDataFreshness: string;
    enrollmentCheckedAt: string | null;
    enrollmentConfidence: string | null;
    source: string;
    truthStatus: CanonicalTruthStatus;
  };
  readiness: {
    status: string;
    score: number;
    readiness_score: number;
    level: string;
    estimatedStartDays: number | null;
    blockers: string[];
    nextActions: TrustPassport['readiness']['nextActions'];
  };
  sourceCoverage: TrustPassport['sourceCoverage'];
}

function dedupeSorted(values: readonly string[]): string[] {
  return [...new Set(values.map((value) => value.trim()).filter(Boolean))]
    .sort((left, right) => left.localeCompare(right));
}

function addHours(timestamp: string | null | undefined, hours: number | null | undefined): string | null {
  if (!timestamp || typeof hours !== 'number' || hours <= 0) {
    return null;
  }

  const base = new Date(timestamp);
  if (Number.isNaN(base.getTime())) {
    return null;
  }

  return new Date(base.getTime() + hours * 3_600_000).toISOString();
}

function launchSpineFallbackCheck(sourceId: string): CanonicalSourceCoverage {
  return createCanonicalSourceCoverage({
    sourceId,
    state: 'pending',
    reason: `${sourceId} has not been checked in the launch spine yet.`,
  });
}

function resolveLaunchSpineCoverage(passport: TrustPassport): CanonicalSourceCoverage[] {
  const checksBySource = new Map(
    passport.sourceCoverage.checks.map((check) => [check.sourceId, check] as const),
  );

  return LAUNCH_SPINE_SOURCE_IDS.map(
    (sourceId) => checksBySource.get(sourceId) ?? launchSpineFallbackCheck(sourceId),
  );
}

function findLicensureCredential(
  passport: TrustPassport,
  sourceId: string,
): PassportCredential | null {
  return passport.authority.credentials.find((credential) => (
    credential.domain === 'LICENSURE'
    && (credential.sourceId ?? 'STATE_BOARD') === sourceId
  )) ?? passport.authority.credentials.find((credential) => credential.domain === 'LICENSURE') ?? null;
}

function truthStatusForSource(
  passport: TrustPassport,
  sourceId: string,
): CanonicalTruthStatus {
  switch (sourceId) {
    case 'NPPES_API':
      return passport.truth.identity.status;
    case 'OIG_LEIE':
      return passport.truth.safety.status;
    case 'PECOS_PUBLIC':
      return passport.truth.eligibility.status;
    case 'STATE_BOARD':
      return passport.truth.authority.status;
    default:
      return 'PENDING';
  }
}

function confidenceLabelForSource(
  passport: TrustPassport,
  sourceId: string,
): string | null {
  switch (sourceId) {
    case 'NPPES_API':
      return passport.identity.npi ? 'HIGH' : null;
    case 'OIG_LEIE':
      return passport.standing.exclusionConfidenceLabel ?? null;
    case 'PECOS_PUBLIC':
      return passport.standing.enrollmentConfidenceLabel ?? null;
    case 'STATE_BOARD':
      return findLicensureCredential(passport, sourceId)?.claimConfidenceLabel ?? null;
    default:
      return null;
  }
}

function observedAtForSource(
  passport: TrustPassport,
  check: CanonicalSourceCoverage,
): string | null {
  switch (check.sourceId) {
    case 'NPPES_API':
      return check.checkedAt ?? passport.lastCheckedAt ?? null;
    case 'OIG_LEIE':
      return passport.standing.exclusionCheckedAt ?? check.checkedAt ?? null;
    case 'PECOS_PUBLIC':
      return passport.standing.enrollmentObservedAt ?? check.checkedAt ?? null;
    case 'STATE_BOARD': {
      const licensureCredential = findLicensureCredential(passport, check.sourceId);
      return licensureCredential?.observedAt ?? licensureCredential?.verifiedAt ?? check.checkedAt ?? null;
    }
    default:
      return check.checkedAt ?? null;
  }
}

function credentialExpiresAtForSource(
  passport: TrustPassport,
  sourceId: string,
): string | null {
  if (sourceId !== 'STATE_BOARD') {
    return null;
  }

  return findLicensureCredential(passport, sourceId)?.expiresAt ?? null;
}

function reviewRequiredForSource(
  passport: TrustPassport,
  sourceId: string,
): boolean {
  switch (sourceId) {
    case 'OIG_LEIE':
      return passport.standing.exclusionStatus === 'POSSIBLE_MATCH';
    case 'PECOS_PUBLIC':
      return passport.truth.eligibility.status === 'REVIEW REQUIRED';
    case 'STATE_BOARD':
      return Boolean(findLicensureCredential(passport, sourceId)?.reviewRequired)
        || passport.truth.authority.status === 'REVIEW REQUIRED';
    default:
      return false;
  }
}

function buildManifestFreshness(
  check: CanonicalSourceCoverage,
  observedAt: string | null,
  expiresAt: string | null,
): NonNullable<EmployerPacketSourceManifestEntry['freshness']> {
  return Object.freeze({
    status:
      check.state === 'stale'
        ? 'stale'
        : check.state === 'checked' && (observedAt || check.checkedAt)
          ? 'current'
          : 'unknown',
    checkedAt: check.checkedAt ?? null,
    observedAt,
    expiresAt,
    freshnessWindowHours: check.freshnessWindowHours ?? null,
  });
}

function buildManifestProvenance(
  check: CanonicalSourceCoverage,
): NonNullable<EmployerPacketSourceManifestEntry['provenance']> {
  return Object.freeze({
    artifactId: check.artifactId ?? null,
    artifactIds: Object.freeze(dedupeSorted(check.proof?.artifactIds ?? [])),
    receiptIds: Object.freeze(dedupeSorted(check.proof?.receiptIds ?? [])),
    sourceUrl: check.sourceUrl ?? null,
    rawArtifactRef: check.rawArtifactRef ?? null,
    checksum: check.checksum ?? null,
    parserVersion: check.parserVersion ?? null,
  });
}

function buildManifestSources(
  passport: TrustPassport,
  launchSpineChecks: readonly CanonicalSourceCoverage[],
): EmployerPacketSourceManifestEntry[] {
  return launchSpineChecks.map((check) => {
    const observedAt = observedAtForSource(passport, check);
    const credentialExpiresAt = credentialExpiresAtForSource(passport, check.sourceId);
    const expiresAt = credentialExpiresAt ?? addHours(observedAt ?? check.checkedAt ?? null, check.freshnessWindowHours ?? null);
    const provenance = buildManifestProvenance(check);

    return {
      sourceId: check.sourceId,
      truthStatus: truthStatusForSource(passport, check.sourceId),
      state: check.state,
      reason: check.reason,
      checkedAt: check.checkedAt ?? null,
      observedAt,
      expiresAt,
      ...(credentialExpiresAt ? { credentialExpiresAt } : {}),
      freshness: buildManifestFreshness(check, observedAt, expiresAt),
      provenance,
      parserVersion: check.parserVersion ?? null,
      checksum: check.checksum ?? null,
      sourceUrl: check.sourceUrl ?? null,
      rawArtifactRef: check.rawArtifactRef ?? null,
      freshnessWindowHours: check.freshnessWindowHours ?? null,
      confidenceLabel: confidenceLabelForSource(passport, check.sourceId),
      reviewRequired: reviewRequiredForSource(passport, check.sourceId),
      artifactId: check.artifactId ?? null,
      artifactIds: [...provenance.artifactIds],
      receiptIds: [...provenance.receiptIds],
    };
  });
}

function buildArtifactReferences(
  manifestSources: readonly EmployerPacketSourceManifestEntry[],
): EmployerPacketArtifactReference[] {
  const seen = new Set<string>();
  const references: EmployerPacketArtifactReference[] = [];

  for (const source of manifestSources) {
    for (const artifactId of source.artifactIds) {
      const key = `${source.sourceId}:${artifactId}`;
      if (seen.has(key)) {
        continue;
      }
      seen.add(key);

      references.push({
        sourceId: source.sourceId,
        artifactId,
        checksum: source.artifactId === artifactId ? source.checksum : null,
        parserVersion: source.artifactId === artifactId ? source.parserVersion : null,
        sourceUrl: source.artifactId === artifactId ? source.sourceUrl : null,
        rawArtifactRef: source.rawArtifactRef ?? artifactId,
      });
    }
  }

  return references.sort((left, right) => (
    left.sourceId.localeCompare(right.sourceId) || left.artifactId.localeCompare(right.artifactId)
  ));
}

function buildReceiptReferences(
  manifestSources: readonly EmployerPacketSourceManifestEntry[],
): EmployerPacketReceiptReference[] {
  const seen = new Set<string>();
  const references: EmployerPacketReceiptReference[] = [];

  for (const source of manifestSources) {
    for (const receiptId of source.receiptIds) {
      const key = `${source.sourceId}:${receiptId}`;
      if (seen.has(key)) {
        continue;
      }
      seen.add(key);
      references.push({
        sourceId: source.sourceId,
        receiptId,
      });
    }
  }

  return references.sort((left, right) => (
    left.sourceId.localeCompare(right.sourceId) || left.receiptId.localeCompare(right.receiptId)
  ));
}

export function buildEmployerEvidencePacket(input: {
  passport: TrustPassport;
  employerId: string;
  exportedAt?: string;
}): EmployerEvidencePacketV1 {
  const exportedAt = input.exportedAt ?? new Date().toISOString();
  const launchSpineChecks = resolveLaunchSpineCoverage(input.passport);
  const sourceCoverageSummary = summarizeCanonicalSourceCoverage(launchSpineChecks);
  const manifestSources = buildManifestSources(input.passport, launchSpineChecks);
  const artifactReferences = buildArtifactReferences(manifestSources);
  const receiptReferences = buildReceiptReferences(manifestSources);
  const freshness = input.passport.trustPosture.freshness;

  const manifest: EmployerEvidencePacketManifestV1 = {
    schema: 'vitalcv.employer.packet-manifest.v1',
    packetSchema: 'vitalcv.employer.packet.v1',
    exportedAt,
    exportedBy: input.employerId,
    entityId: input.passport.entityId,
    clinicianNpi: input.passport.npi ?? '',
    bundleFiles: EMPLOYER_EVIDENCE_PACKET_BUNDLE_FILES,
    receiptReferences,
    artifactReferences,
    sourceCoverage: input.passport.sourceCoverage,
    sourceCoverageSummary,
    freshness,
    status: {
      truth: input.passport.truth,
      freshness,
      readiness: {
        status: input.passport.readiness.status,
        score: input.passport.readiness.score,
        readiness_score: input.passport.readiness.readiness_score,
        level: input.passport.readiness.level,
        blockers: input.passport.readiness.blockers,
      },
      sourceCoverageSummary,
    },
    sources: manifestSources,
  };

  return {
    schema: 'vitalcv.employer.packet.v1',
    exportedAt,
    exportedBy: input.employerId,
    entityId: input.passport.entityId,
    clinicianNpi: input.passport.npi ?? '',
    displayName: input.passport.identity.displayName,
    truth: input.passport.truth,
    manifest,
    receiptReferences,
    artifactReferences,
    sourceCoverageSummary,
    freshness,
    identity: {
      npi: input.passport.identity.npi ?? null,
      displayName: input.passport.identity.displayName,
      specialty: input.passport.identity.specialty ?? null,
      source: 'CMS NPPES',
      checkedAt: input.passport.lastCheckedAt ?? null,
      status: input.passport.identity.npi ? 'confirmed' : 'missing',
      truthStatus: input.passport.truth.identity.status,
    },
    safety: {
      exclusionStatus: input.passport.standing.exclusionStatus,
      exclusionCheckedAt: input.passport.standing.exclusionCheckedAt ?? null,
      exclusionConfidence: input.passport.standing.exclusionConfidenceLabel ?? null,
      source: 'OIG LEIE',
      isClear: input.passport.standing.exclusionClear,
      negativeFindings: input.passport.standing.negativeFindings.filter(
        (finding) => !/pecos|enrollment|medicare/i.test(finding),
      ),
      truthStatus: input.passport.truth.safety.status,
    },
    authority: {
      truthStatus: input.passport.truth.authority.status,
      credentials: input.passport.authority.credentials.map((credential) => ({
        domain: credential.domain,
        status: credential.status,
        jurisdiction: credential.jurisdiction ?? null,
        issuerName: credential.issuerName ?? null,
        sourceId: credential.sourceId ?? null,
        observedAt: credential.observedAt ?? null,
        verifiedAt: credential.verifiedAt ?? null,
        expiresAt: credential.expiresAt ?? null,
        freshnessDays: credential.dataFreshnessLabel ?? null,
        confidence: credential.claimConfidenceLabel ?? null,
        claimCode: credential.authorityClaimCode ?? null,
        reviewRequired: credential.reviewRequired ?? false,
      })),
      summary: {
        active: input.passport.authority.summary.active,
        missing: input.passport.authority.summary.missing,
      },
    },
    eligibility: {
      pecosEnrollmentStatus: input.passport.standing.pecosEnrollmentStatus,
      enrollmentNote: input.passport.standing.enrollmentNote ?? null,
      enrollmentDataVersion: input.passport.standing.enrollmentDataVersion ?? null,
      enrollmentDataFreshness: input.passport.standing.enrollmentDataFreshness ?? 'Quarterly',
      enrollmentCheckedAt: input.passport.standing.enrollmentObservedAt ?? null,
      enrollmentConfidence: input.passport.standing.enrollmentConfidenceLabel ?? null,
      source: input.passport.standing.enrollmentSourceLabel ?? 'CMS PECOS',
      truthStatus: input.passport.truth.eligibility.status,
    },
    readiness: {
      status: input.passport.readiness.status,
      score: input.passport.readiness.score,
      readiness_score: input.passport.readiness.readiness_score,
      level: input.passport.readiness.level,
      estimatedStartDays: input.passport.readiness.estimatedStartDays,
      blockers: input.passport.readiness.blockers,
      nextActions: input.passport.readiness.nextActions,
    },
    sourceCoverage: input.passport.sourceCoverage,
  };
}

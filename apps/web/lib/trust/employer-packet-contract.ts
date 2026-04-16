import {
  CANONICAL_TRUTH_STATUSES,
  isCanonicalSourceCoverageState,
  summarizeCanonicalSourceCoverage,
  type CanonicalSourceCoverageReport,
  type CanonicalSourceCoverageState,
  type CanonicalSourceCoverageSummary,
  type CanonicalTruthStatus,
} from '@vitalcv/trust-state';
import { normalizePassportSourceCoverageChecks } from '@/lib/trust/source-coverage';
import { hasReceiptBackedManifest } from '@/lib/trust/ui-truth-integrity';

type UnknownRecord = Record<string, unknown>;

export interface EmployerPacketSourceManifestEntry {
  sourceId: string;
  truthStatus: CanonicalTruthStatus;
  state: CanonicalSourceCoverageState;
  reason: string;
  checkedAt: string | null;
  observedAt: string | null;
  expiresAt: string | null;
  credentialExpiresAt?: string | null;
  freshness: {
    status: 'current' | 'stale' | 'unknown';
    checkedAt: string | null;
    observedAt: string | null;
    expiresAt: string | null;
    freshnessWindowHours: number | null;
  };
  provenance: {
    artifactId: string | null;
    artifactIds: string[];
    receiptIds: string[];
    sourceUrl: string | null;
    rawArtifactRef: string | null;
    checksum: string | null;
    parserVersion: string | null;
  };
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

export interface EmployerEvidencePacket {
  schema: string;
  exportedAt: string;
  exportedBy: string;
  entityId: string;
  clinicianNpi: string;
  displayName: string;
  truth: Record<string, { status: CanonicalTruthStatus }>;
  manifest: {
    schema: string;
    packetSchema: string;
    exportedAt: string;
    exportedBy: string;
    entityId: string;
    clinicianNpi: string;
    bundleFiles: string[];
    receiptReferences: Array<{ sourceId: string; receiptId: string }>;
    artifactReferences: Array<{ sourceId: string; artifactId: string }>;
    sourceCoverage: CanonicalSourceCoverageReport;
    sourceCoverageSummary: CanonicalSourceCoverageSummary;
    freshness: unknown;
    status: unknown;
    sources: EmployerPacketSourceManifestEntry[];
  };
  receiptReferences: Array<{ sourceId: string; receiptId: string }>;
  artifactReferences: Array<{ sourceId: string; artifactId: string }>;
  sourceCoverageSummary: CanonicalSourceCoverageSummary;
  freshness: unknown;
  identity: unknown;
  safety: unknown;
  authority: unknown;
  eligibility: unknown;
  readiness: unknown;
  sourceCoverage: CanonicalSourceCoverageReport;
  decisionPosture?: unknown;
}

function isRecord(value: unknown): value is UnknownRecord {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function hasOwn(target: UnknownRecord, key: string): boolean {
  return Object.prototype.hasOwnProperty.call(target, key);
}

function isString(value: unknown): value is string {
  return typeof value === 'string';
}

function isNullableString(value: unknown): value is string | null | undefined {
  return typeof value === 'string' || value === null || typeof value === 'undefined';
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every(isString);
}

function isNullableNumber(value: unknown): value is number | null | undefined {
  return value === null || typeof value === 'undefined' || (typeof value === 'number' && Number.isFinite(value));
}

function isCanonicalTruthStatus(value: unknown): value is CanonicalTruthStatus {
  return CANONICAL_TRUTH_STATUSES.includes(value as CanonicalTruthStatus);
}

function isTruthSet(value: unknown): value is EmployerEvidencePacket['truth'] {
  if (!isRecord(value)) {
    return false;
  }

  return ['identity', 'safety', 'authority', 'eligibility'].every((dimension) => (
    isRecord(value[dimension]) && isCanonicalTruthStatus(value[dimension].status)
  ));
}

function isReceiptReference(value: unknown): value is { sourceId: string; receiptId: string } {
  return isRecord(value) && isString(value.sourceId) && isString(value.receiptId);
}

function isArtifactReference(value: unknown): value is { sourceId: string; artifactId: string } {
  return isRecord(value) && isString(value.sourceId) && isString(value.artifactId);
}

function isManifestSource(value: unknown): value is EmployerPacketSourceManifestEntry {
  if (!isRecord(value)) {
    return false;
  }

  if (
    !isString(value.sourceId)
    || !isCanonicalTruthStatus(value.truthStatus)
    || !isCanonicalSourceCoverageState(value.state)
    || !isString(value.reason)
    || !hasOwn(value, 'checkedAt')
    || !hasOwn(value, 'observedAt')
    || !hasOwn(value, 'expiresAt')
    || !hasOwn(value, 'freshness')
    || !hasOwn(value, 'provenance')
    || !hasOwn(value, 'parserVersion')
    || !hasOwn(value, 'checksum')
    || !hasOwn(value, 'artifactIds')
    || !hasOwn(value, 'receiptIds')
  ) {
    return false;
  }

  if (
    !isNullableString(value.checkedAt)
    || !isNullableString(value.observedAt)
    || !isNullableString(value.expiresAt)
    || !isNullableString(value.credentialExpiresAt)
    || !isNullableString(value.parserVersion)
    || !isNullableString(value.checksum)
    || !isNullableString(value.sourceUrl)
    || !isNullableString(value.rawArtifactRef)
    || !isNullableNumber(value.freshnessWindowHours)
    || !isNullableString(value.confidenceLabel)
    || typeof value.reviewRequired !== 'boolean'
    || !isNullableString(value.artifactId)
    || !isStringArray(value.artifactIds)
    || !isStringArray(value.receiptIds)
  ) {
    return false;
  }

  if (!isRecord(value.freshness) || !isRecord(value.provenance)) {
    return false;
  }

  return (
    (value.freshness.status === 'current' || value.freshness.status === 'stale' || value.freshness.status === 'unknown')
    && isNullableString(value.freshness.checkedAt)
    && isNullableString(value.freshness.observedAt)
    && isNullableString(value.freshness.expiresAt)
    && isNullableNumber(value.freshness.freshnessWindowHours)
    && isNullableString(value.provenance.artifactId)
    && isStringArray(value.provenance.artifactIds)
    && isStringArray(value.provenance.receiptIds)
    && isNullableString(value.provenance.sourceUrl)
    && isNullableString(value.provenance.rawArtifactRef)
    && isNullableString(value.provenance.checksum)
    && isNullableString(value.provenance.parserVersion)
  );
}

export function normalizeEmployerEvidencePacket(
  value: unknown,
): EmployerEvidencePacket | null {
  if (
    !isRecord(value)
    || !isTruthSet(value.truth)
    || !isRecord(value.manifest)
    || !isRecord(value.sourceCoverage)
    || !isRecord(value.manifest.sourceCoverage)
  ) {
    return null;
  }

  if (
    !isString(value.schema)
    || !isString(value.exportedAt)
    || !isString(value.exportedBy)
    || !isString(value.entityId)
    || !isString(value.clinicianNpi)
    || !isString(value.displayName)
    || !Array.isArray(value.manifest.sources)
    || !value.manifest.sources.every(isManifestSource)
    || !Array.isArray(value.manifest.bundleFiles)
    || !value.manifest.bundleFiles.every(isString)
    || !Array.isArray(value.manifest.receiptReferences)
    || !value.manifest.receiptReferences.every(isReceiptReference)
    || !Array.isArray(value.manifest.artifactReferences)
    || !value.manifest.artifactReferences.every(isArtifactReference)
    || !Array.isArray(value.receiptReferences)
    || !value.receiptReferences.every(isReceiptReference)
    || !Array.isArray(value.artifactReferences)
    || !value.artifactReferences.every(isArtifactReference)
    || !isString(value.manifest.schema)
    || !isString(value.manifest.packetSchema)
    || !isString(value.manifest.exportedAt)
    || !isString(value.manifest.exportedBy)
    || !isString(value.manifest.entityId)
    || !isString(value.manifest.clinicianNpi)
  ) {
    return null;
  }

  const manifest = value.manifest as UnknownRecord;
  const normalizedPacketCoverageChecks = normalizePassportSourceCoverageChecks(
    value.sourceCoverage as CanonicalSourceCoverageReport,
  );
  const normalizedManifestCoverageChecks = normalizePassportSourceCoverageChecks(
    manifest.sourceCoverage as CanonicalSourceCoverageReport,
  );
  const normalizedPacketCoverage: CanonicalSourceCoverageReport = {
    checks: normalizedPacketCoverageChecks,
    summary: summarizeCanonicalSourceCoverage(normalizedPacketCoverageChecks),
  };
  const normalizedManifestCoverage: CanonicalSourceCoverageReport = {
    checks: normalizedManifestCoverageChecks,
    summary: summarizeCanonicalSourceCoverage(normalizedManifestCoverageChecks),
  };

  if (!hasReceiptBackedManifest({
    manifest: {
      sources: manifest.sources as EmployerPacketSourceManifestEntry[],
      receiptReferences: manifest.receiptReferences as Array<{ sourceId: string; receiptId: string }>,
    },
    receiptReferences: value.receiptReferences as Array<{ sourceId: string; receiptId: string }>,
  })) {
    return null;
  }

  return {
    schema: value.schema as string,
    exportedAt: value.exportedAt as string,
    exportedBy: value.exportedBy as string,
    entityId: value.entityId as string,
    clinicianNpi: value.clinicianNpi as string,
    displayName: value.displayName as string,
    truth: value.truth as EmployerEvidencePacket['truth'],
    manifest: {
      schema: manifest.schema as string,
      packetSchema: manifest.packetSchema as string,
      exportedAt: manifest.exportedAt as string,
      exportedBy: manifest.exportedBy as string,
      entityId: manifest.entityId as string,
      clinicianNpi: manifest.clinicianNpi as string,
      bundleFiles: [...(manifest.bundleFiles as string[])],
      receiptReferences: [...(manifest.receiptReferences as Array<{ sourceId: string; receiptId: string }>)],
      artifactReferences: [...(manifest.artifactReferences as Array<{ sourceId: string; artifactId: string }>)],
      sourceCoverage: normalizedManifestCoverage,
      sourceCoverageSummary: normalizedManifestCoverage.summary,
      freshness: manifest.freshness,
      status: manifest.status,
      sources: [...(manifest.sources as EmployerPacketSourceManifestEntry[])],
    },
    receiptReferences: [...(value.receiptReferences as Array<{ sourceId: string; receiptId: string }>)],
    artifactReferences: [...(value.artifactReferences as Array<{ sourceId: string; artifactId: string }>)],
    freshness: value.freshness,
    identity: value.identity,
    safety: value.safety,
    authority: value.authority,
    eligibility: value.eligibility,
    readiness: value.readiness,
    sourceCoverage: normalizedPacketCoverage,
    sourceCoverageSummary: normalizedPacketCoverage.summary,
    ...(typeof value.decisionPosture === 'undefined' ? {} : { decisionPosture: value.decisionPosture }),
  } satisfies EmployerEvidencePacket;
}

export function assertEmployerEvidencePacket(
  value: unknown,
  context = 'employer evidence packet',
): EmployerEvidencePacket {
  const packet = normalizeEmployerEvidencePacket(value);
  if (!packet) {
    throw new Error(`Invalid ${context}.`);
  }
  return packet;
}

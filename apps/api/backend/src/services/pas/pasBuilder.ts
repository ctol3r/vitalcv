import { CrsEngine } from '@vitalcv/crs';
import type { TrustStateReceiptRecord } from '@vitalcv/psv';
import prisma from '../../graphql/prisma_client';
import { sha256Hex } from '../../utils/deterministic';
import { PrismaCredentialIngestionRepository } from '../../../repositories/credentialIngestion.repo';
import { BackendCanonicalCredentialFactStore } from '../psvInterop/canonicalFactStore';
import type {
  ActiveCredentialArtifactRecord,
  ActiveVerificationArtifactRecord,
} from '../credentials/credentialIngestionTypes';

type PASStatus = 'GREEN' | 'YELLOW' | 'RED';

export interface PASCredential {
  type: string;
  issuer: string;
  license_id: string;
  status: 'ACTIVE' | 'REVOKED' | 'EXPIRED' | 'UNKNOWN';
  verified_at: string;
  expires_at: string | null;
  source_authority: string;
  immutable_hash: string;
  ttl_remaining_days: number | null;
}

export interface PASPsvReceipt {
  receipt_id: string;
  source_authority: string;
  fetched_at: string;
  ttl_seconds: number;
  revoked: boolean;
  response_hash: string;
}

export interface PASObject {
  schema: 'vitalcv.pas.v1';
  generated_at: string;
  npi_checksum: string;
  subject: {
    npi: string;
    name: string;
  };
  authority_state: {
    status: PASStatus;
    as_of: string;
    score: number;
    band: 'GREEN' | 'YELLOW' | 'RED';
    changes_since_last: 'NONE' | 'SCORE_CHANGE' | 'STATUS_CHANGE' | 'NEW_CREDENTIALS';
  };
  credentials: PASCredential[];
  psv_receipts: PASPsvReceipt[];
  audit_trail_pointer: {
    merkle_root: string | null;
    latest_artifact_id: string;
    snapshot_count: number;
    generated_at: string;
  };
}

type ReceiptRow = {
  receiptId: string;
  sourceAuthority: string;
  licenseId: string;
  fetchedAt: Date;
  ttlSeconds: number;
  revoked: boolean;
  responseHash: string;
  lane: string | null;
  verificationCheck: string | null;
  verificationOutcome: string | null;
  failureReason: string | null;
  source: string | null;
  attestorId: string | null;
  verificationRequestId: string | null;
};

type RunArtifact = {
  artifactJson: unknown;
};

type VerificationRunSummary = {
  credentialHashes: string[];
  verificationHashes: string[];
  statusBySource: Record<string, string>;
};

const repository = new PrismaCredentialIngestionRepository();
const canonicalFactStore = new BackendCanonicalCredentialFactStore();

function ttlRemainingDays(deadlineIso: string | null): number | null {
  if (!deadlineIso) {
    return null;
  }

  const deadline = Date.parse(deadlineIso);
  if (!Number.isFinite(deadline)) {
    return null;
  }

  const deltaMs = deadline - Date.now();
  if (deltaMs <= 0) {
    return 0;
  }

  return Math.ceil(deltaMs / 86_400_000);
}

function mapCredentialType(value: string): string {
  switch (value) {
    case 'NPI_ENROLLMENT':
      return 'NPI_ENROLLMENT';
    case 'OIG_EXCLUSION':
      return 'SANCTIONS_CHECK';
    case 'STATE_LICENSE':
      return 'STATE_LICENSE';
    default:
      return 'PRIMARY_SOURCE_VERIFICATION';
  }
}

function mapCredentialStatus(value: string): PASCredential['status'] {
  const normalized = value.trim().toUpperCase();
  if (normalized === 'ACTIVE' || normalized === 'VERIFIED' || normalized === 'CLEAR') {
    return 'ACTIVE';
  }
  if (normalized === 'REVOKED' || normalized === 'SUSPENDED' || normalized === 'EXCLUDED') {
    return 'REVOKED';
  }
  if (normalized === 'EXPIRED') {
    return 'EXPIRED';
  }
  return 'UNKNOWN';
}

function readCredentialName(
  credentialArtifacts: readonly ActiveCredentialArtifactRecord[],
): string {
  const identity = credentialArtifacts.find(
    ({ artifact }) => artifact.credential_type === 'NPI_ENROLLMENT',
  );
  const metadata = identity?.artifact.metadata ?? {};
  if (typeof metadata.full_name === 'string' && metadata.full_name.trim().length > 0) {
    return metadata.full_name.trim();
  }

  const first = typeof metadata.first_name === 'string' ? metadata.first_name.trim() : '';
  const last = typeof metadata.last_name === 'string' ? metadata.last_name.trim() : '';
  return [first, last].filter(Boolean).join(' ') || 'Verified Clinician';
}

function readLicenseId(artifact: ActiveCredentialArtifactRecord): string {
  const metadata = artifact.artifact.metadata ?? {};
  if (typeof metadata.license_number === 'string' && metadata.license_number.trim().length > 0) {
    return metadata.license_number.trim();
  }
  if (artifact.artifact.credential_type === 'NPI_ENROLLMENT') {
    return artifact.artifact.subject_npi;
  }
  return artifact.artifact.issuer_org_id;
}

function latestVerificationByCredentialHash(
  verificationArtifacts: readonly ActiveVerificationArtifactRecord[],
): Map<string, ActiveVerificationArtifactRecord> {
  const latest = new Map<string, ActiveVerificationArtifactRecord>();

  for (const artifact of verificationArtifacts) {
    const key = artifact.artifact.related_credential_hash;
    const current = latest.get(key);
    if (!current || artifact.artifact.verified_at > current.artifact.verified_at) {
      latest.set(key, artifact);
    }
  }

  return latest;
}

function toReceiptRecord(row: ReceiptRow): TrustStateReceiptRecord {
  return {
    receipt_id: row.receiptId,
    fetched_at: row.fetchedAt.toISOString(),
    ttl_seconds: row.ttlSeconds,
    revoked: row.revoked,
    lane: (row.lane as TrustStateReceiptRecord['lane']) ?? undefined,
    verification_check: row.verificationCheck ?? undefined,
    verification_outcome:
      (row.verificationOutcome as TrustStateReceiptRecord['verification_outcome']) ?? undefined,
    failure_reason: row.failureReason ?? undefined,
    source: (row.source as TrustStateReceiptRecord['source']) ?? undefined,
    attestor_id: row.attestorId ?? undefined,
    verification_request_id: row.verificationRequestId ?? undefined,
  };
}

function latestIso(values: readonly (string | null | undefined)[], fallback: string): string {
  let latest = Number.NEGATIVE_INFINITY;

  for (const value of values) {
    if (!value) {
      continue;
    }
    const timestamp = Date.parse(value);
    if (Number.isFinite(timestamp)) {
      latest = Math.max(latest, timestamp);
    }
  }

  return Number.isFinite(latest) ? new Date(latest).toISOString() : fallback;
}

function buildRunSummary(artifacts: readonly RunArtifact[]): VerificationRunSummary {
  const credentialHashes: string[] = [];
  const verificationHashes: string[] = [];
  const statusBySource: Record<string, string> = {};

  for (const entry of artifacts) {
    const artifact = entry.artifactJson as Record<string, unknown>;
    if (artifact.kind === 'credential_artifact') {
      if (typeof artifact.credential_hash === 'string') {
        credentialHashes.push(artifact.credential_hash);
      }
      continue;
    }

    if (artifact.kind === 'verification_artifact') {
      if (typeof artifact.evidence_hash === 'string') {
        verificationHashes.push(artifact.evidence_hash);
      }
      if (
        typeof artifact.source_name === 'string' &&
        typeof artifact.verification_method === 'string'
      ) {
        statusBySource[artifact.source_name] = artifact.verification_method;
      }
    }
  }

  credentialHashes.sort((left, right) => left.localeCompare(right));
  verificationHashes.sort((left, right) => left.localeCompare(right));

  return {
    credentialHashes,
    verificationHashes,
    statusBySource,
  };
}

function detectChanges(
  current: VerificationRunSummary | null,
  previous: VerificationRunSummary | null,
): PASObject['authority_state']['changes_since_last'] {
  if (!current || current.credentialHashes.length === 0) {
    return 'NONE';
  }

  if (!previous) {
    return 'NEW_CREDENTIALS';
  }

  if (JSON.stringify(current.credentialHashes) !== JSON.stringify(previous.credentialHashes)) {
    return 'NEW_CREDENTIALS';
  }

  if (JSON.stringify(current.statusBySource) !== JSON.stringify(previous.statusBySource)) {
    return 'STATUS_CHANGE';
  }

  if (JSON.stringify(current.verificationHashes) !== JSON.stringify(previous.verificationHashes)) {
    return 'SCORE_CHANGE';
  }

  return 'NONE';
}

function deriveBand(score: number, failClosed: boolean): PASStatus {
  if (failClosed || score < 50) {
    return 'RED';
  }
  if (score < 80) {
    return 'YELLOW';
  }
  return 'GREEN';
}

export async function buildPASObject(npi: string): Promise<PASObject> {
  const generatedAt = new Date().toISOString();

  const [credentialArtifactsResult, verificationArtifactsResult, receipts, latestArtifact, runs] =
    await Promise.all([
      repository.findActiveCredentialsByNpi(npi).catch(() => null),
      repository.findVerificationArtifactsByNpi(npi).catch(() => null),
      prisma.psvReceipt.findMany({
        where: { clinicianId: npi },
        orderBy: { fetchedAt: 'desc' },
        take: 10,
        select: {
          receiptId: true,
          sourceAuthority: true,
          licenseId: true,
          fetchedAt: true,
          ttlSeconds: true,
          revoked: true,
          responseHash: true,
          lane: true,
          verificationCheck: true,
          verificationOutcome: true,
          failureReason: true,
          source: true,
          attestorId: true,
          verificationRequestId: true,
        },
      }),
      prisma.verificationArtifact.findFirst({
        where: { npi },
        orderBy: [
          { verifiedAt: 'desc' },
          { createdAt: 'desc' },
        ],
        select: {
          id: true,
          merkleRoot: true,
        },
      }),
      prisma.verificationRun.findMany({
        where: { provider: { npi } },
        orderBy: { retrievedAtUtc: 'desc' },
        take: 2,
        include: {
          artifacts: {
            select: {
              artifactJson: true,
            },
          },
        },
      }),
    ]);

  const credentialArtifacts = credentialArtifactsResult ?? [];
  const verificationArtifacts = verificationArtifactsResult ?? [];
  const snapshotCount = credentialArtifacts.length + verificationArtifacts.length + receipts.length;
  const provenanceValid =
    credentialArtifactsResult !== null &&
    verificationArtifactsResult !== null &&
    credentialArtifacts.length > 0 &&
    verificationArtifacts.length > 0;

  const crsEngine = new CrsEngine({
    receipts: {
      async listByClinician(clinician_id: string): Promise<readonly TrustStateReceiptRecord[]> {
        const rows = await prisma.psvReceipt.findMany({
          where: { clinicianId: clinician_id },
          select: {
            receiptId: true,
            fetchedAt: true,
            ttlSeconds: true,
            revoked: true,
            lane: true,
            verificationCheck: true,
            verificationOutcome: true,
            failureReason: true,
            source: true,
            attestorId: true,
            verificationRequestId: true,
          },
        });
        return rows.map((row) =>
          toReceiptRecord({
            ...row,
            receiptId: row.receiptId,
            sourceAuthority: '',
            licenseId: '',
            fetchedAt: row.fetchedAt,
            ttlSeconds: row.ttlSeconds,
            revoked: row.revoked,
            responseHash: '',
            lane: row.lane,
            verificationCheck: row.verificationCheck,
            verificationOutcome: row.verificationOutcome,
            failureReason: row.failureReason,
            source: row.source,
            attestorId: row.attestorId,
            verificationRequestId: row.verificationRequestId,
          }),
        );
      },
    },
    acceptances: {
      async existsForClinician(clinician_id: string): Promise<boolean> {
        const row = await prisma.acceptance.findFirst({
          where: { subjectId: clinician_id },
          select: { id: true },
        });
        return row !== null;
      },
    },
  });

  const [crsOutput, canonicalStatus] = await Promise.all([
    crsEngine.computeForClinician({
      clinician_id: npi,
      as_of: generatedAt,
    }),
    canonicalFactStore.getStatus(npi),
  ]);

  const verificationByCredential = latestVerificationByCredentialHash(verificationArtifacts);
  const credentials: PASCredential[] = credentialArtifacts.map((entry) => {
    const verification = verificationByCredential.get(entry.artifact.credential_hash);
    return {
      type: mapCredentialType(entry.artifact.credential_type),
      issuer: entry.artifact.issuer_org_id,
      license_id: readLicenseId(entry),
      status: mapCredentialStatus(entry.artifact.status),
      verified_at: verification?.artifact.verified_at ?? entry.artifact.issued_at,
      expires_at: entry.artifact.expires_at,
      source_authority: entry.artifact.source_name,
      immutable_hash: entry.artifact.credential_hash,
      ttl_remaining_days: ttlRemainingDays(verification?.artifact.fresh_until ?? null),
    };
  });

  const psvReceipts: PASPsvReceipt[] = receipts.map((row) => ({
    receipt_id: row.receiptId,
    source_authority: row.sourceAuthority,
    fetched_at: row.fetchedAt.toISOString(),
    ttl_seconds: row.ttlSeconds,
    revoked: row.revoked,
    response_hash: row.responseHash,
  }));

  const receiptIssues = receipts.length === 0 || crsOutput.band === 'RED';
  const score = provenanceValid
    ? Math.min(canonicalStatus.readinessScore ?? crsOutput.score, crsOutput.score)
    : Math.min(canonicalStatus.readinessScore ?? crsOutput.score, 25);
  const band = deriveBand(score, !provenanceValid || receiptIssues);

  const currentRun = runs[0] ? buildRunSummary(runs[0].artifacts) : null;
  const previousRun = runs[1] ? buildRunSummary(runs[1].artifacts) : null;

  return {
    schema: 'vitalcv.pas.v1',
    generated_at: generatedAt,
    npi_checksum: sha256Hex(npi),
    subject: {
      npi,
      name: readCredentialName(credentialArtifacts),
    },
    authority_state: {
      status: band,
      as_of: latestIso(
        [
          canonicalStatus.lastRun,
          crsOutput.last_verified_at,
          ...verificationArtifacts.map((artifact) => artifact.artifact.verified_at),
          ...receipts.map((receipt) => receipt.fetchedAt.toISOString()),
        ],
        generatedAt,
      ),
      score,
      band,
      changes_since_last: detectChanges(currentRun, previousRun),
    },
    credentials,
    psv_receipts: psvReceipts,
    audit_trail_pointer: {
      merkle_root: latestArtifact?.merkleRoot ?? null,
      latest_artifact_id: latestArtifact?.id ?? 'none',
      snapshot_count: snapshotCount,
      generated_at: generatedAt,
    },
  };
}

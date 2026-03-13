import prisma from '../../graphql/prisma_client';
import { buildCanonicalClaimsFromArtifact, buildClaimDigests, buildSelectiveDisclosurePlaceholder } from '../auditBundleClaims';
import { generateClaimProof } from '../selectiveProofEngine';
import { validateMerkleIntegrity } from '../merkleIntegrity';
import { sha256Hex, stableStringify } from '../../utils/deterministic';
import type { ClinicianTrustState } from './trustStateEngine';

type ProofArtifactRecord = {
  id: string;
  npi: string;
  source: string;
  status: string;
  rawPayload: unknown;
  checksum: string;
  merkleRoot: string | null;
  claimHashes: unknown;
  verifiedAt: Date;
  expiresAt: Date | null;
  monitoring: boolean;
  lifecycleState: string;
};

type MonitoringStatus =
  | 'NO_ARTIFACTS'
  | 'NOT_MONITORED'
  | 'PARTIAL_MONITORING'
  | 'ACTIVE_MONITORING';

export type TrustProofClaimDescriptor = {
  claimType: string;
  hash: string;
  proofAvailable: boolean;
  leafHash?: string;
  leafIndex?: number;
  proofPath?: string[];
};

export type TrustProofArtifact = {
  artifactId: string;
  issuer: string;
  sourceChecksum: string;
  artifactHash: string;
  status: string;
  lifecycleState: string;
  verifiedAt: string;
  expiresAt: string | null;
  monitoring: boolean;
  merkleRoot: string | null;
  claimCount: number;
  claims: TrustProofClaimDescriptor[];
  selectiveDisclosure: ReturnType<typeof buildSelectiveDisclosurePlaceholder> | null;
};

export type TrustProofBundle = {
  npi: string;
  timestamp: string;
  methodologyVersion: string;
  sourceSnapshot: {
    artifactId: string;
    verifiedAt: string;
    checksum: string;
  };
  artifactHash: string;
  trustBand: string;
  readinessScore: number;
  monitoringStatus: MonitoringStatus;
  monitoringSummary: {
    monitoredArtifactCount: number;
    totalArtifactCount: number;
    coverageRate: number;
  };
  issuers: string[];
  credentialClaims: {
    redacted: true;
    selectiveDisclosure: true;
    totalClaimCount: number;
  };
  artifacts: TrustProofArtifact[];
  bundleDownloads: {
    trustProofJson: string;
    trustProofPdf: string;
    auditBundleJson: string;
    auditBundleDownload: string;
  };
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function parseTrustStateSnapshot(rawPayload: unknown): ClinicianTrustState {
  if (!isRecord(rawPayload)) {
    throw new Error('Stored trust-state snapshot is invalid.');
  }

  const trustBand = typeof rawPayload.readiness_level === 'string'
    ? rawPayload.readiness_level
    : typeof rawPayload.trustBand === 'string'
      ? rawPayload.trustBand
      : 'L0';
  const readinessScore = typeof rawPayload.readiness_score === 'number'
    ? rawPayload.readiness_score
    : typeof rawPayload.trustScore === 'number'
      ? rawPayload.trustScore
      : 0;
  const methodologyVersion = typeof rawPayload.methodology_version === 'string'
    ? rawPayload.methodology_version
    : 'unknown';
  const computedAt = typeof rawPayload.computed_at === 'string'
    ? rawPayload.computed_at
    : typeof rawPayload.computedAt === 'string'
      ? rawPayload.computedAt
      : new Date(0).toISOString();

  return {
    npi: typeof rawPayload.npi === 'string' ? rawPayload.npi : '',
    identityVerified: rawPayload.identityVerified === true,
    licensureStatus: rawPayload.licensureStatus === 'verified'
      || rawPayload.licensureStatus === 'pending'
      || rawPayload.licensureStatus === 'expired'
      || rawPayload.licensureStatus === 'unknown'
      ? rawPayload.licensureStatus
      : 'unknown',
    exclusionClear: rawPayload.exclusionClear === true,
    credentialCount: typeof rawPayload.credentialCount === 'number' ? rawPayload.credentialCount : 0,
    readiness_level: trustBand as ClinicianTrustState['readiness_level'],
    readiness_status: typeof rawPayload.readiness_status === 'string'
      ? rawPayload.readiness_status
      : '',
    readiness_score: readinessScore,
    gap_summary: Array.isArray(rawPayload.gap_summary)
      ? rawPayload.gap_summary.filter((item): item is string => typeof item === 'string')
      : [],
    methodology_version: methodologyVersion,
    computed_at: computedAt,
    trustBand: trustBand as ClinicianTrustState['trustBand'],
    trustScore: readinessScore,
    facts: [],
    gaps: Array.isArray(rawPayload.gaps)
      ? rawPayload.gaps.filter((item): item is string => typeof item === 'string')
      : [],
    computedAt: computedAt,
  };
}

function computeMonitoringStatus(monitoredArtifactCount: number, totalArtifactCount: number): MonitoringStatus {
  if (totalArtifactCount === 0) {
    return 'NO_ARTIFACTS';
  }
  if (monitoredArtifactCount === 0) {
    return 'NOT_MONITORED';
  }
  if (monitoredArtifactCount < totalArtifactCount) {
    return 'PARTIAL_MONITORING';
  }
  return 'ACTIVE_MONITORING';
}

function escapePdfText(value: string): string {
  return value
    .replace(/\\/g, '\\\\')
    .replace(/\(/g, '\\(')
    .replace(/\)/g, '\\)');
}

function wrapText(value: string, width = 90): string[] {
  if (value.length <= width) {
    return [value];
  }

  const words = value.split(/\s+/);
  const lines: string[] = [];
  let current = '';
  for (const word of words) {
    const next = current.length === 0 ? word : `${current} ${word}`;
    if (next.length > width) {
      if (current.length > 0) {
        lines.push(current);
      }
      current = word;
    } else {
      current = next;
    }
  }
  if (current.length > 0) {
    lines.push(current);
  }
  return lines;
}

function createSimplePdf(lines: string[]): Buffer {
  const contentLines = [
    'BT',
    '/F1 10 Tf',
    '72 720 Td',
    ...lines.flatMap((line, index) => (
      index === 0
        ? [`(${escapePdfText(line)}) Tj`]
        : ['0 -14 Td', `(${escapePdfText(line)}) Tj`]
    )),
    'ET',
  ];
  const stream = contentLines.join('\n');

  const objects = [
    '1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n',
    '2 0 obj\n<< /Type /Pages /Count 1 /Kids [3 0 R] >>\nendobj\n',
    '3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>\nendobj\n',
    `4 0 obj\n<< /Length ${Buffer.byteLength(stream, 'utf8')} >>\nstream\n${stream}\nendstream\nendobj\n`,
    '5 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Courier >>\nendobj\n',
  ];

  let body = '%PDF-1.4\n';
  const offsets = [0];
  for (const object of objects) {
    offsets.push(Buffer.byteLength(body, 'utf8'));
    body += object;
  }

  const xrefOffset = Buffer.byteLength(body, 'utf8');
  body += `xref\n0 ${objects.length + 1}\n`;
  body += '0000000000 65535 f \n';
  for (let index = 1; index < offsets.length; index += 1) {
    body += `${String(offsets[index]).padStart(10, '0')} 00000 n \n`;
  }
  body += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`;

  return Buffer.from(body, 'utf8');
}

export function renderTrustProofPdf(bundle: TrustProofBundle): Buffer {
  const lines = [
    'VitalCV Trust Proof',
    `NPI: ${bundle.npi}`,
    `Trust band: ${bundle.trustBand}`,
    `Readiness score: ${bundle.readinessScore}`,
    `Snapshot timestamp: ${bundle.timestamp}`,
    `Methodology version: ${bundle.methodologyVersion}`,
    `Snapshot artifact: ${bundle.sourceSnapshot.artifactId}`,
    `Snapshot checksum: ${bundle.sourceSnapshot.checksum}`,
    `Bundle hash: ${bundle.artifactHash}`,
    `Monitoring status: ${bundle.monitoringStatus}`,
    `Issuers: ${bundle.issuers.join(', ') || 'none'}`,
    `Artifacts: ${bundle.artifacts.length}`,
    `Redacted claim descriptors: ${bundle.credentialClaims.totalClaimCount}`,
  ].flatMap((line) => wrapText(line));

  for (const artifact of bundle.artifacts) {
    lines.push(...wrapText(`Artifact ${artifact.artifactId} | issuer=${artifact.issuer} | status=${artifact.status} | hash=${artifact.artifactHash}`));
    lines.push(...wrapText(`Claims=${artifact.claimCount} | monitoring=${artifact.monitoring ? 'on' : 'off'} | merkle=${artifact.merkleRoot ?? 'none'}`));
  }

  return createSimplePdf(lines);
}

export async function buildTrustProofBundle(npi: string): Promise<TrustProofBundle> {
  const snapshotArtifact = await prisma.verificationArtifact.findFirst({
    where: {
      npi,
      source: 'TRUST_STATE_ENGINE',
    },
    select: {
      id: true,
      checksum: true,
      verifiedAt: true,
      rawPayload: true,
    },
    orderBy: { verifiedAt: 'desc' },
  });

  if (!snapshotArtifact) {
    throw new Error(`Trust-state snapshot not found for NPI ${npi}`);
  }

  const trustState = parseTrustStateSnapshot(snapshotArtifact.rawPayload);

  const artifactRows = await prisma.verificationArtifact.findMany({
    where: {
      npi,
      source: { not: 'TRUST_STATE_ENGINE' },
      verifiedAt: { lte: snapshotArtifact.verifiedAt },
    },
    select: {
      id: true,
      npi: true,
      source: true,
      status: true,
      rawPayload: true,
      checksum: true,
      merkleRoot: true,
      claimHashes: true,
      verifiedAt: true,
      expiresAt: true,
      monitoring: true,
      lifecycleState: true,
    },
    orderBy: [
      { source: 'asc' },
      { verifiedAt: 'desc' },
      { id: 'asc' },
    ],
  }) as ProofArtifactRecord[];

  const latestBySource = new Map<string, ProofArtifactRecord>();
  for (const artifact of artifactRows) {
    if (!latestBySource.has(artifact.source)) {
      latestBySource.set(artifact.source, artifact);
    }
  }

  const artifacts: TrustProofArtifact[] = [];
  let totalClaimCount = 0;
  let monitoredArtifactCount = 0;
  for (const artifact of [...latestBySource.values()].sort((left, right) => left.source.localeCompare(right.source))) {
    if (artifact.monitoring) {
      monitoredArtifactCount += 1;
    }

    const integrityValid = artifact.merkleRoot
      ? validateMerkleIntegrity({
          merkleRoot: artifact.merkleRoot,
          claimHashes: artifact.claimHashes,
        })
      : false;

    if (artifact.merkleRoot && !integrityValid) {
      throw new Error(`Merkle integrity check failed for artifact ${artifact.id}`);
    }

    const canonicalClaims = buildCanonicalClaimsFromArtifact({
      npi: artifact.npi,
      status: artifact.status,
      rawPayload: artifact.rawPayload,
    });
    const claimDigests = buildClaimDigests(canonicalClaims);
    totalClaimCount += claimDigests.length;

    const claims: TrustProofClaimDescriptor[] = claimDigests.map((digest) => {
      if (!artifact.merkleRoot || !integrityValid) {
        return {
          claimType: digest.type,
          hash: digest.hash,
          proofAvailable: false,
        };
      }

      try {
        const proof = generateClaimProof({
          npi: artifact.npi,
          status: artifact.status,
          rawPayload: artifact.rawPayload,
          checksum: artifact.checksum,
          merkleRoot: artifact.merkleRoot,
          claimHashes: artifact.claimHashes,
          verifiedAt: artifact.verifiedAt,
          expiresAt: artifact.expiresAt,
        }, digest.type);

        return {
          claimType: digest.type,
          hash: digest.hash,
          proofAvailable: true,
          leafHash: proof.leafHash,
          leafIndex: proof.leafIndex,
          proofPath: proof.proofPath,
        };
      } catch {
        return {
          claimType: digest.type,
          hash: digest.hash,
          proofAvailable: false,
        };
      }
    });

    const artifactHash = sha256Hex(stableStringify({
      artifactId: artifact.id,
      source: artifact.source,
      status: artifact.status,
      checksum: artifact.checksum,
      merkleRoot: artifact.merkleRoot,
      verifiedAt: artifact.verifiedAt.toISOString(),
      expiresAt: artifact.expiresAt?.toISOString() ?? null,
      monitoring: artifact.monitoring,
      lifecycleState: artifact.lifecycleState,
      claimHashes: claimDigests.map((digest) => digest.hash),
    }));

    artifacts.push({
      artifactId: artifact.id,
      issuer: artifact.source,
      sourceChecksum: artifact.checksum,
      artifactHash,
      status: artifact.status,
      lifecycleState: artifact.lifecycleState,
      verifiedAt: artifact.verifiedAt.toISOString(),
      expiresAt: artifact.expiresAt?.toISOString() ?? null,
      monitoring: artifact.monitoring,
      merkleRoot: artifact.merkleRoot,
      claimCount: claims.length,
      claims,
      selectiveDisclosure: artifact.merkleRoot && integrityValid
        ? buildSelectiveDisclosurePlaceholder(canonicalClaims)
        : null,
    });
  }

  const coreBundle = {
    npi,
    timestamp: snapshotArtifact.verifiedAt.toISOString(),
    methodologyVersion: trustState.methodology_version,
    sourceSnapshot: {
      artifactId: snapshotArtifact.id,
      verifiedAt: snapshotArtifact.verifiedAt.toISOString(),
      checksum: snapshotArtifact.checksum,
    },
    trustBand: trustState.readiness_level,
    readinessScore: trustState.readiness_score,
    monitoringStatus: computeMonitoringStatus(monitoredArtifactCount, artifacts.length),
    monitoringSummary: {
      monitoredArtifactCount,
      totalArtifactCount: artifacts.length,
      coverageRate: artifacts.length > 0 ? Number((monitoredArtifactCount / artifacts.length).toFixed(4)) : 0,
    },
    issuers: artifacts.map((artifact) => artifact.issuer),
    credentialClaims: {
      redacted: true as const,
      selectiveDisclosure: true as const,
      totalClaimCount,
    },
    artifacts,
  };

  const artifactHash = sha256Hex(stableStringify(coreBundle));

  return {
    ...coreBundle,
    artifactHash,
    bundleDownloads: {
      trustProofJson: `/api/trust-proof/${encodeURIComponent(npi)}`,
      trustProofPdf: `/api/trust-proof/${encodeURIComponent(npi)}?format=pdf`,
      auditBundleJson: `/api/artifact/bundle/${encodeURIComponent(npi)}`,
      auditBundleDownload: `/api/artifact/bundle/${encodeURIComponent(npi)}/download`,
    },
  };
}

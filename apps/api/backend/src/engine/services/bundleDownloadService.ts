import archiver from 'archiver';
import { PassThrough } from 'stream';
import type { PsvArtifact } from '../types/psv';
import { canonicalize } from '../utils/canonicalize';
import { sha256 } from '../utils/hash';

export interface BundleContents {
  /** Canonicalized artifact JSON (deterministic key order) */
  artifactJson: string;
  /** SHA-256 integrity digest matching the artifact's integrity.artifactHash */
  integrityTxt: string;
  /** Canonicalized raw payload blob */
  rawJson: string;
  /** Human-readable README with provenance, hash algorithms, and NCQA note */
  readmeTxt: string;
}

/**
 * Build the four files that compose a PSV evidence bundle.
 *
 * artifact.json — Canonicalized PsvArtifact (sorted keys, no trailing whitespace)
 * integrity.txt — "sha256:<artifactHash>" line matching DB record
 * raw.json      — Canonicalized raw payload blob for stable replays
 * README.txt    — Provenance card: source, retrieval time, method, algorithms, NCQA window
 */
export function buildBundleContents(
  artifact: PsvArtifact,
  rawPayload: Record<string, unknown>,
): BundleContents {
  // artifact.json — canonicalized (deterministic sorted keys)
  const artifactJson = canonicalize(artifact);

  // integrity.txt — must match the stored artifactHash
  const integrityTxt = `sha256:${artifact.integrity.artifactHash}`;

  // raw.json — canonicalized raw payload for deterministic exports
  const rawJson = canonicalize(rawPayload);

  // README.txt — human-readable provenance card
  const readmeTxt = buildReadme(artifact);

  return { artifactJson, integrityTxt, rawJson, readmeTxt };
}

/**
 * Verify bundle consistency:
 * 1. artifact.json is canonicalized (re-canonicalizing produces identical output)
 * 2. integrity.txt matches the artifact's integrity.artifactHash
 * 3. raw.json deserializes to a payload whose hash matches integrity.rawPayloadHash
 * 4. README.txt includes all required provenance fields
 *
 * Returns an array of mismatch descriptions. Empty array = all checks pass.
 */
export function verifyBundleContents(bundle: BundleContents): string[] {
  const errors: string[] = [];

  // 1. artifact.json must be canonicalized
  const parsed = JSON.parse(bundle.artifactJson) as Record<string, unknown>;
  const reCanonicalized = canonicalize(parsed);
  if (reCanonicalized !== bundle.artifactJson) {
    errors.push('artifact.json is not canonicalized');
  }

  const parsedAsPsv = parsed as unknown as PsvArtifact;
  const parsedAsVerifierBundle = parsed as {
    evidenceCapture?: {
      artifactId?: string;
      integrity?: {
        checksum?: string;
        rawPayloadHash?: string;
      };
    };
  };
  const evidenceIntegrity = parsedAsVerifierBundle.evidenceCapture?.integrity;

  const parsedIntegrity = parsedAsPsv.integrity;
  const parsedRawPayloadHash = parsedAsVerifierBundle.evidenceCapture?.integrity?.rawPayloadHash
    ?? parsedAsVerifierBundle.evidenceCapture?.integrity?.checksum
    ?? parsedIntegrity?.rawPayloadHash;
  // 2-4 require an integrity-like block to be present
  if (!parsedIntegrity && !evidenceIntegrity) {
    errors.push('artifact.json missing integrity/evidence capture integrity block');
  } else {
    const expectedChecksum = evidenceIntegrity?.checksum ?? parsedIntegrity?.artifactHash;
    const expectedIntegrity = expectedChecksum ? `sha256:${expectedChecksum}` : null;
    if (bundle.integrityTxt.trim() !== expectedIntegrity) {
      errors.push(
        `integrity.txt mismatch: expected "${expectedIntegrity}", got "${bundle.integrityTxt.trim()}"`,
      );
    }

    // 3. Verify artifactHash is correct (hash of partial without integrity/evidence)
    if (parsedIntegrity) {
      const { integrity, ...partial } = parsedAsPsv;
      const recomputedArtifactHash = sha256(canonicalize(partial));
      if (recomputedArtifactHash !== parsedIntegrity.artifactHash) {
        errors.push(
          `artifactHash mismatch: recomputed "${recomputedArtifactHash}", stored "${parsedIntegrity.artifactHash}"`,
        );
      }
    }

    // 4. raw.json hash must match rawPayloadHash
    const rawParsed = JSON.parse(bundle.rawJson);
    const rawCanonicalized = canonicalize(rawParsed);
    const recomputedRawHash = sha256(rawCanonicalized);
    if (!parsedRawPayloadHash || recomputedRawHash !== parsedRawPayloadHash) {
      errors.push(
        `rawPayloadHash mismatch: recomputed "${recomputedRawHash}", stored "${parsedRawPayloadHash ?? ''}"`,
      );
    }
  }

  // 5. README.txt must include required provenance fields
  const requiredFields = [
    { label: 'Source', pattern: /Source:\s*.+/ },
    { label: 'RetrievedAt', pattern: /RetrievedAt:\s*.+/ },
    { label: 'Method', pattern: /Method:\s*.+/ },
    { label: 'Hash Algorithm', pattern: /Hash Algorithm:\s*.+/ },
    { label: 'Signature Algorithm', pattern: /Signature Algorithm:\s*.+/ },
    { label: 'NCQA Window', pattern: /NCQA.*Window/i },
  ];

  for (const { label, pattern } of requiredFields) {
    if (!pattern.test(bundle.readmeTxt)) {
      errors.push(`README.txt missing required field: ${label}`);
    }
  }

  return errors;
}

/**
 * Stream a zip archive containing the four bundle files.
 * Returns a readable stream (PassThrough) that can be piped to res.
 */
export function createBundleZipStream(
  bundle: BundleContents,
  npi: string,
): PassThrough {
  const passthrough = new PassThrough();
  const archive = archiver('zip', { zlib: { level: 9 } });

  archive.pipe(passthrough);

  const prefix = `psv-bundle-${npi}`;
  archive.append(bundle.artifactJson, { name: `${prefix}/artifact.json` });
  archive.append(bundle.integrityTxt, { name: `${prefix}/integrity.txt` });
  archive.append(bundle.rawJson, { name: `${prefix}/raw.json` });
  archive.append(bundle.readmeTxt, { name: `${prefix}/README.txt` });

  archive.finalize();

  return passthrough;
}

/**
 * Build bundle contents from a DB-level audit bundle (generateAuditBundle result).
 * This is the route-facing API: it canonicalizes the audit JSON,
 * computes integrity from the DB checksum, and builds the README from
 * metadata available on the ArtifactRecord.
 */
export function buildBundleContentsFromRecord(
  bundle: {
    npi: string;
    artifact: {
      id: string;
      source: string;
      status: string;
      checksum: string;
      verifiedAt: Date | string;
      expiresAt: Date | string | null;
      monitoring: boolean;
    };
    auditMetadata: {
      source: string;
      timestamp: string;
      verifierIdentity: string;
      checksum: string;
      methodology: string;
      monitoringStatus: string;
    };
    snapshotId: string;
    verifierAuditBundle?: unknown;
  },
  rawPayload: Record<string, unknown>,
): BundleContents {
  const artifactData = bundle.verifierAuditBundle
    ?? {
      npi: bundle.npi,
      artifact: {
        id: bundle.artifact.id,
        source: bundle.artifact.source,
        status: bundle.artifact.status,
        checksum: bundle.artifact.checksum,
        verifiedAt: typeof bundle.artifact.verifiedAt === 'string' ? bundle.artifact.verifiedAt : bundle.artifact.verifiedAt.toISOString(),
        expiresAt: bundle.artifact.expiresAt ? (typeof bundle.artifact.expiresAt === 'string' ? bundle.artifact.expiresAt : bundle.artifact.expiresAt.toISOString()) : null,
        monitoring: bundle.artifact.monitoring,
      },
      auditMetadata: bundle.auditMetadata,
      snapshotId: bundle.snapshotId,
    };

  // artifact.json — canonicalized audit bundle
  const artifactJson = canonicalize(artifactData as Record<string, unknown>);

  // integrity.txt — DB-stored checksum
  const integrityTxt = `sha256:${bundle.artifact.checksum}`;

  // raw.json — canonicalized raw payload for deterministic replay checks
  const rawJson = canonicalize(rawPayload);

  // README.txt — provenance card from audit metadata
  const readmeTxt = buildReadmeFromRecord(bundle);

  return { artifactJson, integrityTxt, rawJson, readmeTxt };
}

function buildReadmeFromRecord(bundle: {
  npi: string;
  artifact: {
    id: string;
    source: string;
    status: string;
    checksum: string;
    verifiedAt: Date | string;
    expiresAt: Date | string | null;
    monitoring: boolean;
  };
  auditMetadata: {
    source: string;
    timestamp: string;
    verifierIdentity: string;
    checksum: string;
    methodology: string;
    monitoringStatus: string;
  };
  snapshotId: string;
}): string {
  const verifiedAt = new Date(bundle.artifact.verifiedAt);
  const validUntil = new Date(verifiedAt);
  validUntil.setDate(validUntil.getDate() + 120);
  const msRemaining = validUntil.getTime() - Date.now();
  const daysRemaining = Math.max(0, Math.floor(msRemaining / (1000 * 60 * 60 * 24)));
  const windowStatus = msRemaining <= 0 ? 'EXPIRED' : daysRemaining <= 30 ? 'EXPIRING_SOON' : 'WITHIN_WINDOW';

  const windowNote =
    windowStatus === 'EXPIRED'
      ? 'WARNING: This artifact has EXCEEDED the NCQA 120-day primary source verification window.'
      : windowStatus === 'EXPIRING_SOON'
        ? `NOTICE: This artifact is within 30 days of the NCQA 120-day window expiration (${daysRemaining} days remaining).`
        : `This artifact is within the NCQA 120-day primary source verification window (${daysRemaining} days remaining).`;

  return [
    '═══════════════════════════════════════════════════════',
    '  VitalCV PSV Evidence Bundle',
    '═══════════════════════════════════════════════════════',
    '',
    `Artifact ID:         ${bundle.artifact.id}`,
    `Provider NPI:        ${bundle.npi}`,
    `Generated At:        ${bundle.auditMetadata.timestamp}`,
    '',
    '── Provenance ─────────────────────────────────────────',
    '',
    `Source:              ${bundle.artifact.source}`,
    `RetrievedAt:         ${verifiedAt.toISOString()}`,
    `Method:              Primary Source Verification`,
    `Methodology:         ${bundle.auditMetadata.methodology}`,
    '',
    '── Integrity ──────────────────────────────────────────',
    '',
    `Hash Algorithm:      SHA-256`,
    `Checksum:            ${bundle.artifact.checksum}`,
    `Signature Algorithm: ES256`,
    `Verifier:            ${bundle.auditMetadata.verifierIdentity}`,
    '',
    '── NCQA Window ────────────────────────────────────────',
    '',
    `Window Status:       ${windowStatus}`,
    `Verified At:         ${verifiedAt.toISOString()}`,
    `Valid Until:         ${validUntil.toISOString()}`,
    `Window Days:         120`,
    `Days Remaining:      ${daysRemaining}`,
    '',
    windowNote,
    '',
    '── Bundle Contents ────────────────────────────────────',
    '',
    'artifact.json  — Canonicalized audit bundle (sorted keys)',
    'integrity.txt  — SHA-256 digest for tamper detection',
    'raw.json       — Raw primary source payload',
    'README.txt     — This file',
    '',
    '═══════════════════════════════════════════════════════',
    '',
  ].join('\n');
}

function buildReadme(artifact: PsvArtifact): string {
  const { retrieval, integrity, decisionWindow } = artifact;
  const windowNote =
    decisionWindow.windowStatus === 'EXPIRED'
      ? 'WARNING: This artifact has EXCEEDED the NCQA 120-day primary source verification window.'
      : decisionWindow.windowStatus === 'EXPIRING_SOON'
        ? `NOTICE: This artifact is within 30 days of the NCQA 120-day window expiration (${decisionWindow.daysRemaining} days remaining).`
        : `This artifact is within the NCQA 120-day primary source verification window (${decisionWindow.daysRemaining} days remaining).`;

  return [
    '═══════════════════════════════════════════════════════',
    '  VitalCV PSV Evidence Bundle',
    '═══════════════════════════════════════════════════════',
    '',
    `Artifact ID:         ${artifact.artifactId}`,
    `Provider NPI:        ${artifact.provider.npi}`,
    `Generated At:        ${artifact.generatedAt}`,
    '',
    '── Provenance ─────────────────────────────────────────',
    '',
    `Source:              ${retrieval.source.sourceName} (${retrieval.source.sourceType})`,
    `RetrievedAt:         ${retrieval.retrievedAt}`,
    `Method:              ${retrieval.method}`,
    `Authoritative:       ${retrieval.source.authoritative ? 'Yes' : 'No'}`,
    '',
    '── Integrity ──────────────────────────────────────────',
    '',
    `Hash Algorithm:      SHA-256`,
    `Raw Payload Hash:    ${integrity.rawPayloadHash}`,
    `Artifact Hash:       ${integrity.artifactHash}`,
    `Signature Algorithm: ${integrity.signatureAlgorithm}`,
    `Signed At:           ${integrity.signedAt}`,
    `Public Key ID:       ${integrity.publicKeyId}`,
    '',
    '── NCQA Window ────────────────────────────────────────',
    '',
    `Window Status:       ${decisionWindow.windowStatus}`,
    `Verified At:         ${decisionWindow.verifiedAt}`,
    `Valid Until:         ${decisionWindow.validUntil}`,
    `Window Days:         ${decisionWindow.windowDays}`,
    `Days Remaining:      ${decisionWindow.daysRemaining}`,
    '',
    windowNote,
    '',
    '── Bundle Contents ────────────────────────────────────',
    '',
    'artifact.json  — Canonicalized PSV artifact (sorted keys)',
    'integrity.txt  — SHA-256 digest for tamper detection',
    'raw.json       — Raw primary source payload',
    'README.txt     — This file',
    '',
    '═══════════════════════════════════════════════════════',
    '',
  ].join('\n');
}

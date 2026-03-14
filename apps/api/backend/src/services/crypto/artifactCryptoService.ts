/**
 * artifactCryptoService.ts — Artifact signing, verification, and resign pipeline
 *
 * Signs VerificationArtifacts and DecisionCapsules with a chosen crypto suite.
 * Stores the signature in the rawPayload JSON (non-destructive — no schema changes).
 *
 * Canonical payload for signing:
 *   VerificationArtifact: { id, npi, source, status, checksum, createdAt }
 *   DecisionCapsule:      { id, subjectNpi, decisionType, decisionTimestamp, artifactHash, credentialIds }
 *
 * The _crypto envelope is appended to rawPayload (or metadata for capsules).
 * The original SHA-256 hash in artifactHash/checksum is always preserved.
 */

import prisma from '../../graphql/prisma_client';
import {
  signWithSuite,
  verifyWithSuite,
  buildEnvelope,
  keyStore,
  type SuiteId,
  type CryptoEnvelope,
  type CryptoHistory,
} from './cryptoRegistry';
import { canonicalizeJson } from '../../utils/canonicalizeJson';
import { log } from '../../obs/logger';

// ── Canonical payload builders ─────────────────────────────────────────────────

function artifactCanonicalBytes(a: {
  id: string; npi: string; source: string; status: string;
  checksum: string; createdAt: Date;
}): Uint8Array {
  const payload = {
    id: a.id, npi: a.npi, source: a.source,
    status: a.status, checksum: a.checksum,
    createdAt: a.createdAt.toISOString(),
  };
  return new TextEncoder().encode(canonicalizeJson(payload as object));
}

function capsuleCanonicalBytes(c: {
  id: string; subjectNpi: string; decisionType: string;
  decisionTimestamp: Date; artifactHash: string; credentialIds: string[];
}): Uint8Array {
  const payload = {
    id: c.id, subjectNpi: c.subjectNpi, decisionType: c.decisionType,
    decisionTimestamp: c.decisionTimestamp.toISOString(),
    artifactHash: c.artifactHash,
    credentialIds: [...c.credentialIds].sort(),
  };
  return new TextEncoder().encode(canonicalizeJson(payload as object));
}

// ── Sign a VerificationArtifact ───────────────────────────────────────────────

export interface ArtifactSignResult {
  artifactId: string;
  npi: string;
  source: string;
  suiteId: SuiteId;
  keyId: string;
  signedAt: string;
  previousSuite: SuiteId | null;
}

export async function signArtifact(
  artifactId: string,
  suiteId: SuiteId = 'ml-dsa-65',
): Promise<ArtifactSignResult> {
  const artifact = await prisma.verificationArtifact.findUnique({
    where: { id: artifactId },
    select: { id: true, npi: true, source: true, status: true, checksum: true, createdAt: true, rawPayload: true },
  });
  if (!artifact) throw new Error(`Artifact not found: ${artifactId}`);

  const canonical  = artifactCanonicalBytes(artifact);
  const signResult = await signWithSuite(canonical, suiteId);

  const existing = (artifact.rawPayload as Record<string, unknown> | null) ?? {};
  const prevEnv  = existing._crypto as CryptoEnvelope | undefined;
  const prevHist = Array.isArray(existing._cryptoHistory) ? existing._cryptoHistory as CryptoHistory[] : [];

  const history: CryptoHistory[] = prevEnv
    ? [...prevHist, { resignedAt: signResult.signedAt, previousSuite: prevEnv.suite, previousKeyId: prevEnv.keyId, reason: 'resign' }]
    : prevHist;

  const envelope = buildEnvelope(signResult, history);
  const updated  = { ...existing, ...envelope };

  await prisma.verificationArtifact.update({
    where: { id: artifactId },
    data: { rawPayload: JSON.parse(JSON.stringify(updated)) },
  });

  log('info', 'artifactCrypto: artifact signed', {
    artifactId, suite: suiteId, keyId: signResult.keyId,
  });

  return {
    artifactId, npi: artifact.npi, source: artifact.source,
    suiteId, keyId: signResult.keyId, signedAt: signResult.signedAt,
    previousSuite: prevEnv?.suite ?? null,
  };
}

// ── Sign a DecisionCapsule ────────────────────────────────────────────────────

export interface CapsuleSignResult {
  capsuleId: string;
  subjectNpi: string;
  suiteId: SuiteId;
  keyId: string;
  signedAt: string;
  previousSuite: SuiteId | null;
}

export async function signCapsule(
  capsuleId: string,
  suiteId: SuiteId = 'ml-dsa-65',
): Promise<CapsuleSignResult> {
  const capsule = await prisma.decisionCapsule.findUnique({
    where: { id: capsuleId },
    select: { id: true, subjectNpi: true, decisionType: true, decisionTimestamp: true, artifactHash: true, credentialIds: true, metadata: true },
  });
  if (!capsule) throw new Error(`Capsule not found: ${capsuleId}`);

  const canonical  = capsuleCanonicalBytes(capsule);
  const signResult = await signWithSuite(canonical, suiteId);

  const existing = (capsule.metadata as Record<string, unknown> | null) ?? {};
  const prevEnv  = existing._crypto as CryptoEnvelope | undefined;
  const prevHist = Array.isArray(existing._cryptoHistory) ? existing._cryptoHistory as CryptoHistory[] : [];

  const history: CryptoHistory[] = prevEnv
    ? [...prevHist, { resignedAt: signResult.signedAt, previousSuite: prevEnv.suite, previousKeyId: prevEnv.keyId, reason: 'resign' }]
    : prevHist;

  const envelope = buildEnvelope(signResult, history);
  const updated  = { ...existing, ...envelope };

  await prisma.decisionCapsule.update({
    where: { id: capsuleId },
    data: { metadata: JSON.parse(JSON.stringify(updated)) },
  });

  log('info', 'artifactCrypto: capsule signed', {
    capsuleId, suite: suiteId, keyId: signResult.keyId,
  });

  return {
    capsuleId, subjectNpi: capsule.subjectNpi,
    suiteId, keyId: signResult.keyId, signedAt: signResult.signedAt,
    previousSuite: prevEnv?.suite ?? null,
  };
}

// ── Verify signature on an artifact ──────────────────────────────────────────

export interface ArtifactVerifyResult {
  artifactId: string;
  suiteId: SuiteId | null;
  keyId: string | null;
  signaturePresent: boolean;
  signatureValid: boolean;
  quantumResistant: boolean;
  signedAt: string | null;
  error: string | null;
}

export async function verifyArtifactSignature(artifactId: string): Promise<ArtifactVerifyResult> {
  const artifact = await prisma.verificationArtifact.findUnique({
    where: { id: artifactId },
    select: { id: true, npi: true, source: true, status: true, checksum: true, createdAt: true, rawPayload: true },
  });
  if (!artifact) throw new Error(`Artifact not found: ${artifactId}`);

  const raw  = (artifact.rawPayload ?? {}) as Record<string, unknown>;
  const env  = raw._crypto as CryptoEnvelope | undefined;

  if (!env?.signatureHex || !env.keyId) {
    return { artifactId, suiteId: null, keyId: null, signaturePresent: false, signatureValid: false, quantumResistant: false, signedAt: null, error: null };
  }

  const canonical = artifactCanonicalBytes(artifact);
  const result    = await verifyWithSuite(canonical, env.signatureHex, env.keyId);

  return {
    artifactId,
    suiteId:          env.suite,
    keyId:            env.keyId,
    signaturePresent: true,
    signatureValid:   result.valid,
    quantumResistant: env.quantumResistant ?? false,
    signedAt:         env.signedAt,
    error:            result.error ?? null,
  };
}

export async function verifyCapsuleSignature(capsuleId: string): Promise<ArtifactVerifyResult> {
  const capsule = await prisma.decisionCapsule.findUnique({
    where: { id: capsuleId },
    select: { id: true, subjectNpi: true, decisionType: true, decisionTimestamp: true, artifactHash: true, credentialIds: true, metadata: true },
  });
  if (!capsule) throw new Error(`Capsule not found: ${capsuleId}`);

  const meta = (capsule.metadata ?? {}) as Record<string, unknown>;
  const env  = meta._crypto as CryptoEnvelope | undefined;

  if (!env?.signatureHex || !env.keyId) {
    return { artifactId: capsuleId, suiteId: null, keyId: null, signaturePresent: false, signatureValid: false, quantumResistant: false, signedAt: null, error: null };
  }

  const canonical = capsuleCanonicalBytes(capsule);
  const result    = await verifyWithSuite(canonical, env.signatureHex, env.keyId);

  return {
    artifactId: capsuleId, suiteId: env.suite, keyId: env.keyId,
    signaturePresent: true, signatureValid: result.valid,
    quantumResistant: env.quantumResistant ?? false,
    signedAt: env.signedAt, error: result.error ?? null,
  };
}

// ── Resign pipeline ───────────────────────────────────────────────────────────

export interface ResignReport {
  npi: string;
  targetSuite: SuiteId;
  totalArtifacts: number;
  signedCount: number;
  failedCount: number;
  skippedCount: number;
  durationMs: number;
  results: Array<{ id: string; source: string; status: 'signed' | 'failed' | 'skipped'; error?: string }>;
}

export async function batchResignArtifacts(
  npi: string,
  targetSuite: SuiteId = 'ml-dsa-65',
  options: { skipAlreadySigned?: boolean; limit?: number } = {},
): Promise<ResignReport> {
  const start = Date.now();
  const artifacts = await prisma.verificationArtifact.findMany({
    where: { npi, source: { not: 'TRUST_STATE_ENGINE' }, lifecycleState: 'active' },
    select: { id: true, source: true, rawPayload: true },
    take: options.limit ?? 500,
  });

  const results: ResignReport['results'] = [];
  let signedCount = 0, failedCount = 0, skippedCount = 0;

  for (const art of artifacts) {
    const raw = (art.rawPayload ?? {}) as Record<string, unknown>;
    const env = raw._crypto as CryptoEnvelope | undefined;

    if (options.skipAlreadySigned && env?.suite === targetSuite) {
      results.push({ id: art.id, source: art.source, status: 'skipped' });
      skippedCount++;
      continue;
    }

    try {
      await signArtifact(art.id, targetSuite);
      results.push({ id: art.id, source: art.source, status: 'signed' });
      signedCount++;
    } catch (err) {
      results.push({ id: art.id, source: art.source, status: 'failed', error: String(err) });
      failedCount++;
    }
  }

  const report: ResignReport = {
    npi, targetSuite,
    totalArtifacts: artifacts.length,
    signedCount, failedCount, skippedCount,
    durationMs: Date.now() - start,
    results,
  };

  log('info', 'artifactCrypto: batch resign complete', {
    npi, suite: targetSuite, signedCount, failedCount, skippedCount,
  });

  return report;
}

// ── Crypto status for an NPI ──────────────────────────────────────────────────

export interface NpiCryptoStatus {
  npi: string;
  totalArtifacts: number;
  signedCount: number;
  unsignedCount: number;
  suiteBreakdown: Record<string, number>;
  quantumResistantCount: number;
  quantumVulnerableCount: number;
  readyForPQC: boolean;
  recommendation: string;
}

export async function getNpiCryptoStatus(npi: string): Promise<NpiCryptoStatus> {
  const artifacts = await prisma.verificationArtifact.findMany({
    where: { npi, source: { not: 'TRUST_STATE_ENGINE' }, lifecycleState: 'active' },
    select: { rawPayload: true },
  });

  const suiteBreakdown: Record<string, number> = {};
  let signedCount = 0, qrCount = 0, qvCount = 0;

  for (const art of artifacts) {
    const raw = (art.rawPayload ?? {}) as Record<string, unknown>;
    const env = raw._crypto as CryptoEnvelope | undefined;
    if (env?.suite) {
      suiteBreakdown[env.suite] = (suiteBreakdown[env.suite] ?? 0) + 1;
      signedCount++;
      if (env.quantumResistant) qrCount++;
      else qvCount++;
    }
  }

  const total   = artifacts.length;
  const unsigned = total - signedCount;
  const readyForPQC = unsigned === 0 && qvCount === 0 && qrCount > 0;

  const recommendation =
    unsigned > 0   ? `Sign ${unsigned} unsigned artifacts with ML-DSA-65: POST /api/crypto/batch-resign` :
    qvCount > 0    ? `Resign ${qvCount} classically-signed artifacts with ML-DSA-65 to achieve PQC readiness` :
    readyForPQC    ? 'All artifacts PQC-signed ✓' :
                     'Run /api/crypto/batch-resign to sign all artifacts';

  return { npi, totalArtifacts: total, signedCount, unsignedCount: unsigned, suiteBreakdown, quantumResistantCount: qrCount, quantumVulnerableCount: qvCount, readyForPQC, recommendation };
}

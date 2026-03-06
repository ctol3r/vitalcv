/**
 * capsuleEngine.ts — Wave A (Phase 1 Hardening)
 * Salvaged from feature/interoperability-wave65 (Wave 54), upgraded for main.
 *
 * Creates immutable decision capsules that record the credential state
 * at the moment of an operational decision (hiring, privileging, deployment).
 *
 * Each capsule hashes the credential bundle snapshot, records the evaluation
 * methodology, and persists to the database as an append-only audit record.
 */

import prisma from '../../graphql/prisma_client';
import { sha256Hex } from '../../utils/deterministic';
import { log } from '../../obs/logger';

// ── Types ─────────────────────────────────────────────────────────────────

export type DecisionType = 'HIRING' | 'PRIVILEGING' | 'DEPLOYMENT' | 'RENEWAL';
export type CapsuleStatus = 'VALID' | 'AT_RISK' | 'INVALID';

export interface CreateCapsuleInput {
  subjectDid: string;
  subjectNpi: string;
  decisionType: DecisionType;
  credentialIds: string[];
  issuerIds: string[];
  metadata?: Record<string, unknown>;
}

export interface DecisionCapsuleRecord {
  id: string;
  subjectDid: string;
  subjectNpi: string;
  decisionType: string;
  decisionTimestamp: string;
  credentialIds: string[];
  issuerIds: string[];
  artifactHash: string;
  methodology: string;
  status: CapsuleStatus;
  metadata: unknown;
  createdAt: string;
}

// ── Constants ─────────────────────────────────────────────────────────────

const METHODOLOGY_VERSION = 'CRS_v1.0';

// ── Engine ────────────────────────────────────────────────────────────────

/**
 * Create a decision capsule that records the credential state
 * at the moment of an operational decision.
 */
async function createDecisionCapsule(
  input: CreateCapsuleInput,
): Promise<DecisionCapsuleRecord> {
  const decisionTimestamp = new Date();

  // Step 1: Snapshot credential state at decision time
  const artifacts = await prisma.verificationArtifact.findMany({
    where: { id: { in: input.credentialIds } },
    select: {
      id: true,
      npi: true,
      source: true,
      status: true,
      lifecycleState: true,
      checksum: true,
      merkleRoot: true,
      verifiedAt: true,
      expiresAt: true,
      revokedAt: true,
    },
  });

  // Step 2: Hash the full credential bundle for replay integrity
  const bundlePayload = {
    subjectNpi: input.subjectNpi,
    subjectDid: input.subjectDid,
    decisionType: input.decisionType,
    decisionTimestamp: decisionTimestamp.toISOString(),
    credentials: artifacts.map((a) => ({
      id: a.id,
      source: a.source,
      status: a.status,
      checksum: a.checksum,
      merkleRoot: a.merkleRoot,
    })),
    issuerIds: input.issuerIds,
    methodology: METHODOLOGY_VERSION,
  };

  const artifactHash = sha256Hex(JSON.stringify(bundlePayload));

  // Step 3: Persist capsule
  const capsule = await prisma.decisionCapsule.create({
    data: {
      subjectDid: input.subjectDid,
      subjectNpi: input.subjectNpi,
      decisionType: input.decisionType,
      decisionTimestamp,
      credentialIds: input.credentialIds,
      issuerIds: input.issuerIds,
      artifactHash,
      methodology: METHODOLOGY_VERSION,
      status: 'VALID',
      metadata: JSON.parse(JSON.stringify(input.metadata ?? {})),
    },
  });

  // Step 4: Anchor audit event
  await prisma.auditEvent.create({
    data: {
      type: 'DECISION_CAPSULE_CREATED',
      hash: artifactHash,
      referenceId: capsule.id,
      clinicianId: input.subjectNpi,
      metadata: JSON.parse(JSON.stringify({
        decisionType: input.decisionType,
        credentialCount: input.credentialIds.length,
        issuerCount: input.issuerIds.length,
        methodology: METHODOLOGY_VERSION,
      })),
    },
  });

  log('info', 'capsule_engine: created', {
    capsuleId: capsule.id,
    npi: input.subjectNpi.slice(0, 4) + '****',
    decisionType: input.decisionType,
    credentialCount: input.credentialIds.length,
    artifactHash: artifactHash.slice(0, 16),
  });

  return mapCapsule(capsule);
}

/**
 * Retrieve all decision capsules for a clinician, ordered by decision time.
 */
async function getCapsulesByNpi(npi: string): Promise<DecisionCapsuleRecord[]> {
  const capsules = await prisma.decisionCapsule.findMany({
    where: { subjectNpi: npi },
    orderBy: { decisionTimestamp: 'desc' },
  });
  return capsules.map(mapCapsule);
}

/**
 * Retrieve a single capsule by ID.
 */
async function getCapsuleById(id: string): Promise<DecisionCapsuleRecord | null> {
  const capsule = await prisma.decisionCapsule.findUnique({ where: { id } });
  return capsule ? mapCapsule(capsule) : null;
}

/**
 * Count total capsules (for analytics / status endpoints).
 */
async function countCapsules(): Promise<number> {
  return prisma.decisionCapsule.count();
}

// ── Internal helpers ──────────────────────────────────────────────────────

function mapCapsule(c: {
  id: string;
  subjectDid: string;
  subjectNpi: string;
  decisionType: string;
  decisionTimestamp: Date;
  credentialIds: string[];
  issuerIds: string[];
  artifactHash: string;
  methodology: string;
  status: string;
  metadata: unknown;
  createdAt: Date;
}): DecisionCapsuleRecord {
  return {
    id: c.id,
    subjectDid: c.subjectDid,
    subjectNpi: c.subjectNpi,
    decisionType: c.decisionType,
    decisionTimestamp: c.decisionTimestamp.toISOString(),
    credentialIds: c.credentialIds,
    issuerIds: c.issuerIds,
    artifactHash: c.artifactHash,
    methodology: c.methodology,
    status: c.status as CapsuleStatus,
    metadata: c.metadata,
    createdAt: c.createdAt.toISOString(),
  };
}

export const capsuleEngine = {
  createDecisionCapsule,
  getCapsulesByNpi,
  getCapsuleById,
  countCapsules,
};

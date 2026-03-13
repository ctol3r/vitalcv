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
import { computeClinicianTrustState } from '../trust/trustStateEngine';
import { appendAuditEvent } from '../audit/auditLedger';
// Wave 249: Trust Spine Hardening — pipeline enforcement
import {
  ensureTrustStateBeforeCapsule,
  ensureGraphEdgesForCapsule,
} from '../integrity/pipelineEnforcer';

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

/**
 * Create a Decision Capsule automatically from an accepted Application.
 * Snapshots the clinician's current trust state + credentials at decision time.
 */
async function createDecisionFromApplication(params: {
  applicationId: string;
  verifierClerkUserId: string;
  decisionType: DecisionType;
}): Promise<DecisionCapsuleRecord> {
  const { applicationId, verifierClerkUserId, decisionType } = params;

  // Step 1: Look up the Application to get NPI and opportunityId
  const application = await prisma.application.findUnique({
    where: { id: applicationId },
    select: { id: true, npi: true, opportunityId: true, clerkUserId: true },
  });

  if (!application) {
    throw new Error(`Application not found: ${applicationId}`);
  }

  const npi = application.npi;
  if (!npi || !/^\d{10}$/.test(npi)) {
    throw new Error(`Application ${applicationId} has no valid NPI — cannot create Decision Capsule`);
  }

  // Step 2: Ensure fresh trust state via pipeline enforcer (Wave 249)
  const trustState = await ensureTrustStateBeforeCapsule(npi);

  // Step 3: Look up VerificationArtifacts for this clinician
  const artifacts = await prisma.verificationArtifact.findMany({
    where: { npi },
    select: { id: true, source: true, status: true },
  });

  // Step 4: Look up CandidateCredentials for this clinician
  const candidateCredentials = await prisma.candidateCredential.findMany({
    where: { clinicianId: npi },
    select: { id: true, candidateCredentialId: true },
  });

  const credentialIds = artifacts.map((a) => a.id);
  const issuerIds = [...new Set(artifacts.map((a) => a.source))];

  // Step 5: Build artifact hash over trust state + credential bundle
  const bundleForHash = {
    applicationId,
    subjectNpi: npi,
    subjectDid: `did:vitalcv:${npi}`,
    decisionType,
    trustState: {
      readiness_level: trustState.readiness_level,
      readiness_score: trustState.readiness_score,
      methodology_version: trustState.methodology_version,
      computed_at: trustState.computed_at,
    },
    credentialCount: credentialIds.length,
    candidateCredentialCount: candidateCredentials.length,
    verifierClerkUserId,
    opportunityId: application.opportunityId,
  };
  const artifactHash = sha256Hex(JSON.stringify(bundleForHash));

  // Step 6: Persist the capsule with trust_state_snapshot in metadata
  const capsule = await prisma.decisionCapsule.create({
    data: {
      subjectDid: `did:vitalcv:${npi}`,
      subjectNpi: npi,
      decisionType,
      decisionTimestamp: new Date(),
      credentialIds,
      issuerIds,
      artifactHash,
      methodology: METHODOLOGY_VERSION,
      status: 'VALID',
      metadata: JSON.parse(JSON.stringify({
        applicationId,
        opportunityId: application.opportunityId,
        verifierClerkUserId,
        trust_state_snapshot: trustState,
        candidateCredentialIds: candidateCredentials.map((c) => c.id),
      })),
    },
  });

  // Step 7: Emit audit event
  appendAuditEvent({
    category: 'DECISION',
    severity: 'INFO',
    actor: verifierClerkUserId,
    resource: `decision-capsule:${capsule.id}`,
    requestFields: { applicationId, decisionType, npi: npi.slice(0, 4) + '****' },
    resultFields: {
      capsuleId: capsule.id,
      artifactHash: artifactHash.slice(0, 16),
      trustBand: trustState.readiness_level,
      trustScore: trustState.readiness_score,
      credentialCount: credentialIds.length,
    },
  });

  // Step 8: Ensure graph edges are created after capsule (Wave 249, async non-fatal)
  ensureGraphEdgesForCapsule(capsule.id, npi).catch((err) => {
    log('warn', 'capsule_engine: graph_edge_ensure_error', {
      capsuleId: capsule.id,
      error: String(err),
    });
  });

  log('info', 'capsule_engine: created_from_application', {
    capsuleId: capsule.id,
    applicationId,
    npi: npi.slice(0, 4) + '****',
    decisionType,
    trustBand: trustState.readiness_level,
    trustScore: trustState.readiness_score,
    credentialCount: credentialIds.length,
    artifactHash: artifactHash.slice(0, 16),
  });

  return mapCapsule(capsule);
}

export const capsuleEngine = {
  createDecisionCapsule,
  createDecisionFromApplication,
  getCapsulesByNpi,
  getCapsuleById,
  countCapsules,
};

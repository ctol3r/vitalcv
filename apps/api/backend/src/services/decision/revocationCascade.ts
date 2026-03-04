/**
 * revocationCascade.ts — Wave 54: Decision Capsule Revocation Cascade
 *
 * When a credential is revoked, finds all DecisionCapsules that depended
 * on it and transitions their status through the lifecycle:
 *   VALID → AT_RISK → INVALID
 *
 * Emits audit events for every status transition, enabling blast radius
 * analysis and institutional audit replay.
 */

import prisma from '../../graphql/prisma_client';
import { sha256Hex } from '../../utils/deterministic';
import { log } from '../../obs/logger';

// ── Types ─────────────────────────────────────────────────────────────────

export interface CascadeResult {
  credentialId: string;
  affectedCapsules: AffectedCapsule[];
  totalAffected: number;
  auditEventIds: string[];
  cascadedAt: string;
}

export interface AffectedCapsule {
  capsuleId: string;
  previousStatus: string;
  newStatus: string;
  subjectNpi: string;
  decisionType: string;
}

export interface BlastRadiusResult {
  credentialId: string;
  impactedCapsules: Array<{
    id: string;
    subjectNpi: string;
    subjectDid: string;
    decisionType: string;
    status: string;
    decisionTimestamp: string;
  }>;
  impactedNpis: string[];
  impactedDecisionTypes: string[];
  totalImpacted: number;
}

// ── Status Transitions ────────────────────────────────────────────────────

const STATUS_TRANSITIONS: Record<string, string> = {
  VALID: 'AT_RISK',
  AT_RISK: 'INVALID',
};

// ── Cascade Logic ─────────────────────────────────────────────────────────

/**
 * Propagate a credential revocation through all dependent DecisionCapsules.
 * Transitions: VALID → AT_RISK on first revocation, AT_RISK → INVALID on second.
 */
async function propagateRevocation(
  credentialId: string,
): Promise<CascadeResult> {
  const cascadedAt = new Date().toISOString();
  const affectedCapsules: AffectedCapsule[] = [];
  const auditEventIds: string[] = [];

  // Find all capsules that reference this credential
  const capsules = await prisma.decisionCapsule.findMany({
    where: {
      credentialIds: { has: credentialId },
      status: { in: ['VALID', 'AT_RISK'] },
    },
  });

  log('info', 'revocation_cascade: starting', {
    credentialId: credentialId.slice(0, 8) + '...',
    affectedCapsuleCount: capsules.length,
  });

  for (const capsule of capsules) {
    const previousStatus = capsule.status;
    const newStatus = STATUS_TRANSITIONS[previousStatus];

    if (!newStatus) continue; // Already INVALID, skip

    // Update capsule status
    await prisma.decisionCapsule.update({
      where: { id: capsule.id },
      data: { status: newStatus },
    });

    // Audit event
    const auditHash = sha256Hex(
      `${capsule.id}:${credentialId}:${previousStatus}:${newStatus}:${cascadedAt}`,
    );

    const auditEvent = await prisma.auditEvent.create({
      data: {
        type: 'DECISION_CASCADE_TRIGGERED',
        hash: auditHash,
        referenceId: capsule.id,
        clinicianId: capsule.subjectNpi,
        metadata: JSON.parse(JSON.stringify({
          severity: newStatus === 'INVALID' ? 'CRITICAL' : 'WARNING',
          capsuleId: capsule.id,
          credentialId,
          previousStatus,
          newStatus,
          decisionType: capsule.decisionType,
          cascadedAt,
        })),
      },
    });

    auditEventIds.push(auditEvent.id);
    affectedCapsules.push({
      capsuleId: capsule.id,
      previousStatus,
      newStatus,
      subjectNpi: capsule.subjectNpi,
      decisionType: capsule.decisionType,
    });

    log('info', 'revocation_cascade: capsule updated', {
      capsuleId: capsule.id,
      npi: capsule.subjectNpi.slice(0, 4) + '****',
      transition: `${previousStatus} → ${newStatus}`,
    });
  }

  return {
    credentialId,
    affectedCapsules,
    totalAffected: affectedCapsules.length,
    auditEventIds,
    cascadedAt,
  };
}

/**
 * Compute the blast radius of a credential revocation WITHOUT
 * actually performing the cascade. Read-only analysis.
 */
async function computeBlastRadius(
  credentialId: string,
): Promise<BlastRadiusResult> {
  const capsules = await prisma.decisionCapsule.findMany({
    where: {
      credentialIds: { has: credentialId },
    },
    orderBy: { decisionTimestamp: 'desc' },
  });

  const impactedNpis = [...new Set(capsules.map((c) => c.subjectNpi))];
  const impactedDecisionTypes = [...new Set(capsules.map((c) => c.decisionType))];

  return {
    credentialId,
    impactedCapsules: capsules.map((c) => ({
      id: c.id,
      subjectNpi: c.subjectNpi,
      subjectDid: c.subjectDid,
      decisionType: c.decisionType,
      status: c.status,
      decisionTimestamp: c.decisionTimestamp.toISOString(),
    })),
    impactedNpis,
    impactedDecisionTypes,
    totalImpacted: capsules.length,
  };
}

export const revocationCascade = { propagateRevocation, computeBlastRadius };

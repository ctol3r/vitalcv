/**
 * bidirectional.ts — Wave 27: Authority-Bound Knowledge Graph
 *
 * Bidirectional graph traversal engine for credential revocation propagation.
 *
 * When a VerificationArtifact is revoked, this engine:
 *   1. Follows the graph BACKWARD from the revoked artifact:
 *        VerificationArtifact → Clinician (NPI) → Acceptance → Start
 *   2. Classifies every dependent node as CONDITIONAL or INVALID:
 *        - CONDITIONAL  : artifact is expiring or monitoring-flagged (not yet expired)
 *        - INVALID      : artifact is fully revoked, suspended, or expired
 *   3. Writes an AuditEvent for every flagged downstream node (append-only ledger).
 *   4. Returns a structured traversal report so callers can react (notify, surface UI, etc.)
 *
 * This function is PURE from a Prisma standpoint — it only reads and appends
 * to the append-only AuditEvent log. It does NOT mutate Acceptance or Start
 * rows (those models have no status field in the current schema), preserving
 * the immutability guarantee of the canonical path.
 *
 * To check whether a Start or Acceptance has been flagged, query AuditEvents
 * WHERE type IN ('BIDIRECTIONAL_FLAG_CONDITIONAL', 'BIDIRECTIONAL_FLAG_INVALID')
 * AND referenceId = <acceptanceId | startId>.
 */

import prisma from '../../graphql/prisma_client';
import { sha256Hex } from '../../utils/deterministic';
import { log } from '../../obs/logger';

// ── Types ─────────────────────────────────────────────────────────────────

export type DependencyFlag = 'CONDITIONAL' | 'INVALID';

export interface FlaggedNode {
  kind: 'ACCEPTANCE' | 'START';
  id: string;
  /** The domain-level ID (acceptanceId / startId) */
  domainId: string;
  employerId: string;
  clinicianId: string;
  flag: DependencyFlag;
  reason: string;
  /** SHA-256 of (domainId + flag + revokedArtifactId) — audit-trail entry */
  auditHash: string;
}

export interface BidirectionalTraversalResult {
  /** The artifact that was revoked/suspended */
  revokedArtifactId: string;
  /** The NPI resolved from the artifact */
  npi: string;
  /** How this traversal classifies downstream nodes */
  propagationKind: DependencyFlag;
  /** All Acceptance nodes reached and flagged */
  flaggedAcceptances: FlaggedNode[];
  /** All Start nodes reached and flagged */
  flaggedStarts: FlaggedNode[];
  /** Total downstream nodes affected */
  totalFlagged: number;
  /** The audit event IDs written for this traversal */
  auditEventIds: string[];
  /** Deterministic hash of the entire traversal (for transparency log) */
  traversalHash: string;
}

// ── Helpers ───────────────────────────────────────────────────────────────

function classifyArtifact(status: string, trustState: string): DependencyFlag {
  // Full revocation or hard failures → INVALID
  if (
    status === 'REVOKED' ||
    status === 'SUSPENDED' ||
    status === 'EXPIRED' ||
    trustState === 'expired'
  ) {
    return 'INVALID';
  }
  // Soft states (expiring, needs review) → CONDITIONAL
  return 'CONDITIONAL';
}

function buildAuditHash(domainId: string, flag: DependencyFlag, artifactId: string): string {
  return sha256Hex(`${domainId}:${flag}:${artifactId}`);
}

// ── Core traversal ────────────────────────────────────────────────────────

/**
 * Traverse the trust graph from a revoked artifact and propagate flags to
 * all downstream Acceptance and Start nodes.
 *
 * @param artifactId  UUID of the VerificationArtifact that was revoked.
 * @returns           Traversal report with every flagged downstream node.
 */
export async function propagateRevocation(
  artifactId: string,
): Promise<BidirectionalTraversalResult> {
  // ── Step 1: Resolve the revoked artifact ──────────────────────────────
  const artifact = await prisma.verificationArtifact.findUnique({
    where: { id: artifactId },
    select: {
      id: true,
      npi: true,
      status: true,
      trustState: true,
      checksum: true,
      merkleRoot: true,
    },
  });

  if (!artifact) {
    throw new Error(`BidirectionalEngine: VerificationArtifact ${artifactId} not found.`);
  }

  const { npi } = artifact;
  const propagationKind = classifyArtifact(artifact.status, artifact.trustState);

  log('info', 'BidirectionalEngine: starting traversal', {
    artifactId,
    npi,
    propagationKind,
    artifactStatus: artifact.status,
    trustState: artifact.trustState,
  });

  // ── Step 2: Traverse BACKWARD — find all Acceptances for this NPI ──────
  const acceptances = await prisma.acceptance.findMany({
    where: { subjectId: npi },
    select: {
      id: true,
      acceptanceId: true,
      employerId: true,
      subjectId: true,
      eventHash: true,
      starts: {
        select: {
          id: true,
          startId: true,
          employerId: true,
          subjectId: true,
          eventHash: true,
        },
      },
    },
  });

  const flaggedAcceptances: FlaggedNode[] = [];
  const flaggedStarts: FlaggedNode[] = [];
  const auditEventIds: string[] = [];
  const hashParts: string[] = [artifactId, npi, propagationKind];

  // ── Step 3: Flag Acceptances and their dependent Starts ─────────────────
  for (const acc of acceptances) {
    const reason =
      propagationKind === 'INVALID'
        ? `Credential ${artifactId} has been revoked/suspended. Acceptance ${acc.acceptanceId} is now INVALID.`
        : `Credential ${artifactId} is expiring or flagged. Acceptance ${acc.acceptanceId} requires re-verification (CONDITIONAL).`;

    const auditHash = buildAuditHash(acc.acceptanceId, propagationKind, artifactId);
    hashParts.push(auditHash);

    flaggedAcceptances.push({
      kind: 'ACCEPTANCE',
      id: acc.id,
      domainId: acc.acceptanceId,
      employerId: acc.employerId,
      clinicianId: npi,
      flag: propagationKind,
      reason,
      auditHash,
    });

    // Write audit event for this acceptance
    const accEvent = await prisma.auditEvent.create({
      data: {
        type: `BIDIRECTIONAL_FLAG_${propagationKind}`,
        hash: auditHash,
        referenceId: acc.acceptanceId,
        clinicianId: npi,
        metadata: {
          artifactId,
          flag: propagationKind,
          reason,
          employerId: acc.employerId,
          dependencyKind: 'ACCEPTANCE',
        },
      },
    });
    auditEventIds.push(accEvent.id);

    // ── Step 4: Follow Start edges (one hop deeper) ─────────────────────
    for (const start of acc.starts) {
      const startReason =
        propagationKind === 'INVALID'
          ? `Credential ${artifactId} revoked. Start ${start.startId} (via Acceptance ${acc.acceptanceId}) is now INVALID.`
          : `Credential ${artifactId} flagged. Start ${start.startId} requires review (CONDITIONAL).`;

      const startHash = buildAuditHash(start.startId, propagationKind, artifactId);
      hashParts.push(startHash);

      flaggedStarts.push({
        kind: 'START',
        id: start.id,
        domainId: start.startId,
        employerId: start.employerId,
        clinicianId: npi,
        flag: propagationKind,
        reason: startReason,
        auditHash: startHash,
      });

      const startEvent = await prisma.auditEvent.create({
        data: {
          type: `BIDIRECTIONAL_FLAG_${propagationKind}`,
          hash: startHash,
          referenceId: start.startId,
          clinicianId: npi,
          metadata: {
            artifactId,
            acceptanceId: acc.acceptanceId,
            flag: propagationKind,
            reason: startReason,
            employerId: start.employerId,
            dependencyKind: 'START',
          },
        },
      });
      auditEventIds.push(startEvent.id);
    }
  }

  // ── Step 5: Compute traversal hash ────────────────────────────────────
  const traversalHash = sha256Hex(hashParts.join('|'));
  const totalFlagged = flaggedAcceptances.length + flaggedStarts.length;

  log('info', 'BidirectionalEngine: traversal complete', {
    artifactId,
    npi,
    propagationKind,
    totalFlagged,
    traversalHash,
  });

  return {
    revokedArtifactId: artifactId,
    npi,
    propagationKind,
    flaggedAcceptances,
    flaggedStarts,
    totalFlagged,
    auditEventIds,
    traversalHash,
  };
}

/**
 * Check whether a given Acceptance or Start has an active INVALID flag
 * from a prior bidirectional traversal.
 *
 * Useful for read-path checks (e.g., "is this Start still valid?").
 */
export async function getActiveFlag(
  domainId: string,
): Promise<{ flag: DependencyFlag | null; reason: string | null; hash: string | null }> {
  const event = await prisma.auditEvent.findFirst({
    where: {
      referenceId: domainId,
      type: { in: ['BIDIRECTIONAL_FLAG_INVALID', 'BIDIRECTIONAL_FLAG_CONDITIONAL'] },
    },
    orderBy: { createdAt: 'desc' },
    select: { type: true, hash: true, metadata: true },
  });

  if (!event) return { flag: null, reason: null, hash: null };

  const flag: DependencyFlag = event.type === 'BIDIRECTIONAL_FLAG_INVALID' ? 'INVALID' : 'CONDITIONAL';
  const meta = event.metadata as Record<string, unknown> | null;
  const reason = typeof meta?.['reason'] === 'string' ? meta['reason'] : null;

  return { flag, reason, hash: event.hash };
}

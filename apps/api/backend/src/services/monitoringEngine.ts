import prisma from '../graphql/prisma_client';
import { buildVerificationMerklePayload } from './artifactService';
import { getVerificationSource } from './sourceRegistry';
import { computeTrustState } from './trustState';
import { computeCredentialState } from './credentialStatusEngine';
import type { Prisma } from '@prisma/client';
import type { MonitoringEventType } from '../types/auditEventTypes';
import {
  propagateCredentialLifecycleChange,
  type RevocationPropagationTrigger,
} from './revocation/propagationEngine';

type MonitoringCheckResult = {
  npi: string;
  changed: boolean;
  previousStatus: string | null;
  newStatus: string;
  trustState: string;
  monitoringEventId?: string;
};

/**
 * Run a monitoring check for a single NPI.
 *
 * 1. Fetch the latest artifact
 * 2. Re-query the source via adapter registry
 * 3. Compare status
 * 4. If changed → create MonitoringEvent, update artifact
 * 5. Recompute and persist trust state
 */
export async function runMonitoringCheck(
  npi: string,
  organizationId?: string,
): Promise<MonitoringCheckResult> {
  const artifact = await prisma.verificationArtifact.findFirst({
    where: {
      npi,
      ...(organizationId ? { organizationId } : {}),
    },
    orderBy: { createdAt: 'desc' },
  });

  if (!artifact) {
    return {
      npi,
      changed: false,
      previousStatus: null,
      newStatus: 'NO_ARTIFACT',
      trustState: 'needs_review',
    };
  }

  // Re-query source via adapter registry
  const source = getVerificationSource(artifact.source === 'NURSYS' ? 'NURSYS' : artifact.source);
  const freshResult = await source.verify(npi);
  const { fingerprint, merkleRoot, claimHashes } = buildVerificationMerklePayload(npi, freshResult);
  const statusChanged = artifact.status !== freshResult.licenseStatus;
  let monitoringEventId: string | undefined;

  // Recompute trust state regardless of change
  const expiresAt = freshResult.expirationDate ?? null;
  const monitoring = artifact.monitoring;
  const trustState = computeTrustState(
    { status: freshResult.licenseStatus, expiresAt, monitoring },
  );
  const statusCheckedAt = new Date();
  const lifecycleState = computeCredentialState(
    {
      revokedAt: artifact.revokedAt,
      suspendedAt: artifact.suspendedAt,
      expiresAt,
      status: freshResult.licenseStatus,
    },
    statusCheckedAt,
  );

  // Wave 34: Wrap all mutations in a transaction to prevent race conditions
  // on concurrent monitoring runs for the same NPI.
  const monitoringAuditType: MonitoringEventType = 'MONITORING_STATUS_CHANGE';
  await prisma.$transaction(async (tx) => {
    if (statusChanged) {
      // Record monitoring event
      const monitoringEvent = await tx.monitoringEvent.create({
        data: {
          npi,
          source: artifact.source,
          previousStatus: artifact.status,
          newStatus: freshResult.licenseStatus,
          ...(organizationId ? { organizationId } : {}),
        },
        select: { id: true },
      });
      monitoringEventId = monitoringEvent.id;

      // Emit audit trail
      await tx.auditEvent.create({
        data: {
          type: monitoringAuditType,
          hash: fingerprint,
          clinicianId: npi,
          referenceId: artifact.id,
          ...(organizationId ? { organizationId } : {}),
          metadata: {
            previousStatus: artifact.status,
            newStatus: freshResult.licenseStatus,
            source: artifact.source,
          } as unknown as Prisma.InputJsonValue,
        },
      });
    }

    // Update artifact with latest data
    await tx.verificationArtifact.update({
      where: { id: artifact.id },
      data: {
      status: freshResult.licenseStatus,
        rawPayload: freshResult.rawPayload as Prisma.InputJsonValue,
        checksum: fingerprint,
        merkleRoot,
        claimHashes: claimHashes as unknown as Prisma.InputJsonValue,
        verifiedAt: new Date(),
        expiresAt,
        lifecycleState,
        statusLastChecked: statusCheckedAt,
        trustState,
      },
    });
  });

  let trigger: RevocationPropagationTrigger | null = null;
  if (statusChanged) {
    if (freshResult.licenseStatus === 'REVOKED') {
      trigger = 'credential.revoked';
    } else if (freshResult.licenseStatus === 'EXPIRED') {
      trigger = 'credential.expired';
    } else if (!['ACTIVE', 'VERIFIED'].includes(freshResult.licenseStatus)) {
      trigger = 'verification.invalidated';
    }
  }

  if (trigger) {
    await propagateCredentialLifecycleChange({
      credentialId: artifact.id,
      trigger,
      occurredAt: statusCheckedAt,
      reason: `monitoring source reported ${freshResult.licenseStatus}`,
      metadata: {
        source: artifact.source,
        previousStatus: artifact.status,
        newStatus: freshResult.licenseStatus,
      },
    });
  }

  return {
    npi,
    changed: statusChanged,
    previousStatus: artifact.status,
    newStatus: freshResult.licenseStatus,
    trustState,
    monitoringEventId,
  };
}

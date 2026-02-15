import prisma from '../graphql/prisma_client';
import { queryNursysLicense, computeArtifactChecksum } from './nursysAdapter';
import { computeTrustState } from './trustState';
import type { Prisma } from '@prisma/client';

type MonitoringCheckResult = {
  npi: string;
  changed: boolean;
  previousStatus: string | null;
  newStatus: string;
  trustState: string;
};

/**
 * Run a monitoring check for a single NPI.
 *
 * 1. Fetch the latest artifact
 * 2. Re-query the source (Nursys adapter)
 * 3. Compare status
 * 4. If changed → create MonitoringEvent, update artifact
 * 5. Recompute and persist trust state
 */
export async function runMonitoringCheck(npi: string): Promise<MonitoringCheckResult> {
  const artifact = await prisma.verificationArtifact.findFirst({
    where: { npi },
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

  // Re-query source
  const freshResult = await queryNursysLicense(npi);
  const newChecksum = computeArtifactChecksum(freshResult);
  const statusChanged = artifact.status !== freshResult.licenseStatus;

  if (statusChanged) {
    // Record monitoring event
    await prisma.monitoringEvent.create({
      data: {
        npi,
        source: artifact.source,
        previousStatus: artifact.status,
        newStatus: freshResult.licenseStatus,
      },
    });

    // Emit audit trail
    await prisma.auditEvent.create({
      data: {
        type: 'MONITORING_STATUS_CHANGE',
        hash: newChecksum,
        clinicianId: npi,
        referenceId: artifact.id,
        metadata: {
          previousStatus: artifact.status,
          newStatus: freshResult.licenseStatus,
          source: artifact.source,
        } as unknown as Prisma.InputJsonValue,
      },
    });
  }

  // Recompute trust state regardless of change
  const expiresAt = freshResult.expirationDate ? new Date(freshResult.expirationDate) : null;
  const monitoring = artifact.monitoring;
  const trustState = computeTrustState(
    { status: freshResult.licenseStatus, expiresAt, monitoring },
  );

  // Update artifact with latest data
  await prisma.verificationArtifact.update({
    where: { id: artifact.id },
    data: {
      status: freshResult.licenseStatus,
      rawPayload: freshResult as unknown as Prisma.InputJsonValue,
      checksum: newChecksum,
      verifiedAt: new Date(),
      expiresAt,
      trustState,
    },
  });

  return {
    npi,
    changed: statusChanged,
    previousStatus: artifact.status,
    newStatus: freshResult.licenseStatus,
    trustState,
  };
}

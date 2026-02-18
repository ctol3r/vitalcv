import type { Prisma } from '@prisma/client';
import prisma from '../graphql/prisma_client';
import { computeCredentialState } from './credentialStatusEngine';
import { appendArtifactLifecycleEntry } from './transparencyLedger';
import { isStrictTransitionMode } from '../utils/environment';
import { CredentialLifecycleState } from '../utils/lifecycleState';

const MONITORING_WARNING_DAYS = 30;
const DAY_MS = 24 * 60 * 60 * 1000;

const MONITORING_EVENT_EXPIRATION_WARNING = 'expiration-warning' as const;
const MONITORING_EVENT_REVOCATION_DETECTED = 'revocation-detected' as const;

type MonitoringEventType = typeof MONITORING_EVENT_EXPIRATION_WARNING | typeof MONITORING_EVENT_REVOCATION_DETECTED;

type MonitoringRunResult = {
  totalActiveCredentials: number;
  expiringSoonCount: number;
  revokedCount: number;
  lastSweepTimestamp: string;
};

type MonitoringEventResult = {
  created: number;
  revoked: number;
  expiring: number;
};

let lastSweepTimestamp: Date | null = null;

function daysFromNow(days: number): Date {
  return new Date(Date.now() + days * DAY_MS);
}

function buildOrganizationFilter(organizationId?: string): Prisma.VerificationArtifactWhereInput {
  return organizationId ? { organizationId } : {};
}

async function recordMonitoringEvent(
  tx: Prisma.TransactionClient,
  artifactId: string,
  organizationId: string,
  eventType: MonitoringEventType,
): Promise<void> {
  try {
    await tx.credentialMonitoringEvent.create({
      data: {
        artifactId,
        organizationId,
        eventType,
      },
    });
  } catch {
    if (isStrictTransitionMode()) {
      throw new Error(`Unable to record monitoring event for artifact ${artifactId}.`);
    }
  }
}

async function appendMonitoringTransparency(
  tx: Prisma.TransactionClient,
  artifact: {
    id: string;
    checksum: string;
    merkleRoot: string | null;
    organizationId: string | null;
  },
  lifecycleState: string,
): Promise<void> {
  await appendArtifactLifecycleEntry(
    {
      id: artifact.id,
      checksum: artifact.checksum,
      merkleRoot: artifact.merkleRoot,
      lifecycleState,
      organizationId: artifact.organizationId,
    },
    {
      tx,
      strict: isStrictTransitionMode(),
    },
  );
}

async function updateArtifactState(
  tx: Prisma.TransactionClient,
  artifactId: string,
  lifecycleState: string,
  statusLastChecked: Date,
): Promise<void> {
  await tx.verificationArtifact.update({
    where: { id: artifactId },
    data: {
      lifecycleState,
      statusLastChecked,
    },
  });
}

export async function isMonitoringEngineOperational(): Promise<boolean> {
  try {
    await prisma.credentialMonitoringEvent.findFirst({
      select: { id: true },
      take: 1,
    });
    return true;
  } catch {
    return false;
  }
}

export async function assertMonitoringEngineEnabled(): Promise<void> {
  const enabled = await isMonitoringEngineOperational();
  if (!enabled) {
    throw new Error('Credential monitoring engine is disabled.');
  }
}

export async function runMonitoringSweep(organizationId?: string): Promise<MonitoringRunResult> {
  const now = new Date();
  const expirationCutoff = daysFromNow(MONITORING_WARNING_DAYS);
  const baseFilter = buildOrganizationFilter(organizationId);

  const [activeArtifacts, totalActiveCredentials] = await Promise.all([
    prisma.verificationArtifact.findMany({
      where: {
        ...baseFilter,
        lifecycleState: CredentialLifecycleState.ACTIVE,
      },
      orderBy: { createdAt: 'asc' },
      select: {
        id: true,
        npi: true,
        status: true,
        revokedAt: true,
        suspendedAt: true,
        expiresAt: true,
        statusLastChecked: true,
        checksum: true,
        merkleRoot: true,
        organizationId: true,
        lifecycleState: true,
      },
    }),
    prisma.verificationArtifact.count({
      where: {
        ...baseFilter,
        lifecycleState: CredentialLifecycleState.ACTIVE,
      },
    }),
  ]);

  const eventResult: MonitoringEventResult = {
    created: 0,
    revoked: 0,
    expiring: 0,
  };

  for (const artifact of activeArtifacts) {
    const artifactOrgId = artifact.organizationId?.trim() ?? '';
    if (!artifactOrgId) {
      if (isStrictTransitionMode()) {
        throw new Error(`Cannot run monitoring sweep for unscoped artifact ${artifact.id}.`);
      }
      continue;
    }

    const projectedLifecycle = computeCredentialState(
      {
        revokedAt: artifact.revokedAt,
        suspendedAt: artifact.suspendedAt,
        expiresAt: artifact.expiresAt,
        status: artifact.status,
      },
      now,
    );
    const hasRevocationDetected =
      artifact.lifecycleState !== CredentialLifecycleState.REVOKED &&
      projectedLifecycle === CredentialLifecycleState.REVOKED;

    const hasExpirationWarning =
      artifact.expiresAt !== null &&
      artifact.expiresAt.getTime() > now.getTime() &&
      artifact.expiresAt.getTime() <= expirationCutoff.getTime();

    if (!hasRevocationDetected && !hasExpirationWarning) {
      continue;
    }

    await prisma.$transaction(async (tx) => {
      if (hasRevocationDetected) {
        await recordMonitoringEvent(tx, artifact.id, artifactOrgId, MONITORING_EVENT_REVOCATION_DETECTED);
        eventResult.created += 1;
        eventResult.revoked += 1;
        await appendMonitoringTransparency(tx, artifact, projectedLifecycle);
        await updateArtifactState(tx, artifact.id, projectedLifecycle, now);
      }

      if (hasExpirationWarning) {
        await recordMonitoringEvent(tx, artifact.id, artifactOrgId, MONITORING_EVENT_EXPIRATION_WARNING);
        eventResult.created += 1;
        eventResult.expiring += 1;
        await appendMonitoringTransparency(tx, artifact, projectedLifecycle);
        await updateArtifactState(tx, artifact.id, artifact.lifecycleState, now);
      }
    });
  }

  lastSweepTimestamp = now;

  return {
    totalActiveCredentials,
    expiringSoonCount: eventResult.expiring,
    revokedCount: eventResult.revoked,
    lastSweepTimestamp: now.toISOString(),
  };
}

export async function getMonitoringStatus(organizationId?: string): Promise<{
  totalActiveCredentials: number;
  expiringSoonCount: number;
  revokedCount: number;
  lastSweepTimestamp: string | null;
}> {
  const now = new Date();
  const baseFilter = buildOrganizationFilter(organizationId);

  const [totalActiveCredentials, expiringSoonCount, revokedEventsCount, lastEvent] = await Promise.all([
    prisma.verificationArtifact.count({
      where: {
        ...baseFilter,
        lifecycleState: CredentialLifecycleState.ACTIVE,
      },
    }),
    prisma.verificationArtifact.count({
      where: {
        ...baseFilter,
        lifecycleState: CredentialLifecycleState.ACTIVE,
        expiresAt: {
          not: null,
          gt: now,
          lte: daysFromNow(MONITORING_WARNING_DAYS),
        },
      },
    }),
    prisma.credentialMonitoringEvent.count({
      where: {
        ...(organizationId ? { organizationId } : {}),
        eventType: MONITORING_EVENT_REVOCATION_DETECTED,
      },
    }),
    prisma.credentialMonitoringEvent.findFirst({
      where: organizationId ? { organizationId } : undefined,
      orderBy: { createdAt: 'desc' },
      select: { createdAt: true },
    }),
  ]);

  return {
    totalActiveCredentials,
    expiringSoonCount,
    revokedCount: revokedEventsCount,
    lastSweepTimestamp: lastSweepTimestamp?.toISOString() ?? lastEvent?.createdAt.toISOString() ?? null,
  };
}

import prisma from '../graphql/prisma_client';
import { log } from '../obs/logger';

const MS_PER_DAY = 24 * 60 * 60 * 1000;
const SWEEP_INTERVAL_MS = Number(process.env.CREDENTIAL_LIFECYCLE_SWEEP_MS || MS_PER_DAY);

type SweepSummary = {
  sweptAt: string;
  totalCredentials: number;
  updated: number;
  statusCounts: Record<string, number>;
  upcomingExpirations: number;
};

function startOfUtcDay(date: Date): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}

async function getRevokedCredentialIds(
  externalIds: string[],
): Promise<Set<string>> {
  if (!externalIds.length) return new Set();
  const revokeEvents = await prisma.auditEvent.findMany({
    where: { type: 'REVOKE_CREDENTIAL', credentialId: { in: externalIds } },
    select: { credentialId: true },
  });
  return new Set(revokeEvents.map((e) => e.credentialId).filter(Boolean) as string[]);
}

export async function runCredentialLifecycleSweep(): Promise<SweepSummary> {
  const now = new Date();
  const today = startOfUtcDay(now);

  const credentials = await prisma.credential.findMany({
    select: {
      id: true,
      status: true,
      expirationDate: true,
    },
  });

  const externalIds = credentials.map((cred) => `CRED-${cred.id}`);
  const revoked = await getRevokedCredentialIds(externalIds);

  const updates: Parameters<typeof prisma.$transaction>[0] = [];

  let updated = 0;
  const statusCounts: Record<string, number> = {};

  for (const credential of credentials) {
    const externalId = `CRED-${credential.id}`;
    let nextStatus = 'active';
    if (revoked.has(externalId)) {
      nextStatus = 'revoked';
    } else if (credential.expirationDate && credential.expirationDate < today) {
      nextStatus = 'inactive';
    }

    statusCounts[nextStatus] = (statusCounts[nextStatus] || 0) + 1;

    if (credential.status !== nextStatus) {
      updated += 1;
      updates.push(
        prisma.credential.update({
          where: { id: credential.id },
          data: { status: nextStatus },
        }),
      );
      updates.push(
        prisma.auditEvent.create({
          data: {
            type: 'status_changed',
            hash: `${externalId}:${nextStatus}:${now.toISOString()}`,
            credentialId: externalId,
            metadata: {
              from: credential.status,
              to: nextStatus,
              reason: revoked.has(externalId) ? 'revoked' : 'expired',
              sweptAt: now.toISOString(),
            },
          },
        }),
      );
    }
  }

  if (updates.length) {
    await prisma.$transaction(updates);
  }

  const upcomingExpirations = await prisma.credential.count({
    where: {
      expirationDate: {
        gte: today,
        lt: new Date(today.getTime() + 7 * MS_PER_DAY),
      },
      status: 'active',
    },
  });

  const summary: SweepSummary = {
    sweptAt: now.toISOString(),
    totalCredentials: credentials.length,
    updated,
    statusCounts,
    upcomingExpirations,
  };

  await prisma.auditEvent.create({
    data: {
      type: 'CREDENTIAL_LIFECYCLE_SWEEP',
      hash: `sweep:${now.toISOString()}`,
      metadata: summary,
    },
  });

  log('info', 'credential_lifecycle_sweep', summary);

  return summary;
}

export function startCredentialLifecycleSweep(): void {
  runCredentialLifecycleSweep().catch((e) => {
    log('error', 'credential_lifecycle_sweep_failed', {
      error: String(e instanceof Error ? e.message : e),
    });
  });

  setInterval(() => {
    runCredentialLifecycleSweep().catch((e) => {
      log('error', 'credential_lifecycle_sweep_failed', {
        error: String(e instanceof Error ? e.message : e),
      });
    });
  }, SWEEP_INTERVAL_MS);
}

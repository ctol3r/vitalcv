import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export interface ContractLifecycleEvent {
  type: 'renewal' | 'amendment' | 'expiration';
  date: Date;
  status: 'pending' | 'completed' | 'overdue';
  metadata?: Record<string, unknown>;
}

/**
 * Track contract lifecycle events
 */
export async function trackContractLifecycle(
  clinicianId: string,
  employerId: string,
  event: ContractLifecycleEvent,
): Promise<void> {
  const existing = await prisma.contractHealth.findUnique({
    where: {
      clinicianId_employerId: {
        clinicianId,
        employerId,
      },
    },
  });

  const health = existing?.health as Record<string, unknown> || {};
  const lifecycle = (health.lifecycle as ContractLifecycleEvent[]) || [];
  lifecycle.push(event);

  await prisma.contractHealth.upsert({
    where: {
      clinicianId_employerId: {
        clinicianId,
        employerId,
      },
    },
    create: {
      clinicianId,
      employerId,
      health: {
        lifecycle: [event],
      },
    },
    update: {
      health: {
        ...health,
        lifecycle,
      },
      updatedAt: new Date(),
    },
  });
}

/**
 * Get upcoming renewals
 */
export async function getUpcomingRenewals(daysAhead: number = 30): Promise<Array<{
  clinicianId: string;
  employerId: string;
  renewalDate: Date;
}>> {
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() + daysAhead);

  const contracts = await prisma.contractHealth.findMany({
    where: {
      updatedAt: {
        lte: cutoffDate,
      },
    },
  });

  const renewals: Array<{ clinicianId: string; employerId: string; renewalDate: Date }> = [];

  for (const contract of contracts) {
    const health = contract.health as Record<string, unknown>;
    const lifecycle = (health.lifecycle as ContractLifecycleEvent[]) || [];

    for (const event of lifecycle) {
      if (event.type === 'renewal' && event.status === 'pending') {
        const renewalDate = new Date(event.date);
        if (renewalDate <= cutoffDate) {
          renewals.push({
            clinicianId: contract.clinicianId,
            employerId: contract.employerId,
            renewalDate,
          });
        }
      }
    }
  }

  return renewals;
}

/**
 * Get expiring contracts
 */
export async function getExpiringContracts(daysAhead: number = 30): Promise<Array<{
  clinicianId: string;
  employerId: string;
  expirationDate: Date;
}>> {
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() + daysAhead);

  const contracts = await prisma.contractHealth.findMany();

  const expiring: Array<{ clinicianId: string; employerId: string; expirationDate: Date }> = [];

  for (const contract of contracts) {
    const health = contract.health as Record<string, unknown>;
    const lifecycle = (health.lifecycle as ContractLifecycleEvent[]) || [];

    for (const event of lifecycle) {
      if (event.type === 'expiration') {
        const expirationDate = new Date(event.date);
        if (expirationDate <= cutoffDate) {
          expiring.push({
            clinicianId: contract.clinicianId,
            employerId: contract.employerId,
            expirationDate,
          });
        }
      }
    }
  }

  return expiring;
}


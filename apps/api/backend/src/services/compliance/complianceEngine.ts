import prisma from '../../graphql/prisma_client';
import { randomUUID } from 'crypto';

export type BAAStatus = 'PENDING' | 'ACCEPTED' | 'REJECTED';

export async function logHIPAABAAAcceptance(organizationId: string, clerkUserId: string) {
  // Simulates an organization accepting a BAA for HIPAA compliance
  const hash = randomUUID();
  
  await prisma.auditEvent.create({
    data: {
      type: 'HIPAA_BAA_ACCEPTED',
      hash,
      organizationId,
      clinicianId: clerkUserId,
      metadata: {
        timestamp: new Date().toISOString(),
        action: 'baa_acceptance',
        version: 'v1.0.0'
      }
    }
  });

  return { status: 'ACCEPTED', hash };
}

export async function exportSOC2AuditLog(dateStart: Date, dateEnd: Date) {
  const events = await prisma.auditEvent.findMany({
    where: {
      createdAt: {
        gte: dateStart,
        lte: dateEnd
      }
    },
    orderBy: { createdAt: 'desc' },
    select: {
      id: true,
      type: true,
      clinicianId: true,
      referenceId: true,
      createdAt: true,
      metadata: true
    }
  });

  return {
    complianceFramework: 'SOC2',
    exportTimestamp: new Date(),
    recordCount: events.length,
    events
  };
}

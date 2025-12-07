import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export interface LifecycleTimelineEvent {
  id: string;
  type: 'ISSUANCE' | 'VERIFICATION' | 'REVOCATION' | 'MONITORING' | 'ANCHORING';
  title: string;
  description?: string;
  timestamp: Date;
  status: 'completed' | 'pending' | 'failed' | 'warning';
  txHash?: string;
  blockNumber?: number;
  metadata?: Record<string, any>;
}

export async function aggregateLifecycleEvents(credentialId: string): Promise<LifecycleTimelineEvent[]> {
  const credential = await prisma.credential.findUnique({
    where: { id: credentialId },
    include: {
      Revocation: true,
    },
  });

  if (!credential) {
    throw new Error('Credential not found');
  }

  const events: LifecycleTimelineEvent[] = [];

  // 1. Issuance Event
  events.push({
    id: `issuance-${credential.id}`,
    type: 'ISSUANCE',
    title: 'Credential Issued',
    description: `Issued by ${credential.issuer}`,
    timestamp: credential.issuedAt,
    status: 'completed',
    metadata: {
      issuer: credential.issuer,
      type: credential.type,
      version: credential.version,
    },
  });

  // 2. Revocation Events
  if (credential.Revocation && credential.Revocation.length > 0) {
    for (const rev of credential.Revocation) {
      events.push({
        id: `revocation-${rev.id}`,
        type: 'REVOCATION',
        title: 'Credential Revoked',
        description: rev.reason || 'No reason provided',
        timestamp: rev.revokedAt,
        status: 'warning',
        txHash: rev.revocationTxHash || undefined,
        metadata: {
          reason: rev.reason,
        },
      });
    }
  }

  // 3. Audit Events (Verification, Monitoring, Anchoring)
  // Search for audit events that reference this credential ID in their data payload
  const auditEvents = await prisma.auditEvent.findMany({
    where: {
      data: {
        path: ['credentialId'],
        equals: credentialId,
      },
    },
    orderBy: { createdAt: 'desc' },
  });

  for (const event of auditEvents) {
    let type: LifecycleTimelineEvent['type'] = 'MONITORING';
    let title = event.type.replace(/_/g, ' ');
    const status: LifecycleTimelineEvent['status'] = 'completed';

    if (event.type.toUpperCase().includes('VERIF')) {
      type = 'VERIFICATION';
    } else if (event.type.toUpperCase().includes('ANCHOR')) {
      type = 'ANCHORING';
    } else if (event.type.toUpperCase().includes('REVOK')) {
      // Skip if it's a revocation event already handled by the relation,
      // but often audit logs add more detail. Let's include it as a monitoring/audit record if distinct.
      // Or map it to REVOCATION type.
      type = 'REVOCATION';
    }

    // Check for txHash in event top-level or data
    const txHash = event.chainTxHash || (event.data as any)?.txHash;
    const blockNumber = (event.data as any)?.blockNumber;

    events.push({
      id: `audit-${event.id}`,
      type,
      title,
      timestamp: event.createdAt,
      status,
      txHash,
      blockNumber,
      metadata: event.data as Record<string, any>,
    });
  }

  // Sort events descending (newest first)
  return events.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
}















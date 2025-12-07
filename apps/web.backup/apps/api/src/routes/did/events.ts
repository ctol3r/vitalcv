import { Router, type Request, type Response } from 'express';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const router = Router();

router.get('/did/events', async (req: Request, res: Response) => {
  try {
    const clinicianId =
      typeof req.query.clinicianId === 'string' ? req.query.clinicianId : undefined;

    const [auditEvents, recoveryRecords] = await Promise.all([
      prisma.auditEvidence.findMany({
        where: {
          category: { in: ['did-rotation', 'did-delegation', 'did-recovery'] },
          ...(clinicianId ? { clinicianId } : {}),
        },
        orderBy: { createdAt: 'desc' },
        take: 100,
      }),
      fetchRecoveryRows(clinicianId),
    ]);

    const rotations = auditEvents
      .filter((event) => event.category === 'did-rotation')
      .map((event) => serializeAuditEvent(event));
    const delegations = auditEvents
      .filter((event) => event.category === 'did-delegation')
      .map((event) => serializeAuditEvent(event));
    const recoveries = auditEvents
      .filter((event) => event.category === 'did-recovery')
      .map((event) => serializeAuditEvent(event));

    return res.json({
      totalEvents: auditEvents.length,
      rotations,
      delegations,
      recoveries,
      recoveryRegistry: recoveryRecords,
    });
  } catch (error) {
    console.error('[DID] events fetch failed', error);
    return res.status(500).json({
      error: 'did_events_failed',
      message: error instanceof Error ? error.message : 'Unable to load DID lifecycle events',
    });
  }
});

function serializeAuditEvent(record: {
  id: string;
  clinicianId: string;
  category: string;
  payload: unknown;
  createdAt: Date;
}) {
  const payload = (record.payload ?? {}) as Record<string, any>;
  return {
    id: record.id,
    clinicianId: record.clinicianId,
    category: record.category,
    payload,
    createdAt: record.createdAt.toISOString(),
  };
}

async function fetchRecoveryRows(clinicianId?: string) {
  const store = (prisma as any).dIDRecovery;
  if (!store?.findMany) {
    return [];
  }
  const records = await store.findMany({
    where: clinicianId ? { clinicianId } : {},
    orderBy: { createdAt: 'desc' },
    take: 50,
  });
  return records.map((record: any) => ({
    id: record.id,
    clinicianId: record.clinicianId,
    recoveryDid: record.recoveryDid,
    method: record.method,
    createdAt: new Date(record.createdAt).toISOString(),
  }));
}

export default router;












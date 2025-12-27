import { Router } from 'express';
import prisma from '../../graphql/prisma_client';
import type { ReceiptTimelineEntry } from './models';
import { logAuditEvent } from '../audit/service';
import type { RequestWithId } from '../../obs/requestId';

export const receiptRouter = Router();

receiptRouter.get('/credentials/:credentialId/receipt', async (req: RequestWithId, res) => {
  const { credentialId } = req.params;

  const credential = await prisma.verifiableCredential.findUnique({
    where: { id: credentialId },
  });
  if (!credential) {
    return res.status(404).json({ error: 'Credential not found' });
  }

  const events = await prisma.auditEvent.findMany({
    where: { credentialId },
    orderBy: { createdAt: 'asc' },
  });

  const timeline: ReceiptTimelineEntry[] = events.map((event) => ({
    type: event.type as ReceiptTimelineEntry['type'],
    at: event.createdAt.toISOString?.() ?? new Date(event.createdAt).toISOString(),
    hash: event.hash,
    metadata: (event.metadata as Record<string, unknown> | null | undefined) ?? null,
  }));

  const audit = await logAuditEvent({
    type: 'RECEIPT_VIEWED',
    credentialId,
    metadata: { events: timeline.length },
    requestId: req.requestId,
  });

  return res.json({
    credentialId,
    proofHash: credential.proofHash,
    status: credential.status,
    expiresAt: credential.expiresAt?.toISOString?.() ?? null,
    issuedAt: credential.issuedAt.toISOString?.() ?? null,
    timeline,
    auditRef: audit.hash,
  });
});

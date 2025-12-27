import { Router } from 'express';
import { body } from 'express-validator';
import prisma from '../../graphql/prisma_client';
import { validateRequest } from '../../middleware/validateRequest';
import { logAuditEvent } from '../audit/service';
import type { RequestWithId } from '../../obs/requestId';

export const revocationRouter = Router();

revocationRouter.post(
  '/credentials/revoke',
  body('credentialId').isString().withMessage('credentialId is required'),
  body('reason').optional().isString(),
  body('revokedBy').optional().isString(),
  validateRequest,
  async (req: RequestWithId, res) => {
    const { credentialId, reason, revokedBy } = req.body as Record<string, string | undefined>;

    const credential = await prisma.verifiableCredential.findUnique({
      where: { id: credentialId },
    });

    if (!credential) {
      return res.status(404).json({ error: 'Credential not found' });
    }

    const revokedAt = new Date();

    await prisma.credentialRevocation.create({
      data: {
        credentialId,
        reason,
        revokedAt,
        revokedBy,
      },
    });

    await prisma.verifiableCredential.update({
      where: { id: credentialId },
      data: { status: 'revoked' },
    });

    const audit = await logAuditEvent({
      type: 'REVOKE',
      credentialId,
      metadata: { reason: reason ?? null, revokedBy: revokedBy ?? null, revokedAt: revokedAt.toISOString() },
      requestId: req.requestId,
    });

    return res.status(200).json({
      credentialId,
      status: 'revoked',
      revokedAt: revokedAt.toISOString(),
      reason: reason ?? null,
      auditRef: audit.hash,
    });
  },
);

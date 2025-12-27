import crypto from 'crypto';
import { type Request, type Response, Router } from 'express';
import { body } from 'express-validator';
import prisma from '../graphql/prisma_client';
import { validateRequest } from '../middleware/validateRequest';

const router = Router();

function sha256Hex(input: string): string {
  return crypto.createHash('sha256').update(input).digest('hex');
}

function privacyDigest(value: string): string {
  const pepper = process.env.WORLD_ID_PEPPER || process.env.WORLD_ID_NULLIFIER_PEPPER || '';
  return sha256Hex(`${pepper}:${value}`);
}

async function writeAuditEvent(event: {
  type: string;
  credentialId?: string;
  userId?: number;
  metadata?: any;
}): Promise<{ hash: string; createdAt: string }> {
  const createdAt = new Date();
  const hash = sha256Hex(
    JSON.stringify({
      type: event.type,
      credentialId: event.credentialId || null,
      userId: event.userId || null,
      createdAt: createdAt.toISOString(),
      metadata: event.metadata || null,
    }),
  );

  await prisma.auditEvent.create({
    data: {
      type: event.type,
      hash,
      credentialId: event.credentialId,
      userId: event.userId,
      metadata: event.metadata ?? undefined,
      createdAt,
    },
  });

  return { hash, createdAt: createdAt.toISOString() };
}

router.post(
  '/erase',
  body('clinicianId').isString().withMessage('clinicianId is required'),
  body('auth').isString().withMessage('auth is required'),
  validateRequest,
  async (req: Request, res: Response) => {
    const clinicianIdRaw = String(req.body.clinicianId || '').trim();
    const authRaw = String(req.body.auth || '').trim();

    const clinicianIdAsNumber = Number(clinicianIdRaw);
    const user = Number.isInteger(clinicianIdAsNumber)
      ? await prisma.user.findUnique({ where: { id: clinicianIdAsNumber } })
      : await prisma.user.findUnique({ where: { email: clinicianIdRaw } });

    if (!user) return res.status(404).json({ error: 'Clinician not found' });

    const anonymizedEmail = `redacted+${privacyDigest(user.email)}@vitalcv.invalid`;

    await prisma.user.update({
      where: { id: user.id },
      data: {
        deletionRequestedAt: new Date(),
        name: 'Redacted User',
        email: anonymizedEmail,
      },
    });

    const audit = await writeAuditEvent({
      type: 'AUDIT_ERASURE_REQUEST',
      userId: user.id,
      metadata: {
        clinicianId: privacyDigest(clinicianIdRaw),
        authDigest: privacyDigest(authRaw),
        anonymizedEmail,
      },
    });

    return res.json({
      success: true,
      auditRef: audit.hash,
      deletionRequestedAt: audit.createdAt,
    });
  },
);

export default router;

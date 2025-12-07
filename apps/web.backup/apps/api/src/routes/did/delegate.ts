import { Router, type Request, type Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { registerDelegate, listDelegates } from '../../services/did/delegate';

const prisma = new PrismaClient();
const router = Router();

router.post('/did/delegate', async (req: Request, res: Response) => {
  try {
    const record = await registerDelegate(prisma, {
      clinicianId: req.body?.clinicianId,
      delegateDid: req.body?.delegateDid,
      scopes: req.body?.scopes ?? [],
      expiresAt: req.body?.expiresAt,
      note: req.body?.note,
    });
    return res.status(201).json(record);
  } catch (error) {
    console.error('[DID] delegate create failed', error);
    return res.status(400).json({
      error: 'delegate_create_failed',
      message: error instanceof Error ? error.message : 'Unable to register delegate',
    });
  }
});

router.get('/did/delegate', async (req: Request, res: Response) => {
  try {
    const clinicianId =
      typeof req.query.clinicianId === 'string' ? req.query.clinicianId : undefined;
    const delegates = await listDelegates(prisma, clinicianId);
    return res.json({
      total: delegates.length,
      delegates,
    });
  } catch (error) {
    console.error('[DID] delegate list failed', error);
    return res.status(500).json({
      error: 'delegate_list_failed',
      message: error instanceof Error ? error.message : 'Unable to list delegates',
    });
  }
});

export default router;












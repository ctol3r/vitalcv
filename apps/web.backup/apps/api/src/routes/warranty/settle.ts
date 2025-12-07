import { Router, type Request, type Response } from 'express';
import { PrismaClient } from '@prisma/client';

import { settleWarrantyClaim } from '../../services/warranty/settlement';

const router = Router();
const prisma = new PrismaClient();

router.post('/warranty/settle', async (req: Request, res: Response) => {
  try {
    const { credentialId, claimAmount, reason, credentialType, issuerDid } = req.body ?? {};
    if (!credentialId || !claimAmount || !credentialType || !issuerDid) {
      return res.status(400).json({
        error: 'invalid_payload',
        message: 'credentialId, credentialType, issuerDid and claimAmount are required',
      });
    }

    const decision = await settleWarrantyClaim(prisma, {
      credentialId: credentialId.trim(),
      credentialType: String(credentialType),
      issuerDid: String(issuerDid),
      claimAmount: Number(claimAmount),
      reason: reason ? String(reason) : undefined,
    });

    return res.json(decision);
  } catch (error) {
    console.error('[warranty][settle] claim failed', error);
    if (error instanceof Error && error.message === 'credential_warranty_not_found') {
      return res.status(404).json({
        error: 'warranty_not_found',
        message: 'No active warranty found for credential',
      });
    }
    return res.status(500).json({
      error: 'warranty_settlement_failed',
      message: error instanceof Error ? error.message : 'Unexpected settlement error',
    });
  }
});

export default router;











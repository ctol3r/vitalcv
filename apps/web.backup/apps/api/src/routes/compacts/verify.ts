import { Router, type Request, type Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { anchorCompactChange } from '../../services/audit/anchor';

const prisma = new PrismaClient();
const router = Router();

router.post('/:clinicianId', async (req: Request, res: Response) => {
  try {
    const clinicianId = req.params.clinicianId;
    const compact = typeof req.body?.compact === 'string' ? req.body.compact : 'IMLC';
    const sanctionsClear = req.body?.sanctionsClear !== false;
    const homeState = typeof req.body?.homeState === 'string' ? req.body.homeState : undefined;

    const documents = await prisma.compactDocument.findMany({
      where: { clinicianId, compact },
      orderBy: { createdAt: 'desc' },
    });

    const hasVerifiedDoc = documents.some((doc) => doc.verified);
    const missingDocs = hasVerifiedDoc ? [] : [`${compact} participation attestation`];

    const eligibility =
      hasVerifiedDoc && sanctionsClear ? 'ELIGIBLE' : missingDocs.length ? 'PENDING' : 'REVIEW';

    if (eligibility === 'ELIGIBLE') {
      anchorCompactChange('compactEligible', {
        clinicianId,
        compact,
        reason: 'verification_passed',
        homeState,
      });
    } else if (!sanctionsClear) {
      anchorCompactChange('compactRevoked', {
        clinicianId,
        compact,
        reason: 'sanctions_block',
        homeState,
      });
    }

    return res.json({
      clinicianId,
      compact,
      eligibility,
      sanctionsClear,
      missingDocs,
      documents,
      reviewedAt: new Date().toISOString(),
    });
  } catch (error) {
    console.error('[Compacts][verify] failed', error);
    return res.status(400).json({
      error: 'compact_verify_failed',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

export default router;











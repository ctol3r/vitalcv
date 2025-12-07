import { Router, type Request, type Response } from 'express';
import { PrismaClient } from '@prisma/client';

import {
  generateEvidencePack,
  registerEvidencePackShare,
  type EvidencePackType,
} from '../../services/compliance/ncqa-pack';

const prisma = new PrismaClient();
const router = Router();

router.post('/share', async (req: Request, res: Response) => {
  const { clinicianId, packType, recipientOrgId, expiresInHours } = req.body ?? {};

  if (!clinicianId || typeof clinicianId !== 'string') {
    return res.status(400).json({
      error: 'clinician_id_required',
      message: 'clinicianId is required to generate an evidence pack.',
    });
  }

  if (!isSupportedPackType(packType)) {
    return res.status(400).json({
      error: 'invalid_pack_type',
      message: 'packType must be one of ncqa-cr, dea-mate, or tjc-psv.',
    });
  }

  try {
    const buildResult = await generateEvidencePack(clinicianId, packType, { prisma });
    const shareResult = await registerEvidencePackShare({
      recordId: buildResult.packId,
      recipientOrgId:
        typeof recipientOrgId === 'string' && recipientOrgId.trim().length
          ? recipientOrgId.trim()
          : null,
      expiresInHours: typeof expiresInHours === 'number' ? expiresInHours : undefined,
      prisma,
    });

    const shareUrl = buildShareUrl(shareResult.share.shareId, shareResult.share.shareToken);

    return res.json({
      shareId: shareResult.share.shareId,
      shareToken: shareResult.share.shareToken,
      shareUrl,
      expiresAt: shareResult.share.expiresAt,
      packId: buildResult.packId,
      packType: buildResult.packType,
      manifest: buildResult.manifest,
      manifestYaml: buildResult.manifestYaml,
      warnings: buildResult.warnings,
      anchors: buildResult.anchors,
    });
  } catch (error) {
    console.error('[compliance:share] evidence sharing failed', error);
    return res.status(500).json({
      error: 'evidence_share_failed',
      message: error instanceof Error ? error.message : 'Unexpected error while sharing evidence.',
    });
  }
});

function isSupportedPackType(value: unknown): value is EvidencePackType {
  return value === 'ncqa-cr' || value === 'dea-mate' || value === 'tjc-psv';
}

function buildShareUrl(shareId: string, token: string): string | null {
  const base =
    process.env.EVIDENCE_SHARE_BASE_URL ??
    process.env.NEXT_PUBLIC_API_BASE ??
    process.env.NEXT_PUBLIC_API_BASE_URL ??
    '';
  if (!base) {
    return null;
  }
  const normalizedBase = base.replace(/\/$/, '');
  return `${normalizedBase}/compliance/share/${shareId}?token=${token}`;
}

export default router;


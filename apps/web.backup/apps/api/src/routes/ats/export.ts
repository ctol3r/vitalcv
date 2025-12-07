import { Router, type Request, type Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { sendAtsFhirExport } from '../../services/fhir/ats-export';

const router = Router();
const prisma = new PrismaClient();

interface AtsExportRequestBody {
  orgId?: string;
  webhookId?: string;
}

router.post('/ats/export/:clinicianId', async (req: Request<{ clinicianId: string }, unknown, AtsExportRequestBody>, res: Response) => {
  const { clinicianId } = req.params;

  if (!clinicianId) {
    return res.status(400).json({
      error: 'clinician_id_required',
      message: 'Clinician identifier is required',
    });
  }

  try {
    const payload = req.body ?? {};
    const webhookRecord = await resolveWebhookRecord({
      clinicianId,
      candidateOrgId: payload.orgId,
      webhookId: payload.webhookId,
    });

    if (!webhookRecord) {
      return res.status(404).json({
        error: 'webhook_not_found',
        message: 'No ATS webhook registered for this organization',
      });
    }

    const exportResult = await sendAtsFhirExport({
      clinicianId,
      webhook: {
        id: webhookRecord.id,
        url: webhookRecord.url,
        secret: webhookRecord.secret,
      },
      orgId: payload.orgId ?? webhookRecord.orgId,
      prisma,
    });

    return res.status(202).json({
      status: 'delivered',
      webhookId: exportResult.webhookId,
      payloadHash: exportResult.payloadHash,
      responseStatus: exportResult.responseStatus,
      deliveredAt: new Date().toISOString(),
    });
  } catch (error) {
    console.error('[ATS] export failed', error);
    return res.status(500).json({
      error: 'ats_export_failed',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

async function resolveWebhookRecord(input: {
  clinicianId: string;
  candidateOrgId?: string;
  webhookId?: string;
}) {
  if (input.webhookId) {
    return prisma.aTSWebhook.findUnique({
      where: { id: input.webhookId },
    });
  }

  const orgId =
    input.candidateOrgId ??
    (await prisma.clinicianProfile
      .findUnique({
        where: { id: input.clinicianId },
        select: { orgId: true },
      })
      .then((record) => record?.orgId ?? null));

  if (!orgId) {
    return null;
  }

  const matches = await prisma.aTSWebhook.findMany({
    where: { orgId },
    orderBy: { createdAt: 'desc' },
    take: 1,
  });

  return matches[0] ?? null;
}

export default router;












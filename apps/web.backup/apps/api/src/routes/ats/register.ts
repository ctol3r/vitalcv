import { Router, type Request, type Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { normalizeAtsEvents, normalizeClinicianFilters } from '../../services/ats/config';
import { generateSigningSecret, normalizeWebhookUrl } from './utils';

const router = Router();
const prisma = new PrismaClient();

interface AtsRegisterRequest {
  url: string;
  orgId: string;
  label?: string;
  events?: string[] | string;
  clinicianIds?: string[] | string;
}

router.post('/ats/register', async (req: Request<unknown, unknown, AtsRegisterRequest>, res: Response) => {
  try {
    const payload = validateRegisterRequest(req.body);
    const normalizedUrl = normalizeWebhookUrl(payload.url);
    const secret = generateSigningSecret();
    const events = normalizeAtsEvents(payload.events);
    const clinicianFilters = normalizeClinicianFilters(payload.clinicianIds);

    const record = await prisma.aTSWebhook.create({
      data: {
        orgId: payload.orgId,
        url: normalizedUrl,
        secret,
        events,
        clinicianFilters,
      },
    });

    return res.status(201).json({
      webhookId: record.id,
      orgId: record.orgId,
      url: record.url,
      secret,
      createdAt: record.createdAt,
      events: record.events,
      clinicianFilters: record.clinicianFilters,
    });
  } catch (error) {
    console.error('[ATS] webhook registration failed', error);
    return res.status(400).json({
      error: 'ats_registration_failed',
      error_description: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

function validateRegisterRequest(body: Partial<AtsRegisterRequest>): AtsRegisterRequest {
  if (!body || typeof body !== 'object') {
    throw new Error('Request body is required');
  }
  if (!body.url || typeof body.url !== 'string') {
    throw new Error('Webhook url is required');
  }
  if (!body.orgId || typeof body.orgId !== 'string') {
    throw new Error('orgId is required');
  }
  return {
    url: body.url,
    orgId: body.orgId,
    label: typeof body.label === 'string' ? body.label : undefined,
    events: body.events,
    clinicianIds: body.clinicianIds,
  };
}

export default router;



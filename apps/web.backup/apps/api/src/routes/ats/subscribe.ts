import { Router, type Request, type Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { normalizeAtsEvents, normalizeClinicianFilters, type AtsEventType } from '../../services/ats/config';
import { generateSigningSecret, normalizeWebhookUrl } from './utils';

const router = Router();
const prisma = new PrismaClient();

const MAX_SEEDED_CLINICIANS = 25;

interface AtsSubscribeRequest {
  orgId?: string;
  url?: string;
  clinicianIds?: string[] | string;
  events?: string[] | string;
  seedInitialSync?: boolean;
}

interface NormalizedSubscribeRequest {
  orgId: string;
  url: string;
  clinicianIds: string[];
  events: AtsEventType[];
  seedInitialSync: boolean;
}

router.post('/api/ats/subscribe', async (req: Request<unknown, unknown, AtsSubscribeRequest>, res: Response) => {
  try {
    const payload = normalizeRequestBody(req.body);
    const secret = generateSigningSecret();

    const record = await prisma.aTSWebhook.create({
      data: {
        orgId: payload.orgId,
        url: payload.url,
        secret,
        events: payload.events,
        clinicianFilters: payload.clinicianIds,
      },
    });

    const seededCount = await seedInitialQueue({
      orgId: payload.orgId,
      clinicianIds: payload.clinicianIds,
      events: payload.events,
      seedInitialSync: payload.seedInitialSync,
      webhookId: record.id,
    });

    return res.status(201).json({
      webhookId: record.id,
      orgId: record.orgId,
      url: record.url,
      secret,
      events: record.events,
      clinicianFilters: record.clinicianFilters,
      seededRecords: seededCount,
    });
  } catch (error) {
    console.error('[ATS] subscribe failed', error);
    return res.status(400).json({
      error: 'ats_subscribe_failed',
      error_description: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

function normalizeRequestBody(body: AtsSubscribeRequest | undefined | null): NormalizedSubscribeRequest {
  if (!body || typeof body !== 'object') {
    throw new Error('Request body is required');
  }

  if (!body.orgId || typeof body.orgId !== 'string') {
    throw new Error('orgId is required');
  }

  if (!body.url || typeof body.url !== 'string') {
    throw new Error('Webhook url is required');
  }

  return {
    orgId: body.orgId,
    url: normalizeWebhookUrl(body.url),
    clinicianIds: normalizeClinicianFilters(body.clinicianIds),
    events: normalizeAtsEvents(body.events),
    seedInitialSync: Boolean(body.seedInitialSync),
  };
}

async function seedInitialQueue(options: {
  orgId: string;
  clinicianIds: string[];
  events: AtsEventType[];
  seedInitialSync: boolean;
  webhookId: string;
}): Promise<number> {
  if (!options.seedInitialSync) {
    return 0;
  }
  if (options.clinicianIds.length === 0) {
    return 0;
  }
  if (!options.events.includes('readinessUpdate')) {
    return 0;
  }

  const targets = options.clinicianIds.slice(0, MAX_SEEDED_CLINICIANS);
  await prisma.$transaction(
    targets.map((clinicianId) =>
      prisma.candidateSyncQueue.create({
        data: {
          clinicianId,
          orgId: options.orgId,
          event: 'readinessUpdate',
          payload: {
            webhookId: options.webhookId,
            seed: true,
            note: 'ATS subscription bootstrap',
            clinicianId,
          },
        },
      }),
    ),
  );

  return targets.length;
}

export default router;



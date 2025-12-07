import { PrismaClient } from '@prisma/client';
import { buildAtsApplicantBundle } from '../fhir/ats-export';
import { getServiceLogger } from '../../../../services/logging/serviceLogger';
import { matchesClinicianFilter, matchesEventPreference, type AtsEventType } from './config';

const prisma = new PrismaClient();
const log = getServiceLogger('api/services/ats/events');
const READINESS_DELTA_THRESHOLD = Number(process.env.ATS_READINESS_DELTA ?? 0.1);
const READINESS_EVENT: AtsEventType = 'readinessUpdate';

export interface ReadinessDeltaOptions {
  clinicianId: string;
  before?: number | null;
  after: number;
  orgId?: string | null;
}

export async function enqueueReadinessUpdate(
  options: ReadinessDeltaOptions,
): Promise<boolean> {
  const before = options.before ?? 0;
  const delta = options.after - before;

  if (!(delta > READINESS_DELTA_THRESHOLD)) {
    return false;
  }

  const orgId =
    options.orgId ??
    (
      await prisma.clinicianProfile.findUnique({
        where: { id: options.clinicianId },
        select: { orgId: true },
      })
    )?.orgId ??
    null;

  if (!orgId) {
    log.warn('Cannot queue ATS readiness update without org binding', {
      clinicianId: options.clinicianId,
    });
    return false;
  }

  const webhooks = await prisma.aTSWebhook.findMany({
    where: { orgId },
    orderBy: { createdAt: 'desc' },
  });

  const eligibleWebhooks = webhooks.filter(
    (webhook) =>
      matchesEventPreference(webhook.events, READINESS_EVENT) &&
      matchesClinicianFilter(webhook.clinicianFilters, options.clinicianId),
  );

  if (eligibleWebhooks.length === 0) {
    return false;
  }

  const applicant = await buildAtsApplicantBundle({
    clinicianId: options.clinicianId,
    orgId,
    prisma,
  });

  await prisma.$transaction(
    eligibleWebhooks.map((webhook) =>
      prisma.candidateSyncQueue.create({
        data: {
          clinicianId: options.clinicianId,
          orgId,
          event: READINESS_EVENT,
          payload: {
            webhookId: webhook.id,
            diff: {
              before,
              after: options.after,
              delta: Number(delta.toFixed(4)),
            },
            bundle: applicant.bundle,
          },
        },
      }),
    ),
  );

  log.info('Queued ATS readiness update', {
    clinicianId: options.clinicianId,
    orgId,
    delta: Number(delta.toFixed(4)),
    webhookCount: eligibleWebhooks.length,
  });

  return true;
}


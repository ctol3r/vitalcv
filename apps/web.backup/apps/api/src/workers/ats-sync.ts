import { PrismaClient, type CandidateSyncQueue } from '@prisma/client';
import { sendAtsFhirExport, type AtsWebhookTarget } from '../services/fhir/ats-export';
import { getServiceLogger } from '../../../../services/logging/serviceLogger';

const prisma = new PrismaClient();
const log = getServiceLogger('api/workers/ats-sync');

const POLL_INTERVAL_MS = Number(process.env.ATS_SYNC_INTERVAL_MS ?? 60_000);
const MAX_BATCH = Number(process.env.ATS_SYNC_BATCH ?? 25);
const MAX_BACKOFF_MS = Number(process.env.ATS_SYNC_MAX_BACKOFF_MS ?? 30 * 60_000);

type QueuePayload = {
  webhookId?: string;
  diff?: {
    before?: number | null;
    after: number;
  };
  bundle?: unknown;
  retryCount?: number;
  nextAttemptAt?: string;
  lastError?: string;
  deliveredAt?: string;
  [key: string]: unknown;
};

let pollTimer: NodeJS.Timeout | null = null;

export function startAtsSyncWorker(): void {
  if (pollTimer) {
    return;
  }

  pollTimer = setInterval(() => {
    runAtsSyncBatch().catch((error) => {
      log.error('ATS sync batch failed', { error });
    });
  }, POLL_INTERVAL_MS);

  log.info('ATS sync worker started', { intervalMs: POLL_INTERVAL_MS });
}

export async function runAtsSyncBatch(): Promise<number> {
  const now = Date.now();
  const queue = await prisma.candidateSyncQueue.findMany({
    where: { processed: false },
    orderBy: { createdAt: 'asc' },
    take: MAX_BATCH,
  });

  let processed = 0;
  for (const item of queue) {
    const payload = parsePayload(item.payload);
    if (shouldSkipUntilLater(payload, now)) {
      continue;
    }

    try {
      const webhook = await resolveWebhook(item, payload);
      if (!webhook) {
        await markAsProcessed(item.id, payload, 'missing_webhook');
        continue;
      }

      await sendAtsFhirExport({
        clinicianId: item.clinicianId,
        orgId: item.orgId,
        webhook,
        prisma,
      });

      await prisma.candidateSyncQueue.update({
        where: { id: item.id },
        data: {
          processed: true,
          payload: {
            ...payload,
            deliveredAt: new Date().toISOString(),
            lastError: null,
          },
        },
      });

      processed += 1;
      log.info('ATS sync delivered', {
        queueId: item.id,
        clinicianId: item.clinicianId,
        orgId: item.orgId,
        webhookId: payload.webhookId,
      });
    } catch (error) {
      await backoffQueueItem(item.id, payload, error);
    }
  }

  return processed;
}

function parsePayload(payload: CandidateSyncQueue['payload']): QueuePayload {
  if (payload && typeof payload === 'object' && !Array.isArray(payload)) {
    return { ...(payload as Record<string, unknown>) } as QueuePayload;
  }
  return {};
}

function shouldSkipUntilLater(payload: QueuePayload, nowMs: number): boolean {
  if (!payload.nextAttemptAt) {
    return false;
  }
  const scheduled = Date.parse(payload.nextAttemptAt);
  if (Number.isNaN(scheduled)) {
    return false;
  }
  return scheduled > nowMs;
}

async function resolveWebhook(
  item: CandidateSyncQueue,
  payload: QueuePayload,
): Promise<AtsWebhookTarget | null> {
  if (payload.webhookId) {
    const record = await prisma.aTSWebhook.findUnique({
      where: { id: payload.webhookId },
    });
    if (record) {
      return {
        id: record.id,
        url: record.url,
        secret: record.secret,
      };
    }
  }

  const fallback = await prisma.aTSWebhook.findFirst({
    where: { orgId: item.orgId },
    orderBy: { createdAt: 'desc' },
  });

  return fallback
    ? {
        id: fallback.id,
        url: fallback.url,
        secret: fallback.secret,
      }
    : null;
}

async function markAsProcessed(
  queueId: string,
  payload: QueuePayload,
  reason: string,
): Promise<void> {
  await prisma.candidateSyncQueue.update({
    where: { id: queueId },
    data: {
      processed: true,
      payload: {
        ...payload,
        deliveredAt: new Date().toISOString(),
        lastError: reason,
      },
    },
  });
}

async function backoffQueueItem(
  queueId: string,
  payload: QueuePayload,
  error: unknown,
): Promise<void> {
  const retryCount = (payload.retryCount ?? 0) + 1;
  const delay = Math.min(2 ** retryCount * 1_000, MAX_BACKOFF_MS);
  const nextAttemptAt = new Date(Date.now() + delay).toISOString();
  const message = error instanceof Error ? error.message : 'unknown_error';

  log.warn('ATS sync delivery failed', {
    queueId,
    retryCount,
    nextAttemptAt,
    error: message,
  });

  await prisma.candidateSyncQueue.update({
    where: { id: queueId },
    data: {
      payload: {
        ...payload,
        retryCount,
        nextAttemptAt,
        lastError: message,
      },
    },
  });
}

if (require.main === module) {
  startAtsSyncWorker();
  runAtsSyncBatch().catch((error) => {
    console.error('[ats-sync] initial batch failed', error);
  });
}











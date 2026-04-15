import prisma from '../graphql/prisma_client';
import { log } from '../obs/logger';
import {
  deliverIntegrationWebhook,
  integrationWebhookAggregateType,
  markIntegrationWebhookDeliveryFailure,
  markIntegrationWebhookDeliverySuccess,
  parseIntegrationWebhookOutboxPayload,
} from '../services/integration/webhookSystem';

const DEFAULT_INTERVAL_MS = 5_000;

let intervalHandle: NodeJS.Timeout | null = null;
let processing = false;

async function claimOutboxRow(id: string): Promise<boolean> {
  const result = await prisma.outboxEvent.updateMany({
    where: {
      id,
      status: 'PENDING',
    },
    data: {
      status: 'PROCESSING',
    },
  });

  return result.count === 1;
}

export async function processIntegrationWebhookOutboxBatch(limit = 25): Promise<number> {
  if (processing) {
    return 0;
  }

  processing = true;
  try {
    const rows = await prisma.outboxEvent.findMany({
      where: {
        aggregateType: integrationWebhookAggregateType,
        status: 'PENDING',
        availableAt: { lte: new Date() },
      },
      orderBy: [
        { availableAt: 'asc' },
        { createdAt: 'asc' },
      ],
      take: limit,
      select: {
        id: true,
        payload: true,
        attemptCount: true,
      },
    });

    let delivered = 0;

    for (const row of rows) {
      const claimed = await claimOutboxRow(row.id);
      if (!claimed) {
        continue;
      }

      let payload;
      try {
        payload = parseIntegrationWebhookOutboxPayload(row.payload);
      } catch (error) {
        await markIntegrationWebhookDeliveryFailure(null, row.id, row.attemptCount, error);
        log('warn', 'integration_webhook_payload_invalid', {
          outboxId: row.id,
          error: error instanceof Error ? error.message : 'unknown',
        });
        continue;
      }

      try {
        await deliverIntegrationWebhook(payload);
        await markIntegrationWebhookDeliverySuccess(payload.subscriptionId, row.id);
        delivered += 1;
      } catch (error) {
        await markIntegrationWebhookDeliveryFailure(payload.subscriptionId, row.id, row.attemptCount, error);
        log('warn', 'integration_webhook_delivery_failed', {
          outboxId: row.id,
          subscriptionId: payload.subscriptionId,
          attemptCount: row.attemptCount + 1,
          error: error instanceof Error ? error.message : 'unknown',
        });
      }
    }

    return delivered;
  } finally {
    processing = false;
  }
}

export function startIntegrationWebhookWorker(intervalMs = DEFAULT_INTERVAL_MS): void {
  if (process.env.NODE_ENV === 'test') {
    return;
  }

  if (intervalHandle) {
    return;
  }

  intervalHandle = setInterval(() => {
    void processIntegrationWebhookOutboxBatch().catch((error) => {
      log('error', 'integration_webhook_worker_cycle_failed', {
        error: error instanceof Error ? error.message : 'unknown',
      });
    });
  }, intervalMs);

  intervalHandle.unref?.();

  log('info', 'integration_webhook_worker_started', { intervalMs });
}

export function stopIntegrationWebhookWorker(): void {
  if (!intervalHandle) {
    return;
  }

  clearInterval(intervalHandle);
  intervalHandle = null;
  log('info', 'integration_webhook_worker_stopped');
}

import prisma from '../graphql/prisma_client';
import { log } from '../obs/logger';
import {
  dispatchEnterpriseWebhook,
  resolveEnterpriseWebhookTarget,
  type EnterpriseWebhookPayload,
} from '../services/integration/webhookDispatcher';
import type { RevocationOutboxPayload } from '../services/revocation/propagationEngine';

const DEFAULT_INTERVAL_MS = 5_000;
const MAX_ATTEMPTS = 4;

let intervalHandle: NodeJS.Timeout | null = null;
let processing = false;

function nextDelayMs(attemptCount: number): number {
  return 1_000 * Math.pow(2, Math.max(0, attemptCount));
}

function parsePayload(value: unknown): RevocationOutboxPayload {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error('Outbox payload must be an object.');
  }

  return value as RevocationOutboxPayload;
}

function toWebhookPayload(
  rowId: string,
  payload: RevocationOutboxPayload,
): EnterpriseWebhookPayload {
  return {
    schema: 'vitalcv.enterprise.v1',
    event: payload.event,
    delivery_id: rowId,
    issued_at: new Date().toISOString(),
    credential: {
      artifact_id: payload.artifactId,
      npi_prefix: payload.npiPrefix,
      source: payload.source,
      changed_at: payload.changedAt,
      reason: payload.reason,
      lifecycle_state: payload.lifecycleState,
    },
    cascade: {
      affected: payload.impactedCapsules.total,
      invalid: payload.impactedCapsules.invalidated,
      at_risk: payload.impactedCapsules.atRisk,
      capsule_ids: payload.impactedCapsules.capsuleIds,
    },
    trust_state: {
      previous_band: payload.trustState.previousBand,
      new_band: payload.trustState.newBand,
      snapshot_artifact_id: payload.trustState.snapshotArtifactId,
      computed_at: payload.trustState.computedAt,
    },
    employer: {
      employer_id: payload.employerId,
      acceptance_id: payload.acceptanceId,
    },
  };
}

async function markProcessing(id: string): Promise<boolean> {
  const result = await prisma.revocationOutboxEvent.updateMany({
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

async function deliverRow(row: {
  id: string;
  payload: unknown;
  attemptCount: number;
}): Promise<void> {
  const payload = parsePayload(row.payload);
  const target = await resolveEnterpriseWebhookTarget(payload.employerId, payload.acceptanceId);
  if (!target) {
    throw new Error(`No active webhook config for employer ${payload.employerId}.`);
  }

  await dispatchEnterpriseWebhook(target, toWebhookPayload(row.id, payload));
}

async function finalizeSuccess(id: string): Promise<void> {
  await prisma.revocationOutboxEvent.update({
    where: { id },
    data: {
      status: 'DELIVERED',
      lastError: null,
      dispatchedAt: new Date(),
    },
  });
}

async function finalizeFailure(id: string, attemptCount: number, error: unknown): Promise<void> {
  const nextAttemptCount = attemptCount + 1;
  const terminalFailure = nextAttemptCount >= MAX_ATTEMPTS;

  await prisma.revocationOutboxEvent.update({
    where: { id },
    data: {
      status: terminalFailure ? 'FAILED' : 'PENDING',
      attemptCount: nextAttemptCount,
      lastError: error instanceof Error ? error.message : String(error),
      availableAt: terminalFailure ? new Date() : new Date(Date.now() + nextDelayMs(attemptCount)),
    },
  });
}

export async function processRevocationOutboxBatch(limit = 25): Promise<number> {
  if (processing) {
    return 0;
  }

  processing = true;
  try {
    const rows = await prisma.revocationOutboxEvent.findMany({
      where: {
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
      const claimed = await markProcessing(row.id);
      if (!claimed) {
        continue;
      }

      try {
        await deliverRow(row);
        await finalizeSuccess(row.id);
        delivered += 1;
      } catch (error) {
        await finalizeFailure(row.id, row.attemptCount, error);
        log('warn', 'revocation_outbox_delivery_failed', {
          outboxId: row.id,
          attemptCount: row.attemptCount + 1,
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    }

    return delivered;
  } finally {
    processing = false;
  }
}

export function startRevocationOutboxWorker(intervalMs = DEFAULT_INTERVAL_MS): void {
  if (process.env.NODE_ENV === 'test') {
    return;
  }

  if (intervalHandle) {
    return;
  }

  intervalHandle = setInterval(() => {
    void processRevocationOutboxBatch().catch((error) => {
      log('error', 'revocation_outbox_worker_cycle_failed', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    });
  }, intervalMs);

  intervalHandle.unref?.();

  log('info', 'revocation_outbox_worker_started', {
    intervalMs,
  });
}

export function stopRevocationOutboxWorker(): void {
  if (!intervalHandle) {
    return;
  }

  clearInterval(intervalHandle);
  intervalHandle = null;
  log('info', 'revocation_outbox_worker_stopped');
}

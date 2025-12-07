import { PrismaClient } from '@prisma/client';
import { z } from 'zod';
import { getServiceLogger } from '../../logging/serviceLogger.js';
import type { JobQueueRecord } from '../../queue/models/JobQueue.js';
import { getEhrAdapter } from '../adapters/index.js';
import {
  calculateBackoffDelayMs,
  EhrSynchronizationStatus as LocalStatus,
} from '../models/EHRSynchronization.js';

const prisma = new PrismaClient();
const log = getServiceLogger('ehr/workers/ehrSyncWorker');

export const ehrSyncJobPayloadSchema = z.object({
  syncId: z.string().min(1, 'syncId is required'),
});

export type EhrSyncJobPayload = z.infer<typeof ehrSyncJobPayloadSchema>;

export const DEFAULT_MAX_ADAPTER_ATTEMPTS = 3;

type SleepFn = (ms: number) => Promise<void>;

const defaultSleep: SleepFn = (ms) =>
  new Promise((resolve) => {
    setTimeout(resolve, ms);
  });

export async function runEhrSyncJob(job: JobQueueRecord): Promise<void> {
  const payload = ehrSyncJobPayloadSchema.parse(job.payload);
  await processEhrSynchronization(payload.syncId);
}

export interface ProcessEhrSyncOptions {
  maxAdapterAttempts?: number;
  sleepFn?: SleepFn;
}

export async function processEhrSynchronization(
  syncId: string,
  options: ProcessEhrSyncOptions = {}
): Promise<void> {
  const maxAttempts = options.maxAdapterAttempts ?? DEFAULT_MAX_ADAPTER_ATTEMPTS;
  const sleep = options.sleepFn ?? defaultSleep;

  const record = await prisma.ehrSynchronization.findUnique({
    where: { id: syncId },
  });

  if (!record) {
    throw new Error(`EHRSynchronization ${syncId} not found`);
  }

  const adapter = getEhrAdapter(record.ehrSystem);
  if (!adapter) {
    await prisma.ehrSynchronization.update({
      where: { id: syncId },
      data: {
        status: LocalStatus.FAILED,
        error: `Unsupported EHR system: ${record.ehrSystem}`,
        lastAttemptAt: new Date(),
      },
    });
    throw new Error(`Unsupported EHR system: ${record.ehrSystem}`);
  }

  let attempt = 0;
  let currentAttemptCount = record.attemptCount;
  let lastError: Error | undefined;

  while (attempt < maxAttempts) {
    attempt += 1;
    const now = new Date();

    const updated = await prisma.ehrSynchronization.update({
      where: { id: syncId },
      data: {
        status: LocalStatus.RETRYING,
        lastAttemptAt: now,
        attemptCount: { increment: 1 },
        error: null,
      },
      select: { attemptCount: true },
    });
    currentAttemptCount = updated.attemptCount;

    try {
      const adapterResult = await adapter.assignPrivilege({
        clinicianId: record.clinicianId,
        privilegeCode: record.privilegeCode,
        correlationId: syncId,
        metadata: (record.metadata as Record<string, unknown> | undefined) ?? undefined,
      });

      if (adapterResult.success) {
        await prisma.ehrSynchronization.update({
          where: { id: syncId },
          data: {
            status: LocalStatus.SYNCED,
            error: null,
            metadata: {
              ...(record.metadata ?? {}),
              lastResponse: adapterResult.rawResponse,
            },
          },
        });

        log.info('EHR synchronization completed', {
          syncId,
          ehrSystem: record.ehrSystem,
          attempts: currentAttemptCount,
        });

        return;
      }

      lastError = new Error(adapterResult.error ?? 'Adapter signaled failure');
      await prisma.ehrSynchronization.update({
        where: { id: syncId },
        data: {
          status: attempt < maxAttempts ? LocalStatus.RETRYING : LocalStatus.FAILED,
          error: adapterResult.error ?? 'Adapter signaled failure',
          metadata: {
            ...(record.metadata ?? {}),
            lastResponse: adapterResult.rawResponse,
          },
        },
      });
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
      await prisma.ehrSynchronization.update({
        where: { id: syncId },
        data: {
          status: attempt < maxAttempts ? LocalStatus.RETRYING : LocalStatus.FAILED,
          error: lastError.message,
        },
      });
    }

    if (attempt < maxAttempts) {
      const backoffMs = calculateBackoffDelayMs(currentAttemptCount);
      log.warn('EHR sync attempt failed, backing off', {
        syncId,
        backoffMs,
        attempt,
        currentAttemptCount,
      });
      await sleep(backoffMs);
    }
  }

  const message = lastError?.message ?? 'Unknown adapter failure';
  log.error('EHR synchronization exhausted retries', {
    syncId,
    attempts: currentAttemptCount,
    error: message,
  });
  throw new Error(`EHR synchronization ${syncId} failed after retries: ${message}`);
}



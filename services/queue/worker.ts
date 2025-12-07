import './tracing';
import {
  claimNextPendingJob,
  isJobType,
  JobQueueRecord,
  JobQueueType,
  markJobCompleted,
  markJobFailure,
} from './models/JobQueue.js';
import { resolveQueueRoute, MissingQueueRouteError } from './router.js';
import { createLogger, serializeError } from '@chai-vc/logging-core';
import { createJobLogger } from '@packages/queue-core';
import { traceQueueJob } from './tracing/jobTracer.js';
import { validateJobPayload, parseJobPayload } from './validation/payloadValidator.js';
import { formatHandlerError, type FormattedQueueError } from './errorFormatter.js';
import { persistDLQJob } from './models/DLQJobQueue.js';
import { CredentialTimelineEventType, TimelineEventSeverity } from '@prisma/client';
import { logCredentialTimelineEvent } from '../timeline/logCredentialTimelineEvent.js';
import { recordJobDispatch } from './metrics.js';

const log = createLogger({ service: 'queue-worker' });

async function recordTimelineEntry(job: JobQueueRecord, error: FormattedQueueError): Promise<void> {
  try {
    let clinicianId: string | undefined;
    let eventType: CredentialTimelineEventType | undefined;
    const metadata: Record<string, unknown> = {
      jobId: job.id,
      jobType: job.type,
      message: error.message,
    };

    if (job.type === 'PSV_RUN') {
      const payload = parseJobPayload(job, 'PSV_RUN');
      clinicianId = payload.clinicianId;
      metadata.npi = payload.npi;
      metadata.state = payload.state;
      eventType = CredentialTimelineEventType.DRIFT_SIGNAL;
    } else if (job.type === 'PRIVILEGE_ISSUE') {
      const payload = parseJobPayload(job, 'PRIVILEGE_ISSUE');
      clinicianId = payload.clinicianDid;
      metadata.privilegeRequestId = payload.privilegeRequestId;
      metadata.privilegeGrantedId = payload.privilegeGrantedId;
      metadata.orgId = payload.orgId;
      eventType = CredentialTimelineEventType.PRIVILEGE_SYNC_FAILED;
    } else {
      return;
    }

    if (!clinicianId || !eventType) {
      return;
    }

    await logCredentialTimelineEvent({
      clinicianId,
      eventType,
      severity: TimelineEventSeverity.WARNING,
      metadata,
    });
  } catch (timelineError) {
    log.warn('Failed to record queue timeline entry', {
      jobId: job.id,
      error: serializeError(timelineError),
    });
  }
}

async function sinkToDlq(job: JobQueueRecord, error: FormattedQueueError): Promise<void> {
  try {
    await persistDLQJob({ job, error });
    log.warn('Job moved to DLQ', {
      jobId: job.id,
      jobType: job.type,
      attempts: job.attempts,
    });
  } catch (dlqError) {
    log.error('Failed to persist job in DLQ', {
      jobId: job.id,
      error: serializeError(dlqError),
    });
  }
}

export interface QueueWorkerOptions {
  pollIntervalMs?: number;
  maxPollIntervalMs?: number;
  idleBackoffMultiplier?: number;
}

const DEFAULT_POLL_INTERVAL_MS = 2000;
const DEFAULT_MAX_POLL_INTERVAL_MS = 15000;
const DEFAULT_BACKOFF_MULTIPLIER = 1.5;

export class QueueWorker {
  private running = false;
  private timer: NodeJS.Timeout | null = null;
  private readonly baseInterval: number;
  private currentInterval: number;

  constructor(private readonly options: QueueWorkerOptions = {}) {
    this.baseInterval = options.pollIntervalMs ?? DEFAULT_POLL_INTERVAL_MS;
    this.currentInterval = this.baseInterval;
  }

  start(): void {
    if (this.running) {
      return;
    }

    this.running = true;
    log.info('Queue worker starting', {
      pollIntervalMs: this.baseInterval,
      maxPollIntervalMs: this.options.maxPollIntervalMs ?? DEFAULT_MAX_POLL_INTERVAL_MS,
    });
    this.scheduleNext(0);
  }

  stop(): void {
    this.running = false;
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }
    log.info('Queue worker stopped');
  }

  private scheduleNext(delayMs: number): void {
    if (!this.running) {
      return;
    }

    this.timer = setTimeout(() => {
      this.poll().catch((error) => {
        log.error('Queue worker poll loop failed', { error: serializeError(error) });
      });
    }, delayMs);
  }

  private async poll(): Promise<void> {
    if (!this.running) {
      return;
    }

    try {
      const job = await claimNextPendingJob();

      if (!job) {
        this.applyIdleBackoff();
        this.scheduleNext(this.currentInterval);
        return;
      }

      this.resetBackoff();
      await this.processJob(job);
    } catch (error) {
      log.error('Queue worker poll failed', { error: serializeError(error) });
    }

    this.scheduleNext(this.currentInterval);
  }

  private async resolveRoute(
    job: JobQueueRecord,
    jobLogger: ReturnType<typeof createJobLogger>,
  ) {
    try {
      if (!isJobType(job.type)) {
        throw new MissingQueueRouteError(job.type);
      }
      return resolveQueueRoute(job.type as JobQueueType);
    } catch (error) {
      await markJobFailure(job, error instanceof Error ? error : new Error(String(error)), {
        forceFinal: true,
      });
      jobLogger.error('No queue route registered', {
        jobId: job.id,
        type: job.type,
        error: serializeError(error),
      });
      return null;
    }
  }

  private resetBackoff(): void {
    this.currentInterval = this.baseInterval;
  }

  private applyIdleBackoff(): void {
    const maxInterval = this.options.maxPollIntervalMs ?? DEFAULT_MAX_POLL_INTERVAL_MS;
    const multiplier = this.options.idleBackoffMultiplier ?? DEFAULT_BACKOFF_MULTIPLIER;
    this.currentInterval = Math.min(this.currentInterval * multiplier, maxInterval);
  }

  private async processJob(job: JobQueueRecord): Promise<void> {
    const jobLogger = createJobLogger(job, { baseLogger: log });
    const route = await this.resolveRoute(job, jobLogger);

    if (!route) {
      return;
    }

    const handler = route.handler;
    recordJobDispatch(route.type);

    const validation = validateJobPayload(job);
    if (!validation.success) {
      const formattedError = formatHandlerError(validation.error);
      const failureResult = await markJobFailure(job, validation.error, { forceFinal: true });

      jobLogger.error('Job payload validation failed', {
        jobId: job.id,
        type: job.type,
        error: formattedError,
      });

      await sinkToDlq(failureResult.job, formattedError);
      return;
    }

    jobLogger.debug('Processing job', {
      jobId: job.id,
      type: job.type,
      attempts: job.attempts,
      maxAttempts: job.maxAttempts,
    });

    try {
      await traceQueueJob(job, async () => {
        await handler(job);
        await markJobCompleted(job.id);
      });
      jobLogger.info('Completed job', { jobId: job.id, type: job.type });
    } catch (error) {
      const formattedError = formatHandlerError(error);
      const failureResult = await markJobFailure(job, error);
      jobLogger.error('Job failed', {
        final: failureResult.final,
        attempt: job.attempts,
        maxAttempts: job.maxAttempts,
        error: formattedError,
      });

      if (!failureResult.final) {
        jobLogger.warn('Job scheduled for retry', {
          nextAttempt: job.attempts + 1,
          maxAttempts: job.maxAttempts,
        });
      } else {
        await sinkToDlq(failureResult.job, formattedError);
        await recordTimelineEntry(failureResult.job, formattedError);
      }
    }
  }
}

export function startWorker(options?: QueueWorkerOptions): QueueWorker {
  const worker = new QueueWorker(options);
  worker.start();
  return worker;
}

import { JobQueueRecord } from './types';
import { getJobHandler } from './registry';
import {
  claimNextPendingJob,
  markJobCompleted,
  markJobFailure,
} from './store';
import { getJobConfig, getJobTypesForDomain } from './config';
import { JobDomain, JobType, isJobType } from './jobTypes';
import { JobPayloadMap, validateJobPayload } from './schemas';

export interface QueueWorkerLogger {
  info(message: string, meta?: Record<string, unknown>): void;
  warn(message: string, meta?: Record<string, unknown>): void;
  error(message: string, meta?: Record<string, unknown>): void;
  debug?(message: string, meta?: Record<string, unknown>): void;
}

export interface QueueWorkerOptions {
  domain: JobDomain;
  jobTypes?: JobType[];
  pollIntervalMs?: number;
  maxConcurrent?: number;
  logger?: QueueWorkerLogger;
}

const DEFAULT_POLL_INTERVAL = 1_000;

export class QueueWorker {
  private running = false;
  private timer: NodeJS.Timeout | null = null;
  private readonly pollInterval: number;
  private readonly jobTypes: JobType[];
  private readonly maxConcurrent: number;
  private readonly logger: QueueWorkerLogger;
  private activeJobs = 0;
  private readonly activeByType = new Map<JobType, number>();

  constructor(private readonly options: QueueWorkerOptions) {
    this.pollInterval = options.pollIntervalMs ?? DEFAULT_POLL_INTERVAL;
    this.jobTypes =
      options.jobTypes && options.jobTypes.length > 0
        ? options.jobTypes
        : getJobTypesForDomain(options.domain);
    this.maxConcurrent = options.maxConcurrent ?? this.jobTypes.length * 2;
    this.logger =
      options.logger ??
      ({
        info: console.log,
        warn: console.warn,
        error: console.error,
        debug: console.debug,
      } satisfies QueueWorkerLogger);
  }

  start(): void {
    if (this.running) {
      return;
    }
    this.running = true;
    this.logger.info('[queue-worker] starting', {
      domain: this.options.domain,
      jobTypes: this.jobTypes,
      maxConcurrent: this.maxConcurrent,
    });
    this.scheduleNext(0);
  }

  stop(): void {
    this.running = false;
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }
    this.logger.info('[queue-worker] stopped', { domain: this.options.domain });
  }

  private scheduleNext(delayMs: number): void {
    if (!this.running) {
      return;
    }
    this.timer = setTimeout(() => {
      this.poll().catch((error) => {
        this.logger.error('[queue-worker] poll failure', formatError(error));
      });
    }, delayMs);
  }

  private async poll(): Promise<void> {
    if (!this.running) {
      return;
    }

    await this.fillPipeline();
    this.scheduleNext(this.pollInterval);
  }

  private async fillPipeline(): Promise<void> {
    while (this.running && this.activeJobs < this.maxConcurrent) {
      const allowedTypes = this.allowedJobTypes();
      if (!allowedTypes.length) {
        return;
      }

      const job = await claimNextPendingJob({
        domain: this.options.domain,
        jobTypes: allowedTypes,
      });

      if (!job) {
        return;
      }

      const jobType = job.type as JobType;
      this.increment(jobType, 1);
      this.activeJobs += 1;

      this.runJob(job)
        .catch((error) => {
          this.logger.error('[queue-worker] run failed', formatError(error));
        })
        .finally(() => {
          this.increment(jobType, -1);
          this.activeJobs -= 1;
          this.scheduleNext(0);
        });
    }
  }

  private allowedJobTypes(): JobType[] {
    return this.jobTypes.filter((type) => {
      const config = getJobConfig(type);
      const current = this.activeByType.get(type) ?? 0;
      return current < config.concurrencyLimit;
    });
  }

  private increment(type: JobType, delta: number) {
    const current = this.activeByType.get(type) ?? 0;
    this.activeByType.set(type, Math.max(current + delta, 0));
  }

  private async runJob(job: JobQueueRecord): Promise<void> {
    if (!isJobType(job.type)) {
      this.logger.error('[queue-worker] unknown job type', { jobId: job.id, type: job.type });
      await markJobFailure(job, `Unknown job type ${job.type}`, { forceFinal: true });
      return;
    }
    const handler = getJobHandler(job.type);
    if (!handler) {
      this.logger.error('[queue-worker] missing handler', { jobId: job.id, type: job.type });
      await markJobFailure(job, `No handler registered for ${job.type}`, {
        forceFinal: true,
      });
      return;
    }

    const payload = validateJobPayload(job.type, job.payload) as JobPayloadMap[JobType];
    this.logger.debug?.('[queue-worker] processing job', {
      jobId: job.id,
      type: job.type,
      attempt: job.attempts,
    });

    try {
      await handler(job, payload as any);
      await markJobCompleted(job.id);
      this.logger.info('[queue-worker] job completed', {
        jobId: job.id,
        type: job.type,
      });
    } catch (error) {
      const result = await markJobFailure(job, error);
      this.logger.error('[queue-worker] job failed', {
        jobId: job.id,
        type: job.type,
        final: result.final,
        ...formatError(error),
      });
    }
  }
}

export function startWorker(options: QueueWorkerOptions): QueueWorker {
  const worker = new QueueWorker(options);
  worker.start();
  return worker;
}

function formatError(error: unknown) {
  if (error instanceof Error) {
    return { error: { name: error.name, message: error.message, stack: error.stack } };
  }
  return { error: { message: String(error) } };
}


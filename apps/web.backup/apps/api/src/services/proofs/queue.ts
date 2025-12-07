import { randomUUID } from 'crypto';
import { appendProofEvent } from './stream';
import type { ProofJobPriority, ProofWorkerType } from './graph';

export interface ProofWorkerPayload {
  threadId: string;
  payload: Record<string, any>;
}

export interface ProofWorkerExecution {
  status: 'success' | 'failed' | 'skipped';
  output?: any;
  error?: string;
  warnings?: string[];
}

export type ProofWorker = (payload: ProofWorkerPayload) => Promise<ProofWorkerExecution>;

export interface ProofQueueResult<T = any> {
  worker: ProofWorkerType;
  status: 'success' | 'failed' | 'skipped';
  output?: T;
  error?: string;
  warnings?: string[];
  latencyMs: number;
  attempt: number;
}

interface ProofJob {
  id: string;
  threadId: string;
  worker: ProofWorkerType;
  payload: Record<string, any>;
  priority: ProofJobPriority;
  resolve: (result: ProofQueueResult) => void;
  reject: (error: Error) => void;
  attempts: number;
  enqueuedAt: number;
  startedAt?: number;
  lastError?: string;
}

export interface ProofQueueOptions {
  concurrency?: number;
  maxAttempts?: number;
  stallTimeoutMs?: number;
}

export class ProofQueue {
  private readonly workers = new Map<ProofWorkerType, ProofWorker>();
  private readonly urgentQueue: ProofJob[] = [];
  private readonly normalQueue: ProofJob[] = [];
  private readonly activeJobs = new Map<string, ProofJob>();
  private running = 0;
  private readonly concurrency: number;
  private readonly maxAttempts: number;
  private readonly stallTimeoutMs: number;
  private recoveryTimer?: NodeJS.Timeout;

  constructor(options: ProofQueueOptions = {}) {
    this.concurrency = Math.max(1, options.concurrency ?? Number(process.env.PROOF_QUEUE_CONCURRENCY ?? 3));
    this.maxAttempts = Math.max(1, options.maxAttempts ?? Number(process.env.PROOF_QUEUE_MAX_ATTEMPTS ?? 3));
    this.stallTimeoutMs = Math.max(5_000, options.stallTimeoutMs ?? Number(process.env.PROOF_QUEUE_STALL_TIMEOUT_MS ?? 15_000));
    this.recoveryTimer = setInterval(() => this.checkStalledJobs(), this.stallTimeoutMs);
    if (typeof this.recoveryTimer.unref === 'function') {
      this.recoveryTimer.unref();
    }
  }

  registerWorker(type: ProofWorkerType, worker: ProofWorker) {
    this.workers.set(type, worker);
  }

  enqueue<T = any>(options: {
    threadId: string;
    worker: ProofWorkerType;
    payload: Record<string, any>;
    priority?: ProofJobPriority;
  }): Promise<ProofQueueResult<T>> {
    return new Promise<ProofQueueResult<T>>((resolve, reject) => {
      const job: ProofJob = {
        id: randomUUID(),
        threadId: options.threadId,
        worker: options.worker,
        payload: options.payload,
        priority: options.priority ?? 'standard',
        resolve: resolve as (result: ProofQueueResult) => void,
        reject,
        attempts: 0,
        enqueuedAt: Date.now(),
      };

      this.pushJob(job);
      void appendProofEvent(job.threadId, 'queued', {
        jobId: job.id,
        worker: job.worker,
        priority: job.priority,
      });
      this.schedule();
    });
  }

  private pushJob(job: ProofJob) {
    if (job.priority === 'urgent') {
      this.urgentQueue.push(job);
    } else {
      this.normalQueue.push(job);
    }
  }

  private schedule() {
    while (this.running < this.concurrency) {
      const nextJob = this.urgentQueue.shift() ?? this.normalQueue.shift();
      if (!nextJob) {
        break;
      }
      this.runJob(nextJob);
    }
  }

  private async runJob(job: ProofJob) {
    this.running += 1;
    job.startedAt = Date.now();
    job.attempts += 1;
    this.activeJobs.set(job.id, job);

    await appendProofEvent(job.threadId, 'workerStart', {
      jobId: job.id,
      worker: job.worker,
      attempt: job.attempts,
    });

    const worker = this.workers.get(job.worker);
    const startedAt = Date.now();
    let result: ProofQueueResult = {
      worker: job.worker,
      status: 'failed',
      error: `worker_${job.worker}_not_registered`,
      latencyMs: 0,
      attempt: job.attempts,
    };

    if (!worker) {
      console.warn('[proofs][queue] unregistered worker', job.worker);
    } else {
      try {
        const execution = await worker({
          threadId: job.threadId,
          payload: job.payload,
        });
        result = {
          worker: job.worker,
          status: execution.status,
          output: execution.output,
          error: execution.error,
          warnings: execution.warnings,
          latencyMs: Date.now() - startedAt,
          attempt: job.attempts,
        };
      } catch (error) {
        result = {
          worker: job.worker,
          status: 'failed',
          error: error instanceof Error ? error.message : 'Worker threw',
          latencyMs: Date.now() - startedAt,
          attempt: job.attempts,
        };
      }
    }

    const completedSuccessfully = result.status !== 'failed' || job.attempts >= this.maxAttempts;
    if (!completedSuccessfully) {
      job.lastError = result.error;
      await appendProofEvent(job.threadId, 'workerFailed', {
        jobId: job.id,
        worker: job.worker,
        attempt: job.attempts,
        error: result.error,
        action: 'retrying',
      });
      this.activeJobs.delete(job.id);
      this.running = Math.max(0, this.running - 1);
      job.startedAt = undefined;
      this.pushJob(job);
      this.schedule();
      return;
    }

    this.activeJobs.delete(job.id);
    this.running = Math.max(0, this.running - 1);

    const eventName = result.status === 'failed' ? 'workerFailed' : 'workerComplete';
    await appendProofEvent(job.threadId, eventName, {
      jobId: job.id,
      worker: job.worker,
      attempt: job.attempts,
      latencyMs: result.latencyMs,
      status: result.status,
      error: result.error,
      warnings: result.warnings,
    });

    if (result.status === 'failed' && !result.error) {
      result.error = job.lastError ?? 'Job failed';
    }

    job.resolve(result);
    this.schedule();
  }

  private checkStalledJobs() {
    if (!this.activeJobs.size) {
      return;
    }

    const now = Date.now();
    for (const job of Array.from(this.activeJobs.values())) {
      if (!job.startedAt) continue;
      if (now - job.startedAt < this.stallTimeoutMs) {
        continue;
      }

      console.warn('[proofs][queue] detected stalled job, requeuing', {
        jobId: job.id,
        worker: job.worker,
        attempts: job.attempts,
      });

      this.activeJobs.delete(job.id);
      this.running = Math.max(0, this.running - 1);

      if (job.attempts >= this.maxAttempts) {
        job.resolve({
          worker: job.worker,
          status: 'failed',
          error: job.lastError ?? 'Job stalled beyond recovery window',
          latencyMs: now - job.startedAt,
          attempt: job.attempts,
        });
        continue;
      }

      job.startedAt = undefined;
      job.lastError = 'stalled';
      this.pushJob(job);
      void appendProofEvent(job.threadId, 'recovered', {
        jobId: job.id,
        worker: job.worker,
        attempt: job.attempts + 1,
        reason: 'stall_detected',
      });
    }

    this.schedule();
  }
}

export const proofQueue = new ProofQueue();










import process from 'node:process';
import { createLogger, serializeError } from '@chai-vc/logging-core';
import { createJobLogger } from '@packages/queue-core';
import { JobQueueStatus } from '@prisma/client';
import { getJobById, type JobQueueRecord } from '../../services/queue/models/JobQueue.js';
import { getJobHandler } from '../../services/queue/handlers/index.js';
import { traceQueueJob } from '../../services/queue/tracing/jobTracer.js';

const cliLogger = createLogger({ service: 'queue-replay-cli' });
const REPLAYABLE_STATUSES = new Set<JobQueueStatus>([
  JobQueueStatus.FAILED,
  JobQueueStatus.FAILED_FINAL,
  JobQueueStatus.COMPLETED,
]);

export interface QueueReplayOptions {
  jobId: string;
  sandbox?: boolean;
}

function ensureSandboxEnabled(enabled: boolean): void {
  if (!enabled) {
    cliLogger.warn('Sandbox mode disabled – job side effects may execute against live systems');
    return;
  }

  if (process.env.SANDBOX_MODE !== 'true') {
    cliLogger.info('Enforcing SANDBOX_MODE=true for safe job replay');
    process.env.SANDBOX_MODE = 'true';
  }
}

function assertReplayable(job: JobQueueRecord): void {
  if (!REPLAYABLE_STATUSES.has(job.status as JobQueueStatus)) {
    throw new Error(
      `Job ${job.id} is ${job.status}; only failed or completed jobs can be replayed safely`
    );
  }
}

export async function replayJob(options: QueueReplayOptions) {
  if (!options.jobId) {
    throw new Error('jobId is required to replay a queue job');
  }

  const sandbox = options.sandbox !== false;
  const job = await getJobById(options.jobId);

  if (!job) {
    throw new Error(`Job ${options.jobId} not found`);
  }

  assertReplayable(job);
  ensureSandboxEnabled(sandbox);

  const handler = getJobHandler(job.type);
  if (!handler) {
    throw new Error(`No handler registered for job type ${job.type}`);
  }

  const jobLogger = createJobLogger(job, { baseLogger: cliLogger });
  jobLogger.info('Starting job replay', {
    sandbox,
    status: job.status,
  });

  try {
    await traceQueueJob(job, async () => handler(job));
    jobLogger.info('Job replay completed', {
      sandbox,
    });
    return { jobId: job.id, sandbox };
  } catch (error) {
    jobLogger.error('Job replay failed', {
      sandbox,
      error: serializeError(error),
    });
    throw error;
  }
}

function parseArgs(argv: string[]): { jobId?: string; sandbox: boolean } {
  const result: { jobId?: string; sandbox: boolean } = { sandbox: true };

  for (const arg of argv) {
    if (arg === '--no-sandbox') {
      result.sandbox = false;
      continue;
    }

    if (arg.startsWith('--sandbox=')) {
      const [, value] = arg.split('=');
      result.sandbox = value !== 'false';
      continue;
    }

    if (arg.startsWith('--')) {
      continue;
    }

    if (!result.jobId) {
      result.jobId = arg;
    }
  }

  return result;
}

async function runFromCli() {
  const args = parseArgs(process.argv.slice(2));

  if (!args.jobId) {
    console.error('Usage: ts-node cli/commands/queueReplay.ts <jobId> [--no-sandbox]');
    process.exitCode = 1;
    return;
  }

  try {
    await replayJob({ jobId: args.jobId, sandbox: args.sandbox });
    console.log(`✅ Replayed job ${args.jobId}`);
  } catch (error) {
    console.error(`❌ Failed to replay job ${args.jobId}:`, error instanceof Error ? error.message : error);
    process.exitCode = 1;
  }
}

// Execute when invoked directly (ts-node or compiled JS)
if (require.main === module) {
  void runFromCli();
}



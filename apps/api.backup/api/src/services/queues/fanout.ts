/**
 * B144A-PERF-008: Async Job Fan-Out for PSV & Compacts Recompute
 *
 * Parallel processing service for large batch operations:
 * - Provider Status Verification (PSV) batch processing
 * - Compacts map recomputation
 * - Queue depth monitoring
 * - Failure handling and retries
 */

import Queue, { Job, JobOptions } from 'bull';
import { Counter, Gauge, Histogram } from 'prom-client';

// ==================== Metrics ====================

const jobsEnqueued = new Counter({
  name: 'fanout_jobs_enqueued_total',
  help: 'Total number of jobs enqueued for processing',
  labelNames: ['job_type', 'priority'],
});

const jobsProcessed = new Counter({
  name: 'fanout_jobs_processed_total',
  help: 'Total number of jobs processed',
  labelNames: ['job_type', 'status'],
});

const jobsFailures = new Counter({
  name: 'fanout_jobs_failures_total',
  help: 'Total number of job failures',
  labelNames: ['job_type', 'error_type'],
});

const queueDepth = new Gauge({
  name: 'fanout_queue_depth',
  help: 'Current number of jobs waiting in queue',
  labelNames: ['job_type', 'state'],
});

const processingDuration = new Histogram({
  name: 'fanout_job_duration_seconds',
  help: 'Duration of job processing',
  labelNames: ['job_type'],
  buckets: [0.1, 0.5, 1, 2, 5, 10, 30, 60, 120],
});

const batchSize = new Histogram({
  name: 'fanout_batch_size',
  help: 'Number of items in a batch job',
  labelNames: ['job_type'],
  buckets: [10, 50, 100, 500, 1000, 5000, 10000],
});

// ==================== Types ====================

export interface PSVBatchJobData {
  providerIds: string[];
  requestedBy?: string;
  priority?: 'high' | 'normal' | 'low';
  batchId: string;
  timestamp: number;
}

export interface CompactsBatchJobData {
  states?: string[]; // If undefined, recompute all states
  forceRefresh?: boolean;
  batchId: string;
  timestamp: number;
}

export interface FanOutConfig {
  redis?: {
    host?: string;
    port?: number;
    password?: string;
    db?: number;
  };
  psv?: {
    concurrency?: number;
    batchSize?: number;
    maxRetries?: number;
    backoffDelay?: number;
  };
  compacts?: {
    concurrency?: number;
    maxRetries?: number;
    backoffDelay?: number;
  };
  monitoring?: {
    enabled?: boolean;
    updateInterval?: number; // milliseconds
  };
}

export interface JobResult {
  success: boolean;
  processed: number;
  failed: number;
  errors?: Array<{ id: string; error: string }>;
  duration: number;
}

// ==================== Queue Setup ====================

const defaultConfig: Required<FanOutConfig> = {
  redis: {
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT || '6379'),
    password: process.env.REDIS_PASSWORD,
    db: parseInt(process.env.REDIS_DB || '0'),
  },
  psv: {
    concurrency: 10,
    batchSize: 100,
    maxRetries: 3,
    backoffDelay: 5000, // 5 seconds
  },
  compacts: {
    concurrency: 5,
    maxRetries: 2,
    backoffDelay: 10000, // 10 seconds
  },
  monitoring: {
    enabled: true,
    updateInterval: 5000, // 5 seconds
  },
};

let config: Required<FanOutConfig> = defaultConfig;

// Create queues
let psvQueue: Queue<PSVBatchJobData> | null = null;
let compactsQueue: Queue<CompactsBatchJobData> | null = null;

// ==================== Initialization ====================

export function initializeFanOut(customConfig?: FanOutConfig): void {
  config = { ...defaultConfig, ...customConfig };

  const redisConfig = {
    redis: {
      host: config.redis.host,
      port: config.redis.port,
      password: config.redis.password,
      db: config.redis.db,
    },
  };

  // Initialize PSV queue
  psvQueue = new Queue<PSVBatchJobData>('psv-fanout', redisConfig);

  // Initialize Compacts queue
  compactsQueue = new Queue<CompactsBatchJobData>('compacts-fanout', redisConfig);

  // Set up processors
  setupPSVProcessor();
  setupCompactsProcessor();

  // Start monitoring
  if (config.monitoring.enabled) {
    startMonitoring();
  }

  console.log('[FanOut] Initialized with config:', {
    psv: { concurrency: config.psv.concurrency, batchSize: config.psv.batchSize },
    compacts: { concurrency: config.compacts.concurrency },
  });
}

// ==================== PSV Processing ====================

function setupPSVProcessor(): void {
  if (!psvQueue) throw new Error('PSV queue not initialized');

  psvQueue.process(config.psv.concurrency, async (job: Job<PSVBatchJobData>) => {
    const startTime = Date.now();
    const { providerIds, batchId, priority = 'normal' } = job.data;

    console.log(`[PSV Fanout] Processing batch ${batchId} with ${providerIds.length} providers`);

    batchSize.observe({ job_type: 'psv' }, providerIds.length);

    try {
      const result = await processPSVBatch(providerIds, job);

      const duration = (Date.now() - startTime) / 1000;
      processingDuration.observe({ job_type: 'psv' }, duration);

      if (result.success) {
        jobsProcessed.inc({ job_type: 'psv', status: 'success' });
        console.log(`[PSV Fanout] Batch ${batchId} completed: ${result.processed} processed, ${result.failed} failed`);
        return result;
      } else {
        jobsProcessed.inc({ job_type: 'psv', status: 'partial_failure' });
        console.warn(`[PSV Fanout] Batch ${batchId} completed with failures: ${result.failed} failed`);
        return result;
      }
    } catch (error: any) {
      const duration = (Date.now() - startTime) / 1000;
      processingDuration.observe({ job_type: 'psv' }, duration);

      jobsFailures.inc({ job_type: 'psv', error_type: error.name || 'unknown' });
      console.error(`[PSV Fanout] Batch ${batchId} failed:`, error);
      throw error; // Let Bull handle retries
    }
  });

  // Set up event handlers
  psvQueue.on('completed', (job, result: JobResult) => {
    console.log(`[PSV Fanout] Job ${job.id} completed in ${result.duration}s`);
  });

  psvQueue.on('failed', (job, error) => {
    console.error(`[PSV Fanout] Job ${job?.id} failed:`, error.message);
    jobsFailures.inc({ job_type: 'psv', error_type: 'job_failed' });
  });

  psvQueue.on('stalled', (job) => {
    console.warn(`[PSV Fanout] Job ${job.id} stalled`);
  });
}

async function processPSVBatch(providerIds: string[], job: Job<PSVBatchJobData>): Promise<JobResult> {
  const results = {
    success: true,
    processed: 0,
    failed: 0,
    errors: [] as Array<{ id: string; error: string }>,
    duration: 0,
  };

  const startTime = Date.now();

  // Process providers in parallel chunks
  const chunkSize = config.psv.batchSize;
  const chunks: string[][] = [];

  for (let i = 0; i < providerIds.length; i += chunkSize) {
    chunks.push(providerIds.slice(i, i + chunkSize));
  }

  for (let i = 0; i < chunks.length; i++) {
    const chunk = chunks[i];

    // Update job progress
    const progress = Math.round(((i + 1) / chunks.length) * 100);
    await job.progress(progress);

    // Process chunk in parallel
    const chunkResults = await Promise.allSettled(
      chunk.map((providerId) => verifyProviderStatus(providerId))
    );

    // Collect results
    chunkResults.forEach((result, idx) => {
      if (result.status === 'fulfilled') {
        results.processed++;
      } else {
        results.failed++;
        results.errors.push({
          id: chunk[idx],
          error: result.reason?.message || 'Unknown error',
        });
      }
    });

    console.log(`[PSV Fanout] Chunk ${i + 1}/${chunks.length} complete: ${results.processed} processed, ${results.failed} failed`);
  }

  results.duration = (Date.now() - startTime) / 1000;
  results.success = results.failed === 0;

  return results;
}

/**
 * Verify individual provider status
 * This is a placeholder - integrate with actual PSV service
 */
async function verifyProviderStatus(providerId: string): Promise<void> {
  // TODO: Integrate with actual PSV verification service
  // For now, simulate verification
  await new Promise((resolve) => setTimeout(resolve, Math.random() * 100));

  // Simulate occasional failures (5% failure rate)
  if (Math.random() < 0.05) {
    throw new Error(`Provider ${providerId} verification failed`);
  }

  // In production, this would:
  // 1. Query provider data from database
  // 2. Check credentials expiration
  // 3. Verify license status with state boards
  // 4. Update provider status in database
  // 5. Trigger notifications if status changed
}

// ==================== Compacts Processing ====================

function setupCompactsProcessor(): void {
  if (!compactsQueue) throw new Error('Compacts queue not initialized');

  compactsQueue.process(config.compacts.concurrency, async (job: Job<CompactsBatchJobData>) => {
    const startTime = Date.now();
    const { states, forceRefresh = false, batchId } = job.data;

    console.log(`[Compacts Fanout] Processing batch ${batchId} for ${states?.length || 'all'} states`);

    try {
      const result = await recomputeCompacts(states, forceRefresh, job);

      const duration = (Date.now() - startTime) / 1000;
      processingDuration.observe({ job_type: 'compacts' }, duration);

      jobsProcessed.inc({ job_type: 'compacts', status: 'success' });
      console.log(`[Compacts Fanout] Batch ${batchId} completed in ${duration}s`);

      return result;
    } catch (error: any) {
      const duration = (Date.now() - startTime) / 1000;
      processingDuration.observe({ job_type: 'compacts' }, duration);

      jobsFailures.inc({ job_type: 'compacts', error_type: error.name || 'unknown' });
      console.error(`[Compacts Fanout] Batch ${batchId} failed:`, error);
      throw error;
    }
  });

  // Event handlers
  compactsQueue.on('completed', (job, result: JobResult) => {
    console.log(`[Compacts Fanout] Job ${job.id} completed in ${result.duration}s`);
  });

  compactsQueue.on('failed', (job, error) => {
    console.error(`[Compacts Fanout] Job ${job?.id} failed:`, error.message);
    jobsFailures.inc({ job_type: 'compacts', error_type: 'job_failed' });
  });
}

async function recomputeCompacts(
  states: string[] | undefined,
  forceRefresh: boolean,
  job: Job<CompactsBatchJobData>
): Promise<JobResult> {
  const startTime = Date.now();

  // Get all states if not specified
  const targetStates = states || getAllStates();

  const results = {
    success: true,
    processed: 0,
    failed: 0,
    errors: [] as Array<{ id: string; error: string }>,
    duration: 0,
  };

  // Process states in parallel
  const stateResults = await Promise.allSettled(
    targetStates.map(async (state, idx) => {
      // Update progress
      const progress = Math.round(((idx + 1) / targetStates.length) * 100);
      await job.progress(progress);

      return recomputeStateCompacts(state, forceRefresh);
    })
  );

  // Collect results
  stateResults.forEach((result, idx) => {
    if (result.status === 'fulfilled') {
      results.processed++;
    } else {
      results.failed++;
      results.errors.push({
        id: targetStates[idx],
        error: result.reason?.message || 'Unknown error',
      });
    }
  });

  results.duration = (Date.now() - startTime) / 1000;
  results.success = results.failed === 0;

  return results;
}

/**
 * Recompute compacts for a specific state
 */
async function recomputeStateCompacts(state: string, forceRefresh: boolean): Promise<void> {
  // TODO: Integrate with actual compacts service
  // Simulate computation
  await new Promise((resolve) => setTimeout(resolve, Math.random() * 500));

  // In production, this would:
  // 1. Query all providers licensed in this state
  // 2. Check which compacts they're eligible for
  // 3. Update compacts map in cache/database
  // 4. Notify affected providers of new privileges
}

/**
 * Get all US states and territories
 */
function getAllStates(): string[] {
  return [
    'AL', 'AK', 'AZ', 'AR', 'CA', 'CO', 'CT', 'DE', 'FL', 'GA',
    'HI', 'ID', 'IL', 'IN', 'IA', 'KS', 'KY', 'LA', 'ME', 'MD',
    'MA', 'MI', 'MN', 'MS', 'MO', 'MT', 'NE', 'NV', 'NH', 'NJ',
    'NM', 'NY', 'NC', 'ND', 'OH', 'OK', 'OR', 'PA', 'RI', 'SC',
    'SD', 'TN', 'TX', 'UT', 'VT', 'VA', 'WA', 'WV', 'WI', 'WY',
    'DC', 'PR', 'VI', 'GU', 'AS', 'MP',
  ];
}

// ==================== Public API ====================

/**
 * Enqueue a PSV batch job
 */
export async function enqueuePSVBatch(
  providerIds: string[],
  options?: {
    requestedBy?: string;
    priority?: 'high' | 'normal' | 'low';
    delay?: number;
  }
): Promise<string> {
  if (!psvQueue) throw new Error('PSV queue not initialized. Call initializeFanOut() first.');

  const batchId = `psv-${Date.now()}-${Math.random().toString(36).substring(7)}`;

  const jobData: PSVBatchJobData = {
    providerIds,
    requestedBy: options?.requestedBy,
    priority: options?.priority || 'normal',
    batchId,
    timestamp: Date.now(),
  };

  const jobOptions: JobOptions = {
    priority: getPriorityValue(options?.priority),
    attempts: config.psv.maxRetries,
    backoff: {
      type: 'exponential',
      delay: config.psv.backoffDelay,
    },
    delay: options?.delay,
    removeOnComplete: 100, // Keep last 100 completed jobs
    removeOnFail: 1000, // Keep last 1000 failed jobs
  };

  const job = await psvQueue.add(jobData, jobOptions);

  jobsEnqueued.inc({ job_type: 'psv', priority: options?.priority || 'normal' });

  console.log(`[PSV Fanout] Enqueued batch ${batchId} with ${providerIds.length} providers (Job ID: ${job.id})`);

  return batchId;
}

/**
 * Enqueue a compacts recompute job
 */
export async function enqueueCompactsRecompute(
  options?: {
    states?: string[];
    forceRefresh?: boolean;
    delay?: number;
  }
): Promise<string> {
  if (!compactsQueue) throw new Error('Compacts queue not initialized. Call initializeFanOut() first.');

  const batchId = `compacts-${Date.now()}-${Math.random().toString(36).substring(7)}`;

  const jobData: CompactsBatchJobData = {
    states: options?.states,
    forceRefresh: options?.forceRefresh || false,
    batchId,
    timestamp: Date.now(),
  };

  const jobOptions: JobOptions = {
    attempts: config.compacts.maxRetries,
    backoff: {
      type: 'exponential',
      delay: config.compacts.backoffDelay,
    },
    delay: options?.delay,
    removeOnComplete: 50,
    removeOnFail: 200,
  };

  const job = await compactsQueue.add(jobData, jobOptions);

  jobsEnqueued.inc({ job_type: 'compacts', priority: 'normal' });

  console.log(`[Compacts Fanout] Enqueued batch ${batchId} for ${options?.states?.length || 'all'} states (Job ID: ${job.id})`);

  return batchId;
}

/**
 * Get job status by batch ID
 */
export async function getJobStatus(
  batchId: string
): Promise<{
  status: 'waiting' | 'active' | 'completed' | 'failed' | 'not_found';
  progress?: number;
  result?: JobResult;
  error?: string;
}> {
  const jobType = batchId.startsWith('psv-') ? 'psv' : 'compacts';
  const queue = jobType === 'psv' ? psvQueue : compactsQueue;

  if (!queue) throw new Error(`${jobType} queue not initialized`);

  // Search for job in all states
  const [waiting, active, completed, failed] = await Promise.all([
    queue.getWaiting(),
    queue.getActive(),
    queue.getCompleted(),
    queue.getFailed(),
  ]);

  const allJobs = [...waiting, ...active, ...completed, ...failed];
  const job = allJobs.find((j) => j.data.batchId === batchId);

  if (!job) {
    return { status: 'not_found' };
  }

  const state = await job.getState();
  const progress = await job.progress();

  if (state === 'completed') {
    return {
      status: 'completed',
      progress: 100,
      result: job.returnvalue as JobResult,
    };
  } else if (state === 'failed') {
    return {
      status: 'failed',
      progress,
      error: job.failedReason,
    };
  } else {
    return {
      status: state as any,
      progress,
    };
  }
}

/**
 * Get queue statistics
 */
export async function getQueueStats(): Promise<{
  psv: {
    waiting: number;
    active: number;
    completed: number;
    failed: number;
  };
  compacts: {
    waiting: number;
    active: number;
    completed: number;
    failed: number;
  };
}> {
  if (!psvQueue || !compactsQueue) {
    throw new Error('Queues not initialized');
  }

  const [psvCounts, compactsCounts] = await Promise.all([
    psvQueue.getJobCounts(),
    compactsQueue.getJobCounts(),
  ]);

  return {
    psv: {
      waiting: psvCounts.waiting || 0,
      active: psvCounts.active || 0,
      completed: psvCounts.completed || 0,
      failed: psvCounts.failed || 0,
    },
    compacts: {
      waiting: compactsCounts.waiting || 0,
      active: compactsCounts.active || 0,
      completed: compactsCounts.completed || 0,
      failed: compactsCounts.failed || 0,
    },
  };
}

// ==================== Monitoring ====================

let monitoringInterval: NodeJS.Timeout | null = null;

function startMonitoring(): void {
  if (monitoringInterval) {
    clearInterval(monitoringInterval);
  }

  monitoringInterval = setInterval(async () => {
    try {
      const stats = await getQueueStats();

      // Update Prometheus gauges
      queueDepth.set({ job_type: 'psv', state: 'waiting' }, stats.psv.waiting);
      queueDepth.set({ job_type: 'psv', state: 'active' }, stats.psv.active);
      queueDepth.set({ job_type: 'compacts', state: 'waiting' }, stats.compacts.waiting);
      queueDepth.set({ job_type: 'compacts', state: 'active' }, stats.compacts.active);
    } catch (error) {
      console.error('[FanOut] Error updating queue metrics:', error);
    }
  }, config.monitoring.updateInterval);

  // Don't block Node.js exit
  if (monitoringInterval.unref) {
    monitoringInterval.unref();
  }
}

function stopMonitoring(): void {
  if (monitoringInterval) {
    clearInterval(monitoringInterval);
    monitoringInterval = null;
  }
}

// ==================== Cleanup ====================

/**
 * Gracefully shutdown queues
 */
export async function shutdownFanOut(): Promise<void> {
  console.log('[FanOut] Shutting down...');

  stopMonitoring();

  const shutdownPromises: Promise<void>[] = [];

  if (psvQueue) {
    shutdownPromises.push(psvQueue.close());
  }

  if (compactsQueue) {
    shutdownPromises.push(compactsQueue.close());
  }

  await Promise.all(shutdownPromises);

  psvQueue = null;
  compactsQueue = null;

  console.log('[FanOut] Shutdown complete');
}

// ==================== Helpers ====================

function getPriorityValue(priority?: 'high' | 'normal' | 'low'): number {
  switch (priority) {
    case 'high':
      return 1;
    case 'low':
      return 10;
    default:
      return 5;
  }
}

// ==================== Health Check ====================

/**
 * Check if fan-out service is healthy
 */
export async function healthCheck(): Promise<{
  healthy: boolean;
  queues: {
    psv: { connected: boolean };
    compacts: { connected: boolean };
  };
}> {
  const psvConnected = psvQueue !== null && (await psvQueue.isReady());
  const compactsConnected = compactsQueue !== null && (await compactsQueue.isReady());

  return {
    healthy: psvConnected && compactsConnected,
    queues: {
      psv: { connected: psvConnected },
      compacts: { connected: compactsConnected },
    },
  };
}

// ==================== Exports ====================

export default {
  initialize: initializeFanOut,
  shutdown: shutdownFanOut,
  enqueuePSVBatch,
  enqueueCompactsRecompute,
  getJobStatus,
  getQueueStats,
  healthCheck,
};


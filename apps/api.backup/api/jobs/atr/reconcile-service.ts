/**
 * B128A-ATR-014: ATR reconcile service
 * Idempotency keys; batch windows; 429 backoff; /metrics
 */

import { Counter, Histogram, Registry } from 'prom-client';

export interface ATRRecord {
  id: string;
  providerId: string;
  memberplan_id: string;
  effectiveDate: string;
  terminationDate?: string;
  status: 'active' | 'terminated';
}

export interface ReconcileRequest {
  idempotencyKey: string;
  records: ATRRecord[];
  batchId: string;
  timestamp: string;
}

export interface ReconcileResult {
  success: boolean;
  processed: number;
  skipped: number;
  errors: number;
  idempotencyKey: string;
  duration: number;
}

// Metrics registry
const metricsRegistry = new Registry();

// B128A-ATR-014: Metrics for ATR reconciliation
const atrProcessedCounter = new Counter({
  name: 'atr_records_processed_total',
  help: 'Total number of ATR records processed',
  labelNames: ['status'],
  registers: [metricsRegistry],
});

const atrSkippedCounter = new Counter({
  name: 'atr_records_skipped_total',
  help: 'Total number of ATR records skipped (duplicates)',
  registers: [metricsRegistry],
});

const atrErrorCounter = new Counter({
  name: 'atr_records_error_total',
  help: 'Total number of ATR record errors',
  registers: [metricsRegistry],
});

const atrDurationHistogram = new Histogram({
  name: 'atr_reconcile_duration_seconds',
  help: 'Duration of ATR reconciliation in seconds',
  buckets: [0.1, 0.5, 1, 2, 5, 10, 30, 60],
  registers: [metricsRegistry],
});

const atr429RetryCounter = new Counter({
  name: 'atr_429_retries_total',
  help: 'Total number of 429 rate limit retries',
  registers: [metricsRegistry],
});

// Idempotency key store (in production, use Redis or database)
const idempotencyStore = new Map<string, { result: ReconcileResult; timestamp: number }>();
const IDEMPOTENCY_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours

// Record store (in production, use database)
const recordStore = new Map<string, ATRRecord>();

/**
 * B128A-ATR-014: Check idempotency key
 * Returns cached result if request was already processed
 */
export function checkIdempotency(idempotencyKey: string): ReconcileResult | null {
  const cached = idempotencyStore.get(idempotencyKey);

  if (!cached) {
    return null;
  }

  // Check if cached result is still valid (within TTL)
  const age = Date.now() - cached.timestamp;
  if (age > IDEMPOTENCY_TTL_MS) {
    idempotencyStore.delete(idempotencyKey);
    return null;
  }

  return cached.result;
}

/**
 * Store idempotency result
 */
function storeIdempotencyResult(idempotencyKey: string, result: ReconcileResult): void {
  idempotencyStore.set(idempotencyKey, {
    result,
    timestamp: Date.now(),
  });
}

/**
 * B128A-ATR-014: Batch window processing
 * Groups records into time-based batches
 */
export function createBatchWindow(
  records: ATRRecord[],
  windowSizeMs: number
): ATRRecord[][] {
  const batches: ATRRecord[][] = [];
  let currentBatch: ATRRecord[] = [];
  let batchStartTime: number | null = null;

  for (const record of records) {
    const recordTime = new Date(record.effectiveDate).getTime();

    if (batchStartTime === null) {
      batchStartTime = recordTime;
    }

    // Check if record fits in current batch window
    if (recordTime - batchStartTime <= windowSizeMs) {
      currentBatch.push(record);
    } else {
      // Start new batch
      if (currentBatch.length > 0) {
        batches.push(currentBatch);
      }
      currentBatch = [record];
      batchStartTime = recordTime;
    }
  }

  // Add last batch
  if (currentBatch.length > 0) {
    batches.push(currentBatch);
  }

  return batches;
}

/**
 * B128A-ATR-014: Exponential backoff for 429 rate limits
 */
async function retryWith429Backoff<T>(
  fn: () => Promise<T>,
  maxRetries: number = 5
): Promise<T> {
  let attempt = 0;
  let delay = 1000; // Start with 1 second

  while (attempt < maxRetries) {
    try {
      return await fn();
    } catch (error: any) {
      if (error.status === 429 && attempt < maxRetries - 1) {
        attempt++;
        atr429RetryCounter.inc();

        console.warn(`[ATR] Rate limited (429), retrying in ${delay}ms (attempt ${attempt}/${maxRetries})`);

        await new Promise(resolve => setTimeout(resolve, delay));

        // Exponential backoff with jitter
        delay = delay * 2 + Math.random() * 1000;
      } else {
        throw error;
      }
    }
  }

  throw new Error('Max retries exceeded');
}

/**
 * B128A-ATR-014: Process ATR record (with duplicate detection)
 */
function processATRRecord(record: ATRRecord): 'processed' | 'skipped' | 'error' {
  try {
    // Check if record already exists
    const existing = recordStore.get(record.id);

    if (existing) {
      // B128A-ATR-014: No duplicate adds - skip if identical
      if (
        existing.providerId === record.providerId &&
        existing.memberplan_id === record.memberplan_id &&
        existing.effectiveDate === record.effectiveDate
      ) {
        return 'skipped';
      }
    }

    // Store record
    recordStore.set(record.id, record);

    return 'processed';
  } catch (error) {
    console.error('[ATR] Error processing record:', error);
    return 'error';
  }
}

/**
 * B128A-ATR-014: Reconcile ATR records with idempotency
 */
export async function reconcileATR(request: ReconcileRequest): Promise<ReconcileResult> {
  const startTime = Date.now();

  // B128A-ATR-014: Check idempotency key
  const cached = checkIdempotency(request.idempotencyKey);
  if (cached) {
    console.info(`[ATR] Idempotency key ${request.idempotencyKey} already processed, returning cached result`);
    return cached;
  }

  let processed = 0;
  let skipped = 0;
  let errors = 0;

  // B128A-ATR-014: Process records with 429 backoff
  try {
    await retryWith429Backoff(async () => {
      for (const record of request.records) {
        const result = processATRRecord(record);

        switch (result) {
          case 'processed':
            processed++;
            atrProcessedCounter.inc({ status: 'success' });
            break;
          case 'skipped':
            skipped++;
            atrSkippedCounter.inc();
            break;
          case 'error':
            errors++;
            atrErrorCounter.inc();
            break;
        }
      }

      return true;
    });
  } catch (error) {
    console.error('[ATR] Reconciliation failed:', error);
    errors = request.records.length - processed - skipped;
  }

  const duration = (Date.now() - startTime) / 1000; // Duration in seconds
  atrDurationHistogram.observe(duration);

  const result: ReconcileResult = {
    success: errors === 0,
    processed,
    skipped,
    errors,
    idempotencyKey: request.idempotencyKey,
    duration,
  };

  // B128A-ATR-014: Store result for idempotency
  storeIdempotencyResult(request.idempotencyKey, result);

  return result;
}

/**
 * B128A-ATR-014: Get metrics in Prometheus format
 */
export async function getMetrics(): Promise<string> {
  return await metricsRegistry.metrics();
}

/**
 * Get metrics in JSON format
 */
export function getMetricsJSON(): Record<string, any> {
  return {
    processed: atrProcessedCounter['hashMap'],
    skipped: atrSkippedCounter['hashMap'],
    errors: atrErrorCounter['hashMap'],
    retries_429: atr429RetryCounter['hashMap'],
    idempotency_cache_size: idempotencyStore.size,
    record_store_size: recordStore.size,
  };
}

/**
 * Clean up expired idempotency keys
 */
export function cleanupIdempotencyCache(): number {
  const now = Date.now();
  let cleaned = 0;

  for (const [key, value] of idempotencyStore.entries()) {
    if (now - value.timestamp > IDEMPOTENCY_TTL_MS) {
      idempotencyStore.delete(key);
      cleaned++;
    }
  }

  return cleaned;
}

/**
 * Reset for testing
 */
export function reset(): void {
  idempotencyStore.clear();
  recordStore.clear();
  metricsRegistry.resetMetrics();
}


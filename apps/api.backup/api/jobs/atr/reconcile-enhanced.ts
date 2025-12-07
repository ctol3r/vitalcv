/**
 * B127A-ATR-014: ATR reconciliation with idempotency, backoff, metrics
 *
 * Features:
 * - Idempotency keys prevent duplicates
 * - Batch windows for efficient processing
 * - 429 backoff with exponential retry
 * - /metrics endpoint
 */

import { EventEmitter } from 'events';
import { createHash } from 'crypto';

/**
 * Attribution Record
 */
export interface AttributionRecord {
  memberId: string;
  providerId: string;
  effectiveDate: Date;
  endDate?: Date;
  planId: string;
  source: string;
}

/**
 * Batch processing window
 */
export interface BatchWindow {
  id: string;
  startTime: Date;
  endTime: Date;
  recordCount: number;
  status: 'pending' | 'processing' | 'completed' | 'failed';
}

/**
 * Idempotency tracking
 */
interface IdempotencyRecord {
  key: string;
  recordHash: string;
  processedAt: Date;
  result: 'added' | 'skipped' | 'failed';
}

/**
 * Metrics tracking
 */
interface ReconciliationMetrics {
  totalProcessed: number;
  added: number;
  skipped: number;
  failed: number;
  batchesProcessed: number;
  retriesAttempted: number;
  rateLimitHits: number;
}

/**
 * ATR Reconciliation Manager
 */
export class ATRReconciliationManager {
  private idempotencyStore = new Map<string, IdempotencyRecord>();
  private metrics: ReconciliationMetrics = {
    totalProcessed: 0,
    added: 0,
    skipped: 0,
    failed: 0,
    batchesProcessed: 0,
    retriesAttempted: 0,
    rateLimitHits: 0,
  };
  private eventEmitter = new EventEmitter();

  /**
   * Generate idempotency key for attribution record
   * B127A-ATR-014: Idempotency keys prevent duplicate adds
   */
  generateIdempotencyKey(record: AttributionRecord): string {
    const canonical = JSON.stringify({
      memberId: record.memberId,
      providerId: record.providerId,
      effectiveDate: record.effectiveDate.toISOString(),
      planId: record.planId,
    }, null, 0);

    return createHash('sha256').update(canonical).digest('hex');
  }

  /**
   * Check if record was already processed
   */
  isProcessed(key: string): boolean {
    return this.idempotencyStore.has(key);
  }

  /**
   * Mark record as processed
   */
  markProcessed(
    key: string,
    recordHash: string,
    result: 'added' | 'skipped' | 'failed'
  ): void {
    this.idempotencyStore.set(key, {
      key,
      recordHash,
      processedAt: new Date(),
      result,
    });
  }

  /**
   * Exponential backoff for 429 rate limits
   * B127A-ATR-014: 429 backoff with exponential retry
   */
  async exponentialBackoff(attempt: number): Promise<void> {
    const baseDelay = 1000; // 1 second
    const maxDelay = 32000; // 32 seconds
    const delay = Math.min(baseDelay * Math.pow(2, attempt), maxDelay);

    // Add jitter (±20%)
    const jitter = delay * 0.2 * (Math.random() - 0.5);
    const finalDelay = Math.round(delay + jitter);

    this.eventEmitter.emit('backoff', {
      attempt,
      delayMs: finalDelay,
      timestamp: new Date().toISOString(),
    });

    return new Promise(resolve => setTimeout(resolve, finalDelay));
  }

  /**
   * Process single attribution record with retry logic
   */
  async processRecord(
    record: AttributionRecord,
    maxRetries: number = 3
  ): Promise<{
    success: boolean;
    result: 'added' | 'skipped' | 'failed';
    idempotencyKey: string;
    error?: string;
  }> {
    const idempotencyKey = this.generateIdempotencyKey(record);

    // Check idempotency
    if (this.isProcessed(idempotencyKey)) {
      this.metrics.skipped++;
      this.metrics.totalProcessed++;

      return {
        success: true,
        result: 'skipped',
        idempotencyKey,
      };
    }

    // Retry loop with exponential backoff
    for (let attempt = 0; attempt < maxRetries; attempt++) {
      try {
        // Simulate API call (in production, call actual ATR API)
        const response = await this.callATRAPI(record);

        if (response.status === 200 || response.status === 201) {
          // Success
          this.markProcessed(idempotencyKey, response.recordHash, 'added');
          this.metrics.added++;
          this.metrics.totalProcessed++;

          this.eventEmitter.emit('record_added', {
            memberId: record.memberId,
            providerId: record.providerId,
            idempotencyKey,
          });

          return {
            success: true,
            result: 'added',
            idempotencyKey,
          };
        } else if (response.status === 429) {
          // Rate limited - backoff and retry
          this.metrics.rateLimitHits++;
          this.metrics.retriesAttempted++;

          if (attempt < maxRetries - 1) {
            await this.exponentialBackoff(attempt);
            continue;
          } else {
            throw new Error('Max retries exceeded due to rate limiting');
          }
        } else {
          throw new Error(`API error: ${response.status} ${response.error}`);
        }
      } catch (error) {
        if (attempt === maxRetries - 1) {
          // Final attempt failed
          this.markProcessed(idempotencyKey, '', 'failed');
          this.metrics.failed++;
          this.metrics.totalProcessed++;

          this.eventEmitter.emit('record_failed', {
            memberId: record.memberId,
            providerId: record.providerId,
            error: error instanceof Error ? error.message : 'unknown',
          });

          return {
            success: false,
            result: 'failed',
            idempotencyKey,
            error: error instanceof Error ? error.message : 'unknown',
          };
        }

        // Retry on next attempt
        this.metrics.retriesAttempted++;
        await this.exponentialBackoff(attempt);
      }
    }

    // Should not reach here
    return {
      success: false,
      result: 'failed',
      idempotencyKey,
      error: 'Unexpected error',
    };
  }

  /**
   * Simulate ATR API call (replace with real API in production)
   */
  private async callATRAPI(record: AttributionRecord): Promise<{
    status: number;
    recordHash: string;
    error?: string;
  }> {
    // Simulate network delay
    await new Promise(resolve => setTimeout(resolve, 100));

    // Simulate 10% rate limit errors
    if (Math.random() < 0.1) {
      return {
        status: 429,
        recordHash: '',
        error: 'Rate limit exceeded',
      };
    }

    // Simulate 5% server errors
    if (Math.random() < 0.05) {
      return {
        status: 500,
        recordHash: '',
        error: 'Internal server error',
      };
    }

    // Success
    const recordHash = createHash('sha256')
      .update(JSON.stringify(record))
      .digest('hex');

    return {
      status: 201,
      recordHash,
    };
  }

  /**
   * Process batch of records
   * B127A-ATR-014: Batch windows for efficient processing
   */
  async processBatch(
    records: AttributionRecord[],
    batchId: string
  ): Promise<{
    batchId: string;
    totalRecords: number;
    added: number;
    skipped: number;
    failed: number;
    durationMs: number;
  }> {
    const startTime = Date.now();

    this.eventEmitter.emit('batch_started', {
      batchId,
      recordCount: records.length,
      timestamp: new Date().toISOString(),
    });

    const results = await Promise.all(
      records.map(record => this.processRecord(record))
    );

    const added = results.filter(r => r.result === 'added').length;
    const skipped = results.filter(r => r.result === 'skipped').length;
    const failed = results.filter(r => r.result === 'failed').length;

    this.metrics.batchesProcessed++;

    const durationMs = Date.now() - startTime;

    this.eventEmitter.emit('batch_completed', {
      batchId,
      totalRecords: records.length,
      added,
      skipped,
      failed,
      durationMs,
      timestamp: new Date().toISOString(),
    });

    return {
      batchId,
      totalRecords: records.length,
      added,
      skipped,
      failed,
      durationMs,
    };
  }

  /**
   * Get metrics
   * B127A-ATR-014: /metrics shows processed/skipped counts
   */
  getMetrics(): ReconciliationMetrics {
    return { ...this.metrics };
  }

  /**
   * Export metrics in Prometheus format
   */
  exportPrometheusMetrics(): string {
    let output = '# HELP atr_reconciliation_total Total records processed\n';
    output += '# TYPE atr_reconciliation_total counter\n';
    output += `atr_reconciliation_total ${this.metrics.totalProcessed}\n\n`;

    output += '# HELP atr_reconciliation_added Records added\n';
    output += '# TYPE atr_reconciliation_added counter\n';
    output += `atr_reconciliation_added ${this.metrics.added}\n\n`;

    output += '# HELP atr_reconciliation_skipped Records skipped (duplicate)\n';
    output += '# TYPE atr_reconciliation_skipped counter\n';
    output += `atr_reconciliation_skipped ${this.metrics.skipped}\n\n`;

    output += '# HELP atr_reconciliation_failed Records failed\n';
    output += '# TYPE atr_reconciliation_failed counter\n';
    output += `atr_reconciliation_failed ${this.metrics.failed}\n\n`;

    output += '# HELP atr_reconciliation_batches Batches processed\n';
    output += '# TYPE atr_reconciliation_batches counter\n';
    output += `atr_reconciliation_batches ${this.metrics.batchesProcessed}\n\n`;

    output += '# HELP atr_reconciliation_retries Retry attempts\n';
    output += '# TYPE atr_reconciliation_retries counter\n';
    output += `atr_reconciliation_retries ${this.metrics.retriesAttempted}\n\n`;

    output += '# HELP atr_reconciliation_rate_limits Rate limit hits (429)\n';
    output += '# TYPE atr_reconciliation_rate_limits counter\n';
    output += `atr_reconciliation_rate_limits ${this.metrics.rateLimitHits}\n`;

    return output;
  }

  /**
   * Subscribe to events
   */
  on(event: string, listener: (...args: any[]) => void): void {
    this.eventEmitter.on(event, listener);
  }

  /**
   * Reset metrics (for testing)
   */
  resetMetrics(): void {
    this.metrics = {
      totalProcessed: 0,
      added: 0,
      skipped: 0,
      failed: 0,
      batchesProcessed: 0,
      retriesAttempted: 0,
      rateLimitHits: 0,
    };
  }

  /**
   * Clear idempotency store (for testing)
   */
  clearIdempotencyStore(): void {
    this.idempotencyStore.clear();
  }
}

/**
 * Example usage
 */
export async function reconcileAttributions(
  records: AttributionRecord[]
): Promise<void> {
  const manager = new ATRReconciliationManager();

  // Subscribe to events for logging
  manager.on('batch_started', (event) => {
    console.log('[ATR] Batch started:', event);
  });

  manager.on('batch_completed', (event) => {
    console.log('[ATR] Batch completed:', event);
  });

  manager.on('record_added', (event) => {
    console.log('[ATR] Record added:', event);
  });

  manager.on('record_failed', (event) => {
    console.error('[ATR] Record failed:', event);
  });

  manager.on('backoff', (event) => {
    console.warn('[ATR] Backing off due to rate limit:', event);
  });

  // Process in batches of 100
  const batchSize = 100;
  for (let i = 0; i < records.length; i += batchSize) {
    const batch = records.slice(i, i + batchSize);
    const batchId = `batch-${Math.floor(i / batchSize) + 1}`;

    await manager.processBatch(batch, batchId);

    // Optional: add delay between batches to avoid rate limits
    if (i + batchSize < records.length) {
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
  }

  // Export final metrics
  console.log('[ATR] Final metrics:', manager.getMetrics());
}


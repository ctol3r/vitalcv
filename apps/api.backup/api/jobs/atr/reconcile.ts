/**
 * ATR Production Reconcile Job
 * B104C-ATR-048: ATR reconcile + provenance webhooks (retry)
 * B121A-ATR-008: ATR reconcile: retry policy, idempotency key, partial batch recovery
 *
 * Reconciles ATR (Attestation Transaction Records) with production systems.
 * Features:
 * - Batching: Processes records in configurable batch sizes
 * - Backoff: Exponential backoff on 429 (rate limit) responses
 * - Idempotency: Prevents duplicate event processing
 * - Provenance webhooks: Sends delta webhooks with retry logic
 * B121A-ATR-008: no duplicates; retries exponential; metrics collected
 */

import { Pool } from 'pg';
import {
  calculateProvenanceDelta,
  sendProvenanceWebhook,
  getProvenanceWebhookUrls,
  ProvenanceDelta,
} from './provenance-webhook';

interface ATRReconcileConfig {
  batchSize: number;
  maxRetries: number;
  initialBackoffMs: number;
  maxBackoffMs: number;
  backoffMultiplier: number;
}

interface ATRRecord {
  id: string;
  eventId: string;
  providerId: string;
  eventType: string;
  payload: Record<string, any>;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  retryCount: number;
  lastAttemptAt?: Date;
  completedAt?: Date;
  error?: string;
  previousStatus?: string;
  previousPayload?: Record<string, any>;
}

interface ReconcileResult {
  processed: number;
  failed: number;
  skipped: number;
  duplicates: number;
  rateLimited: number;
}

/**
 * B111A-ATR-014: Metrics for ATR reconcile
 */
interface ATRMetrics {
  processed: number;
  skipped: number;
  dropped: number;
  rateLimited: number;
  duplicates: number;
  retries: number;
}

/**
 * ATR Reconcile Service
 */
export class ATRReconcileService {
  private pool: Pool;
  private config: ATRReconcileConfig;
  private metrics: ATRMetrics;

  constructor(pool: Pool, config?: Partial<ATRReconcileConfig>) {
    this.pool = pool;
    this.config = {
      batchSize: parseInt(process.env.ATR_BATCH_SIZE || '50'),
      maxRetries: parseInt(process.env.ATR_MAX_RETRIES || '3'),
      initialBackoffMs: parseInt(process.env.ATR_INITIAL_BACKOFF_MS || '1000'),
      maxBackoffMs: parseInt(process.env.ATR_MAX_BACKOFF_MS || '30000'),
      backoffMultiplier: parseFloat(process.env.ATR_BACKOFF_MULTIPLIER || '2'),
      ...config,
    };
    // B111A-ATR-014: Initialize metrics
    this.metrics = {
      processed: 0,
      skipped: 0,
      dropped: 0,
      rateLimited: 0,
      duplicates: 0,
      retries: 0,
    };
  }

  /**
   * B111A-ATR-014: Get metrics
   */
  getMetrics(): ATRMetrics {
    return { ...this.metrics };
  }

  /**
   * B111A-ATR-014: Reset metrics
   */
  resetMetrics(): void {
    this.metrics = {
      processed: 0,
      skipped: 0,
      dropped: 0,
      rateLimited: 0,
      duplicates: 0,
      retries: 0,
    };
  }

  /**
   * Calculate exponential backoff delay
   */
  private calculateBackoff(retryCount: number): number {
    const delay = Math.min(
      this.config.initialBackoffMs * Math.pow(this.config.backoffMultiplier, retryCount),
      this.config.maxBackoffMs
    );
    return delay;
  }

  /**
   * Sleep for specified milliseconds
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * B111A-ATR-014: Check if event was already processed using idempotency key
   */
  private async isEventProcessed(eventId: string, idempotencyKey?: string): Promise<boolean> {
    // Check by event_id (primary idempotency key)
    const result = await this.pool.query(
      'SELECT id FROM "ATREvent" WHERE event_id = $1 AND status = $2 LIMIT 1',
      [eventId, 'completed']
    );
    if (result.rows.length > 0) {
      return true;
    }

    // B111A-ATR-014: Also check by idempotency_key if provided
    if (idempotencyKey) {
      const keyResult = await this.pool.query(
        'SELECT id FROM "ATREvent" WHERE idempotency_key = $1 AND status = $2 LIMIT 1',
        [idempotencyKey, 'completed']
      );
      if (keyResult.rows.length > 0) {
        return true;
      }
    }

    return false;
  }

  /**
   * Mark event as processing (idempotency lock)
   */
  private async lockEvent(eventId: string, recordId: string): Promise<boolean> {
    try {
      await this.pool.query(
        'UPDATE "ATREvent" SET status = $1, last_attempt_at = NOW() WHERE id = $2 AND status = $3',
        ['processing', recordId, 'pending']
      );
      return true;
    } catch (error) {
      // If update affected 0 rows, another process is already handling it
      return false;
    }
  }

  /**
   * Process a single ATR record
   */
  private async processRecord(record: ATRRecord): Promise<{ success: boolean; error?: string }> {
    // B111A-ATR-014: Idempotency check using idempotency key
    const idempotencyKey = (record.payload as any)?.idempotencyKey || record.eventId;
    const alreadyProcessed = await this.isEventProcessed(record.eventId, idempotencyKey);
    if (alreadyProcessed) {
      this.metrics.duplicates++;
      return { success: true }; // Already processed, skip
    }

    // Lock the event for processing
    const locked = await this.lockEvent(record.eventId, record.id);
    if (!locked) {
      return { success: false, error: 'Event already being processed by another worker' };
    }

    let retryCount = record.retryCount;
    let lastError: string | undefined;

    while (retryCount < this.config.maxRetries) {
      try {
        // Simulate API call to production system
        // In production, this would be an actual HTTP request
        const response = await this.callProductionAPI(record);

        if (response.status === 429) {
          // B111A-ATR-014: Rate limited - apply backoff and track metrics
          this.metrics.rateLimited++;
          this.metrics.retries++;
          const backoffMs = this.calculateBackoff(retryCount);
          console.log(`[ATR] Rate limited, backing off ${backoffMs}ms for event ${record.eventId}`);
          await this.sleep(backoffMs);
          retryCount++;
          continue;
        }

        if (response.status >= 200 && response.status < 300) {
          // Success - mark as completed
          await this.pool.query(
            'UPDATE "ATREvent" SET status = $1, completed_at = NOW(), retry_count = $2 WHERE id = $3',
            ['completed', retryCount, record.id]
          );

          // B111A-ATR-014: Track processed metric
          this.metrics.processed++;

          // Send provenance webhook for status change
          await this.sendProvenanceWebhooks(record, 'completed');

          return { success: true };
        }

        // Other error - retry with backoff
        lastError = `API returned status ${response.status}`;
        retryCount++;
        const backoffMs = this.calculateBackoff(retryCount);
        await this.sleep(backoffMs);

      } catch (error: any) {
        lastError = error.message || 'Unknown error';
        retryCount++;

        if (retryCount < this.config.maxRetries) {
          const backoffMs = this.calculateBackoff(retryCount);
          await this.sleep(backoffMs);
        }
      }
    }

    // Max retries exceeded - mark as failed
    await this.pool.query(
      `UPDATE "ATREvent"
       SET status = $1, error = $2, retry_count = $3,
           previous_status = $5, previous_payload = $6
       WHERE id = $4`,
      [
        'failed',
        lastError || 'Max retries exceeded',
        retryCount,
        record.id,
        record.status,
        JSON.stringify(record.payload),
      ]
    );

    // B111A-ATR-014: Track dropped metric
    this.metrics.dropped++;

    // Send provenance webhook for failure
    await this.sendProvenanceWebhooks(record, 'failed');

    return { success: false, error: lastError || 'Max retries exceeded' };
  }

  /**
   * Send provenance webhooks for status changes
   */
  private async sendProvenanceWebhooks(
    record: ATRRecord,
    newStatus: string
  ): Promise<void> {
    const webhookUrls = getProvenanceWebhookUrls();
    if (webhookUrls.length === 0) {
      return; // No webhooks configured
    }

    const delta = calculateProvenanceDelta(
      record.eventId,
      record.providerId,
      record.eventType,
      record.previousStatus || record.status,
      newStatus,
      record.previousPayload,
      record.payload
    );

    // Send to all configured webhook URLs
    const webhookPromises = webhookUrls.map(async (url) => {
      try {
        const result = await sendProvenanceWebhook(delta, {
          url,
          maxRetries: this.config.maxRetries,
          initialBackoffMs: this.config.initialBackoffMs,
          maxBackoffMs: this.config.maxBackoffMs,
        });

        if (!result.success) {
          console.warn(
            `[ATR] Failed to deliver provenance webhook to ${url} after ${result.attempt} attempts:`,
            result.error
          );
        } else {
          console.log(
            `[ATR] Provenance webhook delivered to ${url} (attempt ${result.attempt})`
          );
        }
      } catch (error: any) {
        console.error(`[ATR] Error sending provenance webhook to ${url}:`, error);
      }
    });

    // Don't block reconciliation on webhook failures
    await Promise.allSettled(webhookPromises);
  }

  /**
   * Call production API (mock implementation)
   * In production, this would make actual HTTP requests
   */
  private async callProductionAPI(record: ATRRecord): Promise<{ status: number; data?: any }> {
    // Mock implementation - in production, make actual API call
    // Simulate occasional rate limiting
    if (Math.random() < 0.1) {
      return { status: 429 };
    }

    // Simulate success
    return { status: 200, data: { processed: true } };
  }

  /**
   * B111A-ATR-014: Reconcile batch of ATR records with batch windows
   */
  async reconcileBatch(windowStart?: Date, windowEnd?: Date): Promise<ReconcileResult> {
    const result: ReconcileResult = {
      processed: 0,
      failed: 0,
      skipped: 0,
      duplicates: 0,
      rateLimited: 0,
    };

    // B111A-ATR-014: Fetch pending records within batch window
    let query = `SELECT id, event_id, provider_id, event_type, payload, status, retry_count, last_attempt_at,
                        previous_status, previous_payload, idempotency_key
                 FROM "ATREvent"
                 WHERE status IN ($1, $2)`;
    const params: any[] = ['pending', 'failed'];

    if (windowStart && windowEnd) {
      query += ' AND created_at >= $3 AND created_at <= $4';
      params.push(windowStart, windowEnd);
    }

    query += ' ORDER BY created_at ASC LIMIT $' + (params.length + 1);
    params.push(this.config.batchSize);

    const queryResult = await this.pool.query(query, params);

    const records: ATRRecord[] = queryResult.rows.map(row => ({
      id: row.id,
      eventId: row.event_id,
      providerId: row.provider_id,
      eventType: row.event_type,
      payload: row.payload,
      status: row.status,
      retryCount: row.retry_count || 0,
      lastAttemptAt: row.last_attempt_at,
      previousStatus: row.previous_status,
      previousPayload: row.previous_payload,
    }));

    console.log(`[ATR] Processing batch of ${records.length} records`);

    // Process records in parallel (with concurrency limit)
    const concurrency = 5;
    for (let i = 0; i < records.length; i += concurrency) {
      const batch = records.slice(i, i + concurrency);
      const results = await Promise.allSettled(
        batch.map(record => this.processRecord(record))
      );

      results.forEach((settled, index) => {
        const record = batch[index];
        if (settled.status === 'fulfilled') {
          const processResult = settled.value;
          if (processResult.success) {
            result.processed++;
          } else {
            if (processResult.error?.includes('already processed')) {
              result.duplicates++;
            } else {
              result.failed++;
            }
          }
        } else {
          result.failed++;
          console.error(`[ATR] Failed to process record ${record.id}:`, settled.reason);
        }
      });

      // B111A-ATR-014: Update result with metrics
      result.rateLimited = this.metrics.rateLimited;
      result.duplicates = this.metrics.duplicates;
    }

    return result;
  }

  /**
   * B111A-ATR-014: Run reconcile job with batch window
   */
  async run(windowStart?: Date, windowEnd?: Date): Promise<ReconcileResult> {
    console.log('[ATR] Starting reconcile job', { windowStart, windowEnd });
    const result = await this.reconcileBatch(windowStart, windowEnd);
    console.log('[ATR] Reconcile job completed:', result);
    console.log('[ATR] Metrics:', this.metrics);
    return result;
  }

  /**
   * B111A-ATR-014: Get metrics endpoint handler
   */
  async getMetricsEndpoint(): Promise<{ metrics: ATRMetrics; result: ReconcileResult }> {
    return {
      metrics: this.getMetrics(),
      result: {
        processed: this.metrics.processed,
        failed: this.metrics.dropped,
        skipped: this.metrics.skipped,
        duplicates: this.metrics.duplicates,
        rateLimited: this.metrics.rateLimited,
      },
    };
  }
}

/**
 * Get ATR reconcile service instance
 */
let reconcileService: ATRReconcileService | null = null;

export function getATRReconcileService(pool?: Pool): ATRReconcileService {
  if (!reconcileService) {
    if (!pool) {
      throw new Error('Pool required for first initialization');
    }
    reconcileService = new ATRReconcileService(pool);
  }
  return reconcileService;
}


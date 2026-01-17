/**
 * B245A-OBS-008: LogExportService
 * Sends logs to external aggregator (e.g. Elasticsearch, CloudWatch) in batch; ensures network retries and backpressure; supports configurable endpoints via ObservabilityConfigService
 */

import { LogEventModel } from '../models/LogEvent.js';
import { ObservabilityConfigService } from '../services/observabilityConfigService.js';

type LogLevel = string;

interface LogEventRecord {
  id: string;
  serviceName: string;
  level: LogLevel;
  message: string;
  context: unknown;
  correlationId?: string | null;
  timestamp: Date;
}

export interface LogExportConfig {
  endpoint: string;
  type: 'elasticsearch' | 'cloudwatch' | 'custom';
  batchSize: number;
  flushInterval: number; // milliseconds
  maxRetries: number;
  retryDelay: number; // milliseconds
  backpressureThreshold: number; // max pending logs
}

export interface LogBatch {
  logs: Array<{
    id: string;
    serviceName: string;
    level: LogLevel;
    message: string;
    context: unknown;
    correlationId?: string;
    timestamp: Date;
  }>;
}

export class LogExportService {
  private logEventModel: LogEventModel;
  private config: LogExportConfig;
  private configService: ObservabilityConfigService;
  private exportQueue: LogBatch[] = [];
  private isExporting: boolean = false;
  private flushTimer?: NodeJS.Timeout;
  private pendingCount: number = 0;

  constructor(prisma: unknown, config: LogExportConfig, configService: ObservabilityConfigService) {
    this.logEventModel = new LogEventModel(prisma as any);
    this.config = config;
    this.configService = configService;

    // Start flush timer
    this.startFlushTimer();
  }

  /**
   * Start automatic flush timer
   */
  private startFlushTimer(): void {
    if (this.flushTimer) {
      clearInterval(this.flushTimer);
    }

    this.flushTimer = setInterval(() => {
      this.flush().catch((error) => {
        console.error('[LogExportService] Error in flush timer:', error);
      });
    }, this.config.flushInterval);
  }

  /**
   * Export logs in batch
   */
  async exportBatch(batch: LogBatch): Promise<void> {
    let retries = 0;

    while (retries < this.config.maxRetries) {
      try {
        await this.sendToEndpoint(batch);
        return; // Success
      } catch (error) {
        retries++;
        if (retries >= this.config.maxRetries) {
          console.error('[LogExportService] Max retries reached, dropping batch:', error);
          throw error;
        }

        // Exponential backoff
        const delay = this.config.retryDelay * Math.pow(2, retries - 1);
        await new Promise((resolve) => setTimeout(resolve, delay));
      }
    }
  }

  /**
   * Send batch to configured endpoint
   */
  private async sendToEndpoint(batch: LogBatch): Promise<void> {
    const payload = this.formatPayload(batch);

    const response = await fetch(this.config.endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      throw new Error(`Export failed with status ${response.status}: ${response.statusText}`);
    }
  }

  /**
   * Format payload based on endpoint type
   */
  private formatPayload(batch: LogBatch): any {
    switch (this.config.type) {
      case 'elasticsearch':
        return {
          index: 'logs',
          body: batch.logs.map((log) => ({
            index: {
              _index: 'logs',
              _type: '_doc',
            },
          })),
          data: batch.logs.map((log) => ({
            '@timestamp': log.timestamp.toISOString(),
            service: log.serviceName,
            level: log.level,
            message: log.message,
            context: log.context,
            correlationId: log.correlationId,
          })),
        };

      case 'cloudwatch':
        return {
          logGroupName: '/vitalcv/logs',
          logStreamName: batch.logs[0]?.serviceName || 'default',
          logEvents: batch.logs.map((log) => ({
            timestamp: log.timestamp.getTime(),
            message: JSON.stringify({
              service: log.serviceName,
              level: log.level,
              message: log.message,
              context: log.context,
              correlationId: log.correlationId,
            }),
          })),
        };

      default:
        return batch.logs;
    }
  }

  /**
   * Queue logs for export
   */
  async queueLogs(serviceName: string, limit: number = 100): Promise<void> {
    // Check backpressure
    if (this.pendingCount >= this.config.backpressureThreshold) {
      console.warn('[LogExportService] Backpressure threshold reached, skipping export');
      return;
    }

    const logs: LogEventRecord[] = await this.logEventModel.findMany(
      {
        serviceName,
      },
      limit,
    );

    if (logs.length === 0) {
      return;
    }

    const batch: LogBatch = {
      logs: logs.map((log: LogEventRecord) => ({
        id: log.id,
        serviceName: log.serviceName,
        level: log.level,
        message: log.message,
        context: log.context,
        correlationId: log.correlationId || undefined,
        timestamp: log.timestamp,
      })),
    };

    this.exportQueue.push(batch);
    this.pendingCount += batch.logs.length;

    // Trigger flush if batch size reached
    if (this.exportQueue.length >= this.config.batchSize) {
      await this.flush();
    }
  }

  /**
   * Flush queued logs
   */
  async flush(): Promise<void> {
    if (this.isExporting || this.exportQueue.length === 0) {
      return;
    }

    this.isExporting = true;

    try {
      const batches = this.exportQueue.splice(0, this.config.batchSize);

      for (const batch of batches) {
        try {
          await this.exportBatch(batch);
          this.pendingCount -= batch.logs.length;
        } catch (error) {
          console.error('[LogExportService] Failed to export batch:', error);
          // Re-queue batch for retry (or implement dead letter queue)
        }
      }
    } finally {
      this.isExporting = false;
    }
  }

  /**
   * Stop the export service
   */
  stop(): void {
    if (this.flushTimer) {
      clearInterval(this.flushTimer);
    }
    // Flush remaining logs
    this.flush().catch((error) => {
      console.error('[LogExportService] Error in final flush:', error);
    });
  }
}

export default LogExportService;

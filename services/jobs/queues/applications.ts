const log = getServiceLogger('jobs/queues/applications');
/**
 * B132A-QUEUE-013: Job application queue (Kafka/Redis) for async processing
 *
 * enqueue on apply; worker processes; DLQ on failure; metrics exported
 */

import { EventEmitter } from 'events';
import { getServiceLogger } from '../../logging/serviceLogger';

export interface QueueMessage {
  type: 'application.created' | 'application.updated' | 'vc.verify' | 'webhook.send';
  applicationId: string;
  application?: any;
  priority: 'high' | 'normal' | 'low';
  attempts?: number;
  maxAttempts?: number;
  metadata?: any;
}

export interface QueueMetrics {
  enqueued: number;
  processed: number;
  failed: number;
  dlq: number;
  inProgress: number;
  averageProcessingTime: number;
}

/**
 * Application Queue
 * Simple in-memory queue with worker processing
 * In production, replace with Kafka, Redis Queue, or AWS SQS
 */
class ApplicationQueue extends EventEmitter {
  private queue: QueueMessage[] = [];
  private dlq: QueueMessage[] = []; // Dead Letter Queue
  private processing = new Set<string>();
  private metrics: QueueMetrics = {
    enqueued: 0,
    processed: 0,
    failed: 0,
    dlq: 0,
    inProgress: 0,
    averageProcessingTime: 0,
  };
  private processingTimes: number[] = [];
  private isProcessing = false;

  /**
   * Enqueue a message
   */
  async enqueue(message: QueueMessage): Promise<void> {
    // Set default values
    message.attempts = message.attempts || 0;
    message.maxAttempts = message.maxAttempts || 3;

    // Priority queue: high > normal > low
    if (message.priority === 'high') {
      this.queue.unshift(message);
    } else {
      this.queue.push(message);
    }

    this.metrics.enqueued++;
    log.info(`[queue] Enqueued message: ${message.type} for ${message.applicationId}`);

    // Emit event
    this.emit('enqueued', message);

    // Start processing if not already running
    if (!this.isProcessing) {
      this.processQueue();
    }
  }

  /**
   * Process messages in the queue
   */
  private async processQueue(): Promise<void> {
    if (this.isProcessing || this.queue.length === 0) {
      return;
    }

    this.isProcessing = true;

    while (this.queue.length > 0) {
      const message = this.queue.shift();
      if (!message) continue;

      this.processing.add(message.applicationId);
      this.metrics.inProgress++;

      const startTime = Date.now();

      try {
        await this.processMessage(message);

        const processingTime = Date.now() - startTime;
        this.processingTimes.push(processingTime);
        if (this.processingTimes.length > 100) {
          this.processingTimes.shift();
        }

        this.metrics.processed++;
        this.metrics.averageProcessingTime =
          this.processingTimes.reduce((a, b) => a + b, 0) / this.processingTimes.length;

        log.info(`[queue] Processed message: ${message.type} for ${message.applicationId} in ${processingTime}ms`);
        this.emit('processed', message);

      } catch (error) {
        log.error(`[queue] Error processing message:`, error);
        message.attempts!++;

        if (message.attempts! >= message.maxAttempts!) {
          // Move to DLQ
          this.dlq.push(message);
          this.metrics.dlq++;
          log.error(`[queue] Message moved to DLQ after ${message.attempts} attempts:`, message);
          this.emit('dlq', message, error);
        } else {
          // Retry
          log.info(`[queue] Retrying message (attempt ${message.attempts}/${message.maxAttempts})`);
          await this.enqueue(message);
        }

        this.metrics.failed++;
      } finally {
        this.processing.delete(message.applicationId);
        this.metrics.inProgress--;
      }
    }

    this.isProcessing = false;
  }

  /**
   * Process a single message
   * This is where the actual work happens
   */
  private async processMessage(message: QueueMessage): Promise<void> {
    switch (message.type) {
      case 'application.created':
        await this.handleApplicationCreated(message);
        break;

      case 'application.updated':
        await this.handleApplicationUpdated(message);
        break;

      case 'vc.verify':
        await this.handleVcVerify(message);
        break;

      case 'webhook.send':
        await this.handleWebhookSend(message);
        break;

      default:
        log.warn(`[queue] Unknown message type: ${message.type}`);
    }
  }

  /**
   * Handle application created event
   */
  private async handleApplicationCreated(message: QueueMessage): Promise<void> {
    log.info(`[queue] Processing application.created: ${message.applicationId}`);

    // 1. Verify VC bundle
    await this.enqueue({
      type: 'vc.verify',
      applicationId: message.applicationId,
      application: message.application,
      priority: 'high',
      metadata: { source: 'application.created' },
    });

    // 2. Send webhook notification
    await this.enqueue({
      type: 'webhook.send',
      applicationId: message.applicationId,
      application: message.application,
      priority: 'normal',
      metadata: { source: 'application.created' },
    });
  }

  /**
   * Handle application updated event
   */
  private async handleApplicationUpdated(message: QueueMessage): Promise<void> {
    log.info(`[queue] Processing application.updated: ${message.applicationId}`);

    // Send webhook notification
    await this.enqueue({
      type: 'webhook.send',
      applicationId: message.applicationId,
      application: message.application,
      priority: 'normal',
      metadata: { source: 'application.updated' },
    });
  }

  /**
   * Handle VC verification
   */
  private async handleVcVerify(message: QueueMessage): Promise<void> {
    log.info(`[queue] Verifying VCs for application: ${message.applicationId}`);

    // Simulate VC verification (in production, call verifier service)
    await new Promise(resolve => setTimeout(resolve, 100));

    // TODO: Implement actual VC verification
    // - Verify signatures
    // - Check revocation status
    // - Validate claims
    // - Generate JobEligibility VC
  }

  /**
   * Handle webhook send
   */
  private async handleWebhookSend(message: QueueMessage): Promise<void> {
    log.info(`[queue] Sending webhook for application: ${message.applicationId}`);

    // Simulate webhook send (in production, call webhook service)
    await new Promise(resolve => setTimeout(resolve, 100));

    // TODO: Implement actual webhook sending
    // - Fetch partner config
    // - Build webhook payload
    // - Send HTTP request with retries
    // - Update application with webhook status
  }

  /**
   * Get queue metrics
   */
  getMetrics(): QueueMetrics {
    return { ...this.metrics };
  }

  /**
   * Get queue size
   */
  size(): number {
    return this.queue.length;
  }

  /**
   * Get DLQ size
   */
  dlqSize(): number {
    return this.dlq.length;
  }

  /**
   * Get DLQ messages
   */
  getDlqMessages(): QueueMessage[] {
    return [...this.dlq];
  }

  /**
   * Retry a message from DLQ
   */
  async retryFromDlq(applicationId: string): Promise<boolean> {
    const index = this.dlq.findIndex(msg => msg.applicationId === applicationId);
    if (index === -1) {
      return false;
    }

    const message = this.dlq.splice(index, 1)[0];
    message.attempts = 0; // Reset attempts
    await this.enqueue(message);
    this.metrics.dlq--;

    return true;
  }

  /**
   * Clear DLQ
   */
  clearDlq(): number {
    const count = this.dlq.length;
    this.dlq = [];
    this.metrics.dlq = 0;
    return count;
  }
}

// Singleton instance
export const applicationQueue = new ApplicationQueue();

// Export class for testing
export { ApplicationQueue };


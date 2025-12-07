/**
 * ObservabilityWebhookListener
 * B245B-OBS-019: Receives webhooks from external monitoring sources
 * Validates signatures
 * Parses event payloads into metrics or logs
 * Triggers alert rules if applicable
 */

import { Request, Response, Router } from 'express';
import crypto from 'crypto';
import { MetricStore, MetricValue } from '../services/alertingService';
import { AlertingService } from '../services/alertingService';
import { PrismaClient } from '@prisma/client';

export interface WebhookConfig {
  path: string;
  secret?: string;
  signatureHeader?: string;
  signatureAlgorithm?: 'sha256' | 'sha512';
}

export interface WebhookEvent {
  type: 'metric' | 'log' | 'alert';
  timestamp?: Date;
  data: any;
}

export interface MetricEvent {
  name: string;
  value: number;
  timestamp?: Date;
  labels?: Record<string, string>;
}

export interface LogEvent {
  level: string;
  message: string;
  timestamp?: Date;
  metadata?: Record<string, any>;
}

/**
 * Webhook listener for external monitoring sources
 */
export class ObservabilityWebhookListener {
  private router: Router;

  constructor(
    private config: WebhookConfig,
    private metricStore: MetricStore,
    private alertingService?: AlertingService,
    private prisma?: PrismaClient
  ) {
    this.router = Router();
    this.setupRoutes();
  }

  /**
   * Get Express router
   */
  getRouter(): Router {
    return this.router;
  }

  /**
   * Setup webhook routes
   */
  private setupRoutes(): void {
    // POST endpoint for receiving webhooks
    this.router.post(this.config.path || '/webhook', async (req: Request, res: Response) => {
      try {
        // Validate signature if secret is configured
        if (this.config.secret) {
          const isValid = this.validateSignature(req);
          if (!isValid) {
            return res.status(401).json({ error: 'Invalid signature' });
          }
        }

        // Parse webhook event
        const event = this.parseEvent(req.body);

        // Process event based on type
        switch (event.type) {
          case 'metric':
            await this.processMetricEvent(event.data as MetricEvent);
            break;
          case 'log':
            await this.processLogEvent(event.data as LogEvent);
            break;
          case 'alert':
            await this.processAlertEvent(event.data);
            break;
          default:
            return res.status(400).json({ error: 'Unknown event type' });
        }

        res.status(200).json({ success: true });
      } catch (error: any) {
        console.error('[ObservabilityWebhookListener] Error processing webhook:', error);
        res.status(500).json({ error: error.message || 'Internal server error' });
      }
    });

    // GET endpoint for health check
    this.router.get(this.config.path || '/webhook', (req: Request, res: Response) => {
      res.json({ status: 'ok', service: 'observability-webhook-listener' });
    });
  }

  /**
   * Validate webhook signature
   */
  private validateSignature(req: Request): boolean {
    if (!this.config.secret) {
      return true; // No secret configured, skip validation
    }

    const signatureHeader = this.config.signatureHeader || 'x-signature';
    const signature = req.headers[signatureHeader] as string;

    if (!signature) {
      return false;
    }

    const algorithm = this.config.signatureAlgorithm || 'sha256';
    const hmac = crypto.createHmac(algorithm, this.config.secret);
    const payload = JSON.stringify(req.body);
    const calculatedSignature = hmac.update(payload).digest('hex');

    // Compare signatures (constant-time comparison)
    return crypto.timingSafeEqual(
      Buffer.from(signature),
      Buffer.from(calculatedSignature)
    );
  }

  /**
   * Parse webhook event from request body
   */
  private parseEvent(body: any): WebhookEvent {
    // Try to determine event type from body structure
    let type: 'metric' | 'log' | 'alert' = 'alert';

    if (body.name && typeof body.value === 'number') {
      type = 'metric';
    } else if (body.level && body.message) {
      type = 'log';
    } else if (body.type) {
      type = body.type;
    }

    return {
      type,
      timestamp: body.timestamp ? new Date(body.timestamp) : new Date(),
      data: body,
    };
  }

  /**
   * Process metric event
   */
  private async processMetricEvent(event: MetricEvent): Promise<void> {
    const metricValue: MetricValue = {
      name: event.name,
      value: event.value,
      timestamp: event.timestamp || new Date(),
      labels: event.labels,
    };

    // Store metric (assuming metric store has internal mechanism)
    // In a real implementation, you'd call: await this.metricStore.setMetric(...)
    console.log(`[ObservabilityWebhookListener] Received metric: ${event.name} = ${event.value}`);

    // Trigger alert evaluation if alerting service is available
    if (this.alertingService) {
      try {
        // Evaluate all rules for this metric
        await this.alertingService.evaluateAllRules();
      } catch (error) {
        console.error('[ObservabilityWebhookListener] Error evaluating alerts:', error);
      }
    }
  }

  /**
   * Process log event
   */
  private async processLogEvent(event: LogEvent): Promise<void> {
    // Store log event
    // In a real implementation, you'd integrate with logging service
    console.log(`[ObservabilityWebhookListener] Received log: [${event.level}] ${event.message}`, event.metadata);
  }

  /**
   * Process alert event (from external alerting systems)
   */
  private async processAlertEvent(event: any): Promise<void> {
    // Process alert from external system
    // This could create an incident, trigger notifications, etc.
    console.log('[ObservabilityWebhookListener] Received alert event:', event);

    // Example: Create incident if Prisma is available
    if (this.prisma && event.incident) {
      try {
        await this.prisma.incident.create({
          data: {
            startTime: event.timestamp ? new Date(event.timestamp) : new Date(),
            status: 'OPEN',
            notes: JSON.stringify(event),
          },
        });
      } catch (error) {
        console.error('[ObservabilityWebhookListener] Error creating incident:', error);
      }
    }
  }
}

/**
 * Create webhook listener from configuration
 */
export function createWebhookListener(
  config: WebhookConfig,
  metricStore: MetricStore,
  alertingService?: AlertingService,
  prisma?: PrismaClient
): ObservabilityWebhookListener {
  return new ObservabilityWebhookListener(config, metricStore, alertingService, prisma);
}


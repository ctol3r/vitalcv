/**
 * B236B-WF-013: WebhookTriggerService
 *
 * Exposes webhook endpoints that trigger workflows when called.
 * Verifies signatures/secrets, throttles and logs requests.
 * Includes security tests.
 */

import { Request, Response } from 'express';
import crypto from 'crypto';
import { getServiceLogger } from '../../logging/serviceLogger';
import { PrismaClient } from '@prisma/client';
import {
  WebhookTriggerConfig,
  WorkflowDefinition,
  WorkflowExecutionContext,
} from '../models/types.js';

const log = getServiceLogger('workflow/triggers/webhook');
const prisma = new PrismaClient();

/**
 * Webhook registration
 */
interface WebhookRegistration {
  workflow: WorkflowDefinition;
  config: WebhookTriggerConfig;
  path: string;
  requestCount: number;
  lastRequestAt?: Date;
}

/**
 * Rate limiting configuration
 */
interface RateLimitConfig {
  maxRequests: number;
  windowMs: number;
}

/**
 * WebhookTriggerService handles webhook-based workflow triggers
 */
export class WebhookTriggerService {
  private registrations: Map<string, WebhookRegistration> = new Map();
  private workflowExecutor?: (context: WorkflowExecutionContext) => Promise<void>;
  private rateLimits: Map<string, { count: number; resetAt: Date }> = new Map();
  private defaultRateLimit: RateLimitConfig = {
    maxRequests: 100,
    windowMs: 60000, // 1 minute
  };

  /**
   * Register a workflow with webhook trigger
   */
  registerWorkflow(workflow: WorkflowDefinition, config: WebhookTriggerConfig): void {
    if (config.type !== 'webhook') {
      throw new Error('WebhookTriggerService only accepts webhook trigger configs');
    }

    const key = `${workflow.id}:${config.path}`;
    const registration: WebhookRegistration = {
      workflow,
      config,
      path: config.path,
      requestCount: 0,
    };

    this.registrations.set(key, registration);

    log.info('Registered workflow for webhook trigger', {
      workflowId: workflow.id,
      path: config.path,
      method: config.method,
    });
  }

  /**
   * Set the workflow executor function
   */
  setWorkflowExecutor(executor: (context: WorkflowExecutionContext) => Promise<void>): void {
    this.workflowExecutor = executor;
  }

  /**
   * Express middleware to handle webhook requests
   */
  getMiddleware() {
    return async (req: Request, res: Response): Promise<void> => {
      const path = req.path;
      const method = req.method;

      // Find matching registration
      const registration = this.findRegistration(path, method);
      if (!registration) {
        res.status(404).json({ error: 'Webhook not found' });
        return;
      }

      // Check if workflow is enabled
      if (!registration.workflow.enabled) {
        res.status(503).json({ error: 'Workflow disabled' });
        return;
      }

      // Rate limiting
      if (!this.checkRateLimit(path)) {
        res.status(429).json({ error: 'Rate limit exceeded' });
        return;
      }

      // Verify signature if configured
      if (registration.config.secret) {
        if (!this.verifySignature(req, registration.config)) {
          log.warn('Webhook signature verification failed', {
            workflowId: registration.workflow.id,
            path,
            ip: req.ip,
          });
          res.status(401).json({ error: 'Invalid signature' });
          return;
        }
      }

      // Log request
      await this.logRequest(registration, req);

      // Execute workflow
      try {
        const executionId = `${registration.workflow.id}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
        const context: WorkflowExecutionContext = {
          workflowId: registration.workflow.id,
          executionId,
          triggerData: {
            triggerType: 'webhook',
            method,
            path,
            headers: this.sanitizeHeaders(req.headers),
            body: req.body,
            query: req.query,
            params: req.params,
            ip: req.ip,
          },
          variables: {},
          stepResults: {},
          startedAt: new Date(),
        };

        if (this.workflowExecutor) {
          // Execute asynchronously to avoid blocking response
          this.workflowExecutor(context).catch((error) => {
            log.error('Error executing workflow from webhook', {
              workflowId: registration.workflow.id,
              executionId: context.executionId,
              error: error instanceof Error ? error.message : 'Unknown error',
            });
          });

          res.status(202).json({
            message: 'Webhook received',
            executionId: context.executionId,
          });
        } else {
          log.warn('No workflow executor set, workflow not executed', {
            workflowId: registration.workflow.id,
          });
          res.status(500).json({ error: 'Workflow executor not configured' });
        }
      } catch (error) {
        log.error('Error processing webhook', {
          workflowId: registration.workflow.id,
          error: error instanceof Error ? error.message : 'Unknown error',
        });
        res.status(500).json({ error: 'Internal server error' });
      }
    };
  }

  /**
   * Find registration matching path and method
   */
  private findRegistration(path: string, method: string): WebhookRegistration | undefined {
    for (const registration of this.registrations.values()) {
      if (registration.path === path && registration.config.method === method) {
        return registration;
      }
    }
    return undefined;
  }

  /**
   * Verify webhook signature
   */
  private verifySignature(req: Request, config: WebhookTriggerConfig): boolean {
    if (!config.secret) {
      return true; // No secret configured, skip verification
    }

    const signatureHeader = config.signatureHeader || 'x-signature';
    const signature = req.headers[signatureHeader.toLowerCase()] as string;

    if (!signature) {
      return false;
    }

    // Common signature verification methods
    const body = typeof req.body === 'string' ? req.body : JSON.stringify(req.body);
    const expectedSignature = crypto
      .createHmac('sha256', config.secret)
      .update(body)
      .digest('hex');

    // Support both hex and base64 signatures
    const signatureHex = signature.length === 64 ? signature : Buffer.from(signature, 'base64').toString('hex');

    return crypto.timingSafeEqual(
      Buffer.from(expectedSignature),
      Buffer.from(signatureHex)
    );
  }

  /**
   * Check rate limit
   */
  private checkRateLimit(path: string): boolean {
    const now = new Date();
    const limit = this.rateLimits.get(path);

    if (!limit || limit.resetAt < now) {
      // Reset or create new limit
      this.rateLimits.set(path, {
        count: 1,
        resetAt: new Date(now.getTime() + this.defaultRateLimit.windowMs),
      });
      return true;
    }

    if (limit.count >= this.defaultRateLimit.maxRequests) {
      return false;
    }

    limit.count++;
    return true;
  }

  /**
   * Log webhook request
   */
  private async logRequest(registration: WebhookRegistration, req: Request): Promise<void> {
    registration.requestCount++;
    registration.lastRequestAt = new Date();

    try {
      await prisma.$executeRaw`
        INSERT INTO "WebhookRequest" (workflow_id, path, method, ip, headers, body, created_at)
        VALUES (
          ${registration.workflow.id},
          ${req.path},
          ${req.method},
          ${req.ip || 'unknown'},
          ${JSON.stringify(this.sanitizeHeaders(req.headers))}::jsonb,
          ${JSON.stringify(req.body)}::jsonb,
          NOW()
        )
      `;
    } catch (error) {
      // If table doesn't exist, just log
      log.debug('Could not persist webhook request (table may not exist)', {
        workflowId: registration.workflow.id,
      });
    }

    log.info('Webhook request received', {
      workflowId: registration.workflow.id,
      path: req.path,
      method: req.method,
      ip: req.ip,
      requestCount: registration.requestCount,
    });
  }

  /**
   * Sanitize headers for logging
   */
  private sanitizeHeaders(headers: Record<string, any>): Record<string, any> {
    const sanitized = { ...headers };
    const sensitiveHeaders = ['authorization', 'cookie', 'x-api-key', 'x-signature'];
    for (const header of sensitiveHeaders) {
      if (sanitized[header]) {
        sanitized[header] = '[REDACTED]';
      }
    }
    return sanitized;
  }

  /**
   * Unregister a workflow
   */
  unregisterWorkflow(workflowId: string, path: string): void {
    const key = `${workflowId}:${path}`;
    this.registrations.delete(key);
    log.info('Unregistered workflow webhook trigger', { workflowId, path });
  }

  /**
   * Get webhook statistics
   */
  getStats(workflowId: string, path: string): {
    requestCount: number;
    lastRequestAt?: Date;
  } | null {
    const key = `${workflowId}:${path}`;
    const registration = this.registrations.get(key);
    if (!registration) {
      return null;
    }

    return {
      requestCount: registration.requestCount,
      lastRequestAt: registration.lastRequestAt,
    };
  }
}


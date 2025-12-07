/**
 * B236B-WF-000: Workflow Types and Models
 *
 * Shared types for workflow system including triggers, actions, and execution context.
 */

import { z } from 'zod';

/**
 * Workflow execution status
 */
export enum WorkflowExecutionStatus {
  PENDING = 'pending',
  RUNNING = 'running',
  COMPLETED = 'completed',
  FAILED = 'failed',
  CANCELLED = 'cancelled',
}

/**
 * Trigger types
 */
export enum TriggerType {
  EVENT = 'event',
  CRON = 'cron',
  WEBHOOK = 'webhook',
  MANUAL = 'manual',
}

/**
 * Action types
 */
export enum ActionType {
  EXTERNAL_API = 'external_api',
  NOTIFICATION = 'notification',
  DATA_TRANSFORM = 'data_transform',
  CONDITION = 'condition',
  DELAY = 'delay',
}

/**
 * Retry policy types
 */
export enum RetryPolicyType {
  FIXED_INTERVAL = 'fixed_interval',
  EXPONENTIAL_BACKOFF = 'exponential_backoff',
  MAX_ATTEMPTS = 'max_attempts',
}

/**
 * Event trigger configuration
 */
export const EventTriggerConfigSchema = z.object({
  type: z.literal(TriggerType.EVENT),
  eventType: z.string(),
  filters: z.record(z.any()).optional(),
  payloadMatch: z.record(z.any()).optional(),
});

export type EventTriggerConfig = z.infer<typeof EventTriggerConfigSchema>;

/**
 * Cron trigger configuration
 */
export const CronTriggerConfigSchema = z.object({
  type: z.literal(TriggerType.CRON),
  expression: z.string(), // cron expression
  timezone: z.string().optional(),
});

export type CronTriggerConfig = z.infer<typeof CronTriggerConfigSchema>;

/**
 * Webhook trigger configuration
 */
export const WebhookTriggerConfigSchema = z.object({
  type: z.literal(TriggerType.WEBHOOK),
  path: z.string(),
  method: z.enum(['GET', 'POST', 'PUT', 'DELETE']).default('POST'),
  secret: z.string().optional(),
  signatureHeader: z.string().optional(),
});

export type WebhookTriggerConfig = z.infer<typeof WebhookTriggerConfigSchema>;

/**
 * Trigger configuration union
 */
export const TriggerConfigSchema = z.discriminatedUnion('type', [
  EventTriggerConfigSchema,
  CronTriggerConfigSchema,
  WebhookTriggerConfigSchema,
]);

export type TriggerConfig = z.infer<typeof TriggerConfigSchema>;

/**
 * External API action configuration
 */
export const ExternalAPIActionConfigSchema = z.object({
  type: z.literal(ActionType.EXTERNAL_API),
  method: z.enum(['GET', 'POST', 'PUT', 'DELETE', 'PATCH']),
  url: z.string().url(),
  headers: z.record(z.string()).optional(),
  bodyTemplate: z.string().optional(), // template string
  responsePath: z.string().optional(), // JSONPath to extract from response
  storeInContext: z.string().optional(), // key to store result in context
});

export type ExternalAPIActionConfig = z.infer<typeof ExternalAPIActionConfigSchema>;

/**
 * Notification action configuration
 */
export const NotificationActionConfigSchema = z.object({
  type: z.literal(ActionType.NOTIFICATION),
  channel: z.enum(['email', 'sms', 'in_app']),
  template: z.string(),
  recipients: z.array(z.string()), // user IDs or email addresses
  personalization: z.record(z.string()).optional(), // template variables
  locale: z.string().optional(),
});

export type NotificationActionConfig = z.infer<typeof NotificationActionConfigSchema>;

/**
 * Data transform action configuration
 */
export const DataTransformActionConfigSchema = z.object({
  type: z.literal(ActionType.DATA_TRANSFORM),
  template: z.string(), // mustache/handlebars template
  source: z.record(z.any()), // source data mapping
  target: z.string(), // key to store transformed data in context
  merge: z.boolean().default(false), // merge with existing context
});

export type DataTransformActionConfig = z.infer<typeof DataTransformActionConfigSchema>;

/**
 * Action configuration union
 */
export const ActionConfigSchema = z.discriminatedUnion('type', [
  ExternalAPIActionConfigSchema,
  NotificationActionConfigSchema,
  DataTransformActionConfigSchema,
]);

export type ActionConfig = z.infer<typeof ActionConfigSchema>;

/**
 * Retry policy configuration
 */
export const RetryPolicySchema = z.object({
  type: z.nativeEnum(RetryPolicyType),
  maxAttempts: z.number().min(1).default(3),
  interval: z.number().optional(), // milliseconds for fixed interval
  backoffMultiplier: z.number().optional().default(2), // for exponential backoff
  maxInterval: z.number().optional(), // max interval for exponential backoff
  onFailure: z.enum(['abort', 'error_step']).default('abort'),
});

export type RetryPolicy = z.infer<typeof RetryPolicySchema>;

/**
 * Workflow step definition
 */
export const WorkflowStepSchema = z.object({
  id: z.string(),
  name: z.string(),
  action: ActionConfigSchema,
  retryPolicy: RetryPolicySchema.optional(),
  condition: z.string().optional(), // expression to evaluate
  onError: z.enum(['continue', 'abort', 'goto']).default('abort'),
  gotoStep: z.string().optional(), // step ID to goto on error
});

export type WorkflowStep = z.infer<typeof WorkflowStepSchema>;

/**
 * Workflow definition
 */
export const WorkflowDefinitionSchema = z.object({
  id: z.string().optional(),
  name: z.string(),
  description: z.string().optional(),
  trigger: TriggerConfigSchema,
  steps: z.array(WorkflowStepSchema),
  enabled: z.boolean().default(true),
  metadata: z.record(z.any()).optional(),
});

export type WorkflowDefinition = z.infer<typeof WorkflowDefinitionSchema>;

/**
 * Workflow execution context
 */
export type WorkflowExecutionContext = {
  workflowId: string;
  executionId: string;
  triggerData: any;
  variables: Record<string, any>;
  stepResults: Record<string, any>;
  startedAt: Date;
  userId?: string;
  orgId?: string;
};

/**
 * Workflow execution result
 */
export type WorkflowExecutionResult = {
  executionId: string;
  workflowId: string;
  status: WorkflowExecutionStatus;
  startedAt: Date;
  completedAt?: Date;
  duration?: number;
  stepResults: Array<{
    stepId: string;
    status: WorkflowExecutionStatus;
    result?: any;
    error?: string;
    duration?: number;
    attempts?: number;
  }>;
  error?: string;
};


/**
 * Workflow Types
 *
 * Shared types for workflow components
 */

export type TriggerConfig =
  | { type: 'event'; eventType: string; filters?: Record<string, any>; payloadMatch?: Record<string, any> }
  | { type: 'cron'; expression: string; timezone?: string }
  | { type: 'webhook'; path: string; method: 'GET' | 'POST' | 'PUT' | 'DELETE'; secret?: string; signatureHeader?: string };

export type ActionConfig =
  | { type: 'external_api'; method: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH'; url: string; headers?: Record<string, string>; bodyTemplate?: string; responsePath?: string; storeInContext?: string }
  | { type: 'notification'; channel: 'email' | 'sms' | 'in_app'; template: string; recipients: string[]; personalization?: Record<string, string>; locale?: string }
  | { type: 'data_transform'; template: string; source: Record<string, any>; target: string; merge?: boolean };

export type WorkflowStep = {
  id: string;
  name: string;
  action: ActionConfig;
  retryPolicy?: {
    type: 'fixed_interval' | 'exponential_backoff' | 'max_attempts';
    maxAttempts: number;
    interval?: number;
    backoffMultiplier?: number;
    maxInterval?: number;
    onFailure: 'abort' | 'error_step';
  };
  condition?: string;
  onError: 'continue' | 'abort' | 'goto';
  gotoStep?: string;
};

export type WorkflowDefinition = {
  id?: string;
  name: string;
  description?: string;
  trigger: TriggerConfig;
  steps: WorkflowStep[];
  enabled: boolean;
  metadata?: Record<string, any>;
};

export type WorkflowExecution = {
  executionId: string;
  workflowId: string;
  status: 'pending' | 'running' | 'completed' | 'failed' | 'cancelled';
  startedAt: Date;
  completedAt?: Date;
  duration?: number;
  stepResults: Array<{
    stepId: string;
    status: 'pending' | 'running' | 'completed' | 'failed' | 'cancelled';
    result?: any;
    error?: string;
    duration?: number;
    attempts?: number;
  }>;
  error?: string;
  trigger?: string;
};


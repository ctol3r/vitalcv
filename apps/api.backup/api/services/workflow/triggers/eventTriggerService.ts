/**
 * B236B-WF-011: EventTriggerService
 *
 * Listens to events from modules (e.g., new credential issued, contract signed)
 * and triggers workflows. Supports filters by event type and payload.
 * Uses message bus integration.
 */

import { EventEmitter } from 'events';
import { getServiceLogger } from '../../logging/serviceLogger';
import {
  EventTriggerConfig,
  WorkflowDefinition,
  WorkflowExecutionContext,
} from '../models/types.js';

const log = getServiceLogger('workflow/triggers/event');

/**
 * EventTriggerService handles event-based workflow triggers
 */
export class EventTriggerService {
  private eventBus: EventEmitter;
  private registeredWorkflows: Map<string, { workflow: WorkflowDefinition; config: EventTriggerConfig }> = new Map();
  private workflowExecutor?: (context: WorkflowExecutionContext) => Promise<void>;

  constructor(eventBus?: EventEmitter) {
    this.eventBus = eventBus || new EventEmitter();
    this.setupEventListeners();
  }

  /**
   * Register a workflow to be triggered by events
   */
  registerWorkflow(workflow: WorkflowDefinition, config: EventTriggerConfig): void {
    if (config.type !== 'event') {
      throw new Error('EventTriggerService only accepts event trigger configs');
    }

    const key = `${workflow.id}:${config.eventType}`;
    this.registeredWorkflows.set(key, { workflow, config });

    log.info('Registered workflow for event trigger', {
      workflowId: workflow.id,
      eventType: config.eventType,
      filters: config.filters,
    });

    // Subscribe to the specific event type
    this.eventBus.on(config.eventType, (eventData: any) => {
      this.handleEvent(config.eventType, eventData, workflow, config);
    });
  }

  /**
   * Set the workflow executor function
   */
  setWorkflowExecutor(executor: (context: WorkflowExecutionContext) => Promise<void>): void {
    this.workflowExecutor = executor;
  }

  /**
   * Handle incoming event
   */
  private async handleEvent(
    eventType: string,
    eventData: any,
    workflow: WorkflowDefinition,
    config: EventTriggerConfig
  ): Promise<void> {
    try {
      // Check if workflow is enabled
      if (!workflow.enabled) {
        log.debug('Workflow disabled, skipping', { workflowId: workflow.id });
        return;
      }

      // Apply filters
      if (!this.matchesFilters(eventData, config)) {
        log.debug('Event does not match filters', {
          workflowId: workflow.id,
          eventType,
        });
        return;
      }

      // Check payload match
      if (config.payloadMatch && !this.matchesPayload(eventData, config.payloadMatch)) {
        log.debug('Event payload does not match', {
          workflowId: workflow.id,
          eventType,
        });
        return;
      }

      log.info('Triggering workflow from event', {
        workflowId: workflow.id,
        eventType,
        eventData: this.sanitizeEventData(eventData),
      });

      // Create execution context
      const executionId = `${workflow.id}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      const context: WorkflowExecutionContext = {
        workflowId: workflow.id,
        executionId,
        triggerData: eventData,
        variables: {},
        stepResults: {},
        startedAt: new Date(),
        userId: eventData.userId,
        orgId: eventData.orgId,
      };

      // Execute workflow
      if (this.workflowExecutor) {
        await this.workflowExecutor(context);
      } else {
        log.warn('No workflow executor set, workflow not executed', {
          workflowId: workflow.id,
        });
      }
    } catch (error) {
      log.error('Error handling event trigger', {
        workflowId: workflow.id,
        eventType,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  /**
   * Check if event data matches filters
   */
  private matchesFilters(eventData: any, config: EventTriggerConfig): boolean {
    if (!config.filters) {
      return true;
    }

    for (const [key, value] of Object.entries(config.filters)) {
      const eventValue = this.getNestedValue(eventData, key);
      if (eventValue !== value) {
        return false;
      }
    }

    return true;
  }

  /**
   * Check if event payload matches expected values
   */
  private matchesPayload(eventData: any, payloadMatch: Record<string, any>): boolean {
    for (const [path, expectedValue] of Object.entries(payloadMatch)) {
      const actualValue = this.getNestedValue(eventData, path);
      if (actualValue !== expectedValue) {
        return false;
      }
    }
    return true;
  }

  /**
   * Get nested value from object using dot notation
   */
  private getNestedValue(obj: any, path: string): any {
    return path.split('.').reduce((current, key) => current?.[key], obj);
  }

  /**
   * Sanitize event data for logging (remove sensitive fields)
   */
  private sanitizeEventData(eventData: any): any {
    const sanitized = { ...eventData };
    const sensitiveFields = ['password', 'token', 'secret', 'apiKey', 'authorization'];
    for (const field of sensitiveFields) {
      if (sanitized[field]) {
        sanitized[field] = '[REDACTED]';
      }
    }
    return sanitized;
  }

  /**
   * Setup event listeners
   */
  private setupEventListeners(): void {
    // Listen for all events and route to registered workflows
    this.eventBus.on('*', (eventType: string, eventData: any) => {
      // This is handled by individual event subscriptions in registerWorkflow
    });
  }

  /**
   * Unregister a workflow
   */
  unregisterWorkflow(workflowId: string, eventType: string): void {
    const key = `${workflowId}:${eventType}`;
    this.registeredWorkflows.delete(key);
    this.eventBus.removeAllListeners(eventType);
    log.info('Unregistered workflow event trigger', { workflowId, eventType });
  }

  /**
   * Get all registered workflows for an event type
   */
  getWorkflowsForEvent(eventType: string): Array<{ workflow: WorkflowDefinition; config: EventTriggerConfig }> {
    return Array.from(this.registeredWorkflows.values()).filter(
      ({ config }) => config.eventType === eventType
    );
  }
}


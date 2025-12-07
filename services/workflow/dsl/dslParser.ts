/**
 * B236B-WF-020: WorkflowDSLParser
 *
 * Implements a DSL parser that converts user-friendly workflow definitions into internal JSON.
 * Supports actions, triggers, conditions.
 * Includes grammar definitions and parser tests.
 */

import { getServiceLogger } from '../../logging/serviceLogger';
import {
  WorkflowDefinition,
  TriggerConfig,
  ActionConfig,
  WorkflowStep,
  TriggerType,
  ActionType,
  RetryPolicy,
  RetryPolicyType,
} from '../models/types.js';

const log = getServiceLogger('workflow/dsl/parser');

/**
 * DSL Grammar:
 *
 * workflow <id> "<name>" {
 *   description: "<description>"
 *   trigger: <trigger-definition>
 *   steps: [
 *     <step-definition>
 *   ]
 * }
 *
 * Trigger definitions:
 *   event <event-type> [filters: { ... }]
 *   cron "<expression>" [timezone: "<tz>"]
 *   webhook "<path>" [method: GET|POST|PUT|DELETE] [secret: "<secret>"]
 *
 * Step definitions:
 *   step <id> "<name>" {
 *     action: <action-definition>
 *     retry: <retry-policy>
 *     condition: "<expression>"
 *     onError: abort|continue|goto <step-id>
 *   }
 *
 * Action definitions:
 *   api <method> "<url>" [headers: { ... }] [body: "<template>"] [store: "<key>"]
 *   notify <channel> "<template>" to [<recipients>] [locale: "<locale>"]
 *   transform "<template>" from { ... } to "<key>" [merge: true|false]
 */

/**
 * WorkflowDSLParser converts DSL to workflow definitions
 */
export class WorkflowDSLParser {
  /**
   * Parse DSL string into WorkflowDefinition
   */
  parse(dsl: string): WorkflowDefinition {
    try {
      log.debug('Parsing workflow DSL', { dslLength: dsl.length });

      // Remove comments
      const cleaned = this.removeComments(dsl);

      // Parse workflow definition
      const workflow = this.parseWorkflow(cleaned);

      log.info('Successfully parsed workflow DSL', {
        workflowId: workflow.id,
        stepCount: workflow.steps.length,
      });

      return workflow;
    } catch (error) {
      log.error('Error parsing workflow DSL', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw new Error(
        `DSL parsing failed: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * Remove comments from DSL
   */
  private removeComments(dsl: string): string {
    // Remove single-line comments (// ...)
    let cleaned = dsl.replace(/\/\/.*$/gm, '');

    // Remove multi-line comments (/* ... */)
    cleaned = cleaned.replace(/\/\*[\s\S]*?\*\//g, '');

    return cleaned.trim();
  }

  /**
   * Parse workflow definition
   */
  private parseWorkflow(dsl: string): WorkflowDefinition {
    // Extract workflow ID and name
    const workflowMatch = dsl.match(/workflow\s+(\w+)\s+"([^"]+)"/);
    if (!workflowMatch) {
      throw new Error('Invalid workflow definition: missing id or name');
    }

    const id = workflowMatch[1];
    const name = workflowMatch[2];

    // Extract description
    const descriptionMatch = dsl.match(/description:\s*"([^"]*)"/);
    const description = descriptionMatch ? descriptionMatch[1] : undefined;

    // Extract trigger
    const trigger = this.parseTrigger(dsl);

    // Extract steps
    const steps = this.parseSteps(dsl);

    return {
      id,
      name,
      description,
      trigger,
      steps,
      enabled: true,
    };
  }

  /**
   * Parse trigger definition
   */
  private parseTrigger(dsl: string): TriggerConfig {
    // Event trigger
    const eventMatch = dsl.match(/trigger:\s*event\s+(\w+)/);
    if (eventMatch) {
      const eventType = eventMatch[1];
      const filtersMatch = dsl.match(/filters:\s*\{([^}]+)\}/);
      const filters = filtersMatch ? this.parseObject(filtersMatch[1]) : undefined;
      const payloadMatch = dsl.match(/payloadMatch:\s*\{([^}]+)\}/);
      const payloadMatchObj = payloadMatch ? this.parseObject(payloadMatch[1]) : undefined;

      return {
        type: TriggerType.EVENT,
        eventType,
        filters,
        payloadMatch: payloadMatchObj,
      };
    }

    // Cron trigger
    const cronMatch = dsl.match(/trigger:\s*cron\s+"([^"]+)"/);
    if (cronMatch) {
      const expression = cronMatch[1];
      const timezoneMatch = dsl.match(/timezone:\s*"([^"]+)"/);
      const timezone = timezoneMatch ? timezoneMatch[1] : undefined;

      return {
        type: TriggerType.CRON,
        expression,
        timezone,
      };
    }

    // Webhook trigger
    const webhookMatch = dsl.match(/trigger:\s*webhook\s+"([^"]+)"/);
    if (webhookMatch) {
      const path = webhookMatch[1];
      const methodMatch = dsl.match(/method:\s*(GET|POST|PUT|DELETE)/);
      const method = (methodMatch ? methodMatch[1] : 'POST') as 'GET' | 'POST' | 'PUT' | 'DELETE';
      const secretMatch = dsl.match(/secret:\s*"([^"]+)"/);
      const secret = secretMatch ? secretMatch[1] : undefined;
      const signatureHeaderMatch = dsl.match(/signatureHeader:\s*"([^"]+)"/);
      const signatureHeader = signatureHeaderMatch ? signatureHeaderMatch[1] : undefined;

      return {
        type: TriggerType.WEBHOOK,
        path,
        method,
        secret,
        signatureHeader,
      };
    }

    throw new Error('Invalid trigger definition');
  }

  /**
   * Parse steps array
   */
  private parseSteps(dsl: string): WorkflowStep[] {
    const stepsMatch = dsl.match(/steps:\s*\[([\s\S]*)\]/);
    if (!stepsMatch) {
      return [];
    }

    const stepsContent = stepsMatch[1];
    const steps: WorkflowStep[] = [];

    // Split steps by "step" keyword
    const stepMatches = stepsContent.matchAll(/step\s+(\w+)\s+"([^"]+)"\s*\{([^}]+)\}/g);

    for (const stepMatch of stepMatches) {
      const stepId = stepMatch[1];
      const stepName = stepMatch[2];
      const stepContent = stepMatch[3];

      // Parse action
      const action = this.parseAction(stepContent);

      // Parse retry policy
      const retryPolicy = this.parseRetryPolicy(stepContent);

      // Parse condition
      const conditionMatch = stepContent.match(/condition:\s*"([^"]+)"/);
      const condition = conditionMatch ? conditionMatch[1] : undefined;

      // Parse onError
      const onErrorMatch = stepContent.match(/onError:\s*(abort|continue|goto)/);
      const onError = (onErrorMatch ? onErrorMatch[1] : 'abort') as 'abort' | 'continue' | 'goto';

      // Parse gotoStep
      const gotoMatch = stepContent.match(/goto\s+(\w+)/);
      const gotoStep = gotoMatch ? gotoMatch[1] : undefined;

      steps.push({
        id: stepId,
        name: stepName,
        action,
        retryPolicy,
        condition,
        onError,
        gotoStep,
      });
    }

    return steps;
  }

  /**
   * Parse action definition
   */
  private parseAction(content: string): ActionConfig {
    // External API action
    const apiMatch = content.match(/action:\s*api\s+(GET|POST|PUT|DELETE|PATCH)\s+"([^"]+)"/);
    if (apiMatch) {
      const method = apiMatch[1] as 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';
      const url = apiMatch[2];

      const headersMatch = content.match(/headers:\s*\{([^}]+)\}/);
      const headers = headersMatch ? this.parseObject(headersMatch[1]) : undefined;

      const bodyMatch = content.match(/body:\s*"([^"]+)"/);
      const bodyTemplate = bodyMatch ? bodyMatch[1] : undefined;

      const storeMatch = content.match(/store:\s*"([^"]+)"/);
      const storeInContext = storeMatch ? storeMatch[1] : undefined;

      const responsePathMatch = content.match(/responsePath:\s*"([^"]+)"/);
      const responsePath = responsePathMatch ? responsePathMatch[1] : undefined;

      return {
        type: ActionType.EXTERNAL_API,
        method,
        url,
        headers,
        bodyTemplate,
        storeInContext,
        responsePath,
      };
    }

    // Notification action
    const notifyMatch = content.match(/action:\s*notify\s+(email|sms|in_app)\s+"([^"]+)"\s+to\s+\[([^\]]+)\]/);
    if (notifyMatch) {
      const channel = notifyMatch[1] as 'email' | 'sms' | 'in_app';
      const template = notifyMatch[2];
      const recipientsStr = notifyMatch[3];
      const recipients = recipientsStr.split(',').map((r) => r.trim().replace(/"/g, ''));

      const localeMatch = content.match(/locale:\s*"([^"]+)"/);
      const locale = localeMatch ? localeMatch[1] : undefined;

      const personalizationMatch = content.match(/personalization:\s*\{([^}]+)\}/);
      const personalization = personalizationMatch
        ? this.parseObject(personalizationMatch[1])
        : undefined;

      return {
        type: ActionType.NOTIFICATION,
        channel,
        template,
        recipients,
        locale,
        personalization,
      };
    }

    // Data transform action
    const transformMatch = content.match(/action:\s*transform\s+"([^"]+)"\s+from\s+{([^}]+)}\s+to\s+"([^"]+)"/);
    if (transformMatch) {
      const template = transformMatch[1];
      const sourceStr = transformMatch[2];
      const source = this.parseObject(sourceStr);
      const target = transformMatch[3];

      const mergeMatch = content.match(/merge:\s*(true|false)/);
      const merge = mergeMatch ? mergeMatch[1] === 'true' : false;

      return {
        type: ActionType.DATA_TRANSFORM,
        template,
        source,
        target,
        merge,
      };
    }

    throw new Error('Invalid action definition');
  }

  /**
   * Parse retry policy
   */
  private parseRetryPolicy(content: string): RetryPolicy | undefined {
    const retryMatch = content.match(/retry:\s*(\w+)/);
    if (!retryMatch) {
      return undefined;
    }

    const typeStr = retryMatch[1];
    let type: RetryPolicyType;

    switch (typeStr) {
      case 'fixed':
        type = RetryPolicyType.FIXED_INTERVAL;
        break;
      case 'exponential':
        type = RetryPolicyType.EXPONENTIAL_BACKOFF;
        break;
      case 'max':
        type = RetryPolicyType.MAX_ATTEMPTS;
        break;
      default:
        return undefined;
    }

    const maxAttemptsMatch = content.match(/maxAttempts:\s*(\d+)/);
    const maxAttempts = maxAttemptsMatch ? parseInt(maxAttemptsMatch[1], 10) : 3;

    const intervalMatch = content.match(/interval:\s*(\d+)/);
    const interval = intervalMatch ? parseInt(intervalMatch[1], 10) : undefined;

    const backoffMultiplierMatch = content.match(/backoffMultiplier:\s*(\d+\.?\d*)/);
    const backoffMultiplier = backoffMultiplierMatch
      ? parseFloat(backoffMultiplierMatch[1])
      : undefined;

    const maxIntervalMatch = content.match(/maxInterval:\s*(\d+)/);
    const maxInterval = maxIntervalMatch ? parseInt(maxIntervalMatch[1], 10) : undefined;

    const onFailureMatch = content.match(/onFailure:\s*(abort|error_step)/);
    const onFailure = (onFailureMatch ? onFailureMatch[1] : 'abort') as 'abort' | 'error_step';

    return {
      type,
      maxAttempts,
      interval,
      backoffMultiplier,
      maxInterval,
      onFailure,
    };
  }

  /**
   * Parse object-like string into object
   */
  private parseObject(objStr: string): Record<string, any> {
    const obj: Record<string, any> = {};
    const pairs = objStr.split(',').map((p) => p.trim());

    for (const pair of pairs) {
      const match = pair.match(/(\w+):\s*(.+)/);
      if (match) {
        const key = match[1];
        let value: any = match[2].trim();

        // Remove quotes if present
        if (value.startsWith('"') && value.endsWith('"')) {
          value = value.slice(1, -1);
        } else if (value === 'true') {
          value = true;
        } else if (value === 'false') {
          value = false;
        } else if (!isNaN(Number(value))) {
          value = Number(value);
        }

        obj[key] = value;
      }
    }

    return obj;
  }

  /**
   * Validate DSL syntax
   */
  validate(dsl: string): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    try {
      this.parse(dsl);
    } catch (error) {
      errors.push(error instanceof Error ? error.message : 'Unknown parsing error');
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  }
}


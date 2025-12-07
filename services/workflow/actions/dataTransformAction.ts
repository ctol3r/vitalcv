/**
 * B236B-WF-016: DataTransformAction
 *
 * Provides JSON transformation and mapping logic for workflow variables.
 * Supports templating and merging using mustache or handlebars syntax.
 * Tested with various inputs.
 */

import { getServiceLogger } from '../../logging/serviceLogger';
import {
  DataTransformActionConfig,
  WorkflowExecutionContext,
} from '../models/types.js';
import Handlebars from 'handlebars';

const log = getServiceLogger('workflow/actions/data-transform');

/**
 * DataTransformAction performs data transformations
 */
export class DataTransformAction {
  /**
   * Execute data transform action
   */
  async execute(
    config: DataTransformActionConfig,
    context: WorkflowExecutionContext
  ): Promise<any> {
    try {
      log.info('Executing data transform', {
        workflowId: context.workflowId,
        executionId: context.executionId,
        target: config.target,
        merge: config.merge,
      });

      // Extract source data
      const sourceData = this.extractSourceData(config.source, context);

      // Compile template
      const template = Handlebars.compile(config.template);

      // Prepare template context
      const templateContext = {
        ...context.variables,
        source: sourceData,
        context: context.variables,
        trigger: context.triggerData,
        steps: context.stepResults,
      };

      // Execute transformation
      const transformedJson = template(templateContext);

      // Parse transformed JSON
      let transformed: any;
      try {
        transformed = JSON.parse(transformedJson);
      } catch (error) {
        // If not valid JSON, treat as string result
        transformed = transformedJson;
      }

      // Store in context
      if (config.merge && context.variables[config.target]) {
        // Merge with existing data
        const existing = context.variables[config.target];
        if (typeof existing === 'object' && typeof transformed === 'object') {
          context.variables[config.target] = {
            ...existing,
            ...transformed,
          };
        } else {
          context.variables[config.target] = transformed;
        }
      } else {
        context.variables[config.target] = transformed;
      }

      log.info('Data transform completed', {
        workflowId: context.workflowId,
        executionId: context.executionId,
        target: config.target,
        resultSize: JSON.stringify(transformed).length,
      });

      return {
        success: true,
        target: config.target,
        transformed,
      };
    } catch (error) {
      log.error('Error executing data transform', {
        workflowId: context.workflowId,
        executionId: context.executionId,
        error: error instanceof Error ? error.message : 'Unknown error',
      });

      throw new Error(
        `Data transform failed: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * Extract source data from context
   */
  private extractSourceData(
    source: Record<string, any>,
    context: WorkflowExecutionContext
  ): Record<string, any> {
    const extracted: Record<string, any> = {};

    for (const [key, path] of Object.entries(source)) {
      if (typeof path === 'string') {
        // Path reference (e.g., "variables.userId" or "triggerData.eventType")
        extracted[key] = this.getNestedValue(context, path);
      } else {
        // Direct value
        extracted[key] = path;
      }
    }

    return extracted;
  }

  /**
   * Get nested value from object using dot notation
   */
  private getNestedValue(obj: any, path: string): any {
    if (!path) {
      return obj;
    }

    const parts = path.split('.');
    let current = obj;

    for (const part of parts) {
      if (current === null || current === undefined) {
        return undefined;
      }

      // Support array indexing [0], [1], etc.
      const arrayMatch = part.match(/^(.+)\[(\d+)\]$/);
      if (arrayMatch) {
        const key = arrayMatch[1];
        const index = parseInt(arrayMatch[2], 10);
        current = current[key];
        if (Array.isArray(current)) {
          current = current[index];
        } else {
          return undefined;
        }
      } else {
        current = current[part];
      }
    }

    return current;
  }
}


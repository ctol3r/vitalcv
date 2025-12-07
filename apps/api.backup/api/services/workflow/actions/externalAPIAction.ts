/**
 * B236B-WF-014: ExternalAPIActionConnector
 *
 * Allows workflows to call external APIs via configurable method, URL, headers, body templates.
 * Supports response parsing and storing results in context.
 */

import axios, { AxiosRequestConfig, AxiosResponse } from 'axios';
import { getServiceLogger } from '../../logging/serviceLogger';
import {
  ExternalAPIActionConfig,
  WorkflowExecutionContext,
} from '../models/types.js';
import Handlebars from 'handlebars';

const log = getServiceLogger('workflow/actions/external-api');

/**
 * ExternalAPIActionConnector executes external API calls
 */
export class ExternalAPIActionConnector {
  /**
   * Execute external API action
   */
  async execute(
    config: ExternalAPIActionConfig,
    context: WorkflowExecutionContext
  ): Promise<any> {
    try {
      // Compile body template if provided
      let body: any = undefined;
      if (config.bodyTemplate) {
        const template = Handlebars.compile(config.bodyTemplate);
        body = JSON.parse(template(context.variables));
      }

      // Prepare headers
      const headers: Record<string, string> = {};
      if (config.headers) {
        for (const [key, value] of Object.entries(config.headers)) {
          // Support template variables in headers
          const template = Handlebars.compile(value);
          headers[key] = template(context.variables);
        }
      }

      // Prepare request config
      const requestConfig: AxiosRequestConfig = {
        method: config.method,
        url: this.resolveUrl(config.url, context),
        headers,
        data: body,
        timeout: 30000, // 30 second timeout
        validateStatus: (status) => status < 500, // Don't throw on 4xx
      };

      log.info('Executing external API call', {
        workflowId: context.workflowId,
        executionId: context.executionId,
        method: config.method,
        url: requestConfig.url,
      });

      // Execute request
      const response: AxiosResponse = await axios(requestConfig);

      // Extract response data
      let result = response.data;

      // Parse response path if specified (JSONPath-like)
      if (config.responsePath) {
        result = this.extractFromPath(response.data, config.responsePath);
      }

      // Store in context if specified
      if (config.storeInContext) {
        context.variables[config.storeInContext] = result;
      }

      log.info('External API call completed', {
        workflowId: context.workflowId,
        executionId: context.executionId,
        status: response.status,
        responseSize: JSON.stringify(result).length,
      });

      return {
        success: response.status >= 200 && response.status < 300,
        status: response.status,
        data: result,
        headers: response.headers,
      };
    } catch (error) {
      log.error('Error executing external API call', {
        workflowId: context.workflowId,
        executionId: context.executionId,
        url: config.url,
        error: error instanceof Error ? error.message : 'Unknown error',
      });

      throw new Error(
        `External API call failed: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * Resolve URL with template variables
   */
  private resolveUrl(url: string, context: WorkflowExecutionContext): string {
    const template = Handlebars.compile(url);
    return template(context.variables);
  }

  /**
   * Extract value from object using dot notation path
   */
  private extractFromPath(obj: any, path: string): any {
    if (!path || path === '.') {
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


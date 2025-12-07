/**
 * B236B-WF-018: RetryPolicyHandler
 *
 * Supports retry policies for steps (fixed interval, exponential backoff, max attempts).
 * Logs attempts, aborts or moves to error step upon failure.
 */

import { getServiceLogger } from '../../logging/serviceLogger';
import {
  RetryPolicy,
  RetryPolicyType,
  WorkflowExecutionContext,
} from '../models/types.js';

const log = getServiceLogger('workflow/engine/retry');

/**
 * Retry attempt result
 */
export interface RetryAttemptResult {
  success: boolean;
  attempt: number;
  error?: string;
  duration: number;
}

/**
 * RetryPolicyHandler manages retry logic for workflow steps
 */
export class RetryPolicyHandler {
  /**
   * Execute a function with retry policy
   */
  async executeWithRetry<T>(
    fn: () => Promise<T>,
    policy: RetryPolicy,
    context: WorkflowExecutionContext,
    stepId: string
  ): Promise<T> {
    let lastError: Error | undefined;
    const startTime = Date.now();

    for (let attempt = 1; attempt <= policy.maxAttempts; attempt++) {
      try {
        log.info('Executing step with retry', {
          workflowId: context.workflowId,
          executionId: context.executionId,
          stepId,
          attempt,
          maxAttempts: policy.maxAttempts,
          policyType: policy.type,
        });

        const result = await fn();
        const duration = Date.now() - startTime;

        log.info('Step executed successfully', {
          workflowId: context.workflowId,
          executionId: context.executionId,
          stepId,
          attempt,
          duration,
        });

        return result;
      } catch (error) {
        lastError = error instanceof Error ? error : new Error('Unknown error');
        const duration = Date.now() - startTime;

        log.warn('Step execution failed', {
          workflowId: context.workflowId,
          executionId: context.executionId,
          stepId,
          attempt,
          maxAttempts: policy.maxAttempts,
          error: lastError.message,
          duration,
        });

        // Check if we should retry
        if (attempt >= policy.maxAttempts) {
          log.error('Step failed after all retry attempts', {
            workflowId: context.workflowId,
            executionId: context.executionId,
            stepId,
            totalAttempts: attempt,
            finalError: lastError.message,
          });

          // Handle failure based on policy
          if (policy.onFailure === 'error_step') {
            // Store error in context for error step handling
            context.variables[`${stepId}_error`] = {
              error: lastError.message,
              attempts: attempt,
              duration,
            };
          }

          throw lastError;
        }

        // Calculate delay before retry
        const delay = this.calculateDelay(attempt, policy);
        log.info('Waiting before retry', {
          workflowId: context.workflowId,
          executionId: context.executionId,
          stepId,
          attempt,
          nextAttempt: attempt + 1,
          delayMs: delay,
        });

        await this.sleep(delay);
      }
    }

    // Should never reach here, but satisfy TypeScript
    throw lastError || new Error('Retry execution failed');
  }

  /**
   * Calculate delay before next retry attempt
   */
  private calculateDelay(attempt: number, policy: RetryPolicy): number {
    switch (policy.type) {
      case RetryPolicyType.FIXED_INTERVAL:
        return policy.interval || 1000; // Default 1 second

      case RetryPolicyType.EXPONENTIAL_BACKOFF:
        const baseInterval = policy.interval || 1000;
        const multiplier = policy.backoffMultiplier || 2;
        const delay = baseInterval * Math.pow(multiplier, attempt - 1);
        const maxInterval = policy.maxInterval || 60000; // Default 60 seconds
        return Math.min(delay, maxInterval);

      case RetryPolicyType.MAX_ATTEMPTS:
        // No delay, just retry immediately (up to max attempts)
        return 0;

      default:
        return 1000; // Default 1 second
    }
  }

  /**
   * Sleep for specified milliseconds
   */
  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /**
   * Check if retry should be attempted based on error type
   */
  shouldRetry(error: Error, policy: RetryPolicy): boolean {
    // In a real implementation, you might want to check error types
    // For example, don't retry on 4xx HTTP errors, but retry on 5xx
    // For now, we retry on all errors up to max attempts
    return true;
  }
}


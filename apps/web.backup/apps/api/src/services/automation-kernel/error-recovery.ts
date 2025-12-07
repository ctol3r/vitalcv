import { prisma } from '@/lib/prisma';

export interface RecoveryAction {
  action: 'retry' | 'fallback' | 'manual_review' | 'skip';
  reason: string;
  maxRetries?: number;
  retryDelay?: number; // seconds
}

/**
 * Automation error recovery with retry + fallback behavior
 */
export async function recoverFromError(
  taskId: string,
  error: Error,
  attemptCount: number,
): Promise<RecoveryAction> {
  const maxRetries = 3;
  const retryDelay = Math.min(60, attemptCount * 10); // Exponential backoff, max 60s

  // Retry for transient errors
  if (isTransientError(error) && attemptCount < maxRetries) {
    return {
      action: 'retry',
      reason: 'Transient error detected',
      maxRetries,
      retryDelay,
    };
  }

  // Fallback for API failures
  if (error.message.includes('API') || error.message.includes('network')) {
    return {
      action: 'fallback',
      reason: 'API failure - using fallback method',
    };
  }

  // Manual review for critical errors
  if (error.message.includes('validation') || error.message.includes('invalid')) {
    return {
      action: 'manual_review',
      reason: 'Validation error requires manual review',
    };
  }

  // Skip for non-critical errors
  return {
    action: 'skip',
    reason: 'Non-critical error - skipping task',
  };
}

function isTransientError(error: Error): boolean {
  const transientPatterns = ['timeout', 'network', 'temporary', 'rate limit', '503', '502', '504'];
  return transientPatterns.some((pattern) => error.message.toLowerCase().includes(pattern));
}

/**
 * Log automation action for compliance
 */
export async function logAutomationAction(
  taskType: string,
  clinicianId: string,
  action: string,
  result: 'success' | 'failure' | 'skipped',
  metadata?: Record<string, unknown>,
): Promise<void> {
  await prisma.automationKernel.create({
    data: {
      tasks: {
        type: taskType,
        clinicianId,
        action,
        result,
        metadata: metadata ?? {},
        timestamp: new Date().toISOString(),
      },
      status: result === 'success' ? 'completed' : 'failed',
    },
  });
}


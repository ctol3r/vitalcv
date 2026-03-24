import { parseRetryAfterMs } from './quotaManager';

export interface ConnectorRetryPolicy {
  maxRetries: number;
  baseDelayMs: number;
  maxDelayMs: number;
  jitterRatio: number;
  maxCumulativeDelayMs: number;
}

export type RetryDelayReason = 'retry-after' | 'backoff';

export interface RetryDelayComputation {
  delayMs: number;
  reason: RetryDelayReason;
  retryAfterMs: number | null;
}

export interface RetryAttemptContext {
  connector: string;
  attempt: number;
  delayMs: number;
  error: Error;
  reason: RetryDelayReason;
  retryAfterMs: number | null;
  totalDelayMs: number;
}

export interface ExecuteWithRetryOptions<T> {
  connector: string;
  operation: (attempt: number) => Promise<T>;
  policy?: Partial<ConnectorRetryPolicy>;
  shouldRetry?: (error: unknown, attempt: number) => boolean;
  onRetry?: (context: RetryAttemptContext) => void | Promise<void>;
  sleep?: (ms: number) => Promise<void>;
  random?: () => number;
}

export interface ExecuteWithRetryResult<T> {
  result: T;
  attempts: number;
  totalDelayMs: number;
}

const DEFAULT_POLICY: ConnectorRetryPolicy = {
  maxRetries: 3,
  baseDelayMs: 250,
  maxDelayMs: 5_000,
  jitterRatio: 0.2,
  maxCumulativeDelayMs: 20_000,
};

function defaultSleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function toError(error: unknown): Error {
  return error instanceof Error ? error : new Error(String(error));
}

function inferRetryAfterMs(error: unknown): number | null {
  if (!error || typeof error !== 'object') {
    return null;
  }

  const value = error as {
    retryAfterMs?: number | null;
    retryAfter?: string;
    headers?: Record<string, string | string[] | undefined>;
  };

  if (typeof value.retryAfterMs === 'number' && Number.isFinite(value.retryAfterMs)) {
    return value.retryAfterMs;
  }

  if (typeof value.retryAfter === 'string') {
    return parseRetryAfterMs(value.retryAfter);
  }

  const header =
    value.headers?.['retry-after']
    ?? value.headers?.['Retry-After']
    ?? value.headers?.['retry_after'];

  if (typeof header === 'string') {
    return parseRetryAfterMs(header);
  }

  if (Array.isArray(header) && typeof header[0] === 'string') {
    return parseRetryAfterMs(header[0]);
  }

  return null;
}

function applyJitter(delayMs: number, jitterRatio: number, random: () => number): number {
  if (jitterRatio <= 0) {
    return delayMs;
  }

  const spread = delayMs * Math.min(Math.max(jitterRatio, 0), 1);
  const offset = (random() * 2 - 1) * spread;
  return Math.max(0, Math.round(delayMs + offset));
}

export class ConnectorRetryableError extends Error {
  readonly retryAfterMs: number | null;
  readonly statusCode?: number;

  constructor(message: string, options: { retryAfterMs?: number | null; statusCode?: number } = {}) {
    super(message);
    this.name = 'ConnectorRetryableError';
    this.retryAfterMs = options.retryAfterMs ?? null;
    this.statusCode = options.statusCode;
  }
}

export class ConnectorRateLimitError extends ConnectorRetryableError {
  constructor(message: string, retryAfterMs?: number | null) {
    super(message, {
      retryAfterMs: retryAfterMs ?? null,
      statusCode: 429,
    });
    this.name = 'ConnectorRateLimitError';
  }
}

export function computeRetryDelay(
  attempt: number,
  policy: ConnectorRetryPolicy,
  retryAfterMs?: number | null,
  random: () => number = Math.random,
): RetryDelayComputation {
  if (typeof retryAfterMs === 'number' && Number.isFinite(retryAfterMs) && retryAfterMs >= 0) {
    return {
      delayMs: Math.max(0, Math.round(retryAfterMs)),
      reason: 'retry-after',
      retryAfterMs,
    };
  }

  const exponent = Math.max(0, attempt - 1);
  const computed = Math.min(policy.maxDelayMs, policy.baseDelayMs * 2 ** exponent);

  return {
    delayMs: applyJitter(computed, policy.jitterRatio, random),
    reason: 'backoff',
    retryAfterMs: null,
  };
}

export function computeRetryDelayMs(
  attempt: number,
  policy: ConnectorRetryPolicy,
  retryAfterMs?: number | null,
  random?: () => number,
): number {
  return computeRetryDelay(attempt, policy, retryAfterMs, random).delayMs;
}

export function isRetryableConnectorError(error: unknown): boolean {
  if (error instanceof ConnectorRetryableError) {
    return true;
  }

  if (!error || typeof error !== 'object') {
    return false;
  }

  const candidate = error as {
    name?: string;
    code?: string;
    status?: number;
    statusCode?: number;
    message?: string;
  };

  const statusCode = candidate.statusCode ?? candidate.status;
  if (
    typeof statusCode === 'number'
    && (statusCode === 408 || statusCode === 409 || statusCode === 425 || statusCode === 429 || statusCode >= 500)
  ) {
    return true;
  }

  if (
    typeof candidate.code === 'string'
    && ['ECONNRESET', 'ECONNREFUSED', 'ETIMEDOUT', 'EAI_AGAIN'].includes(candidate.code)
  ) {
    return true;
  }

  const message = candidate.message?.toLowerCase() ?? '';
  return ['timeout', 'temporarily unavailable', 'rate limit', 'too many requests', 'connection reset']
    .some((token) => message.includes(token));
}

export async function executeWithRetry<T>(options: ExecuteWithRetryOptions<T>): Promise<ExecuteWithRetryResult<T>> {
  const policy: ConnectorRetryPolicy = {
    ...DEFAULT_POLICY,
    ...(options.policy ?? {}),
  };

  const shouldRetry = options.shouldRetry ?? isRetryableConnectorError;
  const sleep = options.sleep ?? defaultSleep;
  const random = options.random ?? Math.random;

  let attempts = 0;
  let totalDelayMs = 0;

  while (attempts <= policy.maxRetries) {
    attempts += 1;

    try {
      const result = await options.operation(attempts);
      return {
        result,
        attempts,
        totalDelayMs,
      };
    } catch (error) {
      const normalizedError = toError(error);

      if (attempts > policy.maxRetries || !shouldRetry(error, attempts)) {
        throw normalizedError;
      }

      const delay = computeRetryDelay(attempts, policy, inferRetryAfterMs(error), random);
      if (totalDelayMs + delay.delayMs > policy.maxCumulativeDelayMs) {
        throw normalizedError;
      }

      totalDelayMs += delay.delayMs;

      if (options.onRetry) {
        await options.onRetry({
          connector: options.connector,
          attempt: attempts,
          delayMs: delay.delayMs,
          error: normalizedError,
          reason: delay.reason,
          retryAfterMs: delay.retryAfterMs,
          totalDelayMs,
        });
      }

      await sleep(delay.delayMs);
    }
  }

  throw new Error(`${options.connector} retry loop exhausted`);
}

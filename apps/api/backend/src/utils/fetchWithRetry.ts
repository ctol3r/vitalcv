/**
 * fetchWithRetry.ts — Exponential backoff retry for upstream HTTP requests.
 *
 * Used by the data spine (NPPES, LEIE) to survive transient upstream failures.
 * Jitter prevents thundering herd on recovery.
 */

import { log } from '../obs/logger';

export interface RetryOptions {
  /** Max number of retry attempts (default: 3) */
  maxRetries?: number;
  /** Base delay in ms before first retry (default: 500) */
  baseDelayMs?: number;
  /** Per-request timeout in ms (default: 10_000) */
  timeoutMs?: number;
  /** Label for log lines (e.g. 'nppes', 'leie_csv') */
  label?: string;
  /** Custom predicate: should this error trigger a retry? Default: retries on network errors and 5xx/429 */
  shouldRetry?: (error: unknown, attempt: number) => boolean;
}

function isRetryableByDefault(error: unknown): boolean {
  // Network-level errors (DNS, connection reset, timeout)
  if (error instanceof TypeError) return true;
  if (error instanceof DOMException && error.name === 'AbortError') return true;

  // Response-level: retry on 429 (rate limit) and 5xx (server error)
  if (
    error &&
    typeof error === 'object' &&
    'status' in error &&
    typeof (error as { status: unknown }).status === 'number'
  ) {
    const status = (error as { status: number }).status;
    return status === 429 || status >= 500;
  }

  return true; // default: retry on unknown errors
}

class UpstreamError extends Error {
  readonly status: number;
  constructor(status: number, message: string) {
    super(message);
    this.name = 'UpstreamError';
    this.status = status;
  }
}

/**
 * Fetch with exponential backoff + jitter.
 *
 * Returns the Response on success.
 * Throws UpstreamError on non-retryable failures or exhausted retries.
 */
export async function fetchWithRetry(
  url: string,
  init?: RequestInit,
  opts?: RetryOptions,
): Promise<Response> {
  const maxRetries = opts?.maxRetries ?? 3;
  const baseDelay = opts?.baseDelayMs ?? 500;
  const timeoutMs = opts?.timeoutMs ?? 10_000;
  const label = opts?.label ?? 'upstream';
  const shouldRetry = opts?.shouldRetry ?? ((err) => isRetryableByDefault(err));

  let lastError: unknown;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    if (attempt > 0) {
      // Exponential backoff with jitter: delay = baseDelay * 2^(attempt-1) * (0.5..1.5)
      const jitter = 0.5 + Math.random();
      const delay = Math.min(baseDelay * Math.pow(2, attempt - 1) * jitter, 30_000);
      log('info', `${label}_retry`, { attempt, delayMs: Math.round(delay), url });
      await new Promise((resolve) => setTimeout(resolve, delay));
    }

    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), timeoutMs);

      // Merge signals: caller's signal + our timeout
      const mergedSignal = init?.signal
        ? AbortSignal.any([init.signal, controller.signal])
        : controller.signal;

      const response = await fetch(url, {
        ...init,
        signal: mergedSignal,
      });
      clearTimeout(timeout);

      // Non-retryable HTTP errors (4xx except 429)
      if (!response.ok) {
        const err = new UpstreamError(response.status, `${label} HTTP ${response.status}`);
        if (response.status >= 400 && response.status < 500 && response.status !== 429) {
          throw err; // 4xx (except 429) = not retryable
        }

        // 5xx or 429 — retryable
        if (attempt < maxRetries && shouldRetry(err, attempt)) {
          lastError = err;
          continue;
        }
        throw err;
      }

      return response;
    } catch (err) {
      lastError = err;

      // Don't retry non-retryable errors
      if (err instanceof UpstreamError && err.status >= 400 && err.status < 500 && err.status !== 429) {
        throw err;
      }

      if (attempt < maxRetries && shouldRetry(err, attempt)) {
        continue;
      }

      log('error', `${label}_exhausted_retries`, {
        url,
        attempts: attempt + 1,
        error: err instanceof Error ? err.message : String(err),
      });
      throw err;
    }
  }

  // Should not reach here, but just in case
  throw lastError;
}

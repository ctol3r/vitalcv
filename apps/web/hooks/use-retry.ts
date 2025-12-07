// Retry utility hook for API calls and other async operations

import { useCallback, useRef, useState } from 'react';

interface RetryOptions {
  maxRetries?: number;
  delay?: number;
  backoff?: 'linear' | 'exponential';
  onRetry?: (attempt: number, error: Error) => void;
  onSuccess?: () => void;
  onFailure?: (error: Error) => void;
}

interface RetryState {
  isLoading: boolean;
  error: Error | null;
  retryCount: number;
  isRetrying: boolean;
}

export function useRetry<T extends any[], R>(
  asyncFn: (...args: T) => Promise<R>,
  options: RetryOptions = {},
) {
  const {
    maxRetries = 3,
    delay = 1000,
    backoff = 'exponential',
    onRetry,
    onSuccess,
    onFailure,
  } = options;

  const [state, setState] = useState<RetryState>({
    isLoading: false,
    error: null,
    retryCount: 0,
    isRetrying: false,
  });

  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  const calculateDelay = useCallback(
    (attempt: number) => {
      if (backoff === 'exponential') {
        return delay * Math.pow(2, attempt - 1);
      }
      return delay * attempt;
    },
    [delay, backoff],
  );

  const execute = useCallback(
    async (...args: T): Promise<R | null> => {
      // Cancel any existing request
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }

      // Create new abort controller
      abortControllerRef.current = new AbortController();

      setState((prev) => ({
        ...prev,
        isLoading: true,
        error: null,
      }));

      let lastError: Error | null = null;

      for (let attempt = 1; attempt <= maxRetries + 1; attempt++) {
        try {
          const result = await asyncFn(...args);

          setState({
            isLoading: false,
            error: null,
            retryCount: attempt - 1,
            isRetrying: false,
          });

          if (onSuccess) {
            onSuccess();
          }

          return result;
        } catch (error) {
          lastError = error as Error;

          // Don't retry if the request was aborted
          if (abortControllerRef.current?.signal.aborted) {
            break;
          }

          // Don't retry on the last attempt
          if (attempt === maxRetries + 1) {
            setState({
              isLoading: false,
              error: lastError,
              retryCount: attempt - 1,
              isRetrying: false,
            });

            if (onFailure) {
              onFailure(lastError);
            }
            break;
          }

          // Set retrying state
          setState((prev) => ({
            ...prev,
            isRetrying: true,
            retryCount: attempt,
          }));

          if (onRetry) {
            onRetry(attempt, lastError);
          }

          // Wait before retrying
          const retryDelay = calculateDelay(attempt);
          await new Promise((resolve) => {
            timeoutRef.current = setTimeout(resolve, retryDelay);
          });

          // Check if request was aborted during delay
          if (abortControllerRef.current?.signal.aborted) {
            break;
          }
        }
      }

      return null;
    },
    [asyncFn, maxRetries, calculateDelay, onRetry, onSuccess, onFailure],
  );

  const reset = useCallback(() => {
    // Cancel any pending request
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }

    // Clear timeout
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }

    setState({
      isLoading: false,
      error: null,
      retryCount: 0,
      isRetrying: false,
    });
  }, []);

  const cancel = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }
  }, []);

  return {
    execute,
    reset,
    cancel,
    ...state,
  };
}

// Utility function for retrying with exponential backoff
export async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  options: {
    maxRetries?: number;
    baseDelay?: number;
    maxDelay?: number;
  } = {},
): Promise<T> {
  const { maxRetries = 3, baseDelay = 1000, maxDelay = 10000 } = options;

  let lastError: Error;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error as Error;

      if (attempt === maxRetries) {
        throw lastError;
      }

      const delay = Math.min(baseDelay * Math.pow(2, attempt), maxDelay);
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }

  throw lastError!;
}

// Utility for handling network errors specifically
export function isNetworkError(error: Error): boolean {
  return (
    error.name === 'NetworkError' ||
    error.name === 'TypeError' ||
    error.message.includes('fetch') ||
    error.message.includes('network') ||
    error.message.includes('timeout')
  );
}

// Utility for handling HTTP errors
export function isHttpError(error: Error): boolean {
  return error.name === 'HttpError' || error.message.includes('HTTP');
}

// Utility for determining if an error is retryable
export function isRetryableError(error: Error): boolean {
  // Don't retry client errors (4xx) except for 408, 429
  if (
    error.message.includes('400') ||
    error.message.includes('401') ||
    error.message.includes('403') ||
    error.message.includes('404')
  ) {
    return false;
  }

  // Retry server errors (5xx) and network errors
  return isNetworkError(error) || error.message.includes('5');
}

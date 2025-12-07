/**
 * Chain Call Timeout Wrapper
 * Task 201.49 - Timeout RPC calls with fallback errors
 */

/**
 * Task 201.49 - Wrap promise with timeout
 */
export async function withTimeout<T>(
  promise: Promise<T>,
  timeoutMs: number,
  errorMessage?: string
): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) =>
      setTimeout(
        () => reject(new Error(errorMessage || `Operation timed out after ${timeoutMs}ms`)),
        timeoutMs
      )
    ),
  ]);
}

/**
 * Wrap chain RPC call with timeout and fallback
 */
export async function chainCallWithTimeout<T>(
  fn: () => Promise<T>,
  timeoutMs: number = 10000,
  fallback?: T
): Promise<T> {
  try {
    return await withTimeout(fn(), timeoutMs, 'Chain RPC call timed out');
  } catch (error) {
    console.error('Chain call failed:', error);

    if (fallback !== undefined) {
      console.log('Returning fallback value');
      return fallback;
    }

    throw error;
  }
}

/**
 * Execute with retry and timeout
 */
export async function chainCallWithRetryAndTimeout<T>(
  fn: () => Promise<T>,
  retries: number = 3,
  timeoutMs: number = 10000,
  fallback?: T
): Promise<T> {
  let lastError: any;

  for (let i = 0; i < retries; i++) {
    try {
      return await chainCallWithTimeout(fn, timeoutMs, fallback);
    } catch (error) {
      lastError = error;
      console.warn(`Retry ${i + 1}/${retries} failed:`, error);

      if (i < retries - 1) {
        // Wait before retry with exponential backoff
        await new Promise(resolve => setTimeout(resolve, Math.pow(2, i) * 1000));
      }
    }
  }

  if (fallback !== undefined) {
    console.log('All retries exhausted, returning fallback');
    return fallback;
  }

  throw lastError;
}


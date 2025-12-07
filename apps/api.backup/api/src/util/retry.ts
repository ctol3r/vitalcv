/**
 * Retry utility with exponential backoff
 * Used for flaky operations like Puppeteer interactions
 */
export async function retry<T>(
  fn: () => Promise<T>,
  times = 2,
  backoff = 300
): Promise<T> {
  let lastError: any;

  for (let i = 0; i <= times; i++) {
    try {
      return await fn();
    } catch (e) {
      lastError = e;
      if (i === times) break;

      // Exponential backoff: 300ms, 600ms, 1200ms, etc.
      const delay = backoff * Math.pow(2, i);
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }

  throw lastError;
}



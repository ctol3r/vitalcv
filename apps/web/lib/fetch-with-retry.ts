/**
 * fetchWithRetry — upstream resilience for server-side proxy routes.
 *
 * Retries on network failures (TypeError: fetch failed) with exponential backoff.
 * Does NOT retry on 4xx/5xx responses (those are application-layer errors).
 *
 * @param url - Target URL
 * @param init - Standard RequestInit
 * @param retries - Max retry attempts (default: 2)
 * @param backoffMs - Initial backoff in ms (default: 300)
 */
export async function fetchWithRetry(
  url: string,
  init: RequestInit & { signal?: AbortSignal },
  retries = 2,
  backoffMs = 300,
): Promise<Response> {
  let lastError: unknown;

  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      return await fetch(url, init);
    } catch (err) {
      lastError = err;
      // Only retry on network-level failures
      if (!(err instanceof TypeError) || attempt === retries) throw err;
      // Exponential backoff
      await new Promise(resolve => setTimeout(resolve, backoffMs * Math.pow(2, attempt)));
    }
  }

  throw lastError;
}

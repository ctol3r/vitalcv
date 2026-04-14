/**
 * safeFetch — enforces the three-condition action success contract.
 *
 *   1. HTTP layer:        res.ok === true
 *   2. Application layer: response.success === true
 *   3. Persistence layer: response.recorded === true OR response.routed is set
 *
 * Throws on any failed condition so callers can surface a truthful error
 * to the user — no silent success when the server returned a 2xx with a
 * failed application payload.
 */

export interface SafeFetchResponse {
  success?: boolean;
  recorded?: boolean;
  routed?: string;
  error?: string;
  [key: string]: unknown;
}

export class SafeFetchError extends Error {
  constructor(
    message: string,
    public readonly layer: 'http' | 'application' | 'persistence' | 'network',
    public readonly status?: number,
    public readonly payload?: unknown,
  ) {
    super(message);
    this.name = 'SafeFetchError';
  }
}

export async function safeFetch<T extends SafeFetchResponse = SafeFetchResponse>(
  url: string,
  options?: RequestInit,
): Promise<T> {
  let res: Response;
  try {
    res = await fetch(url, options);
  } catch (err) {
    throw new SafeFetchError(
      err instanceof Error ? err.message : 'Network request failed',
      'network',
    );
  }

  if (!res.ok) {
    // Attempt to read the body for diagnostics but do not let parse errors mask the status.
    const body = await res.text().catch(() => '');
    throw new SafeFetchError(
      `HTTP error: ${res.status}`,
      'http',
      res.status,
      body,
    );
  }

  let data: T;
  try {
    data = (await res.json()) as T;
  } catch (err) {
    throw new SafeFetchError(
      err instanceof Error ? `Invalid JSON: ${err.message}` : 'Invalid JSON response',
      'application',
      res.status,
    );
  }

  if (!data?.success) {
    throw new SafeFetchError(
      `Application error: ${data?.error ?? JSON.stringify(data)}`,
      'application',
      res.status,
      data,
    );
  }

  // Persistence guard — only applies when the endpoint contract includes
  // either "recorded" (direct write) or "routed" (delegated write). If
  // neither is present the caller did not request persistence verification.
  const hasPersistenceFields =
    Object.prototype.hasOwnProperty.call(data, 'recorded') ||
    Object.prototype.hasOwnProperty.call(data, 'routed');
  if (hasPersistenceFields && !data.recorded && !data.routed) {
    throw new SafeFetchError(
      'Persistence not confirmed by server',
      'persistence',
      res.status,
      data,
    );
  }

  return data;
}

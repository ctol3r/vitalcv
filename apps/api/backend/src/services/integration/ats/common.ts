import { log } from '../../../obs/logger';

const FETCH_TIMEOUT_MS = 8_000;

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

export function buildBasicAuth(username: string, password = ''): string {
  return `Basic ${Buffer.from(`${username}:${password}`).toString('base64')}`;
}

export async function fetchAtsJson<TResponse>(
  provider: string,
  operation: string,
  url: string,
  init: RequestInit,
  context: Record<string, unknown>,
): Promise<TResponse | null> {
  try {
    const response = await fetch(url, {
      ...init,
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    });

    if (!response.ok) {
      log('warn', 'ats_adapter_error', {
        provider,
        operation,
        url,
        status: response.status,
        ...context,
      });
      return null;
    }

    return await response.json() as TResponse;
  } catch (error) {
    log('warn', 'ats_adapter_error', {
      provider,
      operation,
      url,
      error: errorMessage(error),
      ...context,
    });
    return null;
  }
}

export async function fetchAtsOk(
  provider: string,
  operation: string,
  url: string,
  init: RequestInit,
  context: Record<string, unknown>,
): Promise<boolean> {
  try {
    const response = await fetch(url, {
      ...init,
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    });

    if (!response.ok) {
      log('warn', 'ats_adapter_error', {
        provider,
        operation,
        url,
        status: response.status,
        ...context,
      });
      return false;
    }

    return true;
  } catch (error) {
    log('warn', 'ats_adapter_error', {
      provider,
      operation,
      url,
      error: errorMessage(error),
      ...context,
    });
    return false;
  }
}

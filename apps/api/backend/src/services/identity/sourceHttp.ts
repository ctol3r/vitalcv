import { log } from '../../obs/logger';
import { TtlCache } from '../ttlCache';
import { fetchWithRetry } from '../../utils/fetchWithRetry';

const DEFAULT_SOURCE_CACHE_TTL_MS = 5 * 60 * 1000;

type CachedJsonSourceResponse = {
  bodyText: string;
  headers: Record<string, string>;
  fetchedAt: string;
};

const sourceJsonCache = new TtlCache<CachedJsonSourceResponse>(DEFAULT_SOURCE_CACHE_TTL_MS);

export interface FetchJsonSourceOptions {
  label: string;
  headers?: HeadersInit;
  cacheKey?: string;
  cacheTtlMs?: number;
  timeoutMs?: number;
  maxRetries?: number;
  baseDelayMs?: number;
  logUrl?: string;
}

export interface FetchJsonSourceResult {
  data: unknown;
  headers: Record<string, string>;
  fetchedAt: string;
  fromCache: boolean;
}

export type SourceJsonFetchErrorCode =
  | 'EMPTY_RESPONSE'
  | 'SOFT_404'
  | 'INVALID_JSON'
  | 'UNAVAILABLE';

export class SourceJsonFetchError extends Error {
  readonly code: SourceJsonFetchErrorCode;
  readonly label: string;

  constructor(label: string, code: SourceJsonFetchErrorCode, message: string) {
    super(message);
    this.name = 'SourceJsonFetchError';
    this.label = label;
    this.code = code;
  }
}

function headersToObject(headers: Headers): Record<string, string> {
  const normalized: Record<string, string> = {};
  headers.forEach((value, key) => {
    normalized[key] = value;
  });
  return normalized;
}

function isHtmlLikeResponse(bodyText: string, headers?: Record<string, string>): boolean {
  const contentType = headers?.['content-type']?.toLowerCase() ?? '';
  const normalizedBody = bodyText.trim().toLowerCase();

  return (
    contentType.includes('text/html')
    || normalizedBody.startsWith('<!doctype html')
    || normalizedBody.startsWith('<html')
    || normalizedBody.includes('<body')
  );
}

function parseJsonOrThrow(
  bodyText: string,
  label: string,
  headers?: Record<string, string>,
): unknown {
  if (bodyText.trim().length === 0) {
    throw new SourceJsonFetchError(
      label,
      'EMPTY_RESPONSE',
      `${label} returned an empty 200 response`,
    );
  }

  if (isHtmlLikeResponse(bodyText, headers)) {
    throw new SourceJsonFetchError(
      label,
      'SOFT_404',
      `${label} returned HTML instead of JSON`,
    );
  }

  try {
    return JSON.parse(bodyText) as unknown;
  } catch {
    throw new SourceJsonFetchError(
      label,
      'INVALID_JSON',
      `${label} returned invalid JSON`,
    );
  }
}

export async function fetchJsonSource(
  url: string,
  options: FetchJsonSourceOptions,
): Promise<FetchJsonSourceResult> {
  const cacheTtlMs = options.cacheTtlMs ?? DEFAULT_SOURCE_CACHE_TTL_MS;
  const cacheKey = options.cacheKey ?? `${options.label}:${url}`;

  if (cacheTtlMs > 0) {
    const cached = sourceJsonCache.get(cacheKey);
    if (cached) {
      log('debug', 'source_fetch_cache_hit', {
        label: options.label,
        cacheKey,
      });
      return {
        data: parseJsonOrThrow(cached.bodyText, options.label, cached.headers),
        headers: cached.headers,
        fetchedAt: cached.fetchedAt,
        fromCache: true,
      };
    }
  }

  let response: Response;
  try {
    response = await fetchWithRetry(
      url,
      {
        headers: options.headers,
      },
      {
        label: options.label,
        timeoutMs: options.timeoutMs,
        maxRetries: options.maxRetries,
        baseDelayMs: options.baseDelayMs,
        logUrl: options.logUrl,
      },
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    const isTimeout =
      (error instanceof DOMException && error.name === 'AbortError')
      || message.toLowerCase().includes('abort')
      || message.toLowerCase().includes('timeout');

    if (isTimeout) {
      throw new SourceJsonFetchError(
        options.label,
        'UNAVAILABLE',
        `${options.label} is unavailable because the upstream request timed out`,
      );
    }

    throw error;
  }

  const bodyText = await response.text();
  const headers = headersToObject(response.headers);
  const data = parseJsonOrThrow(bodyText, options.label, headers);
  const fetchedAt = new Date().toISOString();

  if (cacheTtlMs > 0) {
    sourceJsonCache.set(
      cacheKey,
      {
        bodyText,
        headers,
        fetchedAt,
      },
      cacheTtlMs,
    );
  }

  return {
    data,
    headers,
    fetchedAt,
    fromCache: false,
  };
}

export function clearSourceJsonCacheForTests(): void {
  sourceJsonCache.clear();
}

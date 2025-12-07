/**
 * SWR Fetcher Configuration
 *
 * Centralized data fetching layer with SWR for:
 * - Automatic caching and revalidation
 * - Error handling and retries
 * - Loading states
 * - Optimistic updates
 */

import type { SWRConfiguration } from 'swr';

const BASE_URL = process.env.NEXT_PUBLIC_BACKEND_URL || '';

/**
 * Custom error class for API errors
 */
export class ApiError extends Error {
  status: number;
  info?: Record<string, unknown>;
  requestId?: string;

  constructor(message: string, status: number, info?: Record<string, unknown>, requestId?: string) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.info = info;
    this.requestId = requestId;
  }

  get isNotFound() {
    return this.status === 404;
  }

  get isUnauthorized() {
    return this.status === 401;
  }

  get isForbidden() {
    return this.status === 403;
  }

  get isServerError() {
    return this.status >= 500;
  }

  get isNetworkError() {
    return this.status === 0;
  }
}

/**
 * Standard JSON fetcher for SWR
 */
export async function fetcher<T>(url: string): Promise<T> {
  const fullUrl = url.startsWith('http') ? url : `${BASE_URL}${url}`;

  const response = await fetch(fullUrl, {
    headers: {
      'Content-Type': 'application/json',
    },
    credentials: 'include',
  });

  const requestId = response.headers.get('x-request-id') || undefined;

  if (!response.ok) {
    let errorInfo: Record<string, unknown> = {};
    try {
      errorInfo = await response.json();
    } catch {
      // Response body wasn't JSON
    }

    throw new ApiError(
      errorInfo.message as string || errorInfo.error as string || `Request failed with status ${response.status}`,
      response.status,
      errorInfo,
      requestId
    );
  }

  return response.json();
}

/**
 * Fetcher with authentication token
 */
export function createAuthFetcher(token: string) {
  return async function authFetcher<T>(url: string): Promise<T> {
    const fullUrl = url.startsWith('http') ? url : `${BASE_URL}${url}`;

    const response = await fetch(fullUrl, {
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      credentials: 'include',
    });

    const requestId = response.headers.get('x-request-id') || undefined;

    if (!response.ok) {
      let errorInfo: Record<string, unknown> = {};
      try {
        errorInfo = await response.json();
      } catch {
        // Response body wasn't JSON
      }

      throw new ApiError(
        errorInfo.message as string || `Request failed with status ${response.status}`,
        response.status,
        errorInfo,
        requestId
      );
    }

    return response.json();
  };
}

/**
 * POST fetcher for mutations
 */
export async function postFetcher<T, D = unknown>(url: string, data: D): Promise<T> {
  const fullUrl = url.startsWith('http') ? url : `${BASE_URL}${url}`;

  const response = await fetch(fullUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    credentials: 'include',
    body: JSON.stringify(data),
  });

  const requestId = response.headers.get('x-request-id') || undefined;

  if (!response.ok) {
    let errorInfo: Record<string, unknown> = {};
    try {
      errorInfo = await response.json();
    } catch {
      // Response body wasn't JSON
    }

    throw new ApiError(
      errorInfo.message as string || `Request failed with status ${response.status}`,
      response.status,
      errorInfo,
      requestId
    );
  }

  return response.json();
}

/**
 * Default SWR configuration
 */
export const swrConfig: SWRConfiguration = {
  fetcher,
  revalidateOnFocus: true,
  revalidateOnReconnect: true,
  shouldRetryOnError: true,
  errorRetryCount: 3,
  errorRetryInterval: 1000,
  dedupingInterval: 2000,
  onError: (error: Error) => {
    if (error instanceof ApiError) {
      // Log API errors for debugging
      console.error(`[SWR] API Error: ${error.message}`, {
        status: error.status,
        requestId: error.requestId,
      });

      // Handle unauthorized errors globally
      if (error.isUnauthorized) {
        // Redirect to login or refresh token
        if (typeof window !== 'undefined') {
          window.dispatchEvent(new CustomEvent('auth:unauthorized'));
        }
      }
    }
  },
};

/**
 * Configuration for rarely changing data
 */
export const staticDataConfig: SWRConfiguration = {
  ...swrConfig,
  revalidateOnFocus: false,
  revalidateOnReconnect: false,
  refreshInterval: 0,
  dedupingInterval: 60000, // 1 minute
};

/**
 * Configuration for frequently changing data
 */
export const realtimeDataConfig: SWRConfiguration = {
  ...swrConfig,
  refreshInterval: 5000, // 5 seconds
  dedupingInterval: 1000,
};

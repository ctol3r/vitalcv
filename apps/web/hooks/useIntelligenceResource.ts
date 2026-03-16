'use client';

import { useEffect, useState } from 'react';
import useSWR, { mutate as mutateSWR } from 'swr';

export interface UseIntelligenceResourceOptions {
  pollIntervalMs?: number;
  retryIntervalMs?: number;
  maxRetryIntervalMs?: number;
  paused?: boolean;
  initialData?: unknown;
}

export interface UseIntelligenceResourceResult<T> {
  data: T | null;
  loading: boolean;
  recovering: boolean;
  error: string | null;
  lastUpdated: string | null;
  refresh: () => void;
}

const resourceLastUpdated = new Map<string, string>();
const knownResourceKeys = new Set<string>();

function stampResource(url: string, at = new Date().toISOString()) {
  knownResourceKeys.add(url);
  resourceLastUpdated.set(url, at);
}

function errorMessage(error: unknown): string | null {
  if (!error) {
    return null;
  }

  if (error instanceof Error) {
    return error.message;
  }

  return typeof error === 'string' ? error : 'Unknown request failure';
}

async function fetchIntelligenceResource<T>(url: string): Promise<T> {
  const response = await fetch(url, {
    cache: 'no-store',
    headers: {
      Accept: 'application/json',
    },
  });

  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    const message = (
      payload && typeof payload === 'object' && 'error' in payload && typeof payload.error === 'string' && payload.error.length > 0
        ? payload.error
        : `Request failed with ${response.status}`
    );
    throw new Error(message);
  }

  return payload as T;
}

export function primeIntelligenceResource<T>(url: string, data: T, lastUpdated?: string | null) {
  stampResource(url, lastUpdated ?? new Date().toISOString());
  void mutateSWR(url, data, {
    populateCache: true,
    revalidate: false,
    rollbackOnError: false,
  });
}

export function mutateIntelligenceResource<T>(
  url: string,
  updater: T | ((current: T | null) => T | null),
) {
  stampResource(url);
  void mutateSWR(
    url,
    (current: T | undefined) => (
      typeof updater === 'function'
        ? (updater as (value: T | null) => T | null)(current ?? null) ?? undefined
        : updater
    ),
    {
      populateCache: true,
      revalidate: false,
      rollbackOnError: false,
    },
  );
}

export function mutateMatchingIntelligenceResources(
  predicate: (url: string) => boolean,
  updater: (current: unknown, url: string) => unknown,
) {
  for (const url of knownResourceKeys) {
    if (!predicate(url)) {
      continue;
    }

    stampResource(url);
    void mutateSWR(
      url,
      (current: unknown) => updater(current, url),
      {
        populateCache: true,
        revalidate: false,
        rollbackOnError: false,
      },
    );
  }
}

export function useIntelligenceResource<T>(
  url: string | null,
  options: UseIntelligenceResourceOptions = {},
): UseIntelligenceResourceResult<T> {
  const {
    pollIntervalMs = 30_000,
    retryIntervalMs = 5_000,
    maxRetryIntervalMs = 60_000,
    paused = false,
    initialData = null,
  } = options;

  const [lastUpdated, setLastUpdated] = useState<string | null>(url ? resourceLastUpdated.get(url) ?? null : null);
  const {
    data,
    error,
    isLoading,
    isValidating,
    mutate,
  } = useSWR<T>(
    url,
    fetchIntelligenceResource,
    {
      fallbackData: initialData === null ? undefined : initialData as T,
      refreshInterval: paused ? 0 : pollIntervalMs,
      revalidateOnFocus: false,
      keepPreviousData: true,
      isPaused: () => paused,
      onErrorRetry: (_error, _key, _config, revalidate, { retryCount }) => {
        if (paused) {
          return;
        }

        const nextDelay = Math.min(
          retryIntervalMs * (2 ** retryCount),
          maxRetryIntervalMs,
        );

        setTimeout(() => {
          void revalidate({ retryCount });
        }, nextDelay);
      },
    },
  );

  useEffect(() => {
    if (!url) {
      setLastUpdated(null);
      return;
    }

    knownResourceKeys.add(url);
    setLastUpdated(resourceLastUpdated.get(url) ?? null);
  }, [url]);

  useEffect(() => {
    if (!url || initialData === null) {
      return;
    }

    if (!resourceLastUpdated.has(url)) {
      stampResource(url);
      setLastUpdated(resourceLastUpdated.get(url) ?? null);
    }

    void mutateSWR(
      url,
      (current: T | undefined) => current ?? initialData as T,
      {
        populateCache: true,
        revalidate: false,
        rollbackOnError: false,
      },
    );
  }, [initialData, url]);

  useEffect(() => {
    if (!url || data === undefined || data === null) {
      return;
    }

    const nextUpdated = new Date().toISOString();
    stampResource(url, nextUpdated);
    setLastUpdated(nextUpdated);
  }, [data, url]);

  const resolvedData = (data ?? (initialData as T | null) ?? null) as T | null;
  const hasData = resolvedData !== null;

  return {
    data: resolvedData,
    loading: !paused && !hasData && isLoading,
    recovering: !paused && hasData && isValidating,
    error: errorMessage(error),
    lastUpdated,
    refresh: () => {
      if (url) {
        void mutate();
      }
    },
  };
}

'use client';

import { useEffect, useRef, useState } from 'react';

export interface UseIntelligenceResourceOptions {
  pollIntervalMs?: number;
  retryIntervalMs?: number;
  maxRetryIntervalMs?: number;
  paused?: boolean;
}

export interface UseIntelligenceResourceResult<T> {
  data: T | null;
  loading: boolean;
  recovering: boolean;
  error: string | null;
  lastUpdated: string | null;
  refresh: () => void;
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
  } = options;

  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(false);
  const [recovering, setRecovering] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<string | null>(null);
  const [refreshNonce, setRefreshNonce] = useState(0);

  const abortRef = useRef<AbortController | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const retryCountRef = useRef(0);
  const dataRef = useRef<T | null>(null);

  useEffect(() => {
    dataRef.current = data;
  }, [data]);

  const clearTimer = () => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  };

  const refresh = () => {
    retryCountRef.current = 0;
    setRefreshNonce((value) => value + 1);
  };

  useEffect(() => {
    if (!url || paused) {
      clearTimer();
      abortRef.current?.abort();
      setLoading(false);
      setRecovering(false);
      return;
    }

    let cancelled = false;

    const scheduleNext = (delayMs: number) => {
      clearTimer();
      timerRef.current = setTimeout(() => {
        void runRequest();
      }, delayMs);
    };

    const runRequest = async () => {
      if (cancelled) {
        return;
      }

      clearTimer();
      abortRef.current?.abort();

      const controller = new AbortController();
      abortRef.current = controller;

      const hasData = dataRef.current !== null;
      setLoading(!hasData);
      setRecovering(hasData);

      try {
        const response = await fetch(url, {
          cache: 'no-store',
          headers: {
            Accept: 'application/json',
          },
          signal: controller.signal,
        });

        const payload = await response.json().catch(() => ({}));
        if (!response.ok) {
          const message = (
            typeof payload?.error === 'string' && payload.error.length > 0
              ? payload.error
              : `Request failed with ${response.status}`
          );
          throw new Error(message);
        }

        retryCountRef.current = 0;
        setData(payload as T);
        setError(null);
        setLastUpdated(new Date().toISOString());
        setLoading(false);
        setRecovering(false);
        scheduleNext(pollIntervalMs);
      } catch (requestError) {
        if (cancelled || (requestError instanceof Error && requestError.name === 'AbortError')) {
          return;
        }

        retryCountRef.current += 1;
        const nextDelay = Math.min(
          retryIntervalMs * (2 ** (retryCountRef.current - 1)),
          maxRetryIntervalMs,
        );

        setError(requestError instanceof Error ? requestError.message : 'Unknown request failure');
        setLoading(false);
        setRecovering(dataRef.current !== null);
        scheduleNext(nextDelay);
      }
    };

    void runRequest();

    return () => {
      cancelled = true;
      clearTimer();
      abortRef.current?.abort();
    };
  }, [maxRetryIntervalMs, paused, pollIntervalMs, refreshNonce, retryIntervalMs, url]);

  return {
    data,
    loading,
    recovering,
    error,
    lastUpdated,
    refresh,
  };
}

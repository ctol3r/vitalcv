'use client';

import { useEffect, useEffectEvent, useRef, useState } from 'react';

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

  const scheduleNext = useEffectEvent((delayMs: number) => {
    clearTimer();
    timerRef.current = setTimeout(() => {
      void runRequest();
    }, delayMs);
  });

  const runRequest = useEffectEvent(async () => {
    if (!url || paused) {
      return;
    }

    clearTimer();
    abortRef.current?.abort();

    const controller = new AbortController();
    abortRef.current = controller;

    const hasData = data !== null;
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
      if (requestError instanceof Error && requestError.name === 'AbortError') {
        return;
      }

      retryCountRef.current += 1;
      const nextDelay = Math.min(
        retryIntervalMs * (2 ** (retryCountRef.current - 1)),
        maxRetryIntervalMs,
      );

      setError(requestError instanceof Error ? requestError.message : 'Unknown request failure');
      setLoading(false);
      setRecovering(data !== null);
      scheduleNext(nextDelay);
    }
  });

  useEffect(() => {
    if (!url || paused) {
      clearTimer();
      abortRef.current?.abort();
      setLoading(false);
      setRecovering(false);
      return;
    }

    void runRequest();

    return () => {
      clearTimer();
      abortRef.current?.abort();
    };
  }, [paused, refreshNonce, runRequest, url]);

  return {
    data,
    loading,
    recovering,
    error,
    lastUpdated,
    refresh,
  };
}

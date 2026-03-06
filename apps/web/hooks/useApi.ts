/**
 * useApi.ts — Wave 93: Generic polling hook
 *
 * Lightweight SWR-equivalent using native fetch + setInterval.
 * Features: loading state, error state, auto-refresh, manual refresh,
 * abort-on-unmount, configurable interval.
 */

'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

export interface UseApiOptions {
  /** Polling interval in ms. 0 = no polling (fetch once). Default: 0 */
  interval?: number;
  /** Pause polling when true */
  paused?: boolean;
  /** Request headers */
  headers?: Record<string, string>;
}

export interface UseApiResult<T> {
  data: T | null;
  loading: boolean;
  error: string | null;
  refresh: () => void;
  lastUpdated: Date | null;
}

const API_BASE =
  (typeof window !== 'undefined'
    ? (process.env.NEXT_PUBLIC_API_BASE ?? process.env.NEXT_PUBLIC_BACKEND_URL ?? '')
    : '') as string;

function resolveUrl(url: string): string {
  if (url.startsWith('http')) return url;
  const base = API_BASE.endsWith('/') ? API_BASE.slice(0, -1) : API_BASE;
  return `${base}${url}`;
}

export function useApi<T>(
  url: string | null,
  options: UseApiOptions = {},
): UseApiResult<T> {
  const { interval = 0, paused = false, headers } = options;

  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [tick, setTick] = useState(0);

  const abortRef = useRef<AbortController | null>(null);

  const refresh = useCallback(() => setTick((t) => t + 1), []);

  useEffect(() => {
    if (!url || paused) return;

    // Cancel any in-flight request
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    let cancelled = false;

    const fetchData = async () => {
      if (!loading) setLoading(true);
      try {
        const res = await fetch(resolveUrl(url), {
          signal: controller.signal,
          headers: { 'Content-Type': 'application/json', ...headers },
        });
        if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
        const json = (await res.json()) as T;
        if (!cancelled) {
          setData(json);
          setError(null);
          setLastUpdated(new Date());
        }
      } catch (err) {
        if (cancelled || (err instanceof Error && err.name === 'AbortError')) return;
        setError(err instanceof Error ? err.message : 'Unknown error');
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    fetchData();

    // Set up polling
    let timer: ReturnType<typeof setInterval> | null = null;
    if (interval > 0) {
      timer = setInterval(fetchData, interval);
    }

    return () => {
      cancelled = true;
      controller.abort();
      if (timer) clearInterval(timer);
    };
    // tick in deps triggers manual refresh
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [url, paused, interval, tick]);

  return { data, loading, error, refresh, lastUpdated };
}

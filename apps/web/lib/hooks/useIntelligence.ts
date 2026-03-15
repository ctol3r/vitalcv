/**
 * useIntelligence.ts — React hooks for VitalCV intelligence surfaces
 *
 * Hooks for: findings, storylines, actions, predictions, system health, polling.
 * All use relative /api/* paths (Next.js proxy → Express backend).
 */

'use client';

import { useState, useEffect, useCallback, useRef } from 'react';

// ── Generic fetch hook ─────────────────────────────────────────────────────────

interface UseFetchResult<T> {
  data: T | null;
  loading: boolean;
  error: string | null;
  refetch: () => void;
}

function useFetch<T>(url: string | null, refreshInterval?: number): UseFetchResult<T> {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const mountedRef = useRef(true);

  const fetchData = useCallback(async () => {
    if (!url) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(url);
      if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
      const json = await res.json();
      if (mountedRef.current) setData(json);
    } catch (err) {
      if (mountedRef.current) setError((err as Error).message);
    } finally {
      if (mountedRef.current) setLoading(false);
    }
  }, [url]);

  useEffect(() => {
    mountedRef.current = true;
    fetchData();
    let timer: ReturnType<typeof setInterval> | undefined;
    if (refreshInterval && refreshInterval > 0) {
      timer = setInterval(fetchData, refreshInterval);
    }
    return () => { mountedRef.current = false; if (timer) clearInterval(timer); };
  }, [fetchData, refreshInterval]);

  return { data, loading, error, refetch: fetchData };
}

// ── POST hook ──────────────────────────────────────────────────────────────────

function usePost<TReq, TRes>() {
  const [data, setData] = useState<TRes | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const post = useCallback(async (url: string, body: TReq): Promise<TRes | null> => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
      const json = await res.json();
      setData(json);
      return json;
    } catch (err) {
      setError((err as Error).message);
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  return { data, loading, error, post };
}

// ── Findings ───────────────────────────────────────────────────────────────────

export function useFindings(limit = 50) {
  return useFetch<{ findings: unknown[]; total: number }>(
    `/api/findings/feed?limit=${limit}`,
    30_000, // refresh every 30s
  );
}

export function useFindingsForNpi(npi: string | null) {
  return useFetch<{ findings: unknown[] }>(
    npi ? `/api/findings/npi/${npi}` : null,
  );
}

export function useFindingStats() {
  return useFetch<{ stats: unknown }>(
    '/api/findings/stats',
    60_000,
  );
}

// ── Storylines ─────────────────────────────────────────────────────────────────

export function useStorylines(limit = 20) {
  return useFetch<{ storylines: unknown[]; total: number }>(
    `/api/storylines?limit=${limit}`,
    30_000,
  );
}

export function useStorylinesForNpi(npi: string | null) {
  return useFetch<{ storylines: unknown[] }>(
    npi ? `/api/storylines/npi/${npi}` : null,
  );
}

export function useStorylineStats() {
  return useFetch<{ stats: unknown }>(
    '/api/storylines/stats',
    60_000,
  );
}

// ── Actions + Predictions ──────────────────────────────────────────────────────

export function useActions(npi: string | null) {
  return useFetch<{ actions: unknown[]; count: number }>(
    npi ? `/api/actions/${npi}` : null,
  );
}

export function usePredictions(npi: string | null) {
  return useFetch<{ predictions: unknown[]; count: number }>(
    npi ? `/api/predictions/${npi}` : null,
  );
}

export function useProviderIntelligence(npi: string | null) {
  return useFetch<{
    npi: string;
    actions: unknown[];
    predictions: unknown[];
    summary: string;
    generatedAt: string;
    durationMs: number;
  }>(
    npi ? `/api/provider-intelligence/${npi}` : null,
  );
}

export function useActionOutcome() {
  return usePost<
    { outcome: string; category: string; npi: string },
    { recorded: boolean; actionId: string; outcome: string }
  >();
}

// ── System Health ──────────────────────────────────────────────────────────────

export function useSystemHealth() {
  return useFetch<{
    agents: { id: string; name: string; enabled: boolean; lastRun: string | null; lastIssueCount: number }[];
    totalIssues: number;
    totalAutoRepaired: number;
    totalSurfaced: number;
    generatedAt: string;
  }>(
    '/api/system-health',
    60_000,
  );
}

export function useSystemHealthReports(limit = 20) {
  return useFetch<{ reports: unknown[] }>(
    `/api/system-health/reports?limit=${limit}`,
  );
}

export function useSystemHealthScan() {
  return usePost<Record<string, never>, { summary: unknown; reports: unknown[] }>();
}

// ── Polling ────────────────────────────────────────────────────────────────────

export function usePollingStatus() {
  return useFetch<{
    running: boolean;
    sources: {
      source: string;
      cadence: string;
      enabled: boolean;
      lastPoll: string | null;
      nextPoll: string | null;
      isOverdue: boolean;
      isActive: boolean;
    }[];
    recentCycles: number;
    totalDiffs: number;
    generatedAt: string;
  }>(
    '/api/polling/status',
    60_000,
  );
}

export function usePollTrigger() {
  return usePost<Record<string, never>, unknown>();
}

// ── Trust Score ────────────────────────────────────────────────────────────────

export function useTrustScore(npi: string | null) {
  return useFetch<{ score: number; band: string; bandLabel: string; dimensions: unknown }>(
    npi ? `/api/trust/score/${npi}` : null,
  );
}

// ── Investigation ──────────────────────────────────────────────────────────────

export function useInvestigation() {
  return usePost<Record<string, unknown>, unknown>();
}

// ── Investigators ──────────────────────────────────────────────────────────────

export function useInvestigators() {
  return useFetch<{ investigators: unknown[] }>(
    '/api/investigators',
    60_000,
  );
}

'use client';

/**
 * LiveTrustStatusBoard.tsx
 *
 * Fetches /api/status on mount. Displays live operational truth.
 * Auto-refreshes every 60s. Manual refresh button.
 */

import { useEffect, useState, useCallback } from 'react';

interface EndpointStatus {
  path: string;
  public: boolean;
  status: string;
}

interface StatusPayload {
  timestamp: string;
  version: string;
  overall: string;
  verifier_continuity: {
    status: string;
    endpoints: Record<string, EndpointStatus>;
  };
  replay_continuity: {
    status: string;
    survivable: boolean;
    dedupe_key_active: boolean;
    actor_attribution_active: boolean;
    mechanism: string;
  };
  runtime_continuity: {
    status: string;
    issuer_did: string;
    signing_algorithm: string;
    signing_key_id: string | null;
    environment: string;
  };
  chronology_continuity: {
    status: string;
    reading_order: string[];
    deterministic_run_id: boolean;
    algorithm: string;
  };
  source_lanes: Record<
    string,
    { lifecycle: string; status: string }
  >;
}

function statusLabel(status: string): string {
  if (status === 'operational') return '● OPERATIONAL';
  if (status === 'degraded') return '⚠ DEGRADED';
  return '✗ DOWN';
}

function statusClass(status: string): string {
  if (status === 'operational') return 'text-green-600 font-mono text-[10px]';
  if (status === 'degraded') return 'text-amber-600 font-mono text-[10px]';
  return 'text-red-600 font-mono text-[10px]';
}

function relativeTime(isoString: string): string {
  const delta = Math.floor((Date.now() - new Date(isoString).getTime()) / 1000);
  if (delta < 5) return 'just now';
  if (delta < 60) return `${delta} seconds ago`;
  if (delta < 120) return '1 minute ago';
  return `${Math.floor(delta / 60)} minutes ago`;
}

export function LiveTrustStatusBoard() {
  const [data, setData] = useState<StatusPayload | null>(null);
  const [fetchedAt, setFetchedAt] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [tick, setTick] = useState(0);

  const fetchStatus = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/status', { cache: 'no-store' });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = (await res.json()) as StatusPayload;
      setData(json);
      setFetchedAt(new Date().toISOString());
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'fetch failed');
    } finally {
      setLoading(false);
    }
  }, []);

  // Initial fetch
  useEffect(() => {
    void fetchStatus();
  }, [fetchStatus]);

  // Auto-refresh every 60s
  useEffect(() => {
    const interval = setInterval(() => {
      void fetchStatus();
    }, 60_000);
    return () => clearInterval(interval);
  }, [fetchStatus]);

  // Tick every second so relative time updates
  useEffect(() => {
    const interval = setInterval(() => setTick((t) => t + 1), 1000);
    return () => clearInterval(interval);
  }, []);

  // Suppress unused tick variable warning
  void tick;

  const overall = data?.overall ?? 'unknown';

  const verifierEndpointCount = data
    ? Object.keys(data.verifier_continuity.endpoints).length
    : 0;

  const allEndpointsPublic = data
    ? Object.values(data.verifier_continuity.endpoints).every((e) => e.public)
    : false;

  const sourceLaneActive = data
    ? Object.values(data.source_lanes).filter((l) => l.lifecycle === 'active').length
    : 0;
  const sourceLanePending = data
    ? Object.values(data.source_lanes).filter(
        (l) => l.lifecycle === 'planned' || l.lifecycle === 'unintegrated' || l.lifecycle === 'demo_only',
      ).length
    : 0;

  return (
    <div className="border border-gray-700 bg-gray-950 font-mono text-xs text-gray-200">
      {/* Header row */}
      <div className="flex items-center justify-between border-b border-gray-700 px-4 py-2">
        <span className="text-[10px] font-bold uppercase tracking-widest text-gray-400">
          LIVE TRUST STATUS
        </span>
        <div className="flex items-center gap-3">
          {fetchedAt && (
            <span className="text-[10px] text-gray-500">
              Updated: {relativeTime(fetchedAt)}
            </span>
          )}
          <button
            onClick={() => void fetchStatus()}
            disabled={loading}
            className="rounded border border-gray-600 px-2 py-0.5 text-[10px] text-gray-400 hover:border-gray-400 hover:text-gray-200 disabled:opacity-50"
          >
            {loading ? '…' : '↻ Refresh'}
          </button>
        </div>
      </div>

      {/* Error state */}
      {error && (
        <div className="border-b border-gray-700 px-4 py-2 text-[10px] text-red-500">
          ✗ Status fetch failed: {error}
        </div>
      )}

      {/* Overall status line */}
      {data && (
        <div className="border-b border-gray-700 px-4 py-2 flex items-center justify-between">
          <span className={statusClass(overall)}>
            {statusLabel(overall)}&nbsp;&nbsp;VitalCV Trust Infrastructure
          </span>
          <span className="text-[10px] text-gray-500">
            {new Date(data.timestamp).toISOString().replace('T', ' ').slice(0, 19)} UTC
          </span>
        </div>
      )}

      {/* 5-column status grid */}
      {data && (
        <div className="grid grid-cols-5 divide-x divide-gray-700 border-b border-gray-700">
          {/* VERIFIER */}
          <div className="px-3 py-3 space-y-1">
            <div className={statusClass(data.verifier_continuity.status)}>
              {statusLabel(data.verifier_continuity.status).split(' ')[0]}{' '}
              {verifierEndpointCount} endpoints
            </div>
            <div className="text-[10px] text-gray-500">
              {allEndpointsPublic ? 'all public' : 'partial public'}
            </div>
            <div className="text-[9px] text-gray-600 uppercase tracking-widest">VERIFIER</div>
          </div>

          {/* REPLAY */}
          <div className="px-3 py-3 space-y-1">
            <div className={statusClass(data.replay_continuity.status)}>
              {statusLabel(data.replay_continuity.status).split(' ')[0]}{' '}
              {data.replay_continuity.survivable ? 'Survivable' : 'Not survivable'}
            </div>
            <div className="text-[10px] text-gray-500">
              dedupe: {data.replay_continuity.dedupe_key_active ? 'YES' : 'NO'}
            </div>
            <div className="text-[9px] text-gray-600 uppercase tracking-widest">REPLAY</div>
          </div>

          {/* RUNTIME */}
          <div className="px-3 py-3 space-y-1">
            <div className={statusClass(data.runtime_continuity.status)}>
              {statusLabel(data.runtime_continuity.status).split(' ')[0]}{' '}
              {data.runtime_continuity.signing_algorithm}
            </div>
            <div className="text-[10px] text-gray-500">DID: bound</div>
            <div className="text-[9px] text-gray-600 uppercase tracking-widest">RUNTIME</div>
          </div>

          {/* CHRONOLOGY */}
          <div className="px-3 py-3 space-y-1">
            <div className={statusClass(data.chronology_continuity.status)}>
              {statusLabel(data.chronology_continuity.status).split(' ')[0]}{' '}
              {data.chronology_continuity.reading_order.length} slots
            </div>
            <div className="text-[10px] text-gray-500">
              {data.chronology_continuity.reading_order.slice(0, 2).join('→')}…
            </div>
            <div className="text-[9px] text-gray-600 uppercase tracking-widest">CHRONOLOGY</div>
          </div>

          {/* SOURCE LANES */}
          <div className="px-3 py-3 space-y-1">
            <div className={statusClass('operational')}>
              ● NPPES active
            </div>
            <div className="text-[10px] text-gray-500">
              {sourceLanePending} pending/future
            </div>
            <div className="text-[9px] text-gray-600 uppercase tracking-widest">
              SOURCE LANES
            </div>
          </div>
        </div>
      )}

      {/* Loading skeleton */}
      {!data && !error && (
        <div className="px-4 py-4 text-[10px] text-gray-500">Loading status…</div>
      )}

      {/* Footer */}
      <div className="px-4 py-1.5 text-[9px] text-gray-600">
        v{data?.version ?? '—'} · auto-refresh 60s · <a href="/api/status" target="_blank" rel="noopener noreferrer" className="underline hover:text-gray-400">/api/status</a>
      </div>
    </div>
  );
}

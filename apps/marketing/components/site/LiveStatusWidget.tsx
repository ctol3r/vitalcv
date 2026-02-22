'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

type RawStatusResponse = {
  version?: string;
  buildVersion?: string;
  sha?: string;
  gitSha?: string;
  commitHash?: string;
  commit?: string;
  environment?: string;
  env?: string;
  uptime?: number;
  uptimeSeconds?: number;
  uptimeMs?: number;
  git?: {
    sha?: string;
    commit?: string;
  };
};

type DemoStatus = {
  version: string;
  sha: string;
  environment: string;
  uptime: string;
};

const POLL_INTERVAL_MS = 30_000;

const API_BASE = (process.env.NEXT_PUBLIC_API_URL ?? '').replace(/\/$/, '');

function normalizeUptime(input: number | undefined): string {
  if (typeof input !== 'number' || Number.isNaN(input) || input < 0) {
    return 'unknown';
  }

  const totalSeconds = Math.max(0, Math.round(input));
  const days = Math.floor(totalSeconds / 86_400);
  const hours = Math.floor((totalSeconds % 86_400) / 3_600);
  const minutes = Math.floor((totalSeconds % 3_600) / 60);
  const seconds = totalSeconds % 60;

  const parts = [
    days > 0 ? `${days}d` : null,
    `${hours}h`,
    `${minutes}m`,
    `${seconds}s`,
  ];
  return parts.filter(Boolean).join(' ');
}

function deriveStatus(payload: RawStatusResponse): DemoStatus {
  const version = payload.version ?? payload.buildVersion ?? 'unknown';
  const git = payload.git;
  const sha = (
    payload.sha ??
    payload.gitSha ??
    payload.commitHash ??
    payload.commit ??
    git?.sha ??
    git?.commit ??
    'unknown'
  ).slice(0, 16);
  const environment = payload.environment ?? payload.env ?? 'unknown';
  const rawUptime =
    payload.uptimeSeconds ??
    (payload.uptime && payload.uptime > 1_000 ? payload.uptime / 1_000 : payload.uptime) ??
    (payload.uptimeMs ? payload.uptimeMs / 1_000 : undefined);

  return {
    version,
    sha,
    environment,
    uptime: normalizeUptime(rawUptime),
  };
}

export default function LiveStatusWidget() {
  const [status, setStatus] = useState<DemoStatus | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [updatedAt, setUpdatedAt] = useState<string | null>(null);
  const mountedRef = useRef(true);

  const refresh = useCallback(async () => {
    if (!API_BASE) {
      setError('NEXT_PUBLIC_API_URL is not configured');
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const response = await fetch(`${API_BASE}/demo/status`, {
        cache: 'no-store',
      });

      if (!response.ok) {
        throw new Error(`Status endpoint returned ${response.status}`);
      }

      const payload = (await response.json()) as RawStatusResponse;
      const normalized = deriveStatus(payload);
      if (mountedRef.current) {
        setStatus(normalized);
        setUpdatedAt(new Date().toLocaleTimeString());
      }
    } catch (err) {
      if (mountedRef.current) {
        setError(err instanceof Error ? err.message : 'Failed to load status');
      }
    } finally {
      if (mountedRef.current) {
        setLoading(false);
      }
    }
  }, []);

  useEffect(() => {
    mountedRef.current = true;
    void refresh();
    const interval = setInterval(() => {
      void refresh();
    }, POLL_INTERVAL_MS);

    return () => {
      mountedRef.current = false;
      clearInterval(interval);
    };
  }, [refresh]);

  return (
    <section className="border border-border bg-surface p-6 md:p-8">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="text-sm font-semibold text-foreground">Live status</p>
          <p className="text-xs text-muted">
            Data from <code className="rounded border px-1">GET {API_BASE}/demo/status</code>
          </p>
        </div>
        <button
          type="button"
          onClick={() => void refresh()}
          disabled={loading}
          className="rounded-md border border-border px-3.5 py-1.5 text-sm font-medium transition-theme hover:bg-background disabled:opacity-60"
        >
          {loading ? 'Refreshing…' : 'Refresh'}
        </button>
      </div>

      {error && !status ? (
        <p className="mt-4 text-sm text-red-500">
          {error}
        </p>
      ) : (
        <>
          <dl className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <StatusField label="Version" value={status?.version ?? 'loading...'} />
            <StatusField label="Git SHA" value={status?.sha ?? 'loading...'} />
            <StatusField
              label="Environment"
              value={status?.environment ?? 'loading...'}
            />
            <StatusField label="Uptime" value={status?.uptime ?? 'loading...'} />
          </dl>

          {error && (
            <p className="mt-4 text-sm text-muted">
              Showing latest known values. Update failed with: {error}
            </p>
          )}
        </>
      )}

      {updatedAt ? (
        <p className="mt-4 text-xs text-muted">Last updated {updatedAt}</p>
      ) : null}
    </section>
  );
}

function StatusField({ label, value }: { label: string; value: string }) {
  return (
    <div className="border border-border bg-background p-4">
      <dt className="text-xs uppercase tracking-wide text-muted">{label}</dt>
      <dd className="mt-1 text-sm font-semibold text-foreground break-all">
        {value}
      </dd>
    </div>
  );
}

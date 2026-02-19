"use client";

import { useState, useEffect, useCallback } from "react";

interface Metrics {
  totalLookups: number;
  totalShareLinks: number;
  totalViews: number;
  totalExports: number;
  avgTimeToViewMs: number | null;
  avgTimeToViewFormatted: string;
}

export default function MetricsPage() {
  const [authed, setAuthed] = useState(false);
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [metrics, setMetrics] = useState<Metrics | null>(null);
  const [loading, setLoading] = useState(false);

  const fetchMetrics = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/internal/metrics");
      if (res.status === 401) {
        setAuthed(false);
        return;
      }
      const data: Metrics = await res.json();
      setMetrics(data);
      setAuthed(true);
    } catch {
      setError("Failed to load metrics");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchMetrics();
  }, [fetchMetrics]);

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    const res = await fetch("/api/internal/metrics", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password }),
    });

    if (!res.ok) {
      setError("Invalid password");
      return;
    }

    setPassword("");
    setAuthed(true);
    void fetchMetrics();
  }

  if (!authed) {
    return (
      <main className="min-h-screen bg-background flex items-center justify-center">
        <form
          onSubmit={handleLogin}
          className="w-full max-w-sm space-y-4 p-8 border border-border rounded-lg"
        >
          <h1 className="text-lg font-semibold text-foreground">
            Internal Metrics
          </h1>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Dashboard password"
            className="w-full px-3 py-2 border border-border rounded bg-surface text-foreground text-sm"
            autoFocus
          />
          {error && <p className="text-red-500 text-sm">{error}</p>}
          <button
            type="submit"
            className="w-full px-3 py-2 bg-accent text-accent-foreground rounded text-sm font-medium"
          >
            Authenticate
          </button>
        </form>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-background p-8 max-w-3xl mx-auto">
      <div className="flex items-center justify-between mb-8">
        <h1 className="text-xl font-semibold text-foreground">
          VitalCV — Traction Metrics
        </h1>
        <button
          onClick={() => void fetchMetrics()}
          disabled={loading}
          className="px-3 py-1.5 text-sm border border-border rounded text-muted hover:text-foreground transition-theme"
        >
          {loading ? "Loading…" : "Refresh"}
        </button>
      </div>

      {metrics ? (
        <div className="grid grid-cols-2 gap-4">
          <MetricCard label="Total NPIs Searched" value={metrics.totalLookups} />
          <MetricCard
            label="Share Links Created"
            value={metrics.totalShareLinks}
          />
          <MetricCard label="Artifact Views" value={metrics.totalViews} />
          <MetricCard label="Artifact Exports" value={metrics.totalExports} />
          <MetricCard
            label="Avg Time: Share → View"
            value={metrics.avgTimeToViewFormatted}
            className="col-span-2"
          />
        </div>
      ) : (
        <p className="text-muted text-sm">Loading metrics…</p>
      )}
    </main>
  );
}

function MetricCard({
  label,
  value,
  className = "",
}: {
  label: string;
  value: string | number;
  className?: string;
}) {
  return (
    <div
      className={`border border-border rounded-lg p-5 ${className}`}
    >
      <p className="text-sm text-muted mb-1">{label}</p>
      <p className="text-2xl font-semibold text-foreground tabular-nums">
        {typeof value === "number" ? value.toLocaleString() : value}
      </p>
    </div>
  );
}

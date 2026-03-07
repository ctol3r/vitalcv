'use client';

/**
 * AuditBaselinePanel — Wave 122: Audit OS + SIEM Operations
 *
 * Shows baseline-aware anomaly detection summary:
 *   - Monitored windows with rates vs baseline
 *   - Anomaly alerts with severity + sample events
 *   - SIEM export examples
 */

import { useEffect, useState, useCallback } from 'react';
import { RefreshCw, AlertTriangle, CheckCircle, Activity, Download } from 'lucide-react';

interface BaselineWindow {
  category: string;
  windowMinutes: number;
  baselineRate: number;
  currentRate: number;
  multiplier: number;
  anomaly: boolean;
  threshold: number;
}

interface AuditAnomaly {
  anomalyId: string;
  category: string;
  description: string;
  severity: 'INFO' | 'WARNING' | 'CRITICAL' | 'EMERGENCY';
  currentRate: number;
  baselineRate: number;
  multiplier: number;
  windowMinutes: number;
  detectedAt: string;
  sampleEvents: Array<{ eventId: string; time: string; actor: string; resource: string }>;
}

interface BaselineSummary {
  computedAt: string;
  windowsChecked: number;
  anomaliesDetected: number;
  windows: BaselineWindow[];
  anomalies: AuditAnomaly[];
}

const base = () =>
  ((typeof process !== 'undefined'
    ? process.env.NEXT_PUBLIC_API_BASE ?? process.env.NEXT_PUBLIC_BACKEND_URL
    : '') ?? '').replace(/\/$/, '');

const SEVERITY_COLORS: Record<string, string> = {
  CRITICAL: 'text-red-400 bg-red-500/10 border-red-500/20',
  WARNING: 'text-amber-400 bg-amber-500/10 border-amber-500/20',
  INFO: 'text-zinc-400 bg-zinc-800 border-zinc-700',
  EMERGENCY: 'text-red-500 bg-red-500/15 border-red-500/30',
};

export function AuditBaselinePanel({ pollIntervalMs = 60_000 }: { pollIntervalMs?: number }) {
  const [summary, setSummary] = useState<BaselineSummary | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchBaseline = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const r = await fetch(`${base()}/api/audit/baseline`);
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      setSummary(await r.json());
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load baseline');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchBaseline();
    const iv = setInterval(fetchBaseline, pollIntervalMs);
    return () => clearInterval(iv);
  }, [fetchBaseline, pollIntervalMs]);

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-medium text-zinc-200">Audit Baseline & Anomalies</p>
          <p className="text-[10px] text-zinc-600">Rolling window anomaly detection with auto-calibrating baselines</p>
        </div>
        <button onClick={fetchBaseline} className="text-zinc-600 hover:text-zinc-300 transition-colors">
          <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {error && (
        <div className="text-xs text-red-400 rounded-lg bg-red-500/[0.05] border border-red-500/20 p-2">{error}</div>
      )}

      {summary && (
        <>
          {/* Anomaly count */}
          <div className="flex items-center gap-3">
            {summary.anomaliesDetected > 0 ? (
              <div className="flex items-center gap-2 text-amber-400">
                <AlertTriangle className="h-4 w-4" />
                <span className="text-sm font-bold">{summary.anomaliesDetected} anomalies</span>
              </div>
            ) : (
              <div className="flex items-center gap-2 text-emerald-400">
                <CheckCircle className="h-4 w-4" />
                <span className="text-sm font-medium">All baselines normal</span>
              </div>
            )}
            <span className="text-[10px] text-zinc-600">
              {summary.windowsChecked} windows checked · {new Date(summary.computedAt).toLocaleTimeString()}
            </span>
          </div>

          {/* Windows grid */}
          <div className="grid grid-cols-2 gap-2">
            {summary.windows.map((w) => (
              <div
                key={w.category}
                className={`rounded-lg border p-3 ${
                  w.anomaly ? 'border-amber-500/30 bg-amber-500/[0.04]' : 'border-zinc-800 bg-white/[0.01]'
                }`}
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="text-[10px] text-zinc-500 font-mono">{w.category}</span>
                  {w.anomaly && <AlertTriangle className="h-3 w-3 text-amber-400" />}
                </div>
                <div className="flex items-end gap-2">
                  <span className={`text-lg font-bold ${w.anomaly ? 'text-amber-400' : 'text-zinc-300'}`}>
                    {w.currentRate}
                  </span>
                  <span className="text-[10px] text-zinc-600 pb-0.5">
                    / {w.baselineRate} baseline
                  </span>
                </div>
                <div className="flex items-center gap-2 mt-1">
                  <div className="flex-1 h-1 rounded-full bg-zinc-800 overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all ${
                        w.anomaly ? 'bg-amber-500' : w.multiplier > 1 ? 'bg-blue-500' : 'bg-emerald-500'
                      }`}
                      style={{ width: `${Math.min(100, (w.multiplier / w.threshold) * 100)}%` }}
                    />
                  </div>
                  <span className="text-[9px] text-zinc-600">{w.multiplier}x</span>
                </div>
                <p className="text-[9px] text-zinc-700 mt-1">{w.windowMinutes}min window · {w.threshold}x threshold</p>
              </div>
            ))}
          </div>

          {/* Anomaly details */}
          {summary.anomalies.length > 0 && (
            <div className="space-y-2">
              <p className="text-[10px] text-zinc-500 uppercase tracking-wider">Active Anomalies</p>
              {summary.anomalies.map((a) => (
                <div
                  key={a.anomalyId}
                  className={`rounded-xl border p-3 ${SEVERITY_COLORS[a.severity]}`}
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="text-xs font-medium">{a.description}</p>
                      <p className="text-[10px] opacity-70 mt-0.5">
                        {a.currentRate} events in {a.windowMinutes}min ({a.multiplier}x baseline)
                      </p>
                    </div>
                    <span className="text-[9px] font-bold">{a.severity}</span>
                  </div>
                  {a.sampleEvents.length > 0 && (
                    <div className="mt-2 space-y-0.5">
                      {a.sampleEvents.slice(0, 3).map((e) => (
                        <p key={e.eventId} className="text-[9px] font-mono opacity-60">
                          {new Date(e.time).toLocaleTimeString()} · {e.actor} → {e.resource}
                        </p>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* SIEM Export Examples */}
          <div className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-4 space-y-2">
            <p className="text-[10px] text-zinc-500 uppercase tracking-wider flex items-center gap-1.5">
              <Download className="h-3 w-3" />
              SIEM Export
            </p>
            <div className="grid grid-cols-2 gap-2">
              <a
                href={`${base()}/api/audit/stream?since=${new Date(Date.now() - 3600_000).toISOString()}&max=1000`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-[10px] text-center px-3 py-2 rounded-lg border border-zinc-800 hover:border-zinc-600 text-zinc-400 hover:text-zinc-200 transition-colors"
              >
                NDJSON — Last Hour
              </a>
              <a
                href={`${base()}/api/audit/stream?since=${new Date(Date.now() - 86400_000).toISOString()}&max=10000`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-[10px] text-center px-3 py-2 rounded-lg border border-zinc-800 hover:border-zinc-600 text-zinc-400 hover:text-zinc-200 transition-colors"
              >
                NDJSON — Last 24h
              </a>
            </div>
            <p className="text-[9px] text-zinc-700">
              Ingest via: <code className="text-zinc-500">curl {base()}/api/audit/stream | jq</code>
            </p>
          </div>
        </>
      )}
    </div>
  );
}

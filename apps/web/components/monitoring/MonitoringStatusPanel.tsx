'use client';

/**
 * MonitoringStatusPanel — Wave 245: Async Trust Engine
 *
 * Monitoring dashboard panel for Mission Ops sidebar:
 * - NPIs being monitored
 * - Queue depth
 * - Last monitoring cycle time + result summary
 * - Recent state changes (degradations in red)
 */

import { useCallback, useEffect, useState } from 'react';
import { Activity, AlertTriangle, CheckCircle, Clock, Database, RefreshCw, Shield } from 'lucide-react';

// ── Types ─────────────────────────────────────────────────────────────────────

interface Degradation {
  npi: string;
  previousBand: string | null;
  newBand: string;
  capsulesAffected: number;
  processedAt: string;
}

interface MonitoringStatus {
  ok: boolean;
  scheduler: {
    running: boolean;
    cycleInProgress: boolean;
    lastCycleTime: string | null;
  };
  queue: {
    depth: number;
  };
  monitoring: {
    npisMonitored: number;
  };
  lastCycle: {
    npisScanned: number;
    stateChanges: number;
    alerts: number;
    capsulesAffected: number;
    startedAt: string;
    completedAt: string;
    durationMs: number;
    recentDegradations: Degradation[];
  } | null;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatRelative(iso: string | null): string {
  if (!iso) return 'Never';
  const diff = Date.now() - new Date(iso).getTime();
  if (diff < 60_000) return 'Just now';
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m ago`;
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}h ago`;
  return `${Math.floor(diff / 86_400_000)}d ago`;
}

function bandColor(band: string): string {
  switch (band) {
    case 'L3': return 'text-green-400';
    case 'L2': return 'text-blue-400';
    case 'L1': return 'text-yellow-400';
    case 'L0': return 'text-red-400';
    default: return 'text-gray-400';
  }
}

// ── Component ─────────────────────────────────────────────────────────────────

interface MonitoringStatusPanelProps {
  className?: string;
  /** Poll interval in ms, default 30s */
  pollIntervalMs?: number;
}

export default function MonitoringStatusPanel({
  className = '',
  pollIntervalMs = 30_000,
}: MonitoringStatusPanelProps) {
  const [status, setStatus] = useState<MonitoringStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [triggering, setTriggering] = useState(false);

  const fetchStatus = useCallback(async () => {
    try {
      const res = await fetch('/api/trust/monitoring/status');
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = (await res.json()) as MonitoringStatus;
      setStatus(data);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchStatus();
    const interval = setInterval(() => void fetchStatus(), pollIntervalMs);
    return () => clearInterval(interval);
  }, [fetchStatus, pollIntervalMs]);

  const handleTriggerCycle = async () => {
    setTriggering(true);
    try {
      const clerkId = (window as unknown as { Clerk?: { user?: { id?: string } } }).Clerk?.user?.id ?? '';
      const res = await fetch('/api/trust/monitoring/cycle', {
        method: 'POST',
        headers: { 'x-clerk-user-id': clerkId },
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      await fetchStatus();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Cycle failed');
    } finally {
      setTriggering(false);
    }
  };

  return (
    <div
      className={`rounded-xl border border-white/10 bg-white/5 backdrop-blur-sm p-4 flex flex-col gap-3 ${className}`}
      style={{ minWidth: 240 }}
    >
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Shield className="h-4 w-4 text-blue-400" />
          <span className="text-sm font-semibold text-white">Async Trust Monitor</span>
        </div>
        <button
          onClick={() => void fetchStatus()}
          title="Refresh"
          className="p-1 rounded hover:bg-white/10 text-gray-400 hover:text-white transition-colors"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {error && (
        <div className="flex items-center gap-2 text-xs text-red-400 bg-red-900/20 rounded-lg px-3 py-2">
          <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {!status && loading && (
        <div className="text-xs text-gray-500 animate-pulse">Loading status…</div>
      )}

      {status && (
        <>
          {/* Stat row */}
          <div className="grid grid-cols-2 gap-2">
            <StatTile
              icon={<Activity className="h-3.5 w-3.5 text-green-400" />}
              label="NPIs Monitored"
              value={String(status.monitoring.npisMonitored)}
            />
            <StatTile
              icon={<Database className="h-3.5 w-3.5 text-purple-400" />}
              label="Queue Depth"
              value={String(status.queue.depth)}
              highlight={status.queue.depth > 100 ? 'warn' : undefined}
            />
          </div>

          {/* Scheduler status */}
          <div className="flex items-center gap-2 text-xs">
            {status.scheduler.running ? (
              <CheckCircle className="h-3.5 w-3.5 text-green-400 shrink-0" />
            ) : (
              <AlertTriangle className="h-3.5 w-3.5 text-yellow-400 shrink-0" />
            )}
            <span className="text-gray-400">
              Scheduler:{' '}
              <span className={status.scheduler.running ? 'text-green-400' : 'text-yellow-400'}>
                {status.scheduler.running ? 'Active (6h)' : 'Inactive'}
              </span>
            </span>
            {status.scheduler.cycleInProgress && (
              <span className="ml-auto text-blue-400 animate-pulse">Running…</span>
            )}
          </div>

          {/* Last cycle */}
          {status.lastCycle ? (
            <div className="rounded-lg bg-white/5 px-3 py-2 flex flex-col gap-1.5">
              <div className="flex items-center justify-between text-xs text-gray-400">
                <div className="flex items-center gap-1.5">
                  <Clock className="h-3.5 w-3.5" />
                  <span>Last cycle</span>
                </div>
                <span className="text-gray-300">{formatRelative(status.lastCycle.completedAt)}</span>
              </div>
              <div className="flex gap-3 text-xs">
                <span className="text-gray-400">
                  <span className="text-white font-medium">{status.lastCycle.npisScanned}</span> scanned
                </span>
                <span className="text-gray-400">
                  <span className={status.lastCycle.stateChanges > 0 ? 'text-yellow-400 font-medium' : 'text-white font-medium'}>
                    {status.lastCycle.stateChanges}
                  </span>{' '}
                  changes
                </span>
                <span className="text-gray-400">
                  <span className={status.lastCycle.alerts > 0 ? 'text-red-400 font-medium' : 'text-white font-medium'}>
                    {status.lastCycle.alerts}
                  </span>{' '}
                  alerts
                </span>
              </div>

              {/* Recent degradations */}
              {status.lastCycle.recentDegradations.length > 0 && (
                <div className="mt-1 flex flex-col gap-1">
                  <span className="text-[10px] text-gray-500 uppercase tracking-wider">Recent Degradations</span>
                  {status.lastCycle.recentDegradations.slice(0, 5).map((d) => (
                    <div
                      key={`${d.npi}-${d.processedAt}`}
                      className="flex items-center justify-between text-xs bg-red-900/20 border border-red-900/30 rounded-md px-2 py-1"
                    >
                      <span className="text-gray-300 font-mono text-[10px]">
                        {d.npi.slice(0, 6)}••••
                      </span>
                      <span className="flex items-center gap-1">
                        <span className={`font-medium ${bandColor(d.previousBand ?? 'L0')}`}>
                          {d.previousBand ?? '?'}
                        </span>
                        <span className="text-gray-500">→</span>
                        <span className={`font-medium ${bandColor(d.newBand)}`}>{d.newBand}</span>
                      </span>
                      {d.capsulesAffected > 0 && (
                        <span className="text-red-400 text-[10px]">{d.capsulesAffected} ⚠</span>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          ) : (
            <div className="text-xs text-gray-500 italic">No cycle run yet.</div>
          )}

          {/* Manual trigger */}
          <button
            onClick={() => void handleTriggerCycle()}
            disabled={triggering || status.scheduler.cycleInProgress}
            className="mt-1 w-full rounded-lg bg-blue-600/20 border border-blue-600/30 text-blue-300 text-xs font-medium px-3 py-1.5 hover:bg-blue-600/30 transition-colors disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            <RefreshCw className={`h-3 w-3 ${triggering ? 'animate-spin' : ''}`} />
            {triggering ? 'Running…' : 'Trigger Cycle'}
          </button>
        </>
      )}
    </div>
  );
}

// ── Sub-components ────────────────────────────────────────────────────────────

function StatTile({
  icon,
  label,
  value,
  highlight,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  highlight?: 'warn' | 'ok';
}) {
  return (
    <div className="rounded-lg bg-white/5 px-3 py-2 flex flex-col gap-1">
      <div className="flex items-center gap-1.5 text-gray-400">
        {icon}
        <span className="text-[10px] uppercase tracking-wider">{label}</span>
      </div>
      <span
        className={`text-lg font-bold leading-none ${
          highlight === 'warn' ? 'text-yellow-400' : 'text-white'
        }`}
      >
        {value}
      </span>
    </div>
  );
}
